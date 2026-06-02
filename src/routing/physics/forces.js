// Forças aplicadas pelos corpos do solver de routing.
//
// Todas escrevem em acumuladores (fx/fy nos corners/points) e são
// chamadas em sequência por step. A integração lê esses acumuladores
// e atualiza velocidades. SegmentBody não tem acumulador próprio
// (após o refactor 5.0): forças no segmento são redistribuídas
// perpendicular nos dois endpoints (cada corner recebe a componente
// inteira `F` — preserva aceleração agregada equivalente ao caso
// onde segmento integrava seu próprio DOF).
//
// Spring "ideal path" aplicada APENAS em corners/points — segments
// são derivados dos corners; spring nos corners já cobre o role de
// "voltar à origem".

import { getSegmentC, getSegmentBounds } from './bodies.js';

export const K_ORIGIN = 0.005;
export const K_REPEL_NODE = 2.0;
export const K_REPEL_PARALLEL = 0.6;
export const K_REPEL_PERP = 0.6;
export const PARALLEL_GAP = 12;
export const NODE_PAD = 12;
// Margem extra adicionada ao push: garante que o equilíbrio (origin
// vs repel) caia FORA da BBox, não no limite. Sem isso, origin spring
// arrasta o corpo de volta pra próximo da face.
const NODE_PUSH_MARGIN = 4;
const PARALLEL_PUSH_MARGIN = 1;
const PERP_PUSH_MARGIN = 1;
// Teto do deslocamento-alvo por step da repulsão perpendicular. A
// "saída" de um cruzamento pode ser dezenas de px (metade do span do
// segmento); empurrar tudo de uma vez geraria força >> τ_split,
// saturaria o cap de velocidade e dispararia FISSÃO em cascata
// (topologia explode em grafos densamente cruzados). Limitar mantém a
// força perp abaixo do threshold de fissão — cruzamentos se resolvem
// por DESLIZAMENTO (vários steps), enquanto fissão fica reservada à
// repulsão de nó (detour em torno de obstáculos). Com k=0.6 e este
// teto, |F_perp| ≤ (5+1)·0.6 = 3.6 < SPLIT_THRESHOLD (4).
const PERP_PUSH_CAP = 5;

// Spring que puxa cada corner/point livre de volta para sua posição
// de origem (warm-start). Sem aplicação em segments — após 5.0 eles
// são puramente derivados.
export function applyOriginSprings(world, opts = {}) {
  const k = opts.kOrigin ?? K_ORIGIN;
  for (const b of world.bodies) {
    if (b.kind === 'corner' || b.kind === 'point') {
      if (b.pinned) continue;
      b.fx += -k * (b.x - b.xOrigin);
      b.fy += -k * (b.y - b.yOrigin);
    }
  }
}

// Para cada segmento, força perpendicular se BBox do segmento
// penetra (até `pad`) o BBox de algum nó alheio (não-source/target/
// ancestor). Força é distribuída nos dois corners endpoints — cada
// corner recebe a componente inteira; após integração, ambos os
// corners se movem juntos (Manhattan estrita garante isso após
// `projectManhattanEdge`).
export function applyNodeRepulsion(world, routingRects, opts = {}) {
  const pad = opts.nodePad ?? NODE_PAD;
  const k = opts.kRepel ?? K_REPEL_NODE;
  // When a collision resolver is provided, a foreign node only counts as an
  // obstacle for this edge when `edgeNodePair(edge, nodeId)` returns truthy
  // (= the pair shares at least one collision layer). Mirrors the A* router's
  // (obstacle-route) layer-aware filtering so the physics solver doesn't
  // push edges off nodes they wouldn't have collided with under A*. Without
  // a resolver, legacy behaviour: every foreign node pushes.
  const edgeNodePair = opts.resolver?.edgeNodePair;
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (!info.segments) continue;
    const allowed = info.allowedNodeIds || new Set();
    for (const seg of info.segments) {
      const segBox = segmentBBox(seg);
      const isEndpointLeg = !!(seg.prevCorner?.pinned || seg.nextCorner?.pinned);
      // Per-tick flag: set when this segment crosses a foreign node's body
      // but CANNOT slide out because at least one corner is pinned. A pinned
      // corner fixes the leg's perpendicular coordinate, so node repulsion
      // adds force the integrator can't act on — the edge stays speared
      // through the node (a straight edge between opposite-side anchors, or
      // an endpoint leg pinned on the node's row). Phase G reads this flag to
      // trigger local fission (obstacle detour) even when global fission is
      // off. A fully-free segment instead slides out and is never flagged.
      // Reset each tick before re-evaluating.
      seg.foreignObstacle = false;
      for (const [nodeId, rect] of routingRects) {
        if (allowed.has(nodeId)) continue;
        if (edgeNodePair && !edgeNodePair(info.edge, nodeId)) continue;
        const padded = expand(rect, pad);
        if (!rectsOverlap(segBox, padded)) continue;
        const push = nodePushPerp(seg, rect, pad);
        applySegPerpForce(seg, push * k);
        // Foreign node whose CORE a pinned segment crosses → hard fission.
        if (isEndpointLeg && rectsOverlap(segBox, rect)) seg.foreignObstacle = true;
      }
    }
  }
}

