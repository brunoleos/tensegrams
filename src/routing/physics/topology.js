// Topology change: fissão e fusão de segmentos.
//
// Fissão (5.5): SegmentBody com força perpendicular líquida nos
//   endpoints > τ_split por ≥ K_split ticks → divide em 2 SegmentBody
//   + 1 CornerBody novo no midpoint. Permite que o segmento "dobre"
//   pra contornar obstáculos que não cabem na perpendicular pura.
//
// Fusão (5.7+): 3 CornerBody colineares com folga geométrica >
//   τ_merge por ≥ K_merge ticks → remove o do meio, funde 2 SegmentBody.
//
// Cooldown: corpos recém-criados marcados com `topologyCooldown=C`;
// não podem mudar topologia até zerar. Evita loop fissão↔fusão.

import { makeCornerBody, makeSegmentBody, makePointBody, getSegmentC } from './bodies.js';

export const COOLDOWN_DEFAULT = 10;
export const SPLIT_THRESHOLD_DEFAULT = 4;     // px de força residual
export const SPLIT_TICKS_DEFAULT = 5;
export const MERGE_THRESHOLD_DEFAULT = 0.5;   // px de folga geométrica
export const MERGE_TICKS_DEFAULT = 10;

// Divide um segmento ortogonal em 2 — cria CornerBody novo no midpoint,
// dois novos SegmentBody (prevCorner→Cm, Cm→nextCorner), atualiza
// listas do edgeIndex e do world.bodies, marca cooldown em todos os
// novos. Retorna { cm, seg1, seg2 } pra inspeção/teste.
//
// Pré-condições:
//   - seg.prevCorner e seg.nextCorner já têm coord perpendicular igual
//     (Manhattan estrita garantida por projectManhattanEdge).
//   - seg pertence ao edgeIndex e world.bodies.
export function splitSegment(seg, world, opts = {}) {
  const cooldown = opts.cooldown ?? COOLDOWN_DEFAULT;
  const info = world.edgeIndex.get(_edgeIdOfSeg(seg));
  if (!info || !info.segments || !info.corners) return null;
  const segIdx = info.segments.indexOf(seg);
  if (segIdx < 0) return null;

  const C1 = seg.prevCorner;
  const C2 = seg.nextCorner;
  const mx = (C1.x + C2.x) / 2;
  const my = (C1.y + C2.y) / 2;
  // Sufixo "ms" (mid-split) pra distinguir de IDs originais (#cN/#sN).
  // Tickbump previne colisão se a mesma seg sofrer split múltiplo.
  const tag = `${seg.id}_split${++world._splitSeq || (world._splitSeq = 1)}`;
  const cm = makeCornerBody({ id: `${tag}#cm`, x: mx, y: my });
  cm.topologyCooldown = cooldown;
  // Salva yOrigin/xOrigin do meio em local "ideal" — mesma coord do
  // segmento atual. Sem isso a spring de origem puxaria cm pra (0,0)
  // do default.
  cm.xOrigin = mx;
  cm.yOrigin = my;

  const seg1 = makeSegmentBody({
    id: `${tag}#s1`,
    orientation: seg.orientation,
    pad: seg.pad,
    prevCorner: C1,
    nextCorner: cm,
  });
  seg1.topologyCooldown = cooldown;
  seg1.strokeWidth = seg.strokeWidth;

  const seg2 = makeSegmentBody({
    id: `${tag}#s2`,
    orientation: seg.orientation,
    pad: seg.pad,
    prevCorner: cm,
    nextCorner: C2,
  });
  seg2.topologyCooldown = cooldown;
  seg2.strokeWidth = seg.strokeWidth;

  // Marca corners adjacentes com cooldown também — evita fusão
  // imediata do corner recém-criado contra os vizinhos antigos.
  C1.topologyCooldown = Math.max(C1.topologyCooldown, cooldown);
  C2.topologyCooldown = Math.max(C2.topologyCooldown, cooldown);

  // Atualiza estruturas: insere cm entre corners[segIdx] e corners[segIdx+1].
  // segments[segIdx] vira seg1; insere seg2 logo após.
  info.corners.splice(segIdx + 1, 0, cm);
  info.segments.splice(segIdx, 1, seg1, seg2);

  // world.bodies: remove seg antigo, adiciona cm + seg1 + seg2.
  const bi = world.bodies.indexOf(seg);
  if (bi >= 0) world.bodies.splice(bi, 1);
  world.bodies.push(cm, seg1, seg2);

  return { cm, seg1, seg2 };
}

