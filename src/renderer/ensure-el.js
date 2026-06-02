// Shared keyed-DOM ensure helper for SVG renderers.
//
// All renderer modules diff against an id-keyed children list: look up
// by `data-id`, create if missing, append. Factoring the lookup +
// creation pair keeps `nodes.js` and `edges.js` focused on the visual
// structure, not on the SVG bookkeeping.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function ensureEl(group, id, build) {
  let el = group.querySelector(`:scope > g[data-id="${escapeAttr(id)}"]`);
  if (el) return el;
  el = document.createElementNS(SVG_NS, 'g');
  el.dataset.id = id;
  build(el);
  group.appendChild(el);
  return el;
}

export function createSvgEl(name) {
  return document.createElementNS(SVG_NS, name);
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '\\"');
}
