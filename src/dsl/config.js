// Parse + validate the YAML config blob.
// Returns { options, errors } where `options` is safe to merge into
// adapter/router opts, and `errors` is a non-fatal list (UI surfaces them).
//
// Schema (all keys optional, unknown keys preserved verbatim so future
// adapters can read them without a parser change):
//
//   live:      { ...adapter knobs }
//   custom:    { ...adapter knobs }
//   off:       { ...adapter knobs }
//   collision: { nodePad: <px>, edgePad: <px> }
//   router:    { ...router knobs }
//
// Collision LAYERS themselves are declared inline in the DSL
// (`nodeLayers` / `edgeLayers` attributes per node/edge); only the
// global pad knobs live here.

import { parse as parseYaml, LineCounter } from 'yaml';

export function parseConfig(text) {
  const out = { options: {}, errors: [] };
  const trimmed = (text || '').trim();
  if (!trimmed) return out;
  let parsed;
  try {
    const lc = new LineCounter();
    parsed = parseYaml(trimmed, { schema: 'core', lineCounter: lc });
  } catch (err) {
    out.errors.push({ msg: 'config inválido: ' + (err.message || String(err)) });
    return out;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    out.errors.push({ msg: 'config precisa ser um mapa YAML' });
    return out;
  }
  out.options = parsed;
  return out;
}

// Per-adapter snippets shown as the textarea `placeholder` — context-aware
// so the example always matches the layout the user has selected. The
// shared `collision` block (global pad knobs) appears in every variant.
const COLLISION_BLOCK = `collision:
  nodePad: 12
  edgePad: 8`;

export const PLACEHOLDERS = {
  live: `live:
  center: 0.012
  damping: 0.82
  collision: true
${COLLISION_BLOCK}
router:
  padding: 12`,
  custom: `${COLLISION_BLOCK}
router:
  padding: 12`,
  off: `${COLLISION_BLOCK}
router:
  padding: 12`,
};

export const CONFIG_PLACEHOLDER = PLACEHOLDERS.live; // back-compat default

export function placeholderFor(layoutId) {
  return PLACEHOLDERS[layoutId] || PLACEHOLDERS.live;
}
