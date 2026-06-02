// applyEdgeCentralForce — força central por aresta.
//
// Para cada endpoint pinado no perímetro (CornerBody com .rect), aplica
// uma força elástica que puxa o anchor em direção ao "target central"
// da aresta. O target padrão é o `edgeCenter` (midpoint dos centros dos
// dois nós da aresta); quando o nó tem snap declarado e o roteador
// atribuiu um snap point ao endpoint (info.snapTarget[side]), o snap
// substitui o edgeCenter como alvo.
//
// O constraint do perímetro (clampAnchorToPerimeter) absorve a
// componente perpendicular ao trilho; o que sobra é a componente
// tangencial, que faz o anchor deslizar pra interseção (ou ponto mais
// próximo dela) entre o perímetro e a linha do anchor ao target.
//
// Skip casos: anchor sem rect (legacy pin total), anchor sem
// info.edgeCenter (warm-start sem rects). Edges curve passam intactas.

export const K_EDGE_CENTRAL = 0.04;

export function applyEdgeCentralForce(world, opts = {}) {
  const k = opts.kEdgeCentral ?? K_EDGE_CENTRAL;
  if (k <= 0) return;
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (info.kind === 'curve') continue;
    if (!info.corners || info.corners.length < 2) continue;
    const center = info.edgeCenter;
    if (!center) continue;
    const snap = info.snapTarget || null;
    const first = info.corners[0];
    const last = info.corners[info.corners.length - 1];
    pullAnchorToTarget(first, snap?.source ?? center, k);
    pullAnchorToTarget(last, snap?.target ?? center, k);
  }
}

function pullAnchorToTarget(body, target, k) {
  if (!body || !body.pinned || !body.rect || !target) return;
  body.fx += -k * (body.x - target.x);
  body.fy += -k * (body.y - target.y);
}
