// Grafo NEUTRO — a interface do harness com layouts externos.
//
// Graph = {
//   nodes: [{ id, width, height, parent: string|null, isContainer: bool,
//             collisionLayers: string[], pinned: {x,y}|null, padding: number }],
//   edges: [{ id, source, target }],
// }
//   - `isContainer` = container COM pelo menos um filho sobrevivente (rect
//     derivado dos filhos). Container vazio conta como folha (tem rect próprio).
//   - Ordem de `nodes` = ordem da IR (pais antes dos filhos na IR do Tensegrams,
//     mas NÃO dependa disso — use `parent`).
//
// Layout (saída de qualquer layout, interno ou externo) = {
//   positions:  Map<id, {x,y,width,height}>   // top-left, folhas + containers vazios
//   containers: Map<id, {x,y,width,height}>   // containers com filhos (opcional:
//                                              // se ausente, deriveContainers() calcula)
// }

export const HEADER = 22;        // src/layout/adapters/live/container-geometry.js:17
export const DEFAULT_PAD = 24;   // padding default de container (live/custom)

export function graphFromIR(ir) {
  const childIdSet = new Set(ir.nodes.filter((n) => n.parent).map((n) => n.parent));
  const nodes = ir.nodes.map((n) => {
    const isContainer = !!n.hasChildren && childIdSet.has(n.id);
    const emptyContainer = !!n.hasChildren && !isContainer;
    return {
      id: n.id,
      // container vazio: os adapters live/v2 usam max(120,w) x max(60,h)
      width: emptyContainer ? Math.max(120, n.width) : n.width,
      height: emptyContainer ? Math.max(60, n.height) : n.height,
      parent: n.parent || null,
      isContainer,
      collisionLayers: n.nodeCollision ? [...n.nodeCollision.keys()] : [],
      pinned: n.pinned || null,
      padding: n.padding || DEFAULT_PAD,
    };
  });
  const edges = ir.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return { nodes, edges };
}

export function ancestorsOf(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = new Map();
  for (const n of graph.nodes) {
    const set = new Set();
    let p = n.parent;
    let guard = 0;
    while (p && byId.has(p) && guard++ < 1000) { set.add(p); p = byId.get(p).parent; }
    out.set(n.id, set);
  }
  return out;
}

// Deriva rects de containers bottom-up (bbox dos filhos + padding + header),
// na mesma convenção do live/v2 — para layouts externos que só devolvem folhas.
export function deriveContainers(graph, positions, header = HEADER) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const depth = (id) => { let d = 0, p = byId.get(id)?.parent; while (p) { d++; p = byId.get(p)?.parent; } return d; };
  const conts = graph.nodes.filter((n) => n.isContainer).sort((a, b) => depth(b.id) - depth(a.id));
  const containers = new Map();
  for (const c of conts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hits = 0;
    for (const ch of graph.nodes) {
      if (ch.parent !== c.id) continue;
      const r = positions.get(ch.id) || containers.get(ch.id);
      if (!r) continue;
      hits++;
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
    }
    if (!hits) continue;
    const pad = c.padding || DEFAULT_PAD;
    containers.set(c.id, { x: minX - pad, y: minY - pad - header, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad + header });
  }
  return containers;
}

// Converte objeto simples {id:{x,y}} ou Map em Map<id,rect> usando tamanhos do grafo.
// `anchor`: 'topleft' (default) ou 'center'.
export function normalizePositions(graph, pos, anchor = 'topleft') {
  const m = pos instanceof Map ? pos : new Map(Object.entries(pos));
  const out = new Map();
  for (const n of graph.nodes) {
    if (n.isContainer) continue;
    const p = m.get(n.id);
    if (!p) continue;
    const w = p.width ?? n.width, h = p.height ?? n.height;
    const x = anchor === 'center' ? p.x - w / 2 : p.x;
    const y = anchor === 'center' ? p.y - h / 2 : p.y;
    out.set(n.id, { x, y, width: w, height: h });
  }
  return out;
}
