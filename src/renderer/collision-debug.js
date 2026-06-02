// Overlay de debug visual: renderiza a GEOMETRIA DE COLISÃO do engine — só os
// BBoxes (nó = rect+nodePad; segmento de aresta = seg+edgePad; label =
// label+labelPad) e, por cima, uma linha fina por camada de colisão em SLOT
// FIXO GLOBAL (mesma camada → mesmo offset em todo BBox, nó ou aresta).
// Endpoints (1ª/última perna da aresta) NÃO têm BBox próprio.

import { midPoint } from '../routing/geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULT_LAYER_COLORS = {
  edges: '#ff6b6b',
  top: '#4ecdc4',
  bottom: '#95e1d3',
  group1: '#a8d8ea',
  group2: '#f7b731',
  blocked: '#f9ca24',
  infra: '#ee5a6f',
};

function colorForLayer(layerName) {
  return DEFAULT_LAYER_COLORS[layerName] || hashColor(layerName);
}

function hashColor(str) {
  let hash = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 60%)`;
}

function ensureGroup(parent, className) {
  let g = parent.querySelector(`.${className}`);
  if (!g) {
    g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', className);
    parent.appendChild(g);
  }
  return g;
}

function createRect(x, y, width, height, fill, fillOpacity, stroke, strokeOpacity) {
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('class', 'dbg-bbox');
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('fill', fill);
  rect.setAttribute('fill-opacity', fillOpacity);
  rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-opacity', strokeOpacity);
  rect.setAttribute('stroke-width', 1);
  rect.setAttribute('pointer-events', 'none');
  return rect;
}

function createLayerLine(x1, y1, x2, y2, stroke) {
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('class', 'dbg-layer-line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', stroke);
  line.setAttribute('stroke-width', 1.5);
  line.setAttribute('pointer-events', 'none');
  return line;
}

export function clearCollisionDebugOverlay(parent) {
  const g = parent.querySelector('.collision-debug');
  if (g) g.remove();
}

// `parent` is the pan/zoom viewport group (`g.vp`), not the svg root — the
// overlay draws in world coordinates and must inherit the viewport transform.
export function renderCollisionDebugOverlay(parent, ir, currentLayout, mergedOpts, session) {
  if (!ir || !currentLayout || !mergedOpts) return;

  clearCollisionDebugOverlay(parent);
  const debugGroup = ensureGroup(parent, 'collision-debug');

  const nodePad = mergedOpts.collision?.nodePad ?? 12;
  const edgePad = mergedOpts.collision?.edgePad ?? 8;
  const labelPad = mergedOpts.collision?.labelPad ?? 6;

  // Slot spaces are SEPARATE by collision type so changes to one space don't
  // shift the other:
  //  - "/" (node-collision) marks live in a node-layer space, built from
  //    every node.nodeCollision AND every edge.nodeCollision key.
  //  - "\" (edge-collision) marks live in an edge-layer space, built from
  //    every edge.edgeCollision key.
  // Nodes never carry edgeLayers, so adding/removing an edgeLayer MUST NOT
  // shift the slot of node-layer "/" marks (and vice-versa).
  const nodeLayerOrder = [];
  const edgeLayerOrder = [];
  const nodeSeen = new Set();
  const edgeSeen = new Set();
  const addNodeLayer = (L) => { if (!nodeSeen.has(L)) { nodeSeen.add(L); nodeLayerOrder.push(L); } };
  const addEdgeLayer = (L) => { if (!edgeSeen.has(L)) { edgeSeen.add(L); edgeLayerOrder.push(L); } };
  for (const n of ir.nodes || []) {
    if (n.nodeCollision) for (const L of n.nodeCollision.keys()) addNodeLayer(L);
  }
  for (const e of ir.edges || []) {
    if (e.nodeCollision) for (const L of e.nodeCollision.keys()) addNodeLayer(L);
    if (e.edgeCollision) for (const L of e.edgeCollision.keys()) addEdgeLayer(L);
  }
  const Nnode = Math.max(nodeLayerOrder.length, 1);
  const Nedge = Math.max(edgeLayerOrder.length, 1);
  const slotNode = (L) => { const i = nodeLayerOrder.indexOf(L); return i < 0 ? 0 : i; };
  const slotEdge = (L) => { const i = edgeLayerOrder.indexOf(L); return i < 0 ? 0 : i; };

  // Distinct colour per layer name: known names keep their fixed colour; the
  // rest get a golden-angle hue indexed by first appearance, so adjacent
  // layer names (e.g. nb/nc, e1/e2) are clearly different instead of the
  // near-identical hashes of similar strings. Same layer name → same colour.
  const colorByLayer = new Map();
  let colorIdx = 0;
  const ensureColor = (L) => {
    if (colorByLayer.has(L)) return;
    colorByLayer.set(L, DEFAULT_LAYER_COLORS[L] || `hsl(${(colorIdx++ * 137.508) % 360}, 65%, 60%)`);
  };
  for (const L of nodeLayerOrder) ensureColor(L);
  for (const L of edgeLayerOrder) ensureColor(L);
  const colorOf = (L) => colorByLayer.get(L) || colorForLayer(L);

  // ---- Node BBoxes + per-layer vertical lines (only collidable nodes) ----
  if (ir.nodes && currentLayout.positions) {
    for (const node of ir.nodes) {
      const cl = node.nodeCollision;
      if (!cl || !cl.size) continue; // no collision layer → not collidable → no BBox
      const rect = currentLayout.positions.get(node.id);
      if (!rect) continue;

      const bx = rect.x - nodePad;
      const by = rect.y - nodePad;
      const bw = rect.width + nodePad * 2;
      const bh = rect.height + nodePad * 2;

      const firstColor = colorOf(cl.keys().next().value);
      const box = createRect(bx, by, bw, bh, firstColor, 0.10, firstColor, 0.7);
      box.setAttribute('data-kind', 'node');
      box.setAttribute('data-node', node.id);
      debugGroup.appendChild(box);

      // One ASCENDING-diagonal "/" per layer, at its fixed NODE-layer slot,
      // spanning the BBox height. The diagonal direction distinguishes NODE
      // layers (/) from EDGE layers (\).
      for (const layer of cl.keys()) {
        const sx = bx + (slotNode(layer) + 0.5) * (bw / Nnode);
        const r = Math.min((bw / Nnode) * 0.35, 14); // horizontal half-run
        const line = createLayerLine(sx - r, by + bh, sx + r, by, colorOf(layer));
        line.setAttribute('data-layer', layer);
        line.setAttribute('data-owner', node.id);
        line.setAttribute('data-coltype', 'node');
        debugGroup.appendChild(line);
      }
    }
  }

  // ---- Edge BBoxes (segments; endpoint legs EXCLUDED) + lines + label ----
  if (currentLayout.routedEdges) {
    for (const [edgeId, routed] of currentLayout.routedEdges) {
      const edge = ir.edges?.find(e => e.id === edgeId);
      if (!edge || !routed.points || routed.points.length < 2) continue;
      const pts = routed.points;
      const straight = routed.kind !== 'curve' && routed.kind !== 'spline';
      const ecl = edge.edgeCollision;
      const ncl = edge.nodeCollision; // edge's nodeLayers → collides with NODES
      const hasCol = !!((ecl && ecl.size) || (ncl && ncl.size));

      if (straight && hasCol) {
        // The segment box is an EDGE thing — its colour reflects the edge's
        // EDGE-layer (its primary aspect), and only falls back to its node-
        // layer when no edgeLayers are declared. Keeps the box colour stable
        // when an edge gains/loses its nodeLayers.
        const firstLayer = (ecl && ecl.size ? ecl : ncl).keys().next().value;
        const color = colorOf(firstLayer);
        const lastSeg = pts.length - 2; // index of the last segment

        // Segment BBoxes for EVERY segment (incl. first/last). The connection
        // POINT itself has no BBox: the box is CAPPED at the endpoint (no pad
        // extension past pts[0]/pts[last]) so it never reaches into the node.
        for (let i = 0; i + 1 < pts.length; i++) {
          const p0 = pts[i], p1 = pts[i + 1];
          const ext0 = (i === 0) ? 0 : edgePad;       // no extension past the source endpoint
          const ext1 = (i === lastSeg) ? 0 : edgePad; // no extension past the target endpoint
          const horizontal = Math.abs(p1.y - p0.y) < Math.abs(p1.x - p0.x);
          let x, y, w, h;
          if (horizontal) {
            const lo = Math.min(p0.x, p1.x), hi = Math.max(p0.x, p1.x);
            const extLo = (p0.x <= p1.x) ? ext0 : ext1;
            const extHi = (p0.x <= p1.x) ? ext1 : ext0;
            x = lo - extLo; w = (hi - lo) + extLo + extHi;
            y = p0.y - edgePad; h = edgePad * 2;
          } else {
            const lo = Math.min(p0.y, p1.y), hi = Math.max(p0.y, p1.y);
            const extLo = (p0.y <= p1.y) ? ext0 : ext1;
            const extHi = (p0.y <= p1.y) ? ext1 : ext0;
            x = p0.x - edgePad; w = edgePad * 2;
            y = lo - extLo; h = (hi - lo) + extLo + extHi;
          }
          const seg = createRect(x, y, w, h, color, 0.15, color, 1);
          seg.setAttribute('data-kind', 'edge-seg');
          seg.setAttribute('data-edge', edgeId);
          seg.setAttribute('data-seg', String(i));
          debugGroup.appendChild(seg);
        }

        // Layer marks at the edge centre, spread along the segment within the
        // edge's BBox space. Direction encodes the collision TYPE: nodeLayers
        // (edge-vs-NODE) as ASCENDING "/", edgeLayers (edge-vs-EDGE) as
        // DESCENDING "\" — so an edge can show BOTH.
        const midSeg = Math.floor((pts.length - 1) / 2);
        const a = pts[midSeg];
        const b = pts[Math.min(midSeg + 1, pts.length - 1)];
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const horizontal = Math.abs(b.y - a.y) < Math.abs(b.x - a.x);
        const marks = [];
        if (ncl) for (const L of ncl.keys()) marks.push({ L, type: 'node' });
        if (ecl) for (const L of ecl.keys()) marks.push({ L, type: 'edge' });
        const k = marks.length;
        const d = edgePad, step = 2 * edgePad + 3;
        marks.forEach((m, li) => {
          const t = (li - (k - 1) / 2) * step; // spread from the centre
          const px = horizontal ? cx + t : cx;
          const py = horizontal ? cy : cy + t;
          const line = (m.type === 'node')
            ? createLayerLine(px - d, py + d, px + d, py - d, colorOf(m.L))  // "/"
            : createLayerLine(px - d, py - d, px + d, py + d, colorOf(m.L)); // "\"
          line.setAttribute('data-layer', m.L);
          line.setAttribute('data-owner', edgeId);
          line.setAttribute('data-coltype', m.type);
          debugGroup.appendChild(line);
        });
      }

      // Label BBox — centred on the ACTUAL label position (midPoint of the
      // routed polyline, the same point the renderer uses), not a vertex.
      const labelBBox = session?.labelBBoxes?.get(edgeId);
      if (labelBBox) {
        const mid = midPoint(pts);
        const lw = labelBBox.width + labelPad * 2;
        const lh = labelBBox.height + labelPad * 2;
        const labelColor = (mergedOpts.collision?.labels !== false) ? '#f39c12' : '#bdc3c7';
        const labelRect = createRect(mid.x - lw / 2, mid.y - lh / 2, lw, lh, labelColor, 0.2, labelColor, 1);
        labelRect.setAttribute('data-kind', 'label');
        labelRect.setAttribute('data-edge', edgeId);
        debugGroup.appendChild(labelRect);
      }
    }
  }
}