// Divide um segmento adjacente a anchor em topologia "shelf" — cria 4
// CornerBody + 5 SegmentBody alternando H-V-H-V-H (ou V-H-V-H-V).
// Necessário quando o split simples (1 corner colinear) não consegue
// produzir desvio: anchor pinado força projeção Manhattan estrita que
// puxaria o corner novo de volta pra y do anchor.
//
// Topologia para seg H entre C1(xL, yA) e C2(xR, yA):
//
//     C1 ──── Cm1                    Cm4 ──── C2
//               │                      │
//              Cm2 ─────────── Cm3
//
//   Cm1 = (xL + L/4, yA)
//   Cm2 = (xL + L/4, yA + offset)
//   Cm3 = (xR - L/4, yA + offset)
//   Cm4 = (xR - L/4, yA)
//
// Sinal de `offset` = signal da força residual (lado pra onde a
// repulsão quer empurrar). Magnitude > K_fusion * stroke + margem
// pra que o seg V inicial não seja absorvido pela fusão no step
// seguinte. Cooldown bem maior que o simple também.
//
// Para seg V, gira 90°: troca x↔y e cria shelf vertical.
export function splitSegmentShelf(seg, world, opts = {}) {
  const cooldown = opts.cooldown ?? COOLDOWN_DEFAULT * 3;
  const info = world.edgeIndex.get(_edgeIdOfSeg(seg));
  if (!info || !info.segments || !info.corners) return null;
  const segIdx = info.segments.indexOf(seg);
  if (segIdx < 0) return null;

  const C1 = seg.prevCorner;
  const C2 = seg.nextCorner;
  const orientation = seg.orientation;
  const perp = orientation === 'h' ? 'v' : 'h';
  const stroke = seg.strokeWidth ?? 2;
  // Offset > K_fusion * stroke pra escapar fusão imediata; +50% margem.
  const offsetMag = Math.max(stroke * (FUSION_MANHATTAN_K_DEFAULT + 4), 12);
  const fres = segmentResidualForce(seg);
  const sign = fres >= 0 ? 1 : -1;
  const offset = sign * offsetMag;

  const tag = `${seg.id}_shelf${++world._shelfSeq || (world._shelfSeq = 1)}`;
  let cm1, cm2, cm3, cm4;
  if (orientation === 'h') {
    const dx = (C2.x - C1.x) * 0.25;  // quarto do comprimento; signed.
    const yA = C1.y;
    const yM = yA + offset;
    cm1 = makeCornerBody({ id: `${tag}#cm1`, x: C1.x + dx, y: yA });
    cm2 = makeCornerBody({ id: `${tag}#cm2`, x: C1.x + dx, y: yM });
    cm3 = makeCornerBody({ id: `${tag}#cm3`, x: C2.x - dx, y: yM });
    cm4 = makeCornerBody({ id: `${tag}#cm4`, x: C2.x - dx, y: yA });
  } else {
    const dy = (C2.y - C1.y) * 0.25;
    const xA = C1.x;
    const xM = xA + offset;
    cm1 = makeCornerBody({ id: `${tag}#cm1`, x: xA, y: C1.y + dy });
    cm2 = makeCornerBody({ id: `${tag}#cm2`, x: xM, y: C1.y + dy });
    cm3 = makeCornerBody({ id: `${tag}#cm3`, x: xM, y: C2.y - dy });
    cm4 = makeCornerBody({ id: `${tag}#cm4`, x: xA, y: C2.y - dy });
  }
  for (const c of [cm1, cm2, cm3, cm4]) {
    c.xOrigin = c.x;
    c.yOrigin = c.y;
    c.topologyCooldown = cooldown;
  }

  // 5 segs alternando: orientação original, perpendicular, original, perp, original.
  const mkSeg = (k, orient, prev, next) => {
    const s = makeSegmentBody({
      id: `${tag}#s${k}`,
      orientation: orient,
      pad: seg.pad,
      prevCorner: prev,
      nextCorner: next,
    });
    s.topologyCooldown = cooldown;
    s.strokeWidth = seg.strokeWidth;
    return s;
  };
  const segs = [
    mkSeg(1, orientation, C1,  cm1),
    mkSeg(2, perp,        cm1, cm2),
    mkSeg(3, orientation, cm2, cm3),
    mkSeg(4, perp,        cm3, cm4),
    mkSeg(5, orientation, cm4, C2),
  ];

  C1.topologyCooldown = Math.max(C1.topologyCooldown, cooldown);
  C2.topologyCooldown = Math.max(C2.topologyCooldown, cooldown);

  info.corners.splice(segIdx + 1, 0, cm1, cm2, cm3, cm4);
  info.segments.splice(segIdx, 1, ...segs);

  const bi = world.bodies.indexOf(seg);
  if (bi >= 0) world.bodies.splice(bi, 1);
  world.bodies.push(cm1, cm2, cm3, cm4, ...segs);

  return { corners: [cm1, cm2, cm3, cm4], segs };
}

