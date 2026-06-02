// Edge endpoint styles. Each preset is an SVG <defs> <marker> spec —
// stamped once into <defs>, referenced per edge via marker-start /
// marker-end. The renderer chooses which marker URL to apply based on
// `edge.startStyle` and `edge.endStyle`.
//
// Adding a new preset:
//   1. Add an entry below with the marker <path> data (or other shape).
//   2. Add its name to attr-set.js#EDGE_STYLE_PRESETS.
//   3. The IR validator will accept it; the renderer picks it up via
//      MARKERS[name].
//
// Each marker uses orient="auto-start-reverse" so the same definition
// flips automatically at start vs end, and viewBox 0 0 10 10 (the
// "tip" is at 10,5 — looking forward along the edge).

export const SVG_NS = 'http://www.w3.org/2000/svg';

// Marker geometry. `d` is the <path>'s d attribute, `fill` chooses
// between solid (filled) and outline (stroked-only) glyphs.
const MARKERS = {
  none: null, // handled specially — no marker attribute emitted
  filledArrow: {
    paths: [{ d: 'M 0 0 L 10 5 L 0 10 z', fill: 'currentColor', stroke: 'none' }],
    refX: 9, refY: 5,
  },
  outlineArrow: {
    paths: [{ d: 'M 0 0 L 10 5 L 0 10 z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }],
    refX: 9, refY: 5,
  },
  crowfoot: {
    // Three lines fanning out from the tip — classic ER "many" notation.
    paths: [
      { d: 'M 10 5 L 0 0',  fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 },
      { d: 'M 10 5 L 0 5',  fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 },
      { d: 'M 10 5 L 0 10', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 },
    ],
    refX: 10, refY: 5,
  },
  diamond: {
    paths: [{ d: 'M 0 5 L 5 0 L 10 5 L 5 10 z', fill: 'currentColor', stroke: 'none' }],
    refX: 9, refY: 5,
  },
  circle: {
    // Small filled circle at the tip.
    paths: [{ d: 'M 4 5 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: 'currentColor', stroke: 'none' }],
    refX: 9, refY: 5,
  },
};

// Build all marker elements once and append them to <defs>. Safe to
// call multiple times — idempotent (each marker has a stable id and
// we don't recreate one that already exists).
export function ensureMarkers(svg) {
  let defs = svg.querySelector(':scope > defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);
  }
  for (const [name, spec] of Object.entries(MARKERS)) {
    if (!spec) continue;
    const id = markerIdFor(name);
    if (defs.querySelector(`#${CSS.escape(id)}`)) continue;
    defs.appendChild(buildMarker(id, spec));
  }
}

function buildMarker(id, spec) {
  const marker = document.createElementNS(SVG_NS, 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', String(spec.refX));
  marker.setAttribute('refY', String(spec.refY));
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('orient', 'auto-start-reverse');
  for (const p of spec.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    for (const [k, v] of Object.entries(p)) path.setAttribute(k, String(v));
    marker.appendChild(path);
  }
  return marker;
}

// Stable id so we can reference the marker via url(#…). Prefix avoids
// collisions with non-edge SVG elements.
export function markerIdFor(name) {
  return `edge-end-${name}`;
}

// Returns the SVG url(#…) reference for the given preset, or null when
// the preset is `none` / unknown.
export function markerUrl(name) {
  if (!name || name === 'none') return null;
  if (!(name in MARKERS)) return null;
  return `url(#${markerIdFor(name)})`;
}
