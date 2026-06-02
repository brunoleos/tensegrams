// Static-layout collision post-pass (custom / off adapters).
//
// Live resolves collisions every tick via forces; the static adapters
// produce one deterministic layout, so a single bounded iterative pass
// nudges colliding nodes apart afterwards. Same weight model as the
// live resolver (collision.js): each side absorbs the opponent's weight
// share, and a DSL-pinned node never moves (its fraction goes to the
// other side).
//
// A node is moved as a rigid block — moving a container shifts its whole
// leaf subtree. After each pass every container rect is reflowed bottom-up
// from its children, so frames stay consistent with their contents.
//
// Mutates the `positions` (leaves) and `containers` Maps in place.

export function applyCollisionPostPass(ir, positions, containers, resolver, opts = {}) {
  const pad = opts.nodePad ?? 12;
  const passes = opts.passes ?? 4;
  const header = opts.header ?? 0;
  // Minimum container size — mirrors the floor the static adapters apply
  // when they first size a frame, so a reflow can't shrink it below it.
  const minWidth = opts.minWidth ?? 0;
  const minHeight = opts.minHeight ?? 0;

  const collidable = ir.nodes.filter(n => n.nodeCollision && n.nodeCollision.size);
  if (collidable.length < 2) return;

  const byId = new Map(ir.nodes.map(n => [n.id, n]));
  const childrenOf = new Map();
  for (const n of ir.nodes) {
    if (!n.parent) continue;
    let list = childrenOf.get(n.parent);
    if (!list) { list = []; childrenOf.set(n.parent, list); }
    list.push(n.id);
  }

  // Leaf-shaped descendants of every container (for rigid-block moves).
  const leafDesc = new Map();
  for (const n of ir.nodes) {
    if (!n.hasChildren) continue;
    const out = [];
    const stack = [...(childrenOf.get(n.id) || [])];
    while (stack.length) {
      const id = stack.pop();
      if (byId.get(id)?.hasChildren) stack.push(...(childrenOf.get(id) || []));
      else out.push(id);
    }
    leafDesc.set(n.id, out);
  }

  const rectOf = (id) => positions.get(id) || containers.get(id);

  function shift(node, dx, dy) {
    if (node.hasChildren) {
      const leaves = leafDesc.get(node.id) || [];
      if (leaves.length) {
        for (const id of leaves) {
          const r = positions.get(id);
          if (r) { r.x += dx; r.y += dy; }
        }
      } else {
        const r = containers.get(node.id); // empty container — move its own rect
        if (r) { r.x += dx; r.y += dy; }
      }
    } else {
      const r = positions.get(node.id);
      if (r) { r.x += dx; r.y += dy; }
    }
  }

  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let a = 0; a < collidable.length; a++) {
      for (let b = a + 1; b < collidable.length; b++) {
        const na = collidable[a], nb = collidable[b];
        const pair = resolver.nodeNodePair(na.id, nb.id);
        if (!pair) continue;
        const ra = rectOf(na.id), rb = rectOf(nb.id);
        if (!ra || !rb) continue;
        const minDX = (ra.width + rb.width) / 2 + pad;
        const minDY = (ra.height + rb.height) / 2 + pad;
        const dx = (rb.x + rb.width / 2) - (ra.x + ra.width / 2);
        const dy = (rb.y + rb.height / 2) - (ra.y + ra.height / 2);
        const overlapX = minDX - Math.abs(dx);
        const overlapY = minDY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        const axisX = overlapX < overlapY;
        const overlap = axisX ? overlapX : overlapY;
        const sign = (axisX ? dx : dy) >= 0 ? 1 : -1;

        let fa = pair.frac.a, fb = pair.frac.b;
        const aPinned = !!na.pinned, bPinned = !!nb.pinned;
        if (aPinned && bPinned) continue;
        if (aPinned) { fa = 0; fb = 1; }
        else if (bPinned) { fa = 1; fb = 0; }

        if (axisX) {
          if (fa > 0) shift(na, -sign * overlap * fa, 0);
          if (fb > 0) shift(nb, sign * overlap * fb, 0);
        } else {
          if (fa > 0) shift(na, 0, -sign * overlap * fa);
          if (fb > 0) shift(nb, 0, sign * overlap * fb);
        }
        moved = true;
      }
    }
    if (!moved) break;
    reflowContainers(ir, byId, childrenOf, positions, containers, header, minWidth, minHeight);
  }
}

// Rebuild every container rect from its children, deepest first, so a
// moved leaf grows/shifts its ancestor frames.
function reflowContainers(ir, byId, childrenOf, positions, containers, header, minWidth, minHeight) {
  const depthOf = (id) => {
    let d = 0, c = byId.get(id)?.parent;
    while (c) { d++; c = byId.get(c)?.parent; }
    return d;
  };
  const conts = ir.nodes.filter(n => n.hasChildren)
    .sort((a, b) => depthOf(b.id) - depthOf(a.id));
  for (const c of conts) {
    const kids = childrenOf.get(c.id) || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hits = 0;
    for (const id of kids) {
      const r = positions.get(id) || containers.get(id);
      if (!r) continue;
      hits++;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.width > maxX) maxX = r.x + r.width;
      if (r.y + r.height > maxY) maxY = r.y + r.height;
    }
    if (!hits) continue;
    const rect = containers.get(c.id);
    if (!rect) continue;
    const pad = c.padding || 24;
    rect.x = minX - pad;
    rect.y = minY - pad - header;
    rect.width = Math.max(minWidth, (maxX - minX) + pad * 2);
    rect.height = Math.max(minHeight, (maxY - minY) + pad * 2 + header);
  }
}
