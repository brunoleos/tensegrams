import { projectToPerimeter, faceOf } from '../anchor-utils.js';

// Constraints aplicadas como projeção pós-step (hard-clip).
//
// Sequência em cada step:
//   1. forces.* preenchem fx/fy nos corners/points.
//   2. integrator atualiza posições via Euler.
//   3. constraints.* projetam de volta pro feasible set.
//   4. commit / paint.
//
// Após 5.0, segmentos não têm DOF próprio. A invariante Manhattan é
// mantida projetando os dois corners adjacentes a cada segmento para
// a mesma coordenada perpendicular: pinned (se houver) ou média
// (caso nenhum dos dois esteja pinado).

// Projeta cada segmento pra manter Manhattan estrita: para um seg
// horizontal, todos os corners do "run" compartilham y; para vertical,
// compartilham x.
//
// Run = sequência maximal de segs consecutivos com mesma orientação.
// Em Manhattan canônico, runs têm tamanho 1 (segs alternam H,V,H,V…).
// Fissão (topology.js) divide um seg horizontal em N pedaços ainda
// horizontais → cria um run de tamanho N.
//
// Sem DOF próprio do segmento: o target perpendicular é decidido pelo
// pin (se algum corner do run é pinado, seu valor manda); caso
// contrário, média de todos os corners do run.
//
// Equalização run-aware é necessária porque a projeção par-a-par
// original era Jacobi de 1 passe — para uma run de N corners,
// convergia em O(N) passes, mas o solver só roda projeção 1× por
// step. Sintoma observado pré-fix: chain de 7 segs H ficava com dy
// decaindo exponencialmente (3.09 → 0.29) em vez de zero estrito,
// renderizada como polyline curva. Equalizar a run inteira numa
// passada resolve em O(1) — testes phase2/phase3 (runs sempre de
// tamanho 1) continuam idênticos.
export function projectManhattanEdge(corners, segments) {
  if (!corners || corners.length < 2 || !segments || !segments.length) return;

  let i = 0;
  while (i < segments.length) {
    let j = i;
    while (j + 1 < segments.length
        && segments[j + 1].orientation === segments[i].orientation) {
      j++;
    }
    projectRun(segments, i, j);
    i = j + 1;
  }
}

// Equaliza a coord perpendicular de todos os corners da run [iSeg..jSeg].
// Pin no run → todos herdam coord do pin (vel zerada — origin spring
// não pode vencer o pin). Sem pin → média de todos.
//
// Perimeter anchors (corner.rect != null) tem pin PARCIAL: pinam o eixo
// PERPENDICULAR à sua face atual, são livres no eixo TANGENCIAL. Para a
// projeção run-aware:
//   - Quando o run roda no eixo PERP da face do anchor (axis = perpAxis),
//     o anchor manda na coord do run (mesmo papel do pin legado).
//   - Quando o run roda no eixo TANGENCIAL da face do anchor, o anchor
//     NÃO impõe a coord — entra na média junto com os outros corners.
//     Isso é o que permite o slide tangencial não ser anulado pela
//     projeção Manhattan.
function projectRun(segments, iSeg, jSeg) {
  const orientation = segments[iSeg].orientation;
  const axis = orientation === 'h' ? 'y' : 'x';
  const velAxis = orientation === 'h' ? 'vy' : 'vx';
  const chain = [];
  for (let k = iSeg; k <= jSeg; k++) {
    if (k === iSeg) chain.push(segments[k].prevCorner);
    chain.push(segments[k].nextCorner);
  }
  let pinned = null;
  let sum = 0;
  for (const c of chain) {
    if (anchorPinsAxis(c, axis) && !pinned) pinned = c;
    sum += c[axis];
  }
  const target = pinned ? pinned[axis] : (sum / chain.length);
  const hasPin = pinned != null;
  for (const c of chain) {
    if (anchorPinsAxis(c, axis)) continue;
    c[axis] = target;
    if (hasPin) c[velAxis] = 0;
  }
}

// Para um corner, decide se ele "pina" um eixo específico.
// - Legacy pin total (c.pinned && !c.rect): pina ambos os eixos.
// - Perimeter anchor (c.pinned && c.rect): pina só o eixo perpendicular
//   à face atual.
function anchorPinsAxis(corner, axis) {
  if (!corner.pinned) return false;
  if (!corner.rect) return true;  // legacy pin total
  const face = corner.face || faceOf(corner, corner.rect);
  // East/West → perp = x; North/South → perp = y.
  const perpAxis = (face === 'east' || face === 'west') ? 'x' : 'y';
  return axis === perpAxis;
}