// Funde um segmento curto (length < K * strokeWidth) — remove o
// segmento e seus 2 corners endpoints, criando um corner único Cm no
// midpoint pra onde os 2 segmentos perpendiculares adjacentes
// passam a apontar. Pré-condições:
//   - seg tem `prevSeg` (segmento anterior na polyline) e `nextSeg`
//     (posterior); ambos perpendiculares ao seg curto.
//   - nenhum dos 2 corners endpoints é pinned (anchors não podem
//     ser removidos; fusão de segmento adjacente a anchor exige
//     tratamento especial — fora do escopo da 5.7).
//   - seg pertence ao edgeIndex e world.bodies.
//
// Retorna { cm, prevSeg, nextSeg } ou null se as pré-condições falham.
export function mergeColinear(seg, world, opts = {}) {
  const cooldown = opts.cooldown ?? COOLDOWN_DEFAULT;
  const info = world.edgeIndex.get(_edgeIdOfSeg(seg));
  if (!info || !info.segments || !info.corners) return null;
  const segIdx = info.segments.indexOf(seg);
  if (segIdx <= 0 || segIdx >= info.segments.length - 1) {
    // Primeiro ou último segmento da edge: não há seg adjacente em
    // ambos os lados. Fusão de segmento terminal fica pra fase futura.
    return null;
  }
  const prevSeg = info.segments[segIdx - 1];
  const nextSeg = info.segments[segIdx + 1];
  if (prevSeg.orientation === seg.orientation) return null;  // não-perpendicular
  if (nextSeg.orientation === seg.orientation) return null;

  const Ca = seg.prevCorner;
  const Cb = seg.nextCorner;
  if (Ca.pinned || Cb.pinned) return null;

  const tag = `${seg.id}_merge${++world._mergeSeq || (world._mergeSeq = 1)}`;
  const cm = makeCornerBody({
    id: `${tag}#cm`,
    x: (Ca.x + Cb.x) / 2,
    y: (Ca.y + Cb.y) / 2,
  });
  cm.xOrigin = cm.x;
  cm.yOrigin = cm.y;
  cm.topologyCooldown = cooldown;

  // Reaponta os segments perpendiculares pra Cm. prevSeg.nextCorner
  // era Ca; vira Cm. nextSeg.prevCorner era Cb; vira Cm.
  prevSeg.nextCorner = cm;
  nextSeg.prevCorner = cm;
  prevSeg.topologyCooldown = Math.max(prevSeg.topologyCooldown, cooldown);
  nextSeg.topologyCooldown = Math.max(nextSeg.topologyCooldown, cooldown);

  // Atualiza estruturas: remove seg, Ca, Cb; insere Cm na posição
  // que era de Ca em corners.
  const caIdx = info.corners.indexOf(Ca);
  if (caIdx >= 0) info.corners.splice(caIdx, 2, cm);  // remove Ca+Cb, insere Cm
  info.segments.splice(segIdx, 1);  // remove seg

  // world.bodies: remove seg, Ca, Cb. Adiciona Cm.
  for (const removed of [seg, Ca, Cb]) {
    const bi = world.bodies.indexOf(removed);
    if (bi >= 0) world.bodies.splice(bi, 1);
  }
  world.bodies.push(cm);

  return { cm, prevSeg, nextSeg };
}

