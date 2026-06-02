// Stub: shape "star" — estrela de N pontas inscrita na BBox. API espelha
// rect; sem `node.star.points`, cai pra fallback rect. Implementação
// analítica (tips + valleys) fica pra fase futura.

import * as rect from './rect.js';

export function bbox(node) { return rect.bbox(node); }

export function boundaryHitFromAngle(node, angleDeg) {
  return rect.boundaryHitFromAngle(node, angleDeg);
}

export function boundaryHitFromPath(node, t) {
  return rect.boundaryHitFromPath(node, t);
}

export function namedAnchors(node) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return new Map([
    ['top',    { x: cx,                      y: node.y }],
    ['right',  { x: node.x + node.width,     y: cy }],
    ['bottom', { x: cx,                      y: node.y + node.height }],
    ['left',   { x: node.x,                  y: cy }],
    ['center', { x: cx,                      y: cy }],
  ]);
}

export function vertices(_node) { return []; }
export function midpoints(_node) { return []; }
export function intersections(_node) { return []; }