// Reposiciona corpos pinados (anchors) na posição de origem.
// Defensivo: caso alguma força tenha empurrado fora do pin, recoloca.
// Aceita tanto CornerBody quanto PointBody (mesmo shape de pin).
//
// Comportamento legado (sem `corner.rect`): pin total — anchor volta a
// xOrigin/yOrigin a cada step. Usado por testes que constroem mundos
// manualmente sem warm-start.
export function pinAnchors(bodies) {
  for (const b of bodies) {
    if (!b.pinned) continue;
    if (b.rect) continue;  // anchor com rail (perímetro) usa clampAnchorToPerimeter
    b.x = b.xOrigin;
    b.y = b.yOrigin;
    b.vx = 0;
    b.vy = 0;
  }
}

// Hard constraint do trilho (perímetro). Para cada body com `pinned` e
// `rect` setados, projeta (b.x, b.y) no perímetro do rect — anchor não
// sai do trilho, mas desliza tangencialmente sob ação das forças.
//
// Velocidade tangencial é preservada (não zerada como em pinAnchors);
// componente perpendicular é absorvida pela projeção (velocidade nessa
// direção vira nada útil quando a posição volta pra borda).
//
// Recomputa `b.face` (metadata pra orientação Manhattan dos runs de
// endpoint) a partir da nova posição via `faceOf(b, rect)`.
export function clampAnchorToPerimeter(bodies) {
  for (const b of bodies) {
    if (!b.pinned || !b.rect) continue;
    const projected = projectToPerimeter(b.rect, { x: b.x, y: b.y });
    b.x = projected.x;
    b.y = projected.y;
    // Velocidade perpendicular à face é descartada (não há pra onde ir);
    // tangencial é preservada pro deslizamento.
    const face = faceOf(b, b.rect);
    if (face === 'east' || face === 'west') b.vx = 0;
    else b.vy = 0;
    b.face = face;
  }
}

// Free corner solidário ao anchor (Q10): quando o anchor desliza ao
// longo do perímetro, o corner adjacente ao seu segmento de endpoint
// herda o mesmo deslocamento tangencial, preservando a perpendicularidade
// do segmento Manhattan à face. Sem isso, o segmento de endpoint
// "ricocheteia" depois do projectManhattanEdge porque o run forçaria
// novamente o eixo perp da face original, anulando o slide do anchor.
//
// Implementação: comparar (xOrigin, yOrigin) do anchor com a posição
// atual (já projetada no perímetro) — o Δ na coord tangencial vira o
// Δ do free corner. Em rect-shapes, o eixo tangencial é horizontal
// (faces N/S) ou vertical (faces E/W) e o free corner adjacente
// herda exatamente o mesmo Δ.
//
// `info` é o entry do edgeIndex (tem .corners). Roda APÓS
// clampAnchorToPerimeter (que recomputa b.face) e ANTES de
// projectManhattanEdge.
export function slideFreeCornersWithAnchors(info) {
  if (!info || !info.corners || info.corners.length < 3) return;
  const corners = info.corners;
  const first = corners[0];
  const last = corners[corners.length - 1];
  for (const [anchor, neighbor] of [[first, corners[1]], [last, corners[corners.length - 2]]]) {
    if (!anchor || !anchor.pinned || !anchor.rect) continue;
    if (!neighbor || neighbor.pinned) continue;
    const face = anchor.face || faceOf(anchor, anchor.rect);
    if (face === 'east' || face === 'west') {
      // Tangencial = y. Free corner herda anchor.y (o segmento de
      // endpoint é horizontal nessa face, então o corner adjacente
      // compartilha a coord y do anchor pra perpendicularidade).
      neighbor.y = anchor.y;
    } else {
      // Tangencial = x. Free corner herda anchor.x.
      neighbor.x = anchor.x;
    }
  }
}

// Atalho usado pelo solver no path moderno: faz tudo (clamp + slide)
// e atualiza `face` no anchor. Mantém pinAnchors pra preservar
// compat com testes legados que constroem mundos sem `rect`.
export function pinAnchorsOnPerimeter(info) {
  if (!info || !info.corners) return;
  clampAnchorToPerimeter(info.corners);
  slideFreeCornersWithAnchors(info);
}

// Fases seguintes: perpendicularidade das pernas terminais (mantém
// segmento adjacente ao anchor perpendicular à face do nó) e
// clipAnchor (anchor não foge do perímetro do nó). Por ora ficam stub
// — o pin já mantém anchors estáveis enquanto a fase 2 não introduz
// repulsão.
export function projectPerpendicularLegs(_corners, _segments, _resolver) {
  // Fase 3+.
}

export function clipAnchorsToNodes(_corners, _routingRects, _resolver) {
  // Fase 3+.
}
