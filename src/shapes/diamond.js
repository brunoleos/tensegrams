// Stub: shape "diamond" (losango inscrito na BBox). API espelha rect;
// implementações analíticas ficam pra fase futura. Por ora cada função
// retorna o equivalente da BBox quando faria sentido — o resto vazio.

import * as rect from './rect.js';

export function bbox(node) {
  return rect.bbox(node);
}

export function boundaryHitFromAngle(node, angleDeg) {
  // Stub: usa raycasting do rect inscrito. Implementação real faz
  // interseção com as 4 arestas oblíquas do losango.
  return rect.boundaryHitFromAngle(node, angleDeg);
}

export function boundaryHitFromPath(node, t) {
  return rect.boundaryHitFromPath(node, t);
}

export function namedAnchors(node) {
  // Diamond: cardinais ficam nos 4 vértices (top/right/bottom/left).
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

export function vertices(node) {
  // Diamond tem 4 vértices nos cardinais — mesmos pontos.
  const a = namedAnchors(node);
  return [a.get('top'), a.get('right'), a.get('bottom'), a.get('left')];
}

export function midpoints(_node) {
  // Midpoints das 4 arestas oblíquas — stub vazio na 5.2.
  return [];
}

export function intersections(_node) {
  return [];
}
