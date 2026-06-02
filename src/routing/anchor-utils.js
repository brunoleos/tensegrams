// Shared helpers for anchor post-processors (clip-anchors and
// snap-container-anchors). Both reposition endpoints of a routed
// polyline; both need to preserve orthogonality of the adjacent
// segment when the polyline has waypoints (Manhattan routers).

// Detects which face of `rect` the point `p` lies on (closest face
// by axis-aligned distance). Used after a projection to decide
// whether the perpendicular neighbour must align in x or y.
export function faceOf(p, rect) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const dL = Math.abs(p.x - rect.x);
  const dR = Math.abs(p.x - right);
  const dT = Math.abs(p.y - rect.y);
  const dB = Math.abs(p.y - bottom);
  const min = Math.min(dL, dR, dT, dB);
  if (min === dL) return 'west';
  if (min === dR) return 'east';
  if (min === dT) return 'north';
  return 'south';
}

// Projects `point` onto the perimeter of `rect`. Used as a HARD constraint
// for endpoint anchors in the physics solver — endpoint must stay on the
// node's perimeter (the "rail" the anchor slides along).
//
// Strategy: snap (x, y) to the closest face by axis-aligned distance,
// then clamp the tangential coord into the face span. When the point is
// already INSIDE the rect, picks the closest face (by side distance) and
// snaps to it — never returns an interior point.
//
// Pluggable per-shape (rect today; circle/polygon when shapes-aware
// physics lands). Default fallback is the rect bbox of any non-rect shape.
export function projectToPerimeter(rect, point) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const dL = Math.abs(point.x - rect.x);
  const dR = Math.abs(point.x - right);
  const dT = Math.abs(point.y - rect.y);
  const dB = Math.abs(point.y - bottom);
  const min = Math.min(dL, dR, dT, dB);
  // Clamp to face span; ties broken by min comparison order (W, E, N, S).
  if (min === dL) {
    return { x: rect.x, y: clamp(point.y, rect.y, bottom) };
  }
  if (min === dR) {
    return { x: right, y: clamp(point.y, rect.y, bottom) };
  }
  if (min === dT) {
    return { x: clamp(point.x, rect.x, right), y: rect.y };
  }
  return { x: clamp(point.x, rect.x, right), y: bottom };
}

// Intersects the ray from `from` through `toward` with the perimeter of
// `rect`. Used by warm-start to place the endpoint anchor at the point
// where the line connecting the two node centers crosses the node's
// own perimeter. When the ray fails to hit (because `toward` sits inside
// the rect, or numerical edge case), falls back to `projectToPerimeter`
// for graceful degradation.
export function intersectRayWithPerimeter(rect, from, toward) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (dx === 0 && dy === 0) return projectToPerimeter(rect, from);
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  let bestT = Infinity;
  let bestHit = null;
  // West / east faces (vertical lines x = rect.x or x = right).
  if (dx !== 0) {
    for (const xFace of [rect.x, right]) {
      const t = (xFace - from.x) / dx;
      if (t <= 1e-9) continue;  // we want the OUTGOING hit, past `from`
      const y = from.y + t * dy;
      if (y < rect.y - 1e-9 || y > bottom + 1e-9) continue;
      if (t < bestT) { bestT = t; bestHit = { x: xFace, y: clamp(y, rect.y, bottom) }; }
    }
  }
  // North / south faces (horizontal lines y = rect.y or y = bottom).
  if (dy !== 0) {
    for (const yFace of [rect.y, bottom]) {
      const t = (yFace - from.y) / dy;
      if (t <= 1e-9) continue;
      const x = from.x + t * dx;
      if (x < rect.x - 1e-9 || x > right + 1e-9) continue;
      if (t < bestT) { bestT = t; bestHit = { x: clamp(x, rect.x, right), y: yFace }; }
    }
  }
  if (bestHit) return bestHit;
  return projectToPerimeter(rect, toward);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// Returns the midpoint of two rect centers — the natural target of the
