// Edge-anchor post-processor.
//
// Single invariant: an edge endpoint (first or last point of its
// polyline) must never fall inside the bounding rect of a container
// that is neither source, target, nor an ancestor of one of them.
// Foreign containers visually covering the anchor are "out of bounds"
// for that anchor.
//
// Why a post-processor and not a per-router concern: every router
// builds anchors from local geometry (source/target rects only) and
// has no global awareness of the rest of the diagram. Pushing the
// invariant up to the pipeline lets each router stay simple and
// keeps the rule in a single place. Adding a router later costs zero
// extra code for this guarantee.
//
// Pesos de colisão (`nodeLayers`/`edgeLayers`) NÃO são consultados aqui:
// o `allowed set` é a única gating para "âncora pode ficar dentro de
// container". Layers servem para roteamento ao redor de obstáculos,
// jamais para bloquear o caminho geométrico até um endpoint.
//
// Algorithm per edge:
//   1. allowed = {source, target} ∪ ancestors(source) ∪ ancestors(target)
//   2. for each endpoint (points[0] and points[last]):
//      a. find any rect whose id ∉ allowed and which contains the point
//      b. project the point onto that rect using clipToRect, aimed at
//         the polyline's next/prev point — this picks the face closest
//         to the rest of the path
//      c. iterate up to MAX_PASSES — pushing out of one rect may
//         move the anchor into another (nested foreign containers)
//
// Degenerate case: the endpoint's neighbouring polyline point also
// sits inside the same blocker. clipToRect would aim back inside —
// the entire edge is engulfed. We bail out, leave anchor untouched,
// and warn once in dev. Heuristics for this rare patological case
// don't pay the complexity.

import { clipToRect } from './router.js';
import { writeAnchor, rebuildManhattanWaypoints, enforcePerpendicularLegs, simplifyCollinear, simplifyStairsAndExcursions } from './anchor-utils.js';
import { endpointAllowedSet } from '../dsl/ancestry.js';

const MAX_PASSES = 3;

export function clipAnchorsToContainerFaces(ir, routedEdges, rects, ancestors) {
  if (!routedEdges || routedEdges.size === 0) return routedEdges;
  const byId = new Map(ir.nodes.map(n => [n.id, n]));

  const out = new Map();
  for (const edge of ir.edges) {
    const re = routedEdges.get(edge.id);
    if (!re) continue;
    out.set(edge.id, clipEdge(re, edge.source, edge.target, byId, rects, ancestors));
  }
  return out;
}

function clipEdge(re, sourceId, targetId, byId, rects, ancestors) {
  const allowed = endpointAllowedSet(sourceId, targetId, ancestors);
  const points = re.points.slice();
  let changed = false;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const firstNeighbor = points[1] || points[0];
    const lastNeighbor  = points[points.length - 2] || points[points.length - 1];
    const changedFirst = clipEndpoint(points, 0, firstNeighbor, byId, rects, allowed);
    const changedLast  = clipEndpoint(points, points.length - 1, lastNeighbor, byId, rects, allowed);
    changed = changed || changedFirst || changedLast;
    if (!changedFirst && !changedLast) break;
  }

  // Reconstruct the Manhattan midline from the updated endpoints so
  // every segment stays axis-aligned (Bezier polylines are left
  // alone — their control points carry meaning). Then enforce
  // perpendicularity to face on the FIRST and LAST legs — the rebuild
  // alone doesn't guarantee it for endpoints landed on cross-axis faces.
  // simplifyCollinear runs UNCONDITIONALLY (even when no anchor moved):
  // the upstream router can emit degenerate polylines like
  // [sA, mid, mid, tA] when source/target centers share an axis, and
  // those would otherwise survive the entire pipeline.
  const sRect = rects.get(sourceId);
  const tRect = rects.get(targetId);
  let finalPoints = points;
  if (changed) {
    finalPoints = rebuildManhattanWaypoints(finalPoints, re.kind);
    finalPoints = enforcePerpendicularLegs(finalPoints, re.kind, sRect, tRect);
  }
  if (re.kind !== 'curve') {
    finalPoints = simplifyCollinear(finalPoints);
    finalPoints = simplifyStairsAndExcursions(finalPoints, re.kind);
    finalPoints = simplifyCollinear(finalPoints);
  }
  // Polyline genuinely unchanged → keep the original re reference so
  // downstream consumers can short-circuit on identity.
  if (!changed && samePolyline(finalPoints, re.points)) return re;
  return {
    ...re,
    points: finalPoints,
    sourceAnchor: finalPoints[0],
    targetAnchor: finalPoints[finalPoints.length - 1],
  };
}

function samePolyline(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 1e-9 || Math.abs(a[i].y - b[i].y) > 1e-9) return false;
  }
  return true;
}

function clipEndpoint(points, idx, neighbor, byId, rects, allowed) {
  const p = points[idx];
  const blocker = findBlocker(p, byId, rects, allowed);
  if (!blocker) return false;
  if (rectContains(blocker.rect, neighbor)) {
    warnDegenerate(blocker.id, p);
    return false;
  }
  const projected = clipToRect(blocker.rect, neighbor.x, neighbor.y);
  return writeAnchor(points, idx, projected);
}

function findBlocker(point, byId, rects, allowed) {
  for (const [id, rect] of rects) {
    if (allowed.has(id)) continue;
    // Only containers geometrically cover an anchor that should be
    // outside them. Leaves never wrap other nodes — skip them to
    // keep the loop fast and predictable.
    const node = byId.get(id);
    if (!node || !node.hasChildren) continue;
    if (rectContains(rect, point)) return { id, rect };
  }
  return null;
}

function rectContains(rect, p) {
  return p.x >= rect.x && p.x <= rect.x + rect.width
      && p.y >= rect.y && p.y <= rect.y + rect.height;
}

let warnedOnce = false;
function warnDegenerate(containerId, point) {
  if (warnedOnce) return;
  warnedOnce = true;
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[clip-anchors] edge polyline fully inside foreign container "${containerId}" at (${point.x.toFixed(1)}, ${point.y.toFixed(1)}); anchor left as-is.`,
    );
  }
}
