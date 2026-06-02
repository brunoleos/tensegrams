// YAML → structured shape.
//
// Reads the canonical YAML document with `yaml` (eemeli) so we get
// native support for composite keys (`? [a, b]\n: { … }`), line/column
// for diagnostics, and a clean Map-based view of the top-level entries.
//
// Shape returned (consumed by buildIR):
//
//   {
//     options: {…},                        // global config
//     connections: [                       // declared edges, in order
//       { a, b, key, line }, …             // key is the 3rd pair item or undefined
//     ],
//     nodes: Map<id, { attrs, line }>,     // string-keyed top-level entries
//     edges: Map<edgeKey, { pair, key, attrs, line }>,
//                                          // composite-keyed decorations
//     errors:   [{ line, msg }, …],        // hard parse errors
//     warnings: [{ line, msg }, …],        // soft (shape mismatches)
//   }
//
// `edgeKey` is the canonical, order-independent identifier built by
// canonicalEdgeKey(a, b, key) — `[a,b]` and `[b,a]` collide on it.

import { parseDocument, LineCounter } from 'yaml';
import { RESERVED_TOP_KEYS } from './attr-set.js';

export function parse(text) {
  const errors = [];
  const warnings = [];
  const input = String(text ?? '');

  const lineCounter = new LineCounter();
  const doc = parseDocument(input, { schema: 'core', lineCounter });

  for (const err of doc.errors)    errors.push(formatYamlIssue(err));
  for (const w   of doc.warnings)  warnings.push(formatYamlIssue(w));
  if (errors.length) return emptyOk(errors, warnings);

  // toJS gives us native arrays/Maps; mapAsMap preserves insertion
  // order AND keeps composite keys as the JS values they parsed to
  // (Arrays for `? [a, b]:`).
  const root = doc.toJS({ mapAsMap: true });
  if (root == null) return emptyOk(errors, warnings);
  if (!(root instanceof Map)) {
    errors.push({ line: 1, msg: 'documento precisa ser um mapa YAML (chave: valor)' });
    return emptyOk(errors, warnings);
  }

  const out = {
    options: {},
    connections: [],
    nodes: new Map(),
    edges: new Map(),
    errors,
    warnings,
  };

  // Cache for line lookups: walk the YAML AST once, recording the
  // starting line of every top-level mapping entry. Keys that are
  // sequences (composite) get indexed by their canonical edge key so
  // we can map decoration warnings back to the source.
  const topLines = indexTopLines(doc, lineCounter);

  for (const [key, value] of root) {
    if (key === 'options') {
      const line = topLines.get('options') ?? 0;
      if (value == null) continue;
      if (!(value instanceof Map)) {
        errors.push({ line, msg: '"options" deve ser um mapa' });
        continue;
      }
      for (const [k, v] of value) out.options[String(k)] = unwrap(v);
      continue;
    }

    if (key === 'connections') {
      const line = topLines.get('connections') ?? 0;
      out.connections.push(...parseConnections(value, line, errors));
      continue;
    }

    if (Array.isArray(key)) {
      // Composite edge-decoration key: [a, b] or [a, b, N].
      const items = key.map(x => unwrap(x));
      if (items.length < 2 || items.length > 3) {
        errors.push({
          line: topLines.get(edgeKeyLookup(items)) ?? 0,
          msg: 'chave de aresta precisa ter 2 ou 3 elementos: [from, to] ou [from, to, N]',
        });
        continue;
      }
      const [a, b, k] = items;
      if (typeof a !== 'string' || !a || typeof b !== 'string' || !b) {
        errors.push({ line: 0, msg: `chave de aresta inválida: [${items.join(', ')}]` });
        continue;
      }
      const line = topLines.get(edgeKeyLookup(items)) ?? 0;
      const attrs = mapToObject(value);
      const canonical = canonicalEdgeKey(a, b, k);
      if (out.edges.has(canonical)) {
        errors.push({
          line,
          msg: `decoração duplicada para a aresta [${a}, ${b}${k != null ? ', ' + k : ''}]`,
        });
        continue;
      }
      out.edges.set(canonical, { pair: [a, b], key: k == null ? undefined : String(k), attrs, line });
      continue;
    }

    // Node definition.
    if (typeof key !== 'string' || !key) {
      errors.push({ line: 0, msg: `id de nó inválido: ${JSON.stringify(key)}` });
      continue;
    }
    if (RESERVED_TOP_KEYS.has(key)) continue;

    const line = topLines.get(key) ?? 0;
    if (value != null && !(value instanceof Map)) {
      errors.push({ line, msg: `definição de "${key}" precisa ser um mapa de atributos` });
      continue;
    }
    if (out.nodes.has(key)) {
      errors.push({ line, msg: `id duplicado: ${key}` });
      continue;
    }
    out.nodes.set(key, { attrs: mapToObject(value), line });
  }

  return out;
}

