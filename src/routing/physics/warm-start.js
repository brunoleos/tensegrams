// Warm-start: converte routedEdges (polylines do router base) em
// `world` (lista de bodies + edgeIndex pra acesso por edge.id).
//
// Fase 2: traduz polyline ortogonal em alternância
//   CornerBody (pinned na ponta) — SegmentBody — CornerBody — …
// Fase 3: também registra `allowedNodeIds` por edge (source + target
// + ancestors) pra forças de repulsão saberem quais nodes ignorar.
//
// Curvas e splines passam intactas (skipped: true) — solver não opera
// sobre elas nesta entrega.

import { makeCornerBody, makeSegmentBody, makePointBody } from './bodies.js';
import {
  intersectRayWithPerimeter,
  midpointOfCenters,
  rectCenter,
  projectToPerimeter,
  faceOf,
} from '../anchor-utils.js';
import { resolveNodeSnapPoints, pickSnapPoint } from '../snap-resolver.js';

// Cascata de resolução de `seg.pad`:
//   edge.style.edgePad           — override explícito por edge
//   meta.routing.edgePad (num)   — default global em px (5.1)
//   meta.routing.edgePad ===
//     'stroke' / ausente         — usa strokeWidth do edge (cai abaixo)
//   edge.style.strokeWidth       — derivado do estilo de traço
//   2                            — fallback final
function metaEdgePad(meta) {
  const v = meta?.routing?.edgePad;
  return typeof v === 'number' && v >= 0 ? v : undefined;
}

// `seg.strokeWidth` é separado de `seg.pad` porque o detector de fusão
// (5.7) usa stroke pra calcular `length < K * stroke`. Mesmo quando o
// usuário override `edgePad`, o critério de fusão referencia o stroke
// verdadeiro do edge.
function resolveStroke(edge, meta) {
  return edge?.style?.strokeWidth
    ?? meta?.routing?.fusion?.defaultStroke
    ?? 2;
}

