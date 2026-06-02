// Seleção de face consciente de cruzamento (warm-start do engine physics).
//
// O roteador base (`routers/orthogonal.js`) escolhe a face de cada
// endpoint só pelo eixo dominante centro-a-centro — sem olhar para
// cruzamentos. Em grafos densos isso deixa cruzamentos que NENHUM
// deslizamento/relaxação resolve, porque a perna terminal está presa do
// lado errado do nó (ex.: aresta que sai pela face sul fica obrigada a
// cruzar a aproximação de outra aresta a um nó vizinho).
//
// Esta pré-passada faz uma busca gulosa: enquanto houver cruzamento
// shared-layer, tenta migrar a face de cada endpoint envolvido para uma
// das faces "à frente" (a horizontal e a vertical que apontam para o
// outro endpoint) e aplica a troca que mais reduz cruzamentos (desempate
// por comprimento total). Reconstrói a polyline Manhattan a partir das
// faces escolhidas (mesma geometria Z/L do roteador base). Roda ANTES de
// buildWorld; o solver físico então relaxa uma rota já descruzada.
//
// Não toca em curvas/splines, endpoints sem rect resolvível, nem nós com
// snap discreto (porta fixa). No-op sem `resolver.edgeLayerPair`.

import { centerOf } from './router.js';
import { faceOf } from './anchor-utils.js';
import { countSharedLayerCrossings, sharedLayerCrossingEdges } from './crossings.js';

const MAX_ITER_DEFAULT = 12;

function anchorOn(rect, face) {
  const c = centerOf(rect);
  if (face === 'east') return { x: rect.x + rect.width, y: c.y };
  if (face === 'west') return { x: rect.x, y: c.y };
  if (face === 'north') return { x: c.x, y: rect.y };
  return { x: c.x, y: rect.y + rect.height };  // south
}

// As 2 faces "à frente" de `rect` em direção a `otherCenter`: a
// horizontal (east/west) e a vertical (north/south) que apontam para o
// outro endpoint. Evita faces "para trás" que gerariam U-turn.
function candidateFaces(rect, otherCenter) {
  const c = centerOf(rect);
  return [
    otherCenter.x >= c.x ? 'east' : 'west',
    otherCenter.y >= c.y ? 'south' : 'north',
  ];
}

// Polyline Manhattan dadas as faces dos dois endpoints. Perna terminal
// perpendicular a cada face; midline no ponto médio das âncoras (igual a
// routers/orthogonal.js). Faces ambas horizontais → Z em midX; ambas
// verticais → Z em midY; mistas → L de 3 pontos.
function routeWithFaces(sRect, tRect, sFace, tFace) {
  const s = anchorOn(sRect, sFace);
  const t = anchorOn(tRect, tFace);
  const sh = sFace === 'east' || sFace === 'west';
  const th = tFace === 'east' || tFace === 'west';
  let points;
  if (sh && th) {
    const mx = (s.x + t.x) / 2;
    points = [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t];
  } else if (!sh && !th) {
    const my = (s.y + t.y) / 2;
    points = [s, { x: s.x, y: my }, { x: t.x, y: my }, t];
  } else {
    const corner = sh ? { x: t.x, y: s.y } : { x: s.x, y: t.y };
    points = [s, corner, t];
  }
  return points;
}

function manhattanLength(points) {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    total += Math.abs(points[i + 1].x - points[i].x)
           + Math.abs(points[i + 1].y - points[i].y);
  }
  return total;
}

function snapNodeIds(ir) {
  const out = new Set();
  if (!Array.isArray(ir?.nodes)) return out;
  for (const n of ir.nodes) {
    if (n && (n.snap != null || n.snapGroups != null)) out.add(n.id);
  }
  return out;
}

