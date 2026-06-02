// Stub: shape "circle" tem a mesma API que rect, mas as implementações
// vivem em fases futuras. Por ora cada função devolve "valor seguro
// para um circle inscrito na BBox" (ponto único quando faria sentido,
// arrays vazios pra vertices/midpoints/intersections que ainda não
// existem no domínio do circle).

import * as rect from './rect.js';

export function bbox(node) {
  return rect.bbox(node);
}

export function boundaryHitFromAngle(node, angleDeg) {
  // Circle inscrito → raycasting é o caso analítico mais limpo possível.
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = Math.min(node.width, node.height) / 2;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function boundaryHitFromPath(node, t) {
  const tt = ((t % 1) + 1) % 1;
  return boundaryHitFromAngle(node, tt * 360);
}

export function namedAnchors(node) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = Math.min(node.width, node.height) / 2;
  return new Map([
    ['top',    { x: cx,     y: cy - r }],
    ['bottom', { x: cx,     y: cy + r }],
    ['left',   { x: cx - r, y: cy }],
    ['right',  { x: cx + r, y: cy }],
    ['center', { x: cx,     y: cy }],
  ]);
}

export function vertices(_node) {
  // Circle não tem vértices discretos.
  return [];
}

export function midpoints(node) {
  // 4 cardinais — mesmos pontos que namedAnchors top/right/bottom/left.
  const a = namedAnchors(node);
  return [a.get('top'), a.get('right'), a.get('bottom'), a.get('left')];
}

export function intersections(_node) {
  return [];
}
