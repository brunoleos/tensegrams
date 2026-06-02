import { ensureEl, createSvgEl } from './ensure-el.js';
import { markerUrl } from './edge-end-styles.js';
import { midPoint } from '../routing/geometry.js';

export function renderEdges(group, ir, routedEdges, reportLabelBBox) {
  const alive = new Set();
  for (const e of ir.edges) {
    const re = routedEdges.get(e.id);
    if (!re) continue;
    alive.add(e.id);
    const el = ensureEdgeEl(group, e);
    el.setAttribute('data-layers', e.layers.join(' '));
    el.setAttribute('data-source', e.source);
    el.setAttribute('data-target', e.target);

    const path = el.querySelector('path.edge-path');
    path.setAttribute('d', edgeD(re));
    // startStyle attaches at the `from` endpoint (source); endStyle at
    // `to` (target). Both fall back to safe defaults applied by the IR
    // builder so we never see undefined here.
    setMarker(path, 'marker-start', markerUrl(e.startStyle));
    setMarker(path, 'marker-end',   markerUrl(e.endStyle));

    const label = el.querySelector('text.edge-label');
    const mask = el.querySelector('mask.edge-mask');
    const maskFill = mask.querySelector('rect.edge-mask-fill');
    const occlusion = mask.querySelector('rect.edge-label-occlusion');
    // sizeMask SEMPRE: o <rect.edge-mask-fill> precisa cobrir o bbox
    // da edge inteira em qualquer caminho (com ou sem label). Sem
    // isso o rect fica em 0x0 (default SVG) e a mask vira preto
    // total — path com mask=url(...) some por completo.
    sizeMask(mask, maskFill, re.points);
    if (e.label) {
      const mid = midPoint(re.points);
      label.setAttribute('x', mid.x);
      label.setAttribute('y', mid.y - 4);
      label.textContent = e.label;
      label.style.display = '';
      // Após o paint o text está laid out — medir uma vez e usar pra
      // (a) recortar a aresta SOB o label via <mask> (occlusion layer:
      // o rect preto perfura o path), e (b) reportar para o engine
      // da live consumir como obstáculo no próximo tick. Defasagem de
      // 1 tick é aceita (primeira render usa última medição ou vazio
      // — corrige no tick seguinte).
      if (typeof label.getBBox === 'function') {
        const bbox = label.getBBox();
        const padX = 4, padY = 1;
        occlusion.setAttribute('x', bbox.x - padX);
        occlusion.setAttribute('y', bbox.y - padY);
        occlusion.setAttribute('width',  bbox.width  + padX * 2);
        occlusion.setAttribute('height', bbox.height + padY * 2);
        occlusion.style.display = '';
        if (reportLabelBBox) {
          reportLabelBBox(e.id, { width: bbox.width, height: bbox.height });
        }
      } else {
        occlusion.style.display = 'none';
      }
    } else {
      label.style.display = 'none';
      // Sem label → occlusion oculto; mask é pass-through (só o
      // rect branco cobrindo o bbox dimensionado acima).
      occlusion.style.display = 'none';
      // Limpa o BBox cacheado na session — sem isso, apagar o label
      // deixa o rect antigo no `labelBBoxes` e ele continua atuando
      // como obstáculo (collision-debug ainda desenha; waypoints
      // ainda desviam).
      if (reportLabelBBox) reportLabelBBox(e.id, null);
    }
  }
  for (const child of Array.from(group.children)) {
    if (!alive.has(child.dataset.id)) child.remove();
  }
}

function ensureEdgeEl(group, edge) {
  return ensureEl(group, edge.id, (el) => {
    el.classList.add('edge');
    // Mask vive como filho da <g class="edge">: o id global resolve
    // url(#…) corretamente, e ao remover a edge a mask cai junto
    // (sem vazar entradas em <defs>). maskUnits='userSpaceOnUse'
    // pra que x/y/width/height fiquem em coordenadas absolutas do
    // canvas — mais previsível que objectBoundingBox.
    const mask = createSvgEl('mask');
    mask.setAttribute('id', maskIdFor(edge.id));
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.classList.add('edge-mask');
    // Retângulo branco cobrindo o BBox da edge: "pinte tudo" como
    // base. Dimensões preenchidas no render quando os pontos são
    // conhecidos.
    const fill = createSvgEl('rect');
    fill.classList.add('edge-mask-fill');
    fill.setAttribute('fill', 'white');
    mask.appendChild(fill);
    // Retângulo preto sobre o BBox do label: "subtraia aqui". Começa
    // escondido até o text ser medido.
    const occlusion = createSvgEl('rect');
    occlusion.classList.add('edge-label-occlusion');
    occlusion.setAttribute('fill', 'black');
    occlusion.style.display = 'none';
    mask.appendChild(occlusion);
    el.appendChild(mask);

    const path = createSvgEl('path');
    path.classList.add('edge-path');
    path.setAttribute('fill', 'none');
    path.setAttribute('mask', `url(#${maskIdFor(edge.id)})`);
    el.appendChild(path);

    const label = createSvgEl('text');
    label.classList.add('edge-label');
    label.setAttribute('text-anchor', 'middle');
    el.appendChild(label);
  });
}

function maskIdFor(edgeId) {
  return `edge-mask-${edgeId}`;
}

function setMarker(path, attr, url) {
  if (url) path.setAttribute(attr, url);
  else path.removeAttribute(attr);
}

// Calcula o BBox dos pontos da polyline + padding pra cobrir o stroke
// e arredondamentos. Aplica ao <mask> e ao <rect.edge-mask-fill> —
// ambos precisam englobar a aresta inteira pra que "fora da mask"
// seja invisível (= preto fora do rect).
function sizeMask(mask, fill, points) {
  if (!points || !points.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = 8; // cobre stroke (1.5px) + markers (até 8px) + folga
  const x = minX - pad;
  const y = minY - pad;
  const w = (maxX - minX) + pad * 2;
  const h = (maxY - minY) + pad * 2;
  mask.setAttribute('x', x);
  mask.setAttribute('y', y);
  mask.setAttribute('width', w);
  mask.setAttribute('height', h);
  fill.setAttribute('x', x);
  fill.setAttribute('y', y);
  fill.setAttribute('width', w);
  fill.setAttribute('height', h);
}

function edgeD(re) {
  const p = re.points;
  // Classic Bezier from the curved router: [start, c1, c2, end].
  if (re.kind === 'curve' && p.length === 4) {
    return `M ${p[0].x} ${p[0].y} C ${p[1].x} ${p[1].y}, ${p[2].x} ${p[2].y}, ${p[3].x} ${p[3].y}`;
  }
  // Obstacle-routed curved edge: a polyline of pass-through points
  // smoothed into a Catmull-Rom spline.
  if (re.kind === 'spline') return splineD(p);
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length; i++) d += ` L ${p[i].x} ${p[i].y}`;
  return d;
}

// Catmull-Rom spline through every point, emitted as chained cubic
// Beziers. Endpoints are duplicated so the curve starts/ends on them.
function splineD(points) {
  if (!points || points.length < 3) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  }
  const last = points.length - 1;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < last; i++) {
    const p0 = points[i - 1] || points[0];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || points[last];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
