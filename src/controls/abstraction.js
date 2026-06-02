// Abstraction drill-in: focus on a container = project IR to its subtree.

export function projectIR(ir, focusedContainer) {
  if (!focusedContainer) return ir;
  const focus = ir.nodes.find(n => n.id === focusedContainer && n.hasChildren);
  if (!focus) return ir;

  const descendants = new Set();
  function collect(parentId) {
    for (const n of ir.nodes) {
      if (n.parent === parentId) {
        descendants.add(n.id);
        if (n.hasChildren) collect(n.id);
      }
    }
  }
  collect(focus.id);

  // Re-parent direct children to null (so layout sees them at root).
  const nodes = ir.nodes
    .filter(n => descendants.has(n.id))
    .map(n => ({ ...n, parent: n.parent === focus.id ? null : n.parent }));
  const edges = ir.edges.filter(e => descendants.has(e.source) && descendants.has(e.target));
  const layers = Array.from(new Set(nodes.flatMap(n => n.layers).concat(edges.flatMap(e => e.layers))));
  return { ...ir, nodes, edges, layers, _focused: focus.id };
}

export function createBreadcrumb(container, ir, focusedContainer, onChange) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'breadcrumb';

  const home = document.createElement('button');
  home.className = 'crumb';
  home.textContent = ir.meta.title || 'raiz';
  home.addEventListener('click', () => onChange(null));
  root.appendChild(home);

  if (focusedContainer) {
    // Walk the ancestor chain from the focused container up to the root
    // so every intermediate container shows as its own crumb — drilling
    // into a grandchild keeps the parent visible (and clickable).
    const byId = new Map(ir.nodes.map(n => [n.id, n]));
    const chain = [];
    for (let id = focusedContainer; id; ) {
      const node = byId.get(id);
      if (!node) break;
      chain.unshift(node);
      id = node.parent;
    }
    chain.forEach((node, i) => {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '›';
      root.appendChild(sep);
      if (i === chain.length - 1) {
        const c = document.createElement('span');
        c.className = 'crumb current';
        c.textContent = node.label;
        root.appendChild(c);
      } else {
        const btn = document.createElement('button');
        btn.className = 'crumb';
        btn.textContent = node.label;
        btn.addEventListener('click', () => onChange(node.id));
        root.appendChild(btn);
      }
    });
  }
  container.appendChild(root);
}
