// Edge-anchor post-processor — second pass after `clipAnchorsToContainerFaces`.
//
// Rule enforced: when an edge has one endpoint that IS a container and
// the other endpoint is NOT a descendant of that container, the anchor
// on the container side must land on the EXTERNAL face of the container
// facing the other endpoint — never on a face that points inward toward
// the container's children.
//
// Why this rule is separate from clip-anchors: `clipAnchorsToContainerFaces`
// only fires on FOREIGN containers (id ∉ allowed). When the container
// IS the endpoint it sits in `allowed`, so clip-anchors lets the router
// pick any face — and routers pick face by sign of dx/dy between centers,
// which falls apart when overlap is permissive (the other endpoint may
// be visually inside the container, dragging the face choice to the
// "inner wall" opposite to the natural exit).
//
// Configuration lives in the DSL (a high-level layout behaviour, not a
// low-level algorithmic knob):
//   - Global: `snapContainerAnchor: on|off` (meta, default on).
//   - Per-edge override: `snap=on|off|inherit` (default inherit).
// Snap fires for an edge when its effective setting is `on`.

import { clipToRect } from './router.js';
import { writeAnchor, rebuildManhattanWaypoints, enforcePerpendicularLegs, simplifyCollinear, simplifyStairsAndExcursions } from './anchor-utils.js';

export function snapContainerEndpointsExternal(ir, routedEdges, rects, ancestors) {
  if (!routedEdges || routedEdges.size === 0) return routedEdges;
  const globalOn = ir.meta?.snapContainerAnchor !== false;
  const byId = new Map(ir.nodes.map(n => [n.id, n]));

  const out = new Map();
  for (const edge of ir.edges) {
    const re = routedEdges.get(edge.id);
    if (!re) continue;
    const effective = resolveEffective(edge.snap, globalOn);
    if (!effective) {
      out.set(edge.id, re);
      continue;
    }
    out.set(edge.id, snapEdge(re, edge.source, edge.target, byId, rects, ancestors));
  }
  return out;
}

function resolveEffective(edgeSnap, globalOn) {
  if (edgeSnap === 'on') return true;
  if (edgeSnap === 'off') return false;
  return globalOn;
}

function snapEdge(re, sourceId, targetId, byId, rects, ancestors) {
  if (sourceId === targetId) return re;
  const points = re.points.slice();
  let changed = false;

  if (shouldSnap(sourceId, targetId, byId, ancestors)) {
    const epRect = rects.get(sourceId);
    const otherRect = rects.get(targetId);
    if (epRect && otherRect) {
      const newAnchor = projectToExternalFace(epRect, otherRect);
      if (writeAnchor(points, 0, newAnchor)) changed = true;
    }
  }

  if (shouldSnap(targetId, sourceId, byId, ancestors)) {
    const epRect = rects.get(targetId);
    const otherRect = rects.get(sourceId);
    if (epRect && otherRect) {
      const newAnchor = projectToExternalFace(epRect, otherRect);
      if (writeAnchor(points, points.length - 1, newAnchor)) changed = true;
    }
  }

  if (!changed) return re;
  // Rebuild Manhattan midline so every segment stays axis-aligned
  // after the anchors moved (Bezier polylines are left intact).
  // Then enforce perpendicular-to-face on the legs leaving each
  // (possibly moved) endpoint.
  const sRect = rects.get(sourceId);
  const tRect = rects.get(targetId);
  let finalPoints = rebuildManhattanWaypoints(points, re.kind);
  finalPoints = enforcePerpendicularLegs(finalPoints, re.kind, sRect, tRect);
  if (re.kind !== 'curve') {
    finalPoints = simplifyCollinear(finalPoints);
    finalPoints = simplifyStairsAndExcursions(finalPoints, re.kind);
    finalPoints = simplifyCollinear(finalPoints);
  }
  return {
    ...re,
    points: finalPoints,
    sourceAnchor: finalPoints[0],
    targetAnchor: finalPoints[finalPoints.length - 1],
  };
}

function shouldSnap(epId, otherId, byId, ancestors) {
  const ep = byId.get(epId);
  if (!ep || !ep.hasChildren) return false;
  // Other endpoint logically inside this container? Then anchor SHOULD
  // land on the inner side — that's the "edge to a descendant" case
  // and we leave the router's choice alone.
  const otherAncestors = ancestors.get(otherId);
  if (otherAncestors && otherAncestors.has(epId)) return false;
  return true;
}

function projectToExternalFace(rect, otherRect) {
  const ox = otherRect.x + otherRect.width / 2;
  const oy = otherRect.y + otherRect.height / 2;
  const p = clipToRect(rect, ox, oy);
  // clipToRect uses ratio-based face selection. For wide/tall rects
  // combined with diagonal targets the projected point can fall just
  // outside the rect on the perpendicular axis. Clamp so the anchor
  // is always on the perimeter.
  return {
    x: clamp(p.x, rect.x, rect.x + rect.width),
    y: clamp(p.y, rect.y, rect.y + rect.height),
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
