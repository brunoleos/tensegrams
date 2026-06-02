// Container ancestry: for every node, the transitive set of containers
// that contain it. Used by the collision resolver and by edge-anchor
// clipping to skip ancestors when evaluating "foreign container"
// containment.
//
// Pure: depends only on `nodes[].parent`. No DOM, no layout, no state.

export function buildAncestors(ir) {
  const byId = new Map(ir.nodes.map(n => [n.id, n]));
  const ancestors = new Map();
  for (const n of ir.nodes) {
    const set = new Set();
    let cur = n.parent;
    while (cur) {
      set.add(cur);
      cur = byId.get(cur)?.parent;
    }
    ancestors.set(n.id, set);
  }
  return ancestors;
}

// Set of node ids an edge's endpoints are "allowed" to touch/overlap:
// the two endpoints plus all their ancestor containers. Used by edge
// collision exclusion and by edge-anchor clipping (a foreign container
// is one whose id is NOT in this set).
export function endpointAllowedSet(sourceId, targetId, ancestors) {
  const set = new Set([sourceId, targetId]);
  const sa = ancestors.get(sourceId);
  if (sa) for (const a of sa) set.add(a);
  const ta = ancestors.get(targetId);
  if (ta) for (const a of ta) set.add(a);
  return set;
}

// Flatten a container's subtree to just its leaf-shaped descendants
// (skipping nested containers). Used when the user drags a container
// — only leaves have a position in the simulation, so we move them as
// a group.
export function descendantLeaves(ir, containerId) {
  if (!ir) return [];
  const childrenByParent = new Map();
  for (const n of ir.nodes) {
    if (!n.parent) continue;
    const list = childrenByParent.get(n.parent) || [];
    list.push(n);
    childrenByParent.set(n.parent, list);
  }
  const out = [];
  const stack = [containerId];
  while (stack.length) {
    const id = stack.pop();
    const kids = childrenByParent.get(id) || [];
    for (const k of kids) {
      if (k.hasChildren) stack.push(k.id);
      else out.push(k.id);
    }
  }
  return out;
}

