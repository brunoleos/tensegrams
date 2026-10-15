// Métricas de qualidade de layout — funções PURAS sobre (graph neutro, layout).
// Não dependem do motor que gerou as posições: servem para qualquer layout.
import { ancestorsOf, deriveContainers } from './graph.mjs';
import { straightRouter } from './repo.mjs';

const EPS = 0.5; // tolerância em px (Float32 do motor v2 + arredondamentos)

function interArea(a, b) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return (w > EPS && h > EPS) ? w * h : 0;
}

function inside(child, parent) {
  const dx = Math.max(0, parent.x - child.x, (child.x + child.width) - (parent.x + parent.width));
  const dy = Math.max(0, parent.y - child.y, (child.y + child.height) - (parent.y + parent.height));
  return Math.max(dx, dy); // excesso máximo (0 = contido)
}

const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function properCross(p1, p2, p3, p4) {
  const d1 = orient(p3, p4, p1), d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3), d4 = orient(p1, p2, p4);
  const e = 1e-9;
  return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
}
// Segmento cruza o interior (encolhido por 1px) do rect?
function segHitsRect(a, b, r) {
  const x0 = r.x + 1, y0 = r.y + 1, x1 = r.x + r.width - 1, y1 = r.y + r.height - 1;
  if (x1 <= x0 || y1 <= y0) return false;
  // Liang–Barsky
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 1e-6;
}

export function computeMetrics(graph, layout) {
  const positions = layout.positions;
  const containers = layout.containers && layout.containers.size
    ? layout.containers
    : deriveContainers(graph, positions);
  const anc = ancestorsOf(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const rectOf = (id) => positions.get(id) || containers.get(id);

  // ---- sobreposição -------------------------------------------------------
  const leafIds = graph.nodes.filter((n) => !n.isContainer && positions.get(n.id)).map((n) => n.id);
  const contIds = graph.nodes.filter((n) => n.isContainer && containers.get(n.id)).map((n) => n.id);
  const layersOf = new Map(graph.nodes.map((n) => [n.id, new Set(n.collisionLayers || [])]));
  const share = (a, b) => { const A = layersOf.get(a), B = layersOf.get(b); for (const l of A) if (B.has(l)) return true; return false; };
  const related = (a, b) => anc.get(a)?.has(b) || anc.get(b)?.has(a);

  let ovAll = 0, ovAllArea = 0, ovCol = 0, ovColArea = 0;
  for (let i = 0; i < leafIds.length; i++) {
    const a = positions.get(leafIds[i]);
    for (let j = i + 1; j < leafIds.length; j++) {
      const ar = interArea(a, positions.get(leafIds[j]));
      if (!ar) continue;
      ovAll++; ovAllArea += ar;
      if (share(leafIds[i], leafIds[j])) { ovCol++; ovColArea += ar; }
    }
  }
  // containers não-aparentados que se sobrepõem (ex.: dois irmãos)
  let ovCont = 0, ovContArea = 0, ovContCol = 0;
  for (let i = 0; i < contIds.length; i++) {
    for (let j = i + 1; j < contIds.length; j++) {
      if (related(contIds[i], contIds[j])) continue;
      const ar = interArea(containers.get(contIds[i]), containers.get(contIds[j]));
      if (ar) { ovCont++; ovContArea += ar; if (share(contIds[i], contIds[j])) ovContCol++; }
    }
  }
  // folha estranha invadindo container do qual não descende
  let intrusion = 0, intrusionArea = 0, intrusionCol = 0;
  for (const l of leafIds) {
    for (const c of contIds) {
      if (anc.get(l)?.has(c)) continue;
      const ar = interArea(positions.get(l), containers.get(c));
      if (ar) { intrusion++; intrusionArea += ar; if (share(l, c)) intrusionCol++; }
    }
  }

  // ---- contenção: filho fora do rect do pai --------------------------------
  let contain = 0, containMax = 0;
  for (const n of graph.nodes) {
    if (!n.parent) continue;
    const pr = containers.get(n.parent), cr = rectOf(n.id);
    if (!pr || !cr) continue;
    const ex = inside(cr, pr);
    if (ex > EPS) { contain++; containMax = Math.max(containMax, ex); }
  }

  // ---- bounding box ---------------------------------------------------------
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of [...positions.values(), ...containers.values()]) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
  }
  const bw = maxX - minX, bh = maxY - minY;
  const nodeArea = leafIds.reduce((s, id) => s + positions.get(id).width * positions.get(id).height, 0);

  // ---- arestas: comprimento + cruzamentos (router straight do repo) --------
  const rects = new Map(positions);
  for (const [id, r] of containers) rects.set(id, r);
  const routed = straightRouter.route({ edges: graph.edges }, rects);
  const segs = [];
  let lenSum = 0, ccSum = 0, nLen = 0;
  for (const e of graph.edges) {
    const re = routed.get(e.id);
    if (!re) continue;
    const a = re.sourceAnchor, b = re.targetAnchor;
    lenSum += Math.hypot(b.x - a.x, b.y - a.y);
    const ca = center(rects.get(e.source)), cb = center(rects.get(e.target));
    ccSum += Math.hypot(cb.x - ca.x, cb.y - ca.y);
    nLen++;
    segs.push({ e, a, b });
  }
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) {
    const si = segs[i];
    for (let j = i + 1; j < segs.length; j++) {
      const sj = segs[j];
      const ei = si.e, ej = sj.e;
      if (ei.source === ej.source || ei.source === ej.target || ei.target === ej.source || ei.target === ej.target) continue;
      if (properCross(si.a, si.b, sj.a, sj.b)) crossings++;
    }
  }
  // aresta atravessando folha que não é endpoint (nem ancestral/descendente dele)
  let edgeThruNode = 0;
  for (const s of segs) {
    for (const l of leafIds) {
      if (l === s.e.source || l === s.e.target) continue;
      if (related(l, s.e.source) || related(l, s.e.target)) continue;
      if (segHitsRect(s.a, s.b, positions.get(l))) edgeThruNode++;
    }
  }

  const meanDiag = leafIds.length
    ? leafIds.reduce((s, id) => s + Math.hypot(positions.get(id).width, positions.get(id).height), 0) / leafIds.length
    : 1;

  return {
    nLeaves: leafIds.length,
    nContainers: contIds.length,
    nEdges: graph.edges.length,
    ovAll, ovAllArea: Math.round(ovAllArea),
    ovCol, ovColArea: Math.round(ovColArea),
    ovCont, ovContArea: Math.round(ovContArea), ovContCol,
    intrusion, intrusionArea: Math.round(intrusionArea), intrusionCol,
    // violações do CONTRATO de colisão (pares que compartilham nodeLayer)
    colViol: ovCol + ovContCol + intrusionCol,
    contain, containMax: +containMax.toFixed(1),
    bboxW: Math.round(bw), bboxH: Math.round(bh),
    bboxArea: Math.round(bw * bh),
    aspect: +(Math.max(bw, bh) / Math.max(1e-9, Math.min(bw, bh))).toFixed(2),
    // densidade = área dos nós / área do bbox (1 = empacotado; ~0 = esparso)
    density: +(nodeArea / Math.max(1, bw * bh)).toFixed(3),
    edgeLen: nLen ? Math.round(lenSum / nLen) : 0,            // âncora→âncora (router straight)
    edgeLenCC: nLen ? Math.round(ccSum / nLen) : 0,           // centro→centro
    edgeLenNorm: nLen ? +((ccSum / nLen) / meanDiag).toFixed(2) : 0, // em diagonais de nó
    crossings,
    edgeThruNode,
  };
}

