// Edge waypoints for the live force sim — HYBRID A* + physics.
//
// Cada aresta com layer de colisão ganha uma `WaypointStrip` de N
// waypoints, onde N é determinado por A* (`hananRoute`) sobre os
// obstáculos detectados. O A* corre uma vez por chave-de-sementeira
// estável (anchors + obstáculos quantizados a 4px); cada vértice
// interno da polilinha A* vira uma semente posicional. Em cada tick,
// physics aplica:
//
//   1. Seed spring     — pull de cada waypoint para sua semente A* (sx,sy)
//   2. Midline spring  — pull fraco para a corda source→target
//   3. Chain spring    — mola axial com rest length entre waypoints
//                        consecutivos da mesma strip (anti-self-crossing)
//   4. Node repel      — penetração contra cada rect de nó obstáculo
//                        (linear-diff weight via edgeNodePair); impulso
//                        em velocidade, com contra-push no nó
//   5. Inter-strip     — repulsão entre waypoints de arestas diferentes
//                        (edgeEdgePair)
//   6. Label collision — rects dos labels de OUTRAS arestas (edgeEdgePair)
//
// Integrador: damping + position += velocity (igual node-node).
//
// `count === 0` num strip significa "linha direta livre" — sem waypoints,
// obstacle-route splica nada e o renderer pinta source→target em linha
// reta.

import { computeContainerRects } from './container-geometry.js';
import { hananRoute, segmentHitsRect, collectEdgeObstacles } from '../../../routing/obstacle-route.js';
import { midPoint } from '../../../routing/geometry.js';

export function createWaypointState(ir, resolver) {
  const edges = ir.edges.filter(e => resolver.edgesWithObstacles.has(e.id));
  return {
    edges,
    collidableNodes: ir.nodes.filter(node => node.nodeCollision && node.nodeCollision.size),
    strips: new Map(),     // edgeId → WaypointStrip
    ir,                    // referência pra reseed (collectEdgeObstacles precisa)
    resolver,
    seeded: false,         // mantido para compat externa (commitWaypoints checa)
  };
}

function makeStrip(edgeId, seedKey, count) {
  return {
    edgeId,
    seedKey,
    count,
    wpx: new Float64Array(count),
    wpy: new Float64Array(count),
    wvx: new Float64Array(count),
    wvy: new Float64Array(count),
    sx:  new Float64Array(count),
    sy:  new Float64Array(count),
  };
}

// Fingerprint estável de (anchors + obstáculos), quantizado a 4px para
// evitar reseed por drift sub-pixel.
function seedKeyOf(S, T, obstacles) {
  const q = (n) => Math.round(n / 4) * 4;
  const parts = [q(S.x), q(S.y), q(T.x), q(T.y)];
  const sorted = obstacles.slice().sort((a, b) =>
    a.x - b.x || a.y - b.y || a.width - b.width || a.height - b.height);
  for (const o of sorted) {
    parts.push(q(o.x), q(o.y), q(o.width), q(o.height));
  }
  return parts.join('|');
}

