// Geometry invariants for routed edges.
//
// Pure module — no Playwright dependency. Takes the same `{ positions,
// edges }` shape that `e2e/13-geometry-invariants.spec.js` already
// extracts from `window.__currentLayout__` and runs a fixed battery of
// detectors. Used both by:
//   - `debug-snapshot.js` (interactive debug tool, --assert mode)
//   - `tests/e2e-invariants.test.js` (unit-tests each detector with
//     synthetic positive/negative cases)
//
// Detectors are bound to specific bugs in the routing pipeline so each
// regression has a named owner:
//   - perpendicular endpoints   → B6 (enforcePerpendicularLegs degenerate)
//   - interior crosses endpoint → B7 (A* waypoint inside source/target)
//   - collinear redundancy      → B8 (missing simplifyCollinear)
//
// Each violation is a string. Empty array = all green.

const FACE_TOL = 0.5;        // px — anchor "on the face" tolerance
const PERP_TOL = 0.5;        // px — leg-perpendicular-to-face tolerance
const COLLINEAR_TOL = 0.1;   // px — cross-product threshold (sub-pixel kink filter)
const DUP_POINT_TOL = 0.5;   // px — consecutive points "the same" tolerance

export function assertGeometryInvariants({ positions, edges }) {
  const issues = [];
  for (const edge of edges) {
    const pts = edge.points;
    if (!pts || pts.length < 2) {
      issues.push(`edge ${edge.id}: only ${pts ? pts.length : 0} point(s)`);
      continue;
    }
    const sRect = positions[edge.source];
    const tRect = positions[edge.target];
    issues.push(...checkPerpendicularEndpoints(edge, pts, sRect, tRect));
    issues.push(...checkInteriorOutsideEndpoints(edge, pts, sRect, tRect));
    issues.push(...checkCollinearRedundancy(edge, pts));
  }
  return issues;
}

// B6 — first leg perpendicular to the face the source anchor sits on,
// last leg perpendicular to the face the target anchor sits on.
// Diagonal segments (slanted routers) are skipped — perpendicularity
// only applies to axis-aligned legs.
export function checkPerpendicularEndpoints(edge, pts, sRect, tRect) {
  const out = [];
  const n = pts.length;
  if (sRect) {
    const face = faceOf(pts[0], sRect);
    if (face && isAxisAligned(pts[0], pts[1]) &&
        !isLegPerpendicularForFace(pts[0], pts[1], face)) {
      out.push(
        `edge ${edge.id}: first leg ${json(pts[0])}→${json(pts[1])} ` +
        `tangent to source face "${face}" of ${json(sRect)}`,
      );
    }
  }
  if (tRect) {
    const face = faceOf(pts[n - 1], tRect);
    if (face && isAxisAligned(pts[n - 1], pts[n - 2]) &&
        !isLegPerpendicularForFace(pts[n - 1], pts[n - 2], face)) {
      out.push(
        `edge ${edge.id}: last leg ${json(pts[n - 2])}→${json(pts[n - 1])} ` +
        `tangent to target face "${face}" of ${json(tRect)}`,
      );
    }
  }
  return out;
}

// B7 — interior vertices (everything except first and last) must not
// fall strictly inside the source or target rect. The endpoints
// themselves sit on the perimeter, so they're excluded.
export function checkInteriorOutsideEndpoints(edge, pts, sRect, tRect) {
  const out = [];
  for (let i = 1; i < pts.length - 1; i++) {
    if (sRect && strictlyInside(pts[i], sRect)) {
      out.push(
        `edge ${edge.id}: interior point ${i} ${json(pts[i])} ` +
        `strictly inside source ${json(sRect)}`,
      );
    }
    if (tRect && strictlyInside(pts[i], tRect)) {
      out.push(
        `edge ${edge.id}: interior point ${i} ${json(pts[i])} ` +
        `strictly inside target ${json(tRect)}`,
      );
    }
  }
  return out;
}

// B8 — no two consecutive points are duplicates, and no interior point
// is collinear with its neighbours (i.e., simplifyCollinear should have
// removed it). Catches both `L X Y L X Y` (duplicate) and
// `L 0 0 L 5 0 L 10 0` (collinear interior).
export function checkCollinearRedundancy(edge, pts) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    if (Math.abs(pts[i].x - pts[i + 1].x) < DUP_POINT_TOL &&
        Math.abs(pts[i].y - pts[i + 1].y) < DUP_POINT_TOL) {
      out.push(
        `edge ${edge.id}: duplicate consecutive points at ${i}/${i + 1} ` +
        `${json(pts[i])} ≈ ${json(pts[i + 1])}`,
      );
    }
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], q = pts[i], r = pts[i + 1];
    const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (Math.abs(cross) < COLLINEAR_TOL) {
      out.push(
        `edge ${edge.id}: collinear interior point ${i} ${json(q)} ` +
        `between ${json(p)} and ${json(r)} (cross=${cross.toExponential(2)})`,
      );
    }
  }
  return out;
}

// ----- helpers -----

function faceOf(p, rect) {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const dL = Math.abs(p.x - rect.x);
  const dR = Math.abs(p.x - right);
  const dT = Math.abs(p.y - rect.y);
  const dB = Math.abs(p.y - bottom);
  const min = Math.min(dL, dR, dT, dB);
  // Anchor must actually sit on the perimeter (within FACE_TOL of one
  // face) — otherwise we have no idea which face it belongs to and the
  // perpendicular check is meaningless. clip-anchors should have already
  // pulled the anchor to the perimeter; if it didn't, that's a separate
  // bug caught by the perimeter test in `13-geometry-invariants.spec.js`.
  if (min > FACE_TOL) return null;
  if (min === dL) return 'west';
  if (min === dR) return 'east';
  if (min === dT) return 'north';
  return 'south';
}

function isAxisAligned(a, b) {
  return Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6;
}

function isLegPerpendicularForFace(anchor, neighbour, face) {
  if (face === 'east' || face === 'west') {
    return Math.abs(neighbour.y - anchor.y) < PERP_TOL;
  }
  return Math.abs(neighbour.x - anchor.x) < PERP_TOL;
}

function strictlyInside(p, rect) {
  const eps = 1e-3;
  return p.x > rect.x + eps && p.x < rect.x + rect.width - eps
      && p.y > rect.y + eps && p.y < rect.y + rect.height - eps;
}

function json(p) {
  return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
}