// edge's central force (each endpoint anchor is pulled toward this point;
// the perpendicular component is absorbed by the perimeter constraint,
// the tangential component slides the anchor along the perimeter to the
// intersection with the line connecting the two node centers).
export function rectCenter(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function midpointOfCenters(rectA, rectB) {
  const ca = rectCenter(rectA);
  const cb = rectCenter(rectB);
  return { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
}

// Writes `newAnchor` into `points[idx]` (no-op when unchanged).
// Returns true when the point actually moved. Callers responsible
// for orthogonality must invoke `rebuildManhattanWaypoints` after
// all anchor moves.
export function writeAnchor(points, idx, newAnchor) {
  const old = points[idx];
  if (Math.abs(old.x - newAnchor.x) < 1e-6 && Math.abs(old.y - newAnchor.y) < 1e-6) {
    return false;
  }
  points[idx] = newAnchor;
  return true;
}

// Rebuilds the interior waypoints of a Manhattan polyline (4-point
// Z or 3-point L) so that every segment is axis-aligned, given the
// possibly-moved endpoints points[0] and points[last]. Chooses the
// dominant axis (same heuristic as `orthogonal.js`) — produces a
// 4-point Z whose middle segment is on the dominant midline.
//
// Skipped for:
// - kind === 'curve' (Bezier control points; geometry is meaningful
//   even when off-axis).
// - kind === 'spline' (obstacle-routed curved polyline; threads N
//   pass-through points, MUST NOT be collapsed back to 4-point Z).
// - length > 4 (obstacle-routed orthogonal with multiple interior
//   waypoints; collapsing destroys the detour).
//
// For the perpendicular-to-face invariant on the FIRST and LAST legs,
// callers should chain `enforcePerpendicularLegs` after this rebuild.
// When both rects are available, prefer calling `enforcePerpendicularLegs`
// directly — it now does a global Z/L rebuild from the two faces and
// supersedes the dominant-axis heuristic for length ≤ 4.
export function rebuildManhattanWaypoints(points, kind) {
  if (kind === 'curve' || kind === 'spline') return points;
  if (!Array.isArray(points) || points.length < 3) return points;
  if (points.length > 4) return points;
  const p0 = points[0];
  const pLast = points[points.length - 1];
  const dx = pLast.x - p0.x;
  const dy = pLast.y - p0.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = (p0.x + pLast.x) / 2;
    return [p0, { x: midX, y: p0.y }, { x: midX, y: pLast.y }, pLast];
  }
  const midY = (p0.y + pLast.y) / 2;
  return [p0, { x: p0.x, y: midY }, { x: pLast.x, y: midY }, pLast];
}

// Manhattan invariant — a polyline routed with axis-aligned segments
// can still LEAVE/ENTER an endpoint along a direction tangent to the
// rect's face (e.g., horizontal first segment from a SOUTH face).
// That looks "slanted" visually because the first segment runs along
// the face instead of perpendicular to it.
//
// Two strategies, picked by polyline length and rect availability:
//
//   (A) Short polyline (≤ 4 pts) WITH both rects → `rebuildWithFaces`
//       reconstructs the Z/L globally from the two faces. Produces a
//       midline placed BETWEEN the anchors (midX or midY), which can
//       never degenerate into a tangent leg the way the dominant-axis
//       heuristic in `rebuildManhattanWaypoints` could when the gap
//       between rects was narrow on one axis. Replaces all interior
//       corners — the original midline coordinates are discarded.
//
//   (B) Otherwise (only one rect, or long obstacle-routed polyline) →
//       per-side REPLACE of the corner adjacent to each anchor via
//       `swappedCorner`. Loses at most one waypoint per side; the
//       rest of an A* detour stays intact.
//
// Skipped for kind === 'curve' (Bezier — perpendicularity isn't defined
// in terms of straight legs).
export function enforcePerpendicularLegs(points, kind, sRect, tRect) {
  if (kind === 'curve') return points;
  if (!Array.isArray(points) || points.length < 3) return points;

  if (points.length <= 4 && sRect && tRect) {
    const f0 = faceOf(points[0], sRect);
    const fN = faceOf(points[points.length - 1], tRect);
    return rebuildWithFaces(points[0], points[points.length - 1], f0, fN);
  }

  const out = points.slice();
  if (sRect) {
    const face = faceOf(out[0], sRect);
    if (!isLegPerpendicularForFace(out[0], out[1], face)) {
      const target = out[2] || out[1];
      const corner = swappedCorner(out[0], target, face);
      // Degenerate when target shares the anchor's perpendicular axis —
      // happens for example when an A* waypoint sits on the same column
      // as the anchor. Leave the polyline untouched; a higher-level pass
      // (re-route or simplify) will deal with it.
      if (!pointsEqual(corner, out[0]) && !pointsEqual(corner, out[1])) {
        out[1] = corner;
      }
    }
  }
  if (tRect) {
    const n = out.length;
    const face = faceOf(out[n - 1], tRect);
    if (!isLegPerpendicularForFace(out[n - 1], out[n - 2], face)) {
      const target = out[n - 3] || out[n - 2];
      const corner = swappedCorner(out[n - 1], target, face);
      if (!pointsEqual(corner, out[n - 1]) && !pointsEqual(corner, out[n - 2])) {
        out[n - 2] = corner;
      }
    }
  }
  return out;
}

// Global Z/L reconstruction for length ≤ 4 polylines when both
// endpoint faces are known. Cases:
//   - Both faces horizontal (east/west) → 4-point Z with midX
//     between p0.x and pN.x. First and last legs are horizontal,
//     perpendicular to their respective east/west faces.
//   - Both faces vertical (north/south) → 4-point Z with midY
//     between p0.y and pN.y. Symmetric.
//   - Mixed (one horizontal + one vertical) → 3-point L. The corner
//     sits at (pN.x, p0.y) when source face is horizontal — the leg
//     leaving p0 stays on p0.y (horizontal), the leg entering pN
//     stays on pN.x (vertical). The other orientation flips it.
//
// Cannot degenerate into a tangent leg even when the rects are close
// or overlapping on one axis — the midline always sits at the midpoint
// between the anchors, never collinear with either face.
export function rebuildWithFaces(p0, pN, f0, fN) {
  const horiz0 = f0 === 'east' || f0 === 'west';
  const horizN = fN === 'east' || fN === 'west';
  if (horiz0 && horizN) {
    const midX = (p0.x + pN.x) / 2;
    return [p0, { x: midX, y: p0.y }, { x: midX, y: pN.y }, pN];
  }
  if (!horiz0 && !horizN) {
    const midY = (p0.y + pN.y) / 2;
    return [p0, { x: p0.x, y: midY }, { x: pN.x, y: midY }, pN];
  }
  const corner = horiz0 ? { x: pN.x, y: p0.y } : { x: p0.x, y: pN.y };
  return [p0, corner, pN];
}

function isLegPerpendicularForFace(anchor, neighbour, face) {
  if (face === 'east' || face === 'west') {
    return Math.abs(neighbour.y - anchor.y) < 1e-6;
  }
  return Math.abs(neighbour.x - anchor.x) < 1e-6;
}

// New L-corner that makes the leg leaving `anchor` perpendicular to
// `face`, then turns toward `target`. East/west face → horizontal leg
// out of anchor (corner shares anchor.y, takes target.x). North/south
// face → vertical leg out of anchor (corner shares anchor.x, takes
// target.y).
function swappedCorner(anchor, target, face) {
  if (face === 'east' || face === 'west') {
    return { x: target.x, y: anchor.y };
  }
  return { x: anchor.x, y: target.y };
}

function pointsEqual(a, b) {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

// Removes redundant interior points from a polyline. Two cases:
//   - Consecutive duplicates (or near-duplicates within DUP_TOL): drop
//     the second — happens after an anchor move snapped a corner onto
//     its neighbour, or after rebuildWithFaces collapsed a Z.
//   - Collinear interior point: drop it — happens when a post-pass
//     replaced a corner that ended up on the straight line between its
//     neighbours (frequent after enforcePerpendicularLegs swappedCorner).
//
// Lives here (not just in obstacle-route) so the anchor post-passes
// can call it without importing the obstacle router. obstacle-route
// keeps its own private copy — both modules apply the same logic but
// to different inputs.
// 0.5px matches the dup tolerance in `e2e/invariants.js` — any pair
// of consecutive points closer than this is sub-pixel noise from
// floating-point anchor moves and shouldn't survive the post-pass.
const DUP_TOL = 0.5;
const COLLINEAR_CROSS_TOL = 1e-3;
export function simplifyCollinear(points) {
  if (!Array.isArray(points) || points.length < 3) return points;
  const dedup = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = dedup[dedup.length - 1];
    if (Math.abs(last.x - points[i].x) > DUP_TOL ||
        Math.abs(last.y - points[i].y) > DUP_TOL) {
      dedup.push(points[i]);
    }
  }
  if (dedup.length < 3) return dedup;
  const out = [dedup[0]];
  for (let i = 1; i < dedup.length - 1; i++) {
    const p = out[out.length - 1], q = dedup[i], r = dedup[i + 1];
    const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (Math.abs(cross) > COLLINEAR_CROSS_TOL) out.push(q);
  }
  out.push(dedup[dedup.length - 1]);
  return out;
}

// Detects and removes "stair + back" excursions — a polilinha pattern
// where a tiny perpendicular step (≤ STAIR_TOL) precedes a reverse of
// direction on the previous axis. Bruno (showcase): goes east 54px,
// south 1.36px, west 31px — the south step is the stair, the west
// move is the back. Without this pass, simplifyCollinear preserves
// it because the cross product is non-zero.
//
// The fix: detect (p[i-1]→p[i]) axis-X, (p[i]→p[i+1]) axis-Y with
// step < STAIR_TOL, (p[i+1]→p[i+2]) axis-X reverse → remove p[i]
// and p[i+1], replace with a corner at (p[i+2].x, p[i-1].y).
// Manhattan stays intact (corner is axis-aligned).
//
// Skipped for kind === 'curve' (Bezier points carry meaning).
const STAIR_TOL = 1.5;
export function simplifyStairsAndExcursions(points, kind) {
  if (kind === 'curve') return points;
  if (!Array.isArray(points) || points.length < 4) return points;
  const out = points.slice();
  let i = 0;
  // Walks the polyline once; each removal shifts indices, but we don't
  // re-scan from the start — back-and-forth patterns rarely chain.
  while (i + 3 < out.length) {
    const a = out[i], b = out[i + 1], c = out[i + 2], d = out[i + 3];
    if (isExcursion(a, b, c, d)) {
      // Replace [b, c] with a single corner at (d.x, a.y) when
      // (a→b) is horizontal, or (a.x, d.y) when (a→b) is vertical.
      const horiz = Math.abs(a.y - b.y) < 1e-6;
      const corner = horiz ? { x: d.x, y: a.y } : { x: a.x, y: d.y };
      out.splice(i + 1, 2, corner);
      // Continue from the same position — newly-formed triple may
      // need another simplification pass through simplifyCollinear.
    } else {
      i++;
    }
  }
  return out;
}

function isExcursion(a, b, c, d) {
  const abHoriz = Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.x - b.x) > 1e-6;
  const abVert  = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) > 1e-6;
  if (!abHoriz && !abVert) return false;
  // b→c must be perpendicular to a→b AND short (the "stair").
  if (abHoriz) {
    if (Math.abs(b.x - c.x) > 1e-6) return false;  // b→c not vertical
    if (Math.abs(c.y - b.y) > STAIR_TOL) return false;  // stair too tall
  } else {
    if (Math.abs(b.y - c.y) > 1e-6) return false;
    if (Math.abs(c.x - b.x) > STAIR_TOL) return false;
  }
  // c→d must be parallel to a→b AND reverse direction (the "back").
  if (abHoriz) {
    if (Math.abs(c.y - d.y) > 1e-6) return false;
    const dxAB = b.x - a.x;
    const dxCD = d.x - c.x;
    if (Math.sign(dxAB) === Math.sign(dxCD)) return false;  // same direction, not a back
  } else {
    if (Math.abs(c.x - d.x) > 1e-6) return false;
    const dyAB = b.y - a.y;
    const dyCD = d.y - c.y;
    if (Math.sign(dyAB) === Math.sign(dyCD)) return false;
  }
  return true;
}