// Para cada par de segmentos com MESMA orientação que se sobrepõem
// no eixo paralelo, se a distância perpendicular for menor que
// `minGap`, empurra ambos pro lado livre — força distribuída nos
// corners de cada segmento.
export function applyParallelRepulsion(world, opts = {}) {
  const minGap = opts.parallelGap ?? PARALLEL_GAP;
  const k = opts.kRepel ?? K_REPEL_PARALLEL;
  // When a resolver is provided, two edges' parallel segments only push each
  // other if their edges share at least one collision layer (edgeEdgePair !==
  // null). Mirrors applyNodeRepulsion's layer-aware filter. Without a resolver,
  // legacy behaviour: every parallel pair pushes.
  const edgeEdgePair = opts.resolver?.edgeEdgePair;
  const segments = [];
  for (const b of world.bodies) if (b.kind === 'segment') segments.push(b);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i], b = segments[j];
      if (a.orientation !== b.orientation) continue;
      if (sameEdge(a.id, b.id)) continue;
      if (edgeEdgePair && !edgeEdgePair(edgeIdOfSeg(a.id), edgeIdOfSeg(b.id))) continue;
      const [ax0, ax1] = getSegmentBounds(a);
      const [bx0, bx1] = getSegmentBounds(b);
      const overlap = Math.min(ax1, bx1) - Math.max(ax0, bx0);
      if (overlap <= 0) continue;
      const ac = getSegmentC(a);
      const bc = getSegmentC(b);
      const dist = Math.abs(ac - bc);
      if (dist >= minGap) continue;
      const need = (minGap - dist) + PARALLEL_PUSH_MARGIN;
      const dir = ac >= bc ? 1 : -1;
      applySegPerpForce(a, (need * 0.5) * dir * k);
      applySegPerpForce(b, -(need * 0.5) * dir * k);
    }
  }
}

// Geometria.

export function segmentBBox(seg) {
  const c = getSegmentC(seg);
  const [x0, x1] = getSegmentBounds(seg);
  const pad = seg.pad ?? 0;
  if (seg.orientation === 'h') {
    return { x: x0, y: c - pad, width: x1 - x0, height: pad * 2 };
  }
  return { x: c - pad, y: x0, width: pad * 2, height: x1 - x0 };
}

function expand(rect, pad) {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function rectsOverlap(a, b) {
  return !(a.x + a.width < b.x || b.x + b.width < a.x
        || a.y + a.height < b.y || b.y + b.height < a.y);
}

// Empurra o segmento perpendicular pra fora do nó (mais próximo da
// face livre). Adiciona NODE_PUSH_MARGIN ao deslocamento alvo pra que
// o equilíbrio com a spring de origem fique FORA da BBox — sem
// margem, repel cai a zero exatamente na face e o origin arrasta o
// corpo de volta pra dentro.
function nodePushPerp(seg, rect, pad) {
  const margin = NODE_PUSH_MARGIN;
  const c = getSegmentC(seg);
  if (seg.orientation === 'h') {
    const top = rect.y - pad;
    const bottom = rect.y + rect.height + pad;
    if (c <= top || c >= bottom) return 0;
    const upRoom = c - top;
    const downRoom = bottom - c;
    return upRoom < downRoom ? -(upRoom + margin) : (downRoom + margin);
  }
  const left = rect.x - pad;
  const right = rect.x + rect.width + pad;
  if (c <= left || c >= right) return 0;
  const leftRoom = c - left;
  const rightRoom = right - c;
  return leftRoom < rightRoom ? -(leftRoom + margin) : (rightRoom + margin);
}

// Distribui força perpendicular aos dois corners endpoints — cada
// corner recebe a componente inteira `F`. Preserva aceleração
// agregada equivalente ao DOF próprio do segmento na arquitetura
// pré-5.0 (onde `seg.fc = F` produzia `seg.c += F * dt²` num step).
function applySegPerpForce(seg, F) {
  if (F === 0) return;
  if (seg.orientation === 'h') {
    if (seg.prevCorner) seg.prevCorner.fy += F;
    if (seg.nextCorner) seg.nextCorner.fy += F;
  } else {
    if (seg.prevCorner) seg.prevCorner.fx += F;
    if (seg.nextCorner) seg.nextCorner.fx += F;
  }
}

// IDs de segmento são "<edgeId>#sN" — mesmo prefixo "<edgeId>#"
// indica mesma edge.
function sameEdge(idA, idB) {
  const i = idA.lastIndexOf('#');
  const j = idB.lastIndexOf('#');
  if (i < 0 || j < 0) return false;
  return idA.slice(0, i) === idB.slice(0, j);
}

// "<edgeId>#sN" → "<edgeId>" — first '#', since fission creates ids like
// "<edgeId>#sN_splitK#sM" where the edge id is the part before the FIRST '#'.
function edgeIdOfSeg(segId) {
  const i = segId.indexOf('#');
  return i < 0 ? segId : segId.slice(0, i);
}

// Mola entre PointBody vizinhos numa curva — comprimento natural é o
// comprimento total da polyline original dividido pelo número de
// segmentos (N-1). Mantém os pontos de controle aproximadamente
// uniformes; sem essa força, repulsão isolada agruparia uns pontos
// e esticaria outros.
//
// Usado por curves (kind='curve' no edgeIndex) — corners ortogonais
// já têm spring de origem mais a projeção Manhattan que cumprem
// papel análogo.
export const K_CHAIN_SPRING = 0.02;

export function applyChainSpring(world, opts = {}) {
  const k = opts.kChain ?? K_CHAIN_SPRING;
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (info.kind !== 'curve') continue;
    const pts = info.points;
    if (!pts || pts.length < 2) continue;
    // Cache do "comprimento ideal" no edgeIndex pra evitar recálculo
    // a cada step. Recalculado se o número de pontos muda (split/merge).
    if (info._chainLen == null || info._chainN !== pts.length) {
      info._chainLen = chainNaturalLength(pts);
      info._chainN = pts.length;
    }
    const Lideal = info._chainLen;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-6) continue;
      const stretch = dist - Lideal;
      const fx = k * stretch * (dx / dist);
      const fy = k * stretch * (dy / dist);
      // Spring puxa cada ponto na direção do outro (atrai quando
      // alongada, repele quando comprimida).
      if (!a.pinned) { a.fx += fx; a.fy += fy; }
      if (!b.pinned) { b.fx -= fx; b.fy -= fy; }
    }
  }
}

