// Layer filter: given an IR and a set of hidden layer tags, return a NEW
// IR with hidden nodes (and their descendants) removed. Edges are handled
// per their `onHidden` attribute (see src/dsl/ir.js makeEdge):
//
//   onHidden = 'omit'    (default)  → edge dropped when an endpoint vanishes
//   onHidden = 'promote'            → endpoint rewritten to nearest visible
//                                     ancestor container; if no visible
//                                     ancestor, the edge is still dropped
//
// Self-loop edges produced by promotion (both endpoints promote to the
// same container) are dropped — they don't add information.
//
// Untagged nodes (empty `layers`) are visible by default. To allow isolating
// "only tagged stuff", the chip control surfaces a synthetic UNTAGGED chip
// when there's a mix of tagged + untagged in the view; hiding it drops the
// untagged nodes here.
//
// MULTI-TAG SEMANTIC: a node is visible if AT LEAST ONE of its layers is
// visible (OR-visibility / "draw on layer" model). Equivalently: hidden
// only when EVERY layer it carries is in the hidden set. This matches the
// Photoshop/drawio convention and is forgiving of accidental toggles —
// `layers=infra,data` survives toggling "infra" off because "data" still
// keeps it on. An untagged node is hidden only by the synthetic UNTAGGED
// chip.
//
// PARENT/CHILD: children do NOT inherit their container's layers, and a
// hidden container does NOT cascade-hide its children. Each node decides
// its own visibility from its own `layers` attr. When a container vanishes
// but its children survive, the children are re-parented to the nearest
// visible ancestor (or become top-level) so layout/render don't trip over
// a dangling parent ID.

// Internal sentinel — collisions with real DSL layer names are unlikely
// (no comma, double underscores). Display label rendered by layers.js.
export const UNTAGGED = '__untagged__';

export function applyLayerFilter(ir, hiddenLayers) {
  if (!hiddenLayers || hiddenLayers.size === 0) return ir;
  const untaggedHidden = hiddenLayers.has(UNTAGGED);

  const byId = new Map(ir.nodes.map(n => [n.id, n]));

  // Direct hits — OR-visibility / "draw on layer":
  //   - tagged node: hidden iff EVERY one of its layers is in hiddenLayers
  //     (at least one visible → stays).
  //   - untagged node: hidden iff the synthetic UNTAGGED chip is off.
  // No inheritance, no cascade. A hidden container does NOT take its
  // children with it; the children are reparented below.
  const hidden = new Set();
  for (const n of ir.nodes) {
    const layers = n.layers || [];
    if (layers.length === 0) {
      if (untaggedHidden) hidden.add(n.id);
    } else if (layers.every(l => hiddenLayers.has(l))) {
      hidden.add(n.id);
    }
  }

  // Re-parent surviving children whose container vanished. Walk the
  // ancestor chain until we hit a visible one (or null = top-level).
  // Keeps adapters/renderer from dereferencing a dangling parent ID.
  function visibleAncestor(parentId) {
    let cur = parentId;
    while (cur && hidden.has(cur)) cur = byId.get(cur)?.parent ?? null;
    return cur ?? null;
  }

  const nodes = ir.nodes
    .filter(n => !hidden.has(n.id))
    .map(n => {
      if (!n.parent || !hidden.has(n.parent)) return n;
      return { ...n, parent: visibleAncestor(n.parent) };
    });
  const visibleIds = new Set(nodes.map(n => n.id));

  const edges = [];
  for (const e of ir.edges) {
    const s = resolveEndpoint(e.source, e, hidden, byId);
    const t = resolveEndpoint(e.target, e, hidden, byId);
    if (s == null || t == null) continue;
    if (!visibleIds.has(s) || !visibleIds.has(t)) continue;
    if (s === t) continue; // self-loop after promotion → drop
    edges.push({ ...e, source: s, target: t });
  }

  // Layers visible to chips = those still referenced by surviving entities.
  const layers = Array.from(new Set(
    nodes.flatMap(n => n.layers || []).concat(edges.flatMap(e => e.layers || []))
  ));

  return { ...ir, nodes, edges, layers };
}

// Build the list of layer tags worth surfacing as chips for THIS view.
// Real layers from the IR + UNTAGGED iff there's a mix (at least one
// untagged AND at least one tagged node). Order: real layers first
// (sorted as they appear in ir.layers), then UNTAGGED last.
export function chipLayers(ir) {
  let anyTagged = false;
  let anyUntagged = false;
  for (const n of ir.nodes) {
    if ((n.layers || []).length === 0) anyUntagged = true;
    else anyTagged = true;
    if (anyTagged && anyUntagged) break;
  }
  const real = ir.layers || [];
  if (anyTagged && anyUntagged) return [...real, UNTAGGED];
  return real;
}

function resolveEndpoint(id, edge, hidden, byId) {
  if (!hidden.has(id)) return id;
  if (edge.onHidden !== 'promote') return null;
  // Walk up the parent chain until we find a visible ancestor.
  let cur = byId.get(id)?.parent;
  while (cur) {
    if (!hidden.has(cur)) return cur;
    cur = byId.get(cur)?.parent;
  }
  return null;
}
