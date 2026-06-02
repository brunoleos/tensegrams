// Obstacle-aware edge routing — shared post-processor.
//
// Runs in the pipeline after `router.route()`, before `clip-anchors`.
// The three routers stay naive (centre-to-centre); the detour logic
// lives here, once, for all of them — same rationale as clip-anchors.
//
// Two detour sources:
//   - live: the adapter already solved waypoint positions via forces
//     (`session.edgeWaypoints`). We splice them into the polyline.
//   - custom/off: no force sim — we run A* over a Hanan grid built from
//     the obstacle rects (deterministic, naturally orthogonal).
//
// One pathfinder, three looks (re-shape by router kind):
//   straight   → detour polyline as-is
//   orthogonal → axis-aligned (A* output already is; waypoint splices
//                get Manhattanised)
//   curved     → `kind:'curve'` preserved; renderer splines the polyline.

import { clipToRect } from './router.js';
import { enforcePerpendicularLegs, simplifyStairsAndExcursions } from './anchor-utils.js';

// Sub-pixel A* turn penalty — see hananRoute.
const TURN_PENALTY = 0.5;

export function applyObstacleRouting(ir, routedEdges, rects, resolver, opts = {}) {
  if (!routedEdges || routedEdges.size === 0) return routedEdges;
  if (!resolver || resolver.edgesWithObstacles.size === 0) return routedEdges;

  const nodePad = opts.nodePad ?? 12;
  const edgePad = opts.edgePad ?? 8;
  const orthogonal = !!opts.orthogonal;
  const waypointsByEdge = opts.edgeWaypoints || null;

  const out = new Map();
  for (const edge of ir.edges) {
    const re = routedEdges.get(edge.id);
    if (!re) continue;
    if (!resolver.edgesWithObstacles.has(edge.id)) { out.set(edge.id, re); continue; }

    let path = null;
    const wps = waypointsByEdge?.get(edge.id);
    if (wps && wps.length) {
      // Live: the force sim already solved the waypoint — just splice it.
      path = spliceWaypoints(edge, re, wps, rects);
    } else {
      // Static layouts: pathfind only when an obstacle actually crosses
      // the straight anchor-to-anchor segment. A node that merely shares
      // a collision label but sits off the path must not force a detour.
      const obstacles = collectEdgeObstacles(edge, ir, rects, resolver, nodePad, edgePad, out);
      if (obstacles.some(o => segmentHitsRect(re.sourceAnchor, re.targetAnchor, o))) {
        path = hananRoute(re.sourceAnchor, re.targetAnchor, obstacles);
      }
    }

    const sRect = rects.get(edge.source);
    const tRect = rects.get(edge.target);
    out.set(edge.id, path ? reshape(re, path, orthogonal, sRect, tRect) : re);
  }
  return out;
}

// Node rects this edge must avoid, plus already-routed colliding edges
// (their segments become thin obstacle rects). `routedSoFar` is the
// output map being built — edges earlier in declaration order win.
// Exported so the live adapter pode reusar a mesma definição de
// "obstáculo da aresta" para semear waypoints via hananRoute.
export function collectEdgeObstacles(edge, ir, rects, resolver, nodePad, edgePad, routedSoFar) {
  const obs = [];
  for (const n of ir.nodes) {
    if (!resolver.edgeNodePair(edge, n.id)) continue;
    const r = rects.get(n.id);
    if (r) obs.push(expandRect(r, nodePad));
  }
  if (routedSoFar) {
    for (const other of ir.edges) {
      if (other.id === edge.id) continue;
      if (!resolver.edgeEdgePair(edge, other)) continue;
      const ore = routedSoFar.get(other.id);
      if (!ore || !ore.points) continue;
      for (let i = 0; i + 1 < ore.points.length; i++) {
        obs.push(segmentRect(ore.points[i], ore.points[i + 1], edgePad));
      }
    }
  }
  return obs;
}