// ---------- canonical edge key ----------
//
// Edges are UNDIRECTED — [a, b] and [b, a] refer to the same edge.
// We normalize to "smaller id first, lexicographic" so a decoration
// keyed `[b, a]` finds the connection declared as `[a, b]`. The pair
// order seen in `connections:` is preserved separately for visual
// orientation (which endpoint gets startStyle vs endStyle).

export function canonicalEdgeKey(a, b, key) {
  const ordered = a <= b ? `${a}|${b}` : `${b}|${a}`;
  return key == null ? ordered : `${ordered}|${key}`;
}

// Build a lookup token that matches the `topLines` index entry for a
// composite key. Same canonical form, but using the OBSERVED pair
// order (so we don't normalize twice — `indexTopLines` already does).
function edgeKeyLookup(items) {
  return '@' + items.join('|');
}

// ---------- AST line indexing ----------

function indexTopLines(doc, lineCounter) {
  const out = new Map();
  const contents = doc.contents;
  if (!contents || !contents.items) return out;
  for (const pair of contents.items) {
    const key = pair.key;
    if (!key) continue;
    const line = lineOf(key, lineCounter) ?? 0;
    if (typeof key.value === 'string') {
      if (!out.has(key.value)) out.set(key.value, line);
      continue;
    }
    if (key.items) {
      const items = key.items.map(it => it?.value).filter(v => v != null);
      const token = '@' + items.join('|');
      if (!out.has(token)) out.set(token, line);
    }
  }
  return out;
}

function lineOf(node, lineCounter) {
  if (!node?.range || !lineCounter) return null;
  return lineCounter.linePos(node.range[0])?.line ?? null;
}

// ---------- helpers ----------

function parseConnections(value, baseLine, errors) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    errors.push({ line: baseLine, msg: '"connections" precisa ser uma lista' });
    return [];
  }
  const out = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (!Array.isArray(item)) {
      errors.push({ line: baseLine, msg: `connections[${i}]: cada item deve ser [from, to] ou [from, to, N]` });
      continue;
    }
    if (item.length < 2 || item.length > 3) {
      errors.push({ line: baseLine, msg: `connections[${i}]: precisa de 2 ou 3 elementos` });
      continue;
    }
    const [a, b, k] = item;
    if (typeof a !== 'string' || !a || typeof b !== 'string' || !b) {
      errors.push({ line: baseLine, msg: `connections[${i}]: "from" e "to" devem ser ids (strings)` });
      continue;
    }
    if (k != null && typeof k !== 'string' && typeof k !== 'number') {
      errors.push({ line: baseLine, msg: `connections[${i}]: discriminador (3º elemento) deve ser número ou string` });
      continue;
    }
    out.push({ a, b, key: k == null ? undefined : String(k), line: baseLine });
  }
  return out;
}

// Convert a YAML Map (mapAsMap result) to a plain object. Nested Maps
// stay as Maps so callers that care (constraint, weighted-maps) can
// detect them. We only flatten the top "attributes" layer.
function mapToObject(value) {
  if (value == null) return {};
  if (!(value instanceof Map)) return {};
  const out = {};
  for (const [k, v] of value) out[String(k)] = unwrap(v);
  return out;
}

// Unwrap a parsed YAML value into the plain-JS form the IR builder
// expects: Maps → objects (recursively for one level — enough for our
// schema, which doesn't nest deeper than `constraint: { type, … }`).
function unwrap(v) {
  if (v instanceof Map) {
    const out = {};
    for (const [k, val] of v) out[String(k)] = unwrap(val);
    return out;
  }
  if (Array.isArray(v)) return v.map(unwrap);
  return v;
}

// Format a YAML parser error/warning into our `{ line, msg }` shape.
function formatYamlIssue(e) {
  const pos = e.linePos?.[0];
  return {
    line: pos?.line ?? 1,
    msg: 'YAML inválido: ' + (e.message || String(e)),
  };
}

function emptyOk(errors, warnings) {
  return {
    options: {},
    connections: [],
    nodes: new Map(),
    edges: new Map(),
    errors,
    warnings,
  };
}