export function stepWaypoints(wp, eng, resolver, cfg, alpha) {
  if (!wp.edges.length) return;
  const { idToIndex, px, py, leaves } = eng;
  const rects = computeContainerRects(eng);
  const k = cfg.collisionK;

  // rects unificado: leaves + containers (para collectEdgeObstacles + nodeRect).
  const rectOf = (id) => {
    const i = idToIndex.get(id);
    if (i !== undefined) {
      const node = leaves[i];
      if (node.hasChildren) return rects.get(id) || null;
      return { x: px[i] - node.width / 2, y: py[i] - node.height / 2,
               width: node.width, height: node.height };
    }
    return rects.get(id) || null;
  };
  const allRects = new Map();
  for (let i = 0; i < leaves.length; i++) {
    const n = leaves[i];
    if (n.hasChildren) continue;
    allRects.set(n.id, rectOf(n.id));
  }
  for (const [id, r] of rects) allRects.set(id, r);

  const center = (id) => {
    const i = idToIndex.get(id);
    if (i !== undefined) return { x: px[i], y: py[i] };
    const r = rects.get(id);
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  };

  // --- Seed / reseed phase ---------------------------------------------
  // Roda cheap em cada tick; A* só executa quando a chave muda.
  const maxCount = cfg.maxWaypointsPerEdge ?? 4;
  const pad = cfg.collisionPadding;
  // B11 — passa a corda reta [S, T] de cada aresta como `routedSoFar`
  // pra collectEdgeObstacles. A* vê arestas com edgeEdgePair como
  // segmentRect padded → desvia → count>0 → inter-strip repulsion atua.
  // Ver buildPrevRoutedFromStrips para a justificativa de usar a CORDA
  // RETA em vez da polilinha atual.
  const prevRouted = buildPrevRoutedFromStrips(wp, center);
  for (const edge of wp.edges) {
    const S = center(edge.source), T = center(edge.target);
    if (!S || !T) continue;
    const obstacles = collectEdgeObstacles(edge, wp.ir, allRects, resolver, pad, pad, prevRouted);
    const key = seedKeyOf(S, T, obstacles);
    const strip = wp.strips.get(edge.id);
    if (strip && strip.seedKey === key) continue;

    // Reseed.
    if (!obstacles.some(o => segmentHitsRect(S, T, o))) {
      wp.strips.set(edge.id, makeStrip(edge.id, key, 0));
      continue;
    }
    const path = hananRoute(S, T, obstacles);
    if (!path || path.length <= 2) {
      wp.strips.set(edge.id, makeStrip(edge.id, key, 0));
      continue;
    }
    // B7 guard — A* doesn't exclude source/target from the grid (only
    // from the obstacle list), so interior vertices CAN fall inside the
    // own endpoints. Filter them out; if everything gets dropped, fall
    // back to a 0-count strip (straight line + physics-only separation).
    const sRect = rectOf(edge.source);
    const tRect = rectOf(edge.target);
    const interior = path.slice(1, -1).filter(p =>
      !(sRect && pointStrictlyInRect(p, sRect)) &&
      !(tRect && pointStrictlyInRect(p, tRect))
    );
    if (interior.length === 0) {
      wp.strips.set(edge.id, makeStrip(edge.id, key, 0));
      continue;
    }
    const count = Math.min(interior.length, maxCount);
    const sampled = sampleEvenly(interior, count);
    const fresh = makeStrip(edge.id, key, count);
    for (let j = 0; j < count; j++) {
      fresh.sx[j]  = sampled[j].x;
      fresh.sy[j]  = sampled[j].y;
      fresh.wpx[j] = sampled[j].x;
      fresh.wpy[j] = sampled[j].y;
    }
    wp.strips.set(edge.id, fresh);
  }

  // --- Force loop -------------------------------------------------------
  const seedSpring  = cfg.waypointSeedSpring  ?? 0.15;
  const midSpring   = (cfg.waypointSpring ?? 0.08) * 0.3;
  const chainSpring = cfg.waypointChainSpring ?? 0.04;

  // Per-strip: springs + node repel.
  for (const edge of wp.edges) {
    const strip = wp.strips.get(edge.id);
    if (!strip || strip.count === 0) continue;
    const S = center(edge.source), T = center(edge.target);
    if (!S || !T) continue;
    const c = strip.count;
    for (let j = 0; j < c; j++) {
      // Seed spring.
      strip.wvx[j] += (strip.sx[j] - strip.wpx[j]) * seedSpring * alpha;
      strip.wvy[j] += (strip.sy[j] - strip.wpy[j]) * seedSpring * alpha;
      // Midline spring (fraco, mantém a aresta tensa quando obstáculos
      // somem mas o seed antigo ainda é pendurado pela seedKey).
      const t = (j + 1) / (c + 1);
      const mx = S.x * (1 - t) + T.x * t;
      const my = S.y * (1 - t) + T.y * t;
      strip.wvx[j] += (mx - strip.wpx[j]) * midSpring * alpha;
      strip.wvy[j] += (my - strip.wpy[j]) * midSpring * alpha;
    }
    // Chain spring com rest length (anti-self-crossing).
    for (let j = 0; j + 1 < c; j++) {
      const restLen = Math.hypot(strip.sx[j+1] - strip.sx[j], strip.sy[j+1] - strip.sy[j]);
      const dx = strip.wpx[j+1] - strip.wpx[j];
      const dy = strip.wpy[j+1] - strip.wpy[j];
      const curLen = Math.hypot(dx, dy);
      if (curLen < 1e-6) continue;
      const stretch = curLen - restLen;
      const ux = dx / curLen, uy = dy / curLen;
      const f = stretch * chainSpring * alpha;
      strip.wvx[j]   += ux * f;
      strip.wvy[j]   += uy * f;
      strip.wvx[j+1] -= ux * f;
      strip.wvy[j+1] -= uy * f;
    }
    // Node repel: cada waypoint vs cada nó colidível. APENAS o waypoint
    // se move — nós são intocáveis pelo roteamento (o usuário arrasta;
    // arestas seguem). `pair.frac.node` é ignorado nesta interação;
    // pair.frac.edge controla a magnitude do desvio do waypoint.
    for (const node of wp.collidableNodes) {
      const pair = resolver.edgeNodePair(edge, node.id);
      if (!pair) continue;
      const r = rectOf(node.id);
      if (!r) continue;
      for (let j = 0; j < c; j++) {
        const pen = penetration(strip.wpx[j], strip.wpy[j], r, cfg.collisionPadding);
        if (!pen) continue;
        strip.wvx[j] += pen.x * pair.frac.edge * k;
        strip.wvy[j] += pen.y * pair.frac.edge * k;
      }
    }
  }

  // Inter-strip waypoint-waypoint repulsion.
  const min = cfg.collisionPadding * 2;
  for (let a = 0; a < wp.edges.length; a++) {
    const sA = wp.strips.get(wp.edges[a].id);
    if (!sA || sA.count === 0) continue;
    for (let b = a + 1; b < wp.edges.length; b++) {
      const sB = wp.strips.get(wp.edges[b].id);
      if (!sB || sB.count === 0) continue;
      const pair = resolver.edgeEdgePair(wp.edges[a], wp.edges[b]);
      if (!pair) continue;
      for (let i = 0; i < sA.count; i++) {
        for (let j = 0; j < sB.count; j++) {
          const dx = sB.wpx[j] - sA.wpx[i];
          const dy = sB.wpy[j] - sA.wpy[i];
          // Quick reject antes do sqrt.
          if (Math.abs(dx) + Math.abs(dy) > 4 * cfg.collisionPadding) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const push = (min - d);
          const ux = dx / d, uy = dy / d;
          sA.wvx[i] -= ux * push * pair.frac.a * k;
          sA.wvy[i] -= uy * push * pair.frac.a * k;
          sB.wvx[j] += ux * push * pair.frac.b * k;
          sB.wvy[j] += uy * push * pair.frac.b * k;
        }
      }
    }
  }

  // Edge labels as obstacles — UNIVERSAL (B1+B2). Labels don't need
  // shared edgeLayers to interact: any visual element that overlaps
  // another is a regression we want to nudge apart. Two interactions:
  //
  //   B1 — label vs WAYPOINT of another edge (no edgeEdgePair gate)
  //        Pushes the waypoint perpendicular out of the label rect.
  //        Edges without waypoints (count=0) can't react — known
  //        limitation; renderer-side label positioning would address it.
  //
  //   B2 — label vs NODE (excluding endpoints + ancestors of the label
  //        owner edge). The label has no independent position (it rides
  //        the edge midpoint), so we push the NODE away; the label's
  //        derived position catches up next frame.
  //
  // Iterates ir.edges (not wp.edges) — labels exist on every edge
  // with measured dimensions, not just collision-carrying ones.
  const labels = eng.labelBBoxes;
  if (labels && labels.size && cfg.labelCollision !== false) {
    const labelPad = cfg.labelPad ?? 6;
    const labelFrac = cfg.labelCollisionFraction ?? 0.5;
    const labelRects = new Map();
    for (const labelEdge of wp.ir.edges) {
      const dim = labels.get(labelEdge.id);
      if (!dim || !dim.width || !dim.height) continue;
      const S = center(labelEdge.source), T = center(labelEdge.target);
      if (!S || !T) continue;
      // Renderer pinta o <text> em midPoint(re.points) — replicar AQUI
      // pra colisão atuar sobre o mesmo retângulo que o usuário vê.
      // Polilinha é reconstituída como [S, ...wps, T]; ausência de
      // strip ou count=0 cai no midpoint dos centros (mesmo resultado
      // que o renderer terá quando re.points = [S, T]).
      const strip = wp.strips.get(labelEdge.id);
      let mid;
      if (strip && strip.count > 0) {
        const pts = [S];
        for (let j = 0; j < strip.count; j++) {
          pts.push({ x: strip.wpx[j], y: strip.wpy[j] });
        }
        pts.push(T);
        mid = midPoint(pts);
      } else {
        mid = { x: (S.x + T.x) / 2, y: (S.y + T.y) / 2 };
      }
      labelRects.set(labelEdge.id, {
        edge: labelEdge,
        rect: { x: mid.x - dim.width / 2, y: mid.y - dim.height / 2,
                width: dim.width, height: dim.height },
      });
    }
    for (const { edge: labelEdge, rect: labelRect } of labelRects.values()) {
      // B1: label vs other edges' waypoints.
      for (const otherEdge of wp.edges) {
        if (otherEdge.id === labelEdge.id) continue;
        const strip = wp.strips.get(otherEdge.id);
        if (!strip || strip.count === 0) continue;
        for (let j = 0; j < strip.count; j++) {
          const pen = penetration(strip.wpx[j], strip.wpy[j], labelRect, labelPad);
          if (!pen) continue;
          strip.wvx[j] += pen.x * labelFrac * k;
          strip.wvy[j] += pen.y * labelFrac * k;
        }
      }
      // B2 desativado: empurrava nós quando o label os cobria. Política
      // atual — nós nunca recebem impulso de arestas/labels. Labels
      // ficam onde o renderer pinta (midpoint da polilinha); se sobrepõem
      // um nó alheio, a separação tem que vir do roteamento da aresta
      // ou de reposicionamento do label, nunca de mover o nó.
    }
  }

  // Integração: damping + position += velocity.
  for (const strip of wp.strips.values()) {
    for (let j = 0; j < strip.count; j++) {
      strip.wvx[j] *= cfg.damping;
      strip.wvy[j] *= cfg.damping;
      strip.wpx[j] += strip.wvx[j];
      strip.wpy[j] += strip.wvy[j];
    }
  }
  wp.seeded = true;
}

