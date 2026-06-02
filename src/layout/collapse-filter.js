// Collapse filter: given an IR and a Set of container IDs marked as
// collapsed by the user (via the context menu), return a NEW IR with
// every descendant of those containers removed.
//
// This is a VIEW transform — it does NOT touch the DSL source. The
// container survives in the IR (still rendered as a frame, now empty)
// with a fresh `collapsed: true` flag so the renderer can show a
// chevron next to the label.
//
// EDGES: an edge whose endpoint was hidden gets rewritten to point at
// the nearest collapsed ancestor (always defined — we only hide
// descendants of explicitly-collapsed containers). The original DSL
// edge with the descendant endpoint is preserved upstream; only this
// view-time copy is rewritten. Self-loops produced when both endpoints
// promote to the same container are dropped.
//
// COMPOSITION: runs AFTER applyLayerFilter, so any IDs in
// `collapsedSet` that were already filtered out by layers are simply
// ignored (no-op). Non-container IDs in the set are also ignored —
// only containers can collapse.

export function applyCollapseFilter(ir, collapsedSet) {
  if (!collapsedSet || collapsedSet.size === 0) return ir;

  const byId = new Map(ir.nodes.map(n => [n.id, n]));

  // Effective collapsed set = only IDs that (a) exist in this IR and
  // (b) point at a container-shaped node.
  const effective = new Set();
  for (const id of collapsedSet) {
    const n = byId.get(id);
    if (n && n.hasChildren) effective.add(id);
  }
  if (effective.size === 0) return ir;

  // Mark every transitive descendant of an effective-collapsed container.
  // hidden: nodes removed from the view.
  // promoteTo: descendantId -> nearest collapsed-ancestor id, used when
  //            rewriting edges.
  const hidden = new Set();
  const promoteTo = new Map();
  for (const n of ir.nodes) {
    let cur = n.parent;
    while (cur) {
      if (effective.has(cur)) {
        hidden.add(n.id);
        promoteTo.set(n.id, cur);
        break;
      }
      cur = byId.get(cur)?.parent;
    }
  }

  const nodes = ir.nodes
    .filter(n => !hidden.has(n.id))
    .map(n => effective.has(n.id) ? { ...n, collapsed: true } : n);

  const edges = [];
  for (const e of ir.edges) {
    const s = hidden.has(e.source) ? promoteTo.get(e.source) : e.source;
    const t = hidden.has(e.target) ? promoteTo.get(e.target) : e.target;
    if (s == null || t == null) continue;
    if (s === t) continue; // both endpoints inside the same collapsed box
    edges.push({ ...e, source: s, target: t });
  }

  return { ...ir, nodes, edges };
}