function chainNaturalLength(pts) {
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total / Math.max(1, pts.length - 1);
}

// Fase 3c — repulsão perpendicular. Para cada par de edges que
// COMPARTILHA edgeLayer (`opts.edgePair(eidA, eidB)` ≠ null), separa
// segmentos de orientações opostas que se CRUZAM: cada um é empurrado
// para sua saída perpendicular mais próxima, escalado pelo `frac` do par
// (lado de menor peso cede mais). Sem `opts.edgePair` → no-op: preserva
// `step()` chamado direto pelos testes das fases 2–5 e o caminho atual.
// Layers disjuntos (edgePair → null) → cruzamento livre (regra do
// usuário). A força some assim que o cruzamento desfaz; PERP_PUSH_MARGIN
// põe o equilíbrio logo FORA da faixa cruzada — sem ele o origin spring
// puxaria o segmento de volta pra dentro.
export function applyPerpRepulsion(world, opts = {}) {
  const edgePair = opts.edgePair;
  if (typeof edgePair !== 'function') return;
  const k = opts.kRepelPerp ?? K_REPEL_PERP;
  const margin = PERP_PUSH_MARGIN;

  const entries = [];
  for (const [eid, info] of world.edgeIndex) {
    if (info.skipped) continue;
    if (!info.segments || !info.corners) continue;
    entries.push([eid, info]);
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [eidA, infoA] = entries[i];
      const [eidB, infoB] = entries[j];
      const pair = edgePair(eidA, eidB);
      if (!pair) continue;
      const fracA = pair.frac ? pair.frac.a : 0.5;
      const fracB = pair.frac ? pair.frac.b : 0.5;

      for (const sa of infoA.segments) {
        for (const sb of infoB.segments) {
          if (sa.orientation === sb.orientation) continue;
          let h, v, fracH, fracV;
          if (sa.orientation === 'h') { h = sa; v = sb; fracH = fracA; fracV = fracB; }
          else { h = sb; v = sa; fracH = fracB; fracV = fracA; }

          const cH = getSegmentC(h);               // y da horizontal
          const [hx0, hx1] = getSegmentBounds(h);  // faixa x da horizontal
          const cV = getSegmentC(v);               // x da vertical
          const [vy0, vy1] = getSegmentBounds(v);  // faixa y da vertical

          // Só age em cruzamento interior próprio (não em toque em T/canto).
          if (!(cV > hx0 && cV < hx1 && cH > vy0 && cH < vy1)) continue;
          // P7 (Q1): removido o sharedNodes-spare blanket. Cruzamento
          // perto do nó comum agora resolve normalmente pela força
          // perpendicular — o vagão-no-trilho (P2) absorve o jitter no
          // anchor, então a vizinhança não precisa mais ser poupada.

          // Horizontal escapa em y pra fora de [vy0, vy1] (lado mais curto).
          const up = cH - vy0, down = vy1 - cH;
          const needH = Math.min(up < down ? up : down, PERP_PUSH_CAP) + margin;
          const dirH = up < down ? -1 : 1;
          // Vertical escapa em x pra fora de [hx0, hx1] (lado mais curto).
          const left = cV - hx0, right = hx1 - cV;
          const needV = Math.min(left < right ? left : right, PERP_PUSH_CAP) + margin;
          const dirV = left < right ? -1 : 1;

          applySegPerpForce(h, dirH * needH * k * fracH);
          applySegPerpForce(v, dirV * needV * k * fracV);
        }
      }
    }
  }
}

export function slackAttract(_segment, _idealC, _kSlack) {
  // Fase futura — atração à mediana entre source/target. Por ora
  // a spring de origem cobre o role de "voltar ao caminho ideal".
}