// Live path: anchors re-clipped to face the nearest waypoint.
function spliceWaypoints(edge, re, wps, rects) {
  const sRect = rects.get(edge.source);
  const tRect = rects.get(edge.target);
  const first = wps[0], last = wps[wps.length - 1];
  const sAnchor = sRect ? clipToRect(sRect, first.x, first.y) : re.sourceAnchor;
  const tAnchor = tRect ? clipToRect(tRect, last.x, last.y) : re.targetAnchor;
  return [sAnchor, ...wps.map(w => ({ x: w.x, y: w.y })), tAnchor];
}

function reshape(re, path, orthogonal, sRect, tRect) {
  // Curved router: the detour polyline becomes a smooth spline. `spline`
  // (not `curve`) tells the renderer to thread every point, not treat
  // them as 4 Bezier control points.
  if (re.kind === 'curve') {
    const pts = simplifyCollinear(path);
    // No real detour — the waypoint stayed on the straight line. Keep
    // the router's original Bezier instead of collapsing to a line.
    if (!pts || pts.length < 3) return re;
    return { ...re, kind: 'spline', points: pts,
             sourceAnchor: pts[0], targetAnchor: pts[pts.length - 1] };
  }
  // For orthogonal, manhattanize guarantees axis-aligned segments, but
  // the leg LEAVING an anchor can still be tangent to the face (e.g.,
  // horizontal first segment from a SOUTH-face anchor). Enforce
  // perpendicularity to face explicitly, then simplify.
  let shaped = orthogonal ? manhattanize(path) : path;
  if (orthogonal) shaped = enforcePerpendicularLegs(shaped, re.kind, sRect, tRect);
  let pts = simplifyCollinear(shaped);
  pts = simplifyStairsAndExcursions(pts, re.kind);
  pts = simplifyCollinear(pts);
  return { ...re, points: pts, sourceAnchor: pts[0], targetAnchor: pts[pts.length - 1] };
}

// ---- Hanan-grid A* ---------------------------------------------------

// Routes S→T orthogonally around `obstacles` (axis-aligned rects). The
// grid is the cartesian product of every obstacle edge coordinate plus
// the endpoints — provably contains an optimal orthogonal path if one
// exists. Returns a polyline, or null when no path is found (caller
// keeps the original route).
export function hananRoute(S, T, obstacles) {
  if (!obstacles.length) return null;
  const xs = uniqSorted([S.x, T.x, ...obstacles.flatMap(o => [o.x, o.x + o.width])]);
  const ys = uniqSorted([S.y, T.y, ...obstacles.flatMap(o => [o.y, o.y + o.height])]);
  const nx = xs.length, ny = ys.length;
  const xi = xs.indexOf(S.x), yi = ys.indexOf(S.y);
  const xg = xs.indexOf(T.x), yg = ys.indexOf(T.y);
  if (xi < 0 || yi < 0 || xg < 0 || yg < 0) return null;

  const passable = (ax, ay, bx, by) => {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    for (const o of obstacles) {
      if (mx > o.x && mx < o.x + o.width && my > o.y && my < o.y + o.height) return false;
    }
    return true;
  };

  const V = nx * ny;
  const start = yi * nx + xi;
  const goal = yg * nx + xg;
  const g = new Float64Array(V).fill(Infinity);
  const prev = new Int32Array(V).fill(-1);
  const closed = new Uint8Array(V);
  const h = (u) => Math.abs(xs[u % nx] - T.x) + Math.abs(ys[(u / nx) | 0] - T.y);

  g[start] = 0;
  const heap = new MinHeap();
  heap.push(h(start), start);
  while (heap.size) {
    const u = heap.pop();
    if (u === goal) break;
    if (closed[u]) continue;
    closed[u] = 1;
    const ux = u % nx, uy = (u / nx) | 0;
    // Direction we entered u with (-1 when u is the start node).
    const inDir = prev[u] === -1 ? -1 : dirOf(prev[u], u, nx);
    for (let d = 0; d < 4; d++) {
      const vx = ux + (d === 0 ? 1 : d === 1 ? -1 : 0);
      const vy = uy + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (vx < 0 || vx >= nx || vy < 0 || vy >= ny) continue;
      const v = vy * nx + vx;
      if (closed[v]) continue;
      if (!passable(xs[ux], ys[uy], xs[vx], ys[vy])) continue;
      // Sub-pixel turn penalty: among equal-length paths it favours the
      // one with fewer bends, never large enough to make a longer win.
      const turn = inDir !== -1 && inDir !== d ? TURN_PENALTY : 0;
      const ng = g[u] + Math.abs(xs[vx] - xs[ux]) + Math.abs(ys[vy] - ys[uy]) + turn;
      if (ng < g[v]) {
        g[v] = ng;
        prev[v] = u;
        heap.push(ng + h(v), v);
      }
    }
  }
  if (g[goal] === Infinity) return null;

  const path = [];
  for (let c = goal; c !== -1; c = prev[c]) {
    path.push({ x: xs[c % nx], y: ys[(c / nx) | 0] });
  }
  path.reverse();
  return simplifyCollinear(path);
}