export function reassignFacesToReduceCrossings(ir, routedEdges, rects, resolver, opts = {}) {
  if (!ir || !ir.edges || !routedEdges || !rects) return routedEdges;
  if (!resolver || typeof resolver.edgeLayerPair !== 'function') return routedEdges;
  const maxIter = opts.maxIter ?? MAX_ITER_DEFAULT;
  const snapNodes = snapNodeIds(ir);

  // Estado mutável de face por edge gerenciável (ortogonal, com rects e
  // ≥2 pontos). Faces iniciais lidas da rota base via faceOf.
  const state = new Map();
  for (const e of ir.edges) {
    const re = routedEdges.get(e.id);
    if (!re || !re.points || re.points.length < 2) continue;
    if (re.kind === 'curve' || re.kind === 'spline') continue;
    const sRect = rects.get(e.source);
    const tRect = rects.get(e.target);
    if (!sRect || !tRect) continue;
    state.set(e.id, {
      id: e.id,
      re,
      sRect, tRect,
      sCenter: centerOf(sRect),
      tCenter: centerOf(tRect),
      sFace: faceOf(re.points[0], sRect),
      tFace: faceOf(re.points[re.points.length - 1], tRect),
      sLocked: snapNodes.has(e.source),
      tLocked: snapNodes.has(e.target),
    });
  }
  if (!state.size) return routedEdges;

  // Mapa de trabalho: começa como cópia das rotas atuais; edges
  // gerenciáveis são substituídas pela reconstrução a partir das faces
  // (idêntica à base quando a face não muda).
  const work = new Map(routedEdges);
  const rebuild = (st) => {
    const points = routeWithFaces(st.sRect, st.tRect, st.sFace, st.tFace);
    work.set(st.id, {
      ...st.re,
      points,
      sourceAnchor: points[0],
      targetAnchor: points[points.length - 1],
    });
  };
  for (const st of state.values()) rebuild(st);

  const totalLen = () => {
    let sum = 0;
    for (const st of state.values()) sum += manhattanLength(work.get(st.id).points);
    return sum;
  };

  let best = countSharedLayerCrossings(work, resolver, opts);
  for (let iter = 0; iter < maxIter && best > 0; iter++) {
    // Só mexe nas edges que efetivamente cruzam neste estado.
    const involved = sharedLayerCrossingEdges(work, resolver, opts);
    let bestFlip = null;  // { st, side, face, count, len }
    for (const id of involved) {
      const st = state.get(id);
      if (!st) continue;
      const trials = [];
      if (!st.sLocked) {
        for (const f of candidateFaces(st.sRect, st.tCenter)) {
          if (f !== st.sFace) trials.push(['s', f]);
        }
      }
      if (!st.tLocked) {
        for (const f of candidateFaces(st.tRect, st.sCenter)) {
          if (f !== st.tFace) trials.push(['t', f]);
        }
      }
      for (const [side, face] of trials) {
        const key = side === 's' ? 'sFace' : 'tFace';
        const prev = st[key];
        st[key] = face;
        rebuild(st);
        const count = countSharedLayerCrossings(work, resolver, opts);
        const len = totalLen();
        if (count < best &&
            (!bestFlip || count < bestFlip.count ||
             (count === bestFlip.count && len < bestFlip.len))) {
          bestFlip = { st, side, face, count, len };
        }
        st[key] = prev;     // reverte o trial
        rebuild(st);
      }
    }
    if (!bestFlip) break;
    const key = bestFlip.side === 's' ? 'sFace' : 'tFace';
    bestFlip.st[key] = bestFlip.face;
    rebuild(bestFlip.st);
    best = bestFlip.count;
  }

  // Escreve de volta só as edges cuja face mudou em relação à base.
  for (const st of state.values()) {
    const re = routedEdges.get(st.id);
    const baseSFace = faceOf(re.points[0], st.sRect);
    const baseTFace = faceOf(re.points[re.points.length - 1], st.tRect);
    if (st.sFace !== baseSFace || st.tFace !== baseTFace) {
      routedEdges.set(st.id, work.get(st.id));
    }
  }
  return routedEdges;
}
