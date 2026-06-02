// Import / export of the DSL and the config as standalone .yaml files.
//
// Both `store.state.dsl` and `store.state.config` are already raw YAML
// strings, so export is a direct write (no serialisation) and import is
// just `setDSL`/`setConfig` — the pipeline re-renders on the store change
// (graphSig in pipeline.js includes both dsl and config).
//
// Validation reuses the SAME parsers the live editor uses, so an imported
// file surfaces problems in #errors exactly like typed text would.

import { downloadTextFile, fileTimestamp } from './download.js';
import { parse as parseDSL } from '../dsl/parser.js';
import { parseConfig } from '../dsl/config.js';

const YAML_MIME = 'text/yaml';

export function exportDSL(store) {
  downloadTextFile(`tensegrams-dsl-${fileTimestamp()}.yaml`, store.state.dsl ?? '', YAML_MIME);
}

export function exportConfig(store) {
  downloadTextFile(`tensegrams-config-${fileTimestamp()}.yaml`, store.state.config ?? '', YAML_MIME);
}

// Both validators return { ok, errors } and never throw — a binary or
// malformed file degrades to an error list, not a crash.
export function validateDSL(text) {
  try {
    const ast = parseDSL(text);
    return { ok: !(ast?.errors?.length), errors: ast?.errors ?? [] };
  } catch (err) {
    return { ok: false, errors: [{ msg: String(err?.message || err) }] };
  }
}

export function validateConfig(text) {
  const { errors } = parseConfig(text); // parseConfig catches internally
  return { ok: !errors.length, errors };
}

// Apply imported text to the store. `kind` is 'dsl' | 'config'. By default
// the content is applied even when invalid, so the user sees and fixes it
// in the editor (errors show in #errors) — mirroring the typing flow. Pass
// { reject: true } to refuse invalid input and leave current content intact.
export function applyImport(store, kind, text, { reject = false } = {}) {
  const { ok, errors } = kind === 'config' ? validateConfig(text) : validateDSL(text);
  if (reject && !ok) return { applied: false, errors };
  if (kind === 'config') store.setConfig(text);
  else store.setDSL(text);
  return { applied: true, errors: ok ? [] : errors };
}