// Comprimento paralelo do segmento — `|x1 - x0|` (horizontal) ou
// `|y1 - y0|` (vertical). Usado pelo critério de fusão Manhattan.
export function segmentLength(seg) {
  const C1 = seg.prevCorner;
  const C2 = seg.nextCorner;
  if (!C1 || !C2) return 0;
  return seg.orientation === 'h'
    ? Math.abs(C2.x - C1.x)
    : Math.abs(C2.y - C1.y);
}

// Decide se o segmento merece fusão: cooldown zerou, comprimento <
// K * strokeWidth, segmentos perpendiculares adjacentes existem e
// nenhum dos corners endpoints é pinado. Fusão de segmento terminal
// (adjacente a anchor) requer tratamento especial — fora do escopo.
export function shouldMerge(seg, world, manhattanK) {
  if (seg.topologyCooldown > 0) return false;
  if (!seg.prevCorner || !seg.nextCorner) return false;
  if (seg.prevCorner.pinned || seg.nextCorner.pinned) return false;
  const stroke = seg.strokeWidth ?? 2;
  if (segmentLength(seg) >= manhattanK * stroke) return false;
  // Precisa ter prevSeg e nextSeg perpendiculares no edgeIndex.
  const info = world.edgeIndex.get(_edgeIdOfSeg(seg));
  if (!info || !info.segments) return false;
  const idx = info.segments.indexOf(seg);
  if (idx <= 0 || idx >= info.segments.length - 1) return false;
  if (info.segments[idx - 1].orientation === seg.orientation) return false;
  if (info.segments[idx + 1].orientation === seg.orientation) return false;
  // Manhattan-safety: after the merge, the two perpendicular neighbours form
  // a single run that shares one corner (Cm = midpoint). projectManhattanEdge
  // can only equalise that run's perpendicular coord to ONE value. If the
  // run's OUTER corners (prevSeg.prevCorner and nextSeg.nextCorner) are both
  // pinned (anchors) at different perp coords, no single value satisfies
  // both — one of the post-merge legs would stay diagonal. Block the fusion.
  const prevSeg = info.segments[idx - 1];
  const nextSeg = info.segments[idx + 1];
  const outer0 = prevSeg.prevCorner;
  const outerN = nextSeg.nextCorner;
  if (outer0 && outerN && outer0.pinned && outerN.pinned) {
    // After fusion, the merged run has the orientation of prevSeg (= perp
    // to `seg`). Its corners share the axis perpendicular to that = seg's
    // own axis: `x` when seg is horizontal, `y` when seg is vertical.
    const sharedAxis = seg.orientation === 'h' ? 'x' : 'y';
    if (Math.abs(outer0[sharedAxis] - outerN[sharedAxis]) > 1e-6) return false;
  }
  return true;
}

export const FUSION_MANHATTAN_K_DEFAULT = 4;
export const MIN_CONTROL_DISTANCE_DEFAULT = 6;  // px — fusão curved

