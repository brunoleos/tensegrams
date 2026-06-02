// Tipos de corpos físicos do solver de routing.
//
// `CornerBody`: ponto 2D com 2 DOFs (x, y). Dono ÚNICO da posição da
// polyline ortogonal. Endpoints (anchor no nó) são `CornerBody` com
// `pinned: true`.
//
// `SegmentBody` (Manhattan): retângulo axis-aligned com 0 DOFs próprios.
// Geometria derivada de prevCorner/nextCorner via `getSegmentC(seg)` e
// `getSegmentBounds(seg)`. Forças aplicadas no segmento (repulsão de
// nó, repulsão paralela) são distribuídas perpendicular aos dois corners
// endpoints; equilíbrio é onde a soma dessas forças nos corners zera.
// Tem `pad` (default = strokeWidth do edge) que define a "espessura"
// da BBox usada em colisões.
//
// `PointBody` (curved): ponto 2D com 2 DOFs + raio de cobertura.
// Sequência de PointBody é interpolada via Catmull-Rom no renderer.

export function makeSegmentBody({ id, orientation, pad = 2, prevCorner, nextCorner }) {
  return {
    kind: 'segment',
    id,
    orientation,       // 'h' | 'v'
    pad,               // espessura usada na BBox para colisões
    prevCorner,
    nextCorner,
    topologyCooldown: 0,
    // residualTicks: contador de ticks consecutivos em que a força
    // perpendicular líquida nos endpoints excedeu τ_split. Solver
    // dispara `splitSegment` quando atinge K_split. Resetado quando
    // a força cai abaixo do threshold (zona morta evita oscilação
    // perto do limite).
    residualTicks: 0,
  };
}

export function makeCornerBody({ id, x, y, pinned = false, anchorOf = null, rect = null, anchorSide = null }) {
  return {
    kind: 'corner',
    id,
    x, y,
    xOrigin: x, yOrigin: y,   // memória pro spring "ideal path"
    vx: 0, vy: 0,
    fx: 0, fy: 0,
    pinned,
    anchorOf,
    // `rect` (only for pinned anchors) is the rail the anchor slides along —
    // post-step `clampAnchorToPerimeter` projects (x, y) back onto this
    // perimeter so the anchor stays glued to the node's edge while keeping
    // its tangential DOF. Null for free interior corners.
    rect,
    // `anchorSide` records whether this anchor is the SOURCE or TARGET
    // endpoint of its edge, so `info.snapTarget[side]` can be looked up
    // without re-deriving from corner indices.
    anchorSide,
    topologyCooldown: 0,
  };
}

export function makePointBody({ id, x, y, radius = 12 }) {
  return {
    kind: 'point',
    id,
    x, y,
    xOrigin: x, yOrigin: y,
    vx: 0, vy: 0,
    fx: 0, fy: 0,
    radius,
    pinned: false,
    topologyCooldown: 0,
  };
}

export function clearForces(body) {
  if (body.kind === 'segment') return;
  body.fx = 0;
  body.fy = 0;
}

// Coordenada perpendicular do segmento — derivada dos endpoints.
// Após `projectManhattanEdge`, prevCorner e nextCorner têm a mesma
// coordenada perpendicular (y para horizontal, x para vertical); o
// helper devolve essa coordenada lendo do prevCorner.
export function getSegmentC(seg) {
  return seg.orientation === 'h' ? seg.prevCorner.y : seg.prevCorner.x;
}

// Limites paralelos (x0, x1) do segmento — derivados dos endpoints.
export function getSegmentBounds(seg) {
  const a = seg.orientation === 'h' ? seg.prevCorner.x : seg.prevCorner.y;
  const b = seg.orientation === 'h' ? seg.nextCorner.x : seg.nextCorner.y;
  return a <= b ? [a, b] : [b, a];
}