// Deslocamento médio dos nós COMUNS entre dois layouts (preservação do mapa mental).
// raw  = o que o usuário vê (viewport fixo);
// aligned = após remover a translação média (viewport que recentraliza).
export function displacement(layoutA, layoutB, ids = null) {
  const common = [];
  for (const [id, a] of layoutA.positions) {
    if (ids && !ids.has(id)) continue;
    const b = layoutB.positions.get(id);
    if (b) common.push([center(a), center(b)]);
  }
  if (!common.length) return { raw: 0, aligned: 0, max: 0, n: 0 };
  let tx = 0, ty = 0;
  for (const [a, b] of common) { tx += b.x - a.x; ty += b.y - a.y; }
  tx /= common.length; ty /= common.length;
  let raw = 0, al = 0, mx = 0;
  for (const [a, b] of common) {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    raw += d; mx = Math.max(mx, d);
    al += Math.hypot(b.x - a.x - tx, b.y - a.y - ty);
  }
  return { raw: raw / common.length, aligned: al / common.length, max: mx, n: common.length };
}

export function maxPositionDiff(layoutA, layoutB) {
  let m = 0;
  for (const [id, a] of layoutA.positions) {
    const b = layoutB.positions.get(id);
    if (!b) return Infinity;
    m = Math.max(m, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  for (const [id, a] of layoutA.containers || []) {
    const b = layoutB.containers?.get(id);
    if (!b) return Infinity;
    m = Math.max(m, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  return m;
}
