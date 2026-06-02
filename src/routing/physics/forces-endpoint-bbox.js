// applyEndpointBBoxRepulsion — colisão BBox de endpoint vs BBox de
// endpoint (P5) e BBox de endpoint vs segmento alheio (P6, com filtro
// de edgeLayer).
//
// Cada CornerBody pinado no perímetro (corner.rect != null) carrega um
// BBox quadrado axis-aligned no lado externo do nó, centrado no anchor
// e estendido `effectiveSide` em ambos os eixos. Quando dois BBoxes se
// sobrepõem, AMBOS cedem ao longo do perímetro (Δ tangencial; o clamp
// pós-step projeta de volta). Quando o BBox de A sobrepõe um segmento
// alheio, só o segmento cede (BBox-vs-seg unidirecional).
//
// Auto-clamp Q11: effectiveSide = min(configuredSide, faceSpan / N_endpoints_nessa_face).
// Sem configuração explícita, default = ENDPOINT_BBOX_DEFAULT_SIDE.

import { faceOf } from '../anchor-utils.js';
import { getSegmentC } from './bodies.js';
import { segmentBBox, K_REPEL_NODE } from './forces.js';

export const K_ENDPOINT_BBOX = 0.6;
export const ENDPOINT_BBOX_DEFAULT_SIDE = 16;

// Resolve o `side` configurado para um endpoint, com cascata:
//   info.edge.endpoints[side].side          (per-endpoint override)
//   info.edge.style?.endpointBBox?.side     (per-edge default)
//   opts.routing?.endpointBBox?.side        (meta global)
//   ENDPOINT_BBOX_DEFAULT_SIDE              (fallback)
function configuredSide(info, side, opts) {
  return info.edge?.endpoints?.[side]?.side
    ?? info.edge?.style?.endpointBBox?.side
    ?? opts.routing?.endpointBBox?.side
    ?? opts.endpointBBoxSide
    ?? ENDPOINT_BBOX_DEFAULT_SIDE;
}

// Coleta todos os endpoint anchors com BBox ativável.
function collectEndpointAnchors(world, opts) {
  const out = [];
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (info.kind === 'curve') continue;
    if (!info.corners || info.corners.length < 2) continue;
    const first = info.corners[0];
    const last = info.corners[info.corners.length - 1];
    for (const [anchor, side] of [[first, 'source'], [last, 'target']]) {
      if (!anchor.pinned || !anchor.rect) continue;
      const cfgSide = configuredSide(info, side, opts);
      out.push({ anchor, info, side, cfgSide });
    }
  }
  return out;
}