export function buildWorld(ir, routedEdges, resolver, opts = {}) {
  const bodies = [];
  const edgeIndex = new Map();
  if (!ir || !ir.edges) return { bodies, edgeIndex, stableTicks: 0 };

  const ancestorsMap = resolver?.ancestors || new Map();
  const metaPad = metaEdgePad(ir.meta);
  // Node lookup for per-node attribute resolution at force-application time.
  const nodeById = new Map((ir.nodes || []).map(n => [n.id, n]));
  // routingRects (opcional) é o mapa nodeId → rect que vem do pipeline.
  // Quando presente, o warm-start usa o rect REAL pra (a) ancorar
  // CornerBody endpoints como vagões no trilho do perímetro e (b) calcular
  // o edgeCenter (midpoint dos centros dos rects). Sem routingRects, cai
  // no path legado (warm-start a partir do polyline original do router).
  const routingRects = opts.routingRects || null;

  for (const e of ir.edges) {
    const re = routedEdges.get(e.id);
    if (!re || !re.points || re.points.length < 2) continue;

    // Curves/splines: cada ponto vira PointBody. Endpoints (primeiro
    // e último) ficam pinned. Spring de origem mantém control points
    // no lugar; fases futuras podem acrescentar repel BBox↔PointBody.
    if (re.kind === 'curve' || re.kind === 'spline') {
      const points = re.points.map((p, i) => makePointBody({
        id: `${e.id}#p${i}`,
        x: p.x,
        y: p.y,
      }));
      // Pin endpoints (anchors).
      points[0].pinned = true;
      points[points.length - 1].pinned = true;
      bodies.push(...points);
      edgeIndex.set(e.id, { skipped: false, kind: 'curve', points, original: re });
      continue;
    }

    const sourceRect = routingRects?.get?.(e.source) || null;
    const targetRect = routingRects?.get?.(e.target) || null;
    const edgeCenter = (sourceRect && targetRect)
      ? midpointOfCenters(sourceRect, targetRect)
      : null;

    // Pontos warm-start: se temos rects, recalcular anchor inicial como
    // a interseção do perímetro com o raio center↔edgeCenter (a posição-
    // alvo natural pra qual a força central converge). Sem rects, cai
    // no anchor original do router base (path legado).
    const pts = re.points.slice();
    if (sourceRect && edgeCenter) {
      pts[0] = intersectRayWithPerimeter(sourceRect, rectCenter(sourceRect), edgeCenter);
    }
    if (targetRect && edgeCenter) {
      pts[pts.length - 1] = intersectRayWithPerimeter(targetRect, rectCenter(targetRect), edgeCenter);
    }

    const corners = pts.map((p, i) => {
      const isAnchor = i === 0 || i === pts.length - 1;
      const rect = isAnchor
        ? (i === 0 ? sourceRect : targetRect)
        : null;
      return makeCornerBody({
        id: `${e.id}#c${i}`,
        x: p.x,
        y: p.y,
        pinned: isAnchor,
        anchorOf: isAnchor ? e.id : null,
        rect,
        anchorSide: isAnchor ? (i === 0 ? 'source' : 'target') : null,
      });
    });
    // Pre-compute initial face so projectRun knows the perpendicular axis
    // from tick 0 (otherwise it falls back to faceOf, same result).
    for (const c of corners) {
      if (c.pinned && c.rect) c.face = faceOf(c, c.rect);
    }

    const edgePad = e?.style?.edgePad ?? metaPad ?? e?.style?.strokeWidth ?? 2;
    const stroke = resolveStroke(e, ir.meta);
    const segments = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const orientation = dy > dx ? 'v' : 'h';
      const seg = makeSegmentBody({
        id: `${e.id}#s${i}`,
        orientation,
        pad: edgePad,
        prevCorner: corners[i],
        nextCorner: corners[i + 1],
      });
      seg.strokeWidth = stroke;
      segments.push(seg);
    }
    bodies.push(...corners, ...segments);

    const allowedNodeIds = new Set([e.source, e.target]);
    for (const id of [e.source, e.target]) {
      const anc = ancestorsMap.get(id);
      if (anc) for (const a of anc) allowedNodeIds.add(a);
    }

    // Snap selection (P4): if a node declares `snap`/`snapGroups`, pick
    // the snap point closest to the anchor warm-start position. Greedy
    // local; multiple endpoints CAN share the same snap (BBox-vs-BBox
    // separates them on the perimeter at force application time).
    const snapTarget = { source: null, target: null };
    for (const [side, rect, nodeId] of [
      ['source', sourceRect, e.source],
      ['target', targetRect, e.target],
    ]) {
      const node = nodeById.get(nodeId);
      if (!node || !rect) continue;
      const candidates = resolveNodeSnapPoints(node, rect, ir.meta);
      if (!candidates.length) continue;
      const anchorIdx = side === 'source' ? 0 : pts.length - 1;
      const ideal = pts[anchorIdx];
      const picked = pickSnapPoint(candidates, ideal, 'nearest');
      if (picked) {
        // Re-project the snap point onto the perimeter so the central
        // force never pulls the anchor off-rail. (Snap points already on
        // the perimeter are no-ops under projectToPerimeter.)
        snapTarget[side] = projectToPerimeter(rect, picked);
      }
    }

    edgeIndex.set(e.id, {
      skipped: false,
      corners,
      segments,
      allowedNodeIds,
      source: e.source,
      target: e.target,
      // Refs for per-edge/per-node attribute resolution in the force loops.
      edge: e,
      sourceNode: nodeById.get(e.source) || null,
      targetNode: nodeById.get(e.target) || null,
      sourceRect,
      targetRect,
      edgeCenter,
      snapTarget,
      original: re,
    });
  }

  return { bodies, edgeIndex, stableTicks: 0 };
}

// Lê posições atuais dos corners de cada edge e reconstrói a polyline
// final. Para edges skipped (curves), devolve o routedEdge original
// intocado.
export function commitWorld(world) {
  const out = new Map();
  if (!world || !world.edgeIndex) return out;

  for (const [edgeId, info] of world.edgeIndex) {
    if (info.skipped) {
      out.set(edgeId, info.original);
      continue;
    }
    if (info.kind === 'curve') {
      const points = info.points.map((p) => ({ x: p.x, y: p.y }));
      out.set(edgeId, { ...info.original, points });
      continue;
    }
    const points = info.corners.map((c) => ({ x: c.x, y: c.y }));
    out.set(edgeId, { ...info.original, points });
  }
  return out;
}