export function commitWaypoints(wp) {
  const out = new Map();
  for (const [edgeId, strip] of wp.strips) {
    if (strip.count === 0) {
      out.set(edgeId, []);
      continue;
    }
    const pts = new Array(strip.count);
    for (let j = 0; j < strip.count; j++) {
      pts[j] = { x: strip.wpx[j], y: strip.wpy[j] };
    }
    out.set(edgeId, pts);
  }
  return out;
}

// Out-of-rect vector for a point inside `rect` expanded by `pad` — the
// shortest axis-aligned escape. null when the point is already outside.
function penetration(x, y, r, pad) {
  const left = r.x - pad, right = r.x + r.width + pad;
  const top = r.y - pad, bottom = r.y + r.height + pad;
  if (x <= left || x >= right || y <= top || y >= bottom) return null;
  const dl = x - left, dr = right - x, dt = y - top, db = bottom - y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: -dl, y: 0 };
  if (m === dr) return { x: dr, y: 0 };
  if (m === dt) return { x: 0, y: -dt };
  return { x: 0, y: db };
}

// Builds a STRAIGHT polilinha [S, T] for every edge — intentionally
// IGNORES the current strip waypoints. Used by the seed phase to feed
// `routedSoFar` into collectEdgeObstacles (B11).
//
// Why straight (not current polilinha): if we used the routed polilinha,
// each tick adds more segments as obstacles, and after a few ticks A*
// runs out of passable grid → returns null → count=0 → cycle restarts.
// Treating every edge as its IDEAL straight chord gives a stable,
// monotonic obstacle set: detours fire once and persist (the obstacle
// doesn't move), without the obstacle list growing unbounded.
//
// Edges with no usable center (missing rect) are skipped.
function buildPrevRoutedFromStrips(wp, centerFn) {
  const out = new Map();
  for (const edge of wp.edges) {
    const S = centerFn(edge.source);
    const T = centerFn(edge.target);
    if (!S || !T) continue;
    out.set(edge.id, { points: [S, T] });
  }
  return out;
}

// Strict containment — used by B7 guard to drop A* interior vertices
// that fall inside the edge's own source/target. The endpoints themselves
// sit on the perimeter and pass through; only INNER pixels count.
function pointStrictlyInRect(p, r) {
  const eps = 1e-3;
  return p.x > r.x + eps && p.x < r.x + r.width - eps
      && p.y > r.y + eps && p.y < r.y + r.height - eps;
}

// Amostra `count` pontos uniformemente espaçados ao longo da lista
// `points` (mantém o primeiro e o último, e amostra os intermediários).
function sampleEvenly(points, count) {
  if (count >= points.length) return points;
  const out = new Array(count);
  for (let j = 0; j < count; j++) {
    const idx = Math.round(j * (points.length - 1) / Math.max(count - 1, 1));
    out[j] = points[idx];
  }
  return out;
}