// Agrupa anchors por (rectId, face) — pra auto-clamp por face.
function groupByFace(anchors) {
  const groups = new Map();
  for (const item of anchors) {
    const face = item.anchor.face || faceOf(item.anchor, item.anchor.rect);
    const key = `${item.anchor.rect.x},${item.anchor.rect.y},${item.anchor.rect.width},${item.anchor.rect.height}|${face}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...item, face });
  }
  return groups;
}

// Calcula a BBox quadrada externa em torno do anchor, com lado clamped
// pela face span / N.
function buildBBox(item, count, warningsSink) {
  const { anchor, face, cfgSide, info, side } = item;
  const rect = anchor.rect;
  const faceSpan = (face === 'east' || face === 'west') ? rect.height : rect.width;
  const effectiveSide = Math.min(cfgSide, faceSpan / Math.max(1, count));
  if (effectiveSide < cfgSide && warningsSink) {
    warningsSink.push({
      msg: `endpoint BBox clamped on edge ${info.edge?.id || '?'} (${side}) face ${face}: ${cfgSide} → ${effectiveSide.toFixed(2)}`,
    });
  }
  const half = effectiveSide / 2;
  // External side of the perimeter: nudge BBox center half-side outward.
  let cx = anchor.x, cy = anchor.y;
  if (face === 'east') cx += half;
  else if (face === 'west') cx -= half;
  else if (face === 'south') cy += half;
  else if (face === 'north') cy -= half;
  return { cx, cy, half, face, anchor, item, effectiveSide };
}

function bboxRect(b) {
  return { x: b.cx - b.half, y: b.cy - b.half, width: b.half * 2, height: b.half * 2 };
}

function rectsOverlap(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x
        || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

export function applyEndpointBBoxRepulsion(world, opts = {}) {
  if (!world || !world.edgeIndex) return;
  const k = opts.kEndpointBBox ?? K_ENDPOINT_BBOX;
  const warningsSink = opts.warningsSink ?? world.warningsSink ?? null;

  // 1. Coleta anchors e agrupa por face pra auto-clamp.
  const anchors = collectEndpointAnchors(world, opts);
  if (!anchors.length) return;
  const groupsByFace = groupByFace(anchors);

  // 2. Constrói BBoxes (uma por anchor) com clamping aplicado.
  const allBoxes = [];
  for (const [, list] of groupsByFace) {
    for (const item of list) {
      allBoxes.push(buildBBox(item, list.length, warningsSink));
    }
  }

  // 3. BBox-vs-BBox: pares que sobrepõem cedem tangencialmente, MAS
  //    apenas quando o par está habilitado a interagir:
  //    - mesmo nó (anchors compartilham .rect): NUNCA. Coincidência de
  //      endpoints no mesmo nó é permitida — o desenho fica limpo
  //      empilhando endpoints no mesmo ponto.
  //    - nós diferentes: só se as arestas compartilham edgeLayer
  //      (`resolver.edgeLayerPair` casa) — sem layer comum, sem
  //      interação. (Sem resolver — modo dos testes unit — assume
  //      legacy: sempre atua.)
  const edgeLayerPair = opts.resolver?.edgeLayerPair;
  for (let i = 0; i < allBoxes.length; i++) {
    for (let j = i + 1; j < allBoxes.length; j++) {
      const A = allBoxes[i];
      const B = allBoxes[j];
      if (A.anchor === B.anchor) continue;
      if (!bboxPairEnabled(A, B, edgeLayerPair)) continue;
      const rA = bboxRect(A);
      const rB = bboxRect(B);
      if (!rectsOverlap(rA, rB)) continue;
      applyBBoxPairForce(A, B, k);
    }
  }

  // 4. BBox-vs-segmento foreign (P6): só segmento cede; gated por
  //    `edgeLayerPair` reusado do passo 3.
  for (const box of allBoxes) {
    const ownEdgeId = box.item.info.edge?.id;
    for (const otherInfo of world.edgeIndex.values()) {
      if (otherInfo.skipped) continue;
      if (otherInfo.kind === 'curve') continue;
      if (!otherInfo.segments) continue;
      if (otherInfo === box.item.info) continue;
      if (edgeLayerPair && ownEdgeId && otherInfo.edge?.id) {
        if (!edgeLayerPair(ownEdgeId, otherInfo.edge.id)) continue;
      }
      const rBox = bboxRect(box);
      for (const seg of otherInfo.segments) {
        const sBox = segmentBBox(seg);
        if (!rectsOverlap(rBox, sBox)) continue;
        const push = segPushFromBBox(box, seg);
        if (push !== 0) applySegPerpForceLocal(seg, push * (opts.kRepel ?? K_REPEL_NODE));
      }
    }
  }
}

function bboxPairEnabled(A, B, edgeLayerPair) {
  // Mesmo nó → endpoints podem coincidir livremente.
  if (A.anchor.rect === B.anchor.rect) return false;
  if (!edgeLayerPair) return true;
  const idA = A.item.info.edge?.id;
  const idB = B.item.info.edge?.id;
  if (!idA || !idB) return true;
  return edgeLayerPair(idA, idB) != null;
}

// Empurra o par (A, B) ao longo de suas tangentes locais. Para mesma face,
// tangente é trivial; para faces distintas, projeta cada um na sua tangente.
// A força no anchor é puro tangencial (perpendicular ao trilho é absorvida
// pelo clamp pós-step de qualquer jeito; aplicamos a componente bruta).
function applyBBoxPairForce(A, B, k) {
  // Vetor de separação (centro de B → centro de A): empurra A na direção
  // contrária ao centro de B.
  const dx = A.cx - B.cx;
  const dy = A.cy - B.cy;
  // Magnitude de overlap = soma de halves - distância. Use uma versão
  // simplificada: queremos uma força de magnitude proporcional ao overlap
  // estimado, dirigida tangencialmente em cada lado.
  const ax = applyTangentialPart(A.anchor, A.face, dx, dy);
  const bx = applyTangentialPart(B.anchor, B.face, -dx, -dy);
  // Escala pela constante; metade pra cada lado.
  A.anchor.fx += ax.fx * k * 0.5;
  A.anchor.fy += ax.fy * k * 0.5;
  B.anchor.fx += bx.fx * k * 0.5;
  B.anchor.fy += bx.fy * k * 0.5;
}

function applyTangentialPart(anchor, face, dx, dy) {
  // Tangencial = eixo paralelo à face. East/West → tangent = y. N/S → x.
  if (face === 'east' || face === 'west') {
    return { fx: 0, fy: dy };
  }
  return { fx: dx, fy: 0 };
}

// Calcula o quanto o segmento `seg` deve ser empurrado perpendicular pra
// sair do BBox `box`. Análogo a `nodePushPerp` em forces.js, mas com o
// BBox como obstáculo.
function segPushFromBBox(box, seg) {
  const r = bboxRect(box);
  const c = getSegmentC(seg);
  if (seg.orientation === 'h') {
    const top = r.y;
    const bottom = r.y + r.height;
    if (c <= top || c >= bottom) return 0;
    const upRoom = c - top;
    const downRoom = bottom - c;
    return upRoom < downRoom ? -(upRoom + 1) : (downRoom + 1);
  }
  const left = r.x;
  const right = r.x + r.width;
  if (c <= left || c >= right) return 0;
  const leftRoom = c - left;
  const rightRoom = right - c;
  return leftRoom < rightRoom ? -(leftRoom + 1) : (rightRoom + 1);
}

function applySegPerpForceLocal(seg, F) {
  if (F === 0) return;
  if (seg.orientation === 'h') {
    if (seg.prevCorner) seg.prevCorner.fy += F;
    if (seg.nextCorner) seg.nextCorner.fy += F;
  } else {
    if (seg.prevCorner) seg.prevCorner.fx += F;
    if (seg.nextCorner) seg.nextCorner.fx += F;
  }
}

