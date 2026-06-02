import { ensureEl, createSvgEl } from './ensure-el.js';

// View-state is passed in by the pipeline. The renderer does NOT read
// it from the IR — keeps the SVG layer agnostic of how selection /
// collapse state are stored upstream.
//
// `view` shape: { selectedId: string|null, collapsedIds: Set<string> }.

export function renderNodes(group, ir, positions, containers, view = {}) {
  const selectedId = view.selectedId ?? null;
  const collapsedIds = view.collapsedIds || EMPTY_SET;
  const alive = new Set();

  // Container-shaped nodes first (z-order behind leaf-shaped ones).
  for (const node of ir.nodes) {
    if (!node.hasChildren) continue;
    const rect = containers.get(node.id);
    if (!rect) continue;
    alive.add(node.id);
    const el = ensureNodeEl(group, node);
    placeContainer(el, node, rect, collapsedIds.has(node.id));
    el.classList.toggle('selected', node.id === selectedId);
  }
  for (const node of ir.nodes) {
    if (node.hasChildren) continue;
    const rect = positions.get(node.id);
    if (!rect) continue;
    alive.add(node.id);
    const el = ensureNodeEl(group, node);
    placeLeaf(el, node, rect);
    el.classList.toggle('selected', node.id === selectedId);
  }

  // Reap stale.
  for (const child of Array.from(group.children)) {
    if (!alive.has(child.dataset.id)) child.remove();
  }
}

const EMPTY_SET = new Set();

function ensureNodeEl(group, node) {
  return ensureEl(group, node.id, (el) => {
    el.classList.add('node');
    // `data-kind` is purely a visual hint for CSS / E2E selectors — the
    // abstract model has only one Node type. The value reflects whether
    // this node has children (renders as a frame) or not (renders as a box).
    el.dataset.kind = node.hasChildren ? 'container' : 'leaf';
    el.setAttribute('data-layers', node.layers.join(' '));

    const rect = createSvgEl('rect');
    rect.classList.add('node-rect');
    rect.setAttribute('rx', '6');
    el.appendChild(rect);

    if (node.hasChildren) {
      const header = createSvgEl('rect');
      header.classList.add('container-header');
      header.setAttribute('rx', '6');
      el.appendChild(header);
    }

    const label = createSvgEl('text');
    label.classList.add('node-label');
    label.textContent = node.label;
    el.appendChild(label);
  });
}

function placeLeaf(el, node, rect) {
  el.setAttribute('transform', `translate(${rect.x} ${rect.y})`);
  const r = el.querySelector('.node-rect');
  r.setAttribute('width', rect.width);
  r.setAttribute('height', rect.height);
  const label = el.querySelector('.node-label');
  label.setAttribute('x', rect.width / 2);
  label.setAttribute('y', rect.height / 2 + 5);
  label.textContent = node.label;
  el.setAttribute('data-layers', node.layers.join(' '));
}

function placeContainer(el, node, rect, isCollapsed) {
  el.setAttribute('transform', `translate(${rect.x} ${rect.y})`);
  const r = el.querySelector('.node-rect');
  r.setAttribute('width', rect.width);
  r.setAttribute('height', rect.height);
  const header = el.querySelector('.container-header');
  if (header) {
    header.setAttribute('width', rect.width);
    header.setAttribute('height', 22);
  }
  const label = el.querySelector('.node-label');
  // Two label positions for containers — chosen by collapse state so
  // the user can read the name at a glance regardless of size:
  //   - expanded:  label inside the header strip (top-left), leaving
  //                the body free for descendants.
  //   - collapsed: label centered in the body (the header is just a
  //                tap target for toggle), since there are no
  //                descendants to compete with.
  if (isCollapsed) {
    label.setAttribute('x', rect.width / 2);
    label.setAttribute('y', rect.height / 2 + 5);
    label.setAttribute('text-anchor', 'middle');
    label.textContent = `▸ ${node.label}`;
  } else {
    label.setAttribute('x', 10);
    label.setAttribute('y', 15);
    label.setAttribute('text-anchor', 'start');
    label.textContent = node.label;
  }
  el.setAttribute('data-layers', node.layers.join(' '));
  el.classList.toggle('collapsed', isCollapsed);
}