// ---- geometry helpers ------------------------------------------------

function expandRect(r, pad) {
  return { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

function segmentRect(a, b, pad) {
  const x = Math.min(a.x, b.x) - pad;
  const y = Math.min(a.y, b.y) - pad;
  return {
    x, y,
    width: Math.abs(a.x - b.x) + pad * 2,
    height: Math.abs(a.y - b.y) + pad * 2,
  };
}

function uniqSorted(arr) {
  const s = Array.from(new Set(arr)).sort((a, b) => a - b);
  return s;
}

// Liang–Barsky: true when segment s→e intersects the axis-aligned rect r.
// Used to decide whether a straight edge actually needs a detour.
// Exported so the live adapter pode reusar.
export function segmentHitsRect(s, e, r) {
  const dx = e.x - s.x, dy = e.y - s.y;
  const p = [-dx, dx, -dy, dy];
  const q = [s.x - r.x, (r.x + r.width) - s.x, s.y - r.y, (r.y + r.height) - s.y];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;  // parallel to this slab and outside it
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else          { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

// Grid step direction (0:+x 1:-x 2:+y 3:-y) from node a to adjacent node b.
function dirOf(a, b, nx) {
  const ax = a % nx, ay = (a / nx) | 0;
  const bx = b % nx, by = (b / nx) | 0;
  if (bx > ax) return 0;
  if (bx < ax) return 1;
  if (by > ay) return 2;
  return 3;
}

// Drop interior points that lie on the straight line between neighbours.
function simplifyCollinear(points) {
  if (!points || points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p = out[out.length - 1], q = points[i], r = points[i + 1];
    const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (Math.abs(cross) > 1e-6) out.push(q);
  }
  out.push(points[points.length - 1]);
  return out;
}

// Insert elbow points so every segment of an arbitrary polyline becomes
// axis-aligned (horizontal-first). Used for the live waypoint splice
// under the orthogonal router.
function manhattanize(points) {
  if (!points || points.length < 2) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = out[out.length - 1], q = points[i];
    if (Math.abs(p.x - q.x) > 1e-6 && Math.abs(p.y - q.y) > 1e-6) {
      out.push({ x: q.x, y: p.y });
    }
    out.push(q);
  }
  return out;
}

// ---- binary min-heap -------------------------------------------------

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.v.length; }
  push(key, value) {
    const { k, v } = this;
    k.push(key); v.push(value);
    let i = v.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      swap(k, p, i); swap(v, p, i);
      i = p;
    }
  }
  pop() {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (v.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < v.length && k[l] < k[m]) m = l;
        if (r < v.length && k[r] < k[m]) m = r;
        if (m === i) break;
        swap(k, m, i); swap(v, m, i);
        i = m;
      }
    }
    return top;
  }
}

function swap(arr, i, j) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
