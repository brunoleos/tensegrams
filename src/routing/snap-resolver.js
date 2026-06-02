// Snap resolver — resolve declarações heterogêneas de `node.snap` /
// `node.snapGroups` em uma lista de pontos `{x, y}` candidatos, depois
// escolhe o melhor segundo o `criterion` ('nearest' | 'minLength' |
// 'astar'). Anchors discretos opt-in: nodes sem `snap` nem `snapGroups`
// declarados retornam lista vazia e a edge cai no caminho contínuo
// atual (clipAnchors + snapContainerEndpointsExternal).
//
// Itens aceitos em `node.snap` (lista; tipos misturáveis):
//   - string `top`, `bottom`, `left`, `right`, `center`,
//     `corner0..3` → consulta `shape.namedAnchors(rect)`.
//   - string `cardinals`, `vertices`, `midpoints`, `intersections`
//     → expansão de grupo (vide `expandGroup`).
//   - `{angle: <graus>}` → `shape.boundaryHitFromAngle(rect, angle)`.
//   - `{path: <0..1>}` → `shape.boundaryHitFromPath(rect, t)`.
//   - `[u, v]` com u,v ∈ [0,1] → coord relativa à BBox do rect.

import { getShape } from '../shapes/index.js';

const DEFAULT_GROUPS = Object.freeze({
  cardinals:     'on',
  vertices:      'off',
  midpoints:     'off',
  intersections: 'off',
});

// Resolve todos os snap points de um node. Snap discreto é OPT-IN:
// só ativa quando o node declara `snap` ou `snapGroups` (mesmo vazios).
// Sem declaração → array vazio, e a edge cai no caminho contínuo
// atual (clipAnchors + snapContainerEndpointsExternal). Os pontos
// vêm deduplicados por coordenada (tolerância 0.001).
export function resolveNodeSnapPoints(node, rect, meta) {
  if (!node || !rect) return [];
  if (node.snap == null && node.snapGroups == null) return [];

  const shape = getShape(node.shape ?? 'rect');
  const points = [];

  // 1. Itens explícitos em `node.snap`.
  const items = Array.isArray(node.snap) ? node.snap : [];
  for (const item of items) {
    const expanded = resolveItem(item, shape, rect);
    if (Array.isArray(expanded)) points.push(...expanded);
    else if (expanded) points.push(expanded);
  }

  // 2. Grupos ativos. Override per-node em `node.snapGroups` aceita
  // lista (`[cardinals, vertices]` ativa cardinals+vertices, demais
  // desligados); mapa segue o mesmo formato do default.
  const groups = resolveGroups(node.snapGroups, meta?.routing?.snap?.groups);
  for (const [name, state] of Object.entries(groups)) {
    if (state !== 'on') continue;
    points.push(...expandGroup(name, shape, rect));
  }

  return dedupe(points);
}

// Escolhe o ponto de snap que melhor casa com o `ideal` segundo o
// `criterion`. `ctx` aceita { otherEndpoint } para 'minLength' (soma
// dist(ideal, candidate) + dist(otherEndpoint, candidate); proxy
// linear pra "edge mais curta").
//
// 'astar' fica como stub: usa 'nearest' por ora; 5.6 plugará A*
// degenerado no grafo discreto de snap points.
export function pickSnapPoint(candidates, ideal, criterion = 'nearest', ctx = {}) {
  if (!candidates || !candidates.length) return null;
  if (!ideal) return candidates[0];
  switch (criterion) {
    case 'minLength': return pickMinLength(candidates, ideal, ctx);
    case 'astar':     // fallback: 'nearest' até 5.6 plugar A*
    case 'nearest':
    default:          return pickNearest(candidates, ideal);
  }
}

// ---------- helpers ----------

function resolveItem(item, shape, rect) {
  if (typeof item === 'string') {
    if (isGroupName(item)) return expandGroup(item, shape, rect);
    const anchors = shape.namedAnchors(rect);
    return anchors.get(item) ?? null;
  }
  if (Array.isArray(item)) {
    // [u, v] coord relativa à BBox. Aceita só pares numéricos em [0,1].
    if (item.length === 2 && item.every(Number.isFinite)) {
      const [u, v] = item;
      return { x: rect.x + rect.width * u, y: rect.y + rect.height * v };
    }
    return null;
  }
  if (item && typeof item === 'object') {
    if (Number.isFinite(item.angle)) {
      return shape.boundaryHitFromAngle(rect, item.angle);
    }
    if (Number.isFinite(item.path)) {
      return shape.boundaryHitFromPath(rect, item.path);
    }
  }
  return null;
}

function isGroupName(name) {
  return name === 'cardinals' || name === 'vertices'
    || name === 'midpoints' || name === 'intersections';
}

function expandGroup(name, shape, rect) {
  switch (name) {
    case 'cardinals': {
      const a = shape.namedAnchors(rect);
      // Cardinais = top/right/bottom/left (NÃO inclui center nem corners).
      return ['top', 'right', 'bottom', 'left']
        .map(k => a.get(k))
        .filter(Boolean);
    }
    case 'vertices':      return shape.vertices(rect);
    case 'midpoints':     return shape.midpoints(rect);
    case 'intersections': return shape.intersections(rect);
    default:              return [];
  }
}

function resolveGroups(perNode, globalDef) {
  const def = { ...DEFAULT_GROUPS, ...(globalDef || {}) };
  if (perNode == null) return def;
  if (Array.isArray(perNode)) {
    // Lista de grupos a ativar — restante fica como está no default.
    // Útil pra "ativar só vertices sem mexer cardinals".
    const out = { ...def };
    for (const k of Object.keys(out)) out[k] = 'off';
    for (const g of perNode) {
      if (isGroupName(g)) out[g] = 'on';
    }
    return out;
  }
  if (typeof perNode === 'object') {
    return { ...def, ...perNode };
  }
  return def;
}

function pickNearest(candidates, ideal) {
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const dx = c.x - ideal.x;
    const dy = c.y - ideal.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = c; }
  }
  return best;
}

function pickMinLength(candidates, ideal, ctx) {
  const other = ctx?.otherEndpoint;
  if (!other) return pickNearest(candidates, ideal);
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d1 = dist(c, ideal);
    const d2 = dist(c, other);
    const total = d1 + d2;
    if (total < bestD) { bestD = total; best = c; }
  }
  return best;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function dedupe(points, tol = 0.001) {
  const out = [];
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const found = out.some(q => Math.abs(q.x - p.x) < tol && Math.abs(q.y - p.y) < tol);
    if (!found) out.push(p);
  }
  return out;
}
