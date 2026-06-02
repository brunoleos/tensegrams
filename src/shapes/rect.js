// Shape primitivo "rect" — todos os outros shapes hoje no projeto.
//
// API uniforme (mirror em circle/diamond/polygon/star stubs):
//   bbox(node)                 → { x, y, width, height }
//   boundaryHitFromAngle(n, θ) → ponto na fronteira a partir do centro,
//                                na direção do ângulo (graus, 0=leste,
//                                90=norte com y positivo pra cima — mas
//                                aqui o sistema usa y positivo pra baixo,
//                                então 90=sul).
//   boundaryHitFromPath(n, t)  → ponto no perímetro, t ∈ [0,1] iniciando
//                                no canto top-left e progredindo horário.
//   namedAnchors(node)         → Map<string, {x,y}> com nomes canônicos:
//                                top, bottom, left, right, center,
//                                corner0..3.
//   vertices(node)             → [{x,y}] dos 4 cantos (corner0..3).
//   midpoints(node)            → [{x,y}] dos 4 midpoints das faces.
//   intersections(node)        → [] (rect não tem cruzamentos internos).
//
// `node` aqui é `{x, y, width, height}` — BBox absoluta. Shape-specific
// fields (number of points em star, etc.) chegam em fases futuras.

export function bbox(node) {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

export function boundaryHitFromAngle(node, angleDeg) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  // Achar t > 0 mínimo tal que cx + t*dx encosta x=node.x ou node.x+w
  // OU cy + t*dy encosta y=node.y ou node.y+h. O menor t define a face.
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  const tX = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const tY = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const t = Math.min(tX, tY);
  return { x: cx + t * dx, y: cy + t * dy };
}

export function boundaryHitFromPath(node, t) {
  // Normaliza t para [0,1).
  const tt = ((t % 1) + 1) % 1;
  const w = node.width;
  const h = node.height;
  const perim = 2 * (w + h);
  const d = tt * perim;  // distância percorrida no perímetro
  // 4 trechos: top (w), right (h), bottom (w), left (h).
  if (d < w) {
    return { x: node.x + d, y: node.y };
  }
  if (d < w + h) {
    return { x: node.x + w, y: node.y + (d - w) };
  }
  if (d < 2 * w + h) {
    return { x: node.x + w - (d - w - h), y: node.y + h };
  }
  return { x: node.x, y: node.y + h - (d - 2 * w - h) };
}

export function namedAnchors(node) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return new Map([
    ['top',     { x: cx,             y: node.y }],
    ['bottom',  { x: cx,             y: node.y + node.height }],
    ['left',    { x: node.x,         y: cy }],
    ['right',   { x: node.x + node.width, y: cy }],
    ['center',  { x: cx,             y: cy }],
    ['corner0', { x: node.x,                  y: node.y }],
    ['corner1', { x: node.x + node.width,     y: node.y }],
    ['corner2', { x: node.x + node.width,     y: node.y + node.height }],
    ['corner3', { x: node.x,                  y: node.y + node.height }],
  ]);
}

export function vertices(node) {
  return [
    { x: node.x,                  y: node.y },
    { x: node.x + node.width,     y: node.y },
    { x: node.x + node.width,     y: node.y + node.height },
    { x: node.x,                  y: node.y + node.height },
  ];
}

export function midpoints(node) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return [
    { x: cx,                      y: node.y },                  // top
    { x: node.x + node.width,     y: cy },                      // right
    { x: cx,                      y: node.y + node.height },    // bottom
    { x: node.x,                  y: cy },                      // left
  ];
}

export function intersections(_node) {
  return [];
}