// Cria PointBody no midpoint de 2 pontos vizinhos de uma curva.
// Útil quando a distância entre eles excede 2x o comprimento ideal
// ou a curvatura local fica alta. Insere no info.points e no
// world.bodies; cooldown evita oscilação imediata.
export function splitCurvePoint(info, idx, world, opts = {}) {
  if (!info || info.kind !== 'curve') return null;
  if (idx < 0 || idx + 1 >= info.points.length) return null;
  const cooldown = opts.cooldown ?? COOLDOWN_DEFAULT;
  const a = info.points[idx];
  const b = info.points[idx + 1];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const tag = `${a.id || 'pt'}_csplit${++world._curveSplitSeq || (world._curveSplitSeq = 1)}`;
  const newPoint = makePointBody({ id: `${tag}`, x: mx, y: my });
  newPoint.xOrigin = mx;
  newPoint.yOrigin = my;
  newPoint.topologyCooldown = cooldown;

  info.points.splice(idx + 1, 0, newPoint);
  info._chainLen = null;  // invalida cache
  info._chainN = null;
  world.bodies.push(newPoint);

  return newPoint;
}

// Remove PointBody de uma curva. Trigger típico: ponto colapsou
// contra vizinho (dist < minControlDistance). Endpoints pinados não
// são candidatos.
export function mergeCurvePoint(info, idx, world) {
  if (!info || info.kind !== 'curve') return null;
  if (idx <= 0 || idx >= info.points.length - 1) return null;  // nunca endpoints
  const point = info.points[idx];
  if (point.pinned) return null;
  if (point.topologyCooldown > 0) return null;

  info.points.splice(idx, 1);
  info._chainLen = null;
  info._chainN = null;

  const bi = world.bodies.indexOf(point);
  if (bi >= 0) world.bodies.splice(bi, 1);

  return point;
}

// Função utilitária pro detector futuro — distância para o vizinho
// (mínimo entre prev e next).
export function curvePointNeighborDistance(info, idx) {
  const pts = info?.points;
  if (!pts || idx <= 0 || idx >= pts.length - 1) return Infinity;
  const p = pts[idx];
  const dPrev = Math.hypot(p.x - pts[idx - 1].x, p.y - pts[idx - 1].y);
  const dNext = Math.hypot(p.x - pts[idx + 1].x, p.y - pts[idx + 1].y);
  return Math.min(dPrev, dNext);
}

// Decrementa cooldown topológico. Chamado no fim de cada step pra
// todos os bodies (corners, segments, points). 0 = pode mudar topologia.
export function tickCooldown(body) {
  if (body.topologyCooldown > 0) body.topologyCooldown -= 1;
}

// Calcula a força perpendicular líquida agindo no segmento — média
// dos componentes perpendiculares ao eixo nos dois corners endpoints.
// Para horizontal: (C1.fy + C2.fy)/2. Vertical: (C1.fx + C2.fx)/2.
export function segmentResidualForce(seg) {
  const C1 = seg.prevCorner;
  const C2 = seg.nextCorner;
  if (!C1 || !C2) return 0;
  if (seg.orientation === 'h') return (C1.fy + C2.fy) / 2;
  return (C1.fx + C2.fx) / 2;
}

// Decide se o segmento merece split: cooldown zerou, e |f_res| >= τ
// por ≥ K ticks consecutivos. Quando a força volta abaixo do threshold,
// `residualTicks` reseta (zona morta evita oscilação no limite). Solver
// chama `maybeSplitSegment` após calcular forças, antes da integração.
export function updateSplitCounter(seg, threshold) {
  const f = Math.abs(segmentResidualForce(seg));
  if (f >= threshold) {
    seg.residualTicks = (seg.residualTicks || 0) + 1;
  } else {
    seg.residualTicks = 0;
  }
  return seg.residualTicks;
}

export function shouldSplit(seg, threshold, ticks) {
  if (seg.topologyCooldown > 0) return false;
  return seg.residualTicks >= ticks && Math.abs(segmentResidualForce(seg)) >= threshold;
}

// IDs de segment são "<edgeId>#sN" ou "<edgeId>#sN_splitK#sN" após split.
// O edgeId é a parte antes do primeiro '#'.
function _edgeIdOfSeg(seg) {
  const i = seg.id.indexOf('#');
  return i < 0 ? seg.id : seg.id.slice(0, i);
}
