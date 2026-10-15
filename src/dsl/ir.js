// Parsed YAML doc → GraphIR.
//
// The new schema declares:
//   - `options:` global config (title, snapContainerAnchor)
//   - `connections:` list of [a, b] / [a, b, N] pairs (declares the
//     existence of edges AND, implicitly, of the nodes they mention)
//   - `<id>:` blocks add config to a node (label, parent, layers, …)
//   - `? [a, b]:` (or `? [a, b, N]:`) blocks add config to an edge
//
// Edges are UNDIRECTED. `source`/`target` in the IR are positional —
// they only determine which endpoint gets `startStyle` vs `endStyle`.
//
// Downstream code (layout, router, renderer) consumes the same IR
// shape as before; only the front-end (YAML parser + this builder)
// changed.

import { canonicalEdgeKey } from './parser.js';
import {
  OPTION_KEYS,
  ROUTING_SUBKEYS,
  ENDPOINT_BBOX_SUBKEYS,
  CENTRAL_SUBKEYS,
  ALGEBRAIC_SUBKEYS,
  PHYSICS_SUBKEYS,
  NODE_ATTRS,
  EDGE_ATTRS,
  EDGE_STYLE_SUBKEYS,
  EDGE_STYLE_PRESETS,
  DEFAULT_EDGE_STYLE,
  SNAP_VALUES,
  ON_HIDDEN_VALUES,
  ENDPOINTS_SIDES,
  ENDPOINT_SUBKEYS,
} from './attr-set.js';
import { didYouMean } from './diagnostics.js';

const DEFAULT_NODE_SIZE = { width: 140, height: 48 };
const DEFAULT_CONTAINER_PADDING = 24;

export function buildIR(parsed) {
  const ir = {
    nodes: [],
    edges: [],
    layers: [],
    meta: {
      title: '',
      direction: 'LR',
      snapContainerAnchor: true,
      // routing: config do solver físico (fase 5.x). Sub-chaves
      // populadas conforme `options.routing.*` aparecer no DSL; ausência
      // significa "usar defaults do solver". Sem efeito funcional na
      // 5.1 — apenas aceita e propaga.
      routing: {},
    },
    errors: [...(parsed.errors || [])],
    warnings: [...(parsed.warnings || [])],
  };

  // --- options ---
  for (const [k, v] of Object.entries(parsed.options || {})) {
    if (!OPTION_KEYS.has(k)) {
      ir.warnings.push({ line: 0, msg: `options.${k} desconhecido${didYouMean(k, [...OPTION_KEYS])}` });
      continue;
    }
    if (k === 'title') ir.meta.title = String(v ?? '');
    else if (k === 'snapContainerAnchor') ir.meta.snapContainerAnchor = parseBool(v, true);
    else if (k === 'routing') ir.meta.routing = parseRouting(v, ir);
  }

  // --- node materialization ---
  //
  // 1. Walk explicit definitions in declaration order.
  // 2. For each connection, auto-declare endpoints we haven't seen yet
  //    (their attrs default to empty).
  const nodeIndex = new Map(); // id → node object (in declaration order)

  function ensureNode(id, lineHint, explicitContainer = false) {
    let n = nodeIndex.get(id);
    if (n) {
      if (explicitContainer) n._isContainerSyntax = true;
      return n;
    }
    n = makeNode(id, id, lineHint, ir);
    if (explicitContainer) n._isContainerSyntax = true;
    nodeIndex.set(id, n);
    ir.nodes.push(n);
    return n;
  }

  for (const [id, def] of parsed.nodes) {
    ensureNode(id, def.line);
    applyNodeAttrs(nodeIndex.get(id), def.attrs, def.line, ir);
  }

  // --- edge materialization ---
  //
  // Each entry in `connections` becomes an edge. Decoration blocks
  // attach attrs to the edge with the matching canonical key. Edges
  // without a discriminator that appear more than once in `connections`
  // are a hard error (paralelas precisam de discriminador).
  const edgeByCanonical = new Map();
  const seenWithoutKey = new Set(); // canonical (no discriminator) → seen

  for (const c of parsed.connections) {
    ensureNode(c.a, c.line);
    ensureNode(c.b, c.line);

    const canonical = canonicalEdgeKey(c.a, c.b, c.key);

    if (edgeByCanonical.has(canonical)) {
      ir.errors.push({
        line: c.line,
        msg: c.key == null
          ? `aresta duplicada [${c.a}, ${c.b}] — paralelas precisam de discriminador [${c.a}, ${c.b}, N]`
          : `aresta duplicada [${c.a}, ${c.b}, ${c.key}]`,
      });
      continue;
    }

    // Reject mixing [a, b] (no key) with [a, b, N] (with key) — they're
    // incompatible declarations of "is there one or many".
    const base = canonicalEdgeKey(c.a, c.b);
    if (c.key == null) {
      // a base edge.  Conflicts if a discriminated one already exists.
      const existingDiscriminated = [...edgeByCanonical.keys()]
        .some(k => k.startsWith(base + '|') && k !== base);
      if (existingDiscriminated) {
        ir.errors.push({
          line: c.line,
          msg: `[${c.a}, ${c.b}] sem discriminador conflita com paralelas já declaradas`,
        });
        continue;
      }
      seenWithoutKey.add(base);
    } else {
      // a discriminated edge.  Conflicts if a base one already exists.
      if (seenWithoutKey.has(base)) {
        ir.errors.push({
          line: c.line,
          msg: `[${c.a}, ${c.b}, ${c.key}] conflita com [${c.a}, ${c.b}] já declarada — escolha uma forma`,
        });
        continue;
      }
    }

    const edge = makeEdge(c.a, c.b, c.key, canonical, c.line);
    edgeByCanonical.set(canonical, edge);
    ir.edges.push(edge);
  }

  // Apply decorations. Orphans (no matching connection) → warning.
  for (const [canonical, deco] of parsed.edges) {
    const edge = edgeByCanonical.get(canonical);
    if (!edge) {
      const label = deco.key != null
        ? `[${deco.pair[0]}, ${deco.pair[1]}, ${deco.key}]`
        : `[${deco.pair[0]}, ${deco.pair[1]}]`;
      ir.warnings.push({
        line: deco.line,
        msg: `decoração ${label} sem aresta correspondente em "connections" — ignorada`,
      });
      continue;
    }
    applyEdgeAttrs(edge, deco.attrs, deco.line, ir);
  }

  // --- parent resolution + container intent ---
  resolveParents(ir.nodes, ir);
  finalizeContainerFlags(ir.nodes);

  // --- layer set ---
  const layerSet = new Set();
  for (const n of ir.nodes) for (const l of n.layers) layerSet.add(l);
  for (const e of ir.edges) for (const l of e.layers) layerSet.add(l);
  ir.layers = Array.from(layerSet);

  // --- paradoxical nodeLayers warning ---
  // Quando uma aresta declara nodeLayers compartilhadas com seu endpoint
  // (ou um ancestral), a colisão é silenciosamente neutralizada pelo
  // `endpointAllowedSet` (princípio da necessidade geométrica — veja
  // src/layout/collision.js). Avisar o autor pra ele remover a declaração
  // redundante e entender por que aquela layer não tem efeito ali.
  warnParadoxicalNodeLayers(ir);

  return ir;
}

function warnParadoxicalNodeLayers(ir) {
  const byId = new Map(ir.nodes.map(n => [n.id, n]));
  // Build ancestor sets inline (importar buildAncestors criaria ciclo).
  const ancestorsOf = (id) => {
    const set = new Set();
    let cur = byId.get(id)?.parent;
    while (cur) { set.add(cur); cur = byId.get(cur)?.parent; }
    return set;
  };
  for (const edge of ir.edges) {
    if (!edge.nodeCollision || !edge.nodeCollision.size) continue;
    const allowed = new Set([edge.source, edge.target,
      ...ancestorsOf(edge.source), ...ancestorsOf(edge.target)]);
    const seen = new Set();
    for (const id of allowed) {
      const n = byId.get(id);
      if (!n || !n.nodeCollision || !n.nodeCollision.size) continue;
      for (const layer of edge.nodeCollision.keys()) {
        if (!n.nodeCollision.has(layer)) continue;
        const tag = `${layer}|${id}`;
        if (seen.has(tag)) continue;
        seen.add(tag);
        const role = id === edge.source || id === edge.target ? 'endpoint' : 'ancestral';
        ir.warnings.push({
          line: edge._line || 0,
          msg: `aresta [${edge.source}, ${edge.target}] declara nodeLayers: "${layer}" presente em "${id}" (${role}) — colisão será ignorada pelo resolvedor (necessidade geométrica)`,
        });
      }
    }
  }
}

// ---------- node helpers ----------

function makeNode(id, label, line, ir) {
  return {
    id,
    label,
    parent: null,
    _line: line,
    _isContainerSyntax: false,
    _parentRaw: null,           // raw parent string from attrs; resolved later
    layers: [],
    nodeCollision: new Map(),
    width: DEFAULT_NODE_SIZE.width,
    height: DEFAULT_NODE_SIZE.height,
    pinned: false,
    constraint: null,
    forces: null,
    padding: undefined,
  };
}

function applyNodeAttrs(node, attrs, line, ir) {
  for (const [k, v] of Object.entries(attrs)) {
    if (!NODE_ATTRS.has(k)) {
      ir.warnings.push({
        line,
        msg: `atributo desconhecido em "${node.id}": ${k}${didYouMean(k, [...NODE_ATTRS])}`,
      });
      continue;
    }
    switch (k) {
      case 'label':       node.label = String(v ?? node.id); break;
      case 'parent':      node._parentRaw = v == null ? null : String(v); break;
      case 'viewLayers':  node.layers = parseLayerList(v, line, ir, node.id); break;
      case 'nodeLayers':  node.nodeCollision = parseWeightedMap(v, line, ir, node.id, 'nodeLayers'); break;
      case 'size':        applyPair(v, ([w, h]) => {
                            if (Number.isFinite(w)) node.width = w;
                            if (Number.isFinite(h)) node.height = h;
                          }); break;
      case 'pin':         applyPair(v, ([x, y]) => {
                            if (Number.isFinite(x) && Number.isFinite(y)) node.pinned = { x, y };
                          }); break;
      case 'padding':     if (Number.isFinite(Number(v))) node.padding = Number(v); break;
      case 'attractTo':   node.forces = node.forces || { attractTo: {}, repelFrom: {} };
                          for (const [t, w] of parseWeightedMap(v, line, ir, node.id, 'attractTo')) {
                            node.forces.attractTo[t] = w;
                          } break;
      case 'repelFrom':   node.forces = node.forces || { attractTo: {}, repelFrom: {} };
                          for (const [t, w] of parseWeightedMap(v, line, ir, node.id, 'repelFrom')) {
                            node.forces.repelFrom[t] = w;
                          } break;
      case 'constraint':  node.constraint = parseConstraint(v, line, ir, node.id); break;
      // Fase 5.1: novos attrs aceitos sem efeito funcional. Solver/
      // snap-resolver (5.3+) consomem `node.shape` e `node.snap*` quando
      // implementados. Validação de valores fica nas fases que usam.
      case 'shape':       node.shape = v == null ? null : String(v); break;
      case 'snap':        node.snap = v; break;
      case 'snapGroups':  node.snapGroups = v; break;
      case 'snapAngles':  node.snapAngles = v; break;
      case 'anchors':     node.anchors = v; break;
    }
  }
}

function resolveParents(nodes, ir) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) {
    if (n._parentRaw == null) { delete n._parentRaw; continue; }
    const target = byId.get(n._parentRaw);
    if (!target) {
      ir.warnings.push({ line: n._line || 0, msg: `parent desconhecido em "${n.id}": ${n._parentRaw}` });
      delete n._parentRaw;
      continue;
    }
    // Cycle check: walk up from target; if we hit `n`, it's a cycle.
    let cur = target;
    let cycle = false;
    const visited = new Set([n.id]);
    while (cur) {
      if (visited.has(cur.id)) { cycle = true; break; }
      visited.add(cur.id);
      cur = cur._parentRaw ? byId.get(cur._parentRaw) : null;
    }
    if (cycle) {
      ir.warnings.push({ line: n._line || 0, msg: `ciclo em parent envolvendo "${n.id}" — ignorado` });
      n.parent = null;
    } else {
      n.parent = target.id;
      target._hasChildIntent = true; // node referenced as parent → container
    }
    delete n._parentRaw;
  }
}

function finalizeContainerFlags(nodes) {
  for (const n of nodes) {
    n.hasChildren = n._isContainerSyntax === true || n._hasChildIntent === true;
    delete n._isContainerSyntax;
    delete n._hasChildIntent;
    delete n._line;
    if (n.hasChildren && n.padding == null) n.padding = DEFAULT_CONTAINER_PADDING;
  }
}

// ---------- edge helpers ----------

function makeEdge(a, b, key, canonical, line) {
  // Edge id is derived from the canonical pair + discriminator. Stable
  // across renders even when the user shuffles connections order.
  const id = key == null ? `e:${canonical}` : `e:${canonical}`;
  return {
    id,
    canonical,
    source: a,                  // POSITIONAL — startStyle attaches here
    target: b,                  // POSITIONAL — endStyle attaches here
    parallelKey: key == null ? null : String(key),
    label: '',
    layers: [],
    nodeCollision: new Map(),
    edgeCollision: new Map(),
    snap: 'inherit',
    onHidden: 'omit',
    startStyle: DEFAULT_EDGE_STYLE.startStyle,
    endStyle:   DEFAULT_EDGE_STYLE.endStyle,
    _line: line,
  };
}

function applyEdgeAttrs(edge, attrs, line, ir) {
  for (const [k, v] of Object.entries(attrs)) {
    if (!EDGE_ATTRS.has(k)) {
      ir.warnings.push({
        line,
        msg: `atributo desconhecido em aresta [${edge.source}, ${edge.target}]: ${k}${didYouMean(k, [...EDGE_ATTRS])}`,
      });
      continue;
    }
    switch (k) {
      case 'label':       edge.label = String(v ?? ''); break;
      case 'viewLayers':  edge.layers = parseLayerList(v, line, ir, edgeName(edge)); break;
      case 'nodeLayers':  edge.nodeCollision = parseWeightedMap(v, line, ir, edgeName(edge), 'nodeLayers'); break;
      case 'edgeLayers':  edge.edgeCollision = parseWeightedMap(v, line, ir, edgeName(edge), 'edgeLayers'); break;
      case 'snap':        edge.snap = SNAP_VALUES.has(String(v)) ? String(v) : 'inherit'; break;
      case 'onHidden':    edge.onHidden = ON_HIDDEN_VALUES.has(String(v)) ? String(v) : 'omit'; break;
      case 'startStyle':  edge.startStyle = validateStyle(v, line, ir, edgeName(edge), 'startStyle'); break;
      case 'endStyle':    edge.endStyle   = validateStyle(v, line, ir, edgeName(edge), 'endStyle'); break;
      // Fase 5.1: edge.style = { strokeWidth?, edgePad? }. Lido pelo
      // warm-start do solver físico pra calcular `seg.pad`. Sub-chaves
      // desconhecidas viram warning com sugestão.
      case 'style':       edge.style = parseEdgeStyle(v, line, ir, edgeName(edge)); break;
      case 'endpoints': {
        const eps = parseEdgeEndpoints(v, line, ir, edgeName(edge));
        if (eps) edge.endpoints = eps;
        break;
      }
    }
  }
}

function parseEdgeEndpoints(v, line, ir, owner) {
  if (v == null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) {
    ir.warnings.push({ line, msg: `endpoints em ${owner} deve ser um mapa { source?, target? }` });
    return undefined;
  }
  const out = {};
  for (const [side, sub] of Object.entries(v)) {
    if (!ENDPOINTS_SIDES.includes(side)) {
      ir.warnings.push({
        line,
        msg: `endpoints.${side} desconhecido em ${owner}${didYouMean(side, ENDPOINTS_SIDES)}`,
      });
      continue;
    }
    if (sub == null) continue;
    if (typeof sub !== 'object' || Array.isArray(sub)) {
      ir.warnings.push({ line, msg: `endpoints.${side} em ${owner} deve ser um mapa` });
      continue;
    }
    const entry = {};
    for (const [k, val] of Object.entries(sub)) {
      if (!ENDPOINT_SUBKEYS.has(k)) {
        ir.warnings.push({
          line,
          msg: `endpoints.${side}.${k} desconhecido em ${owner}${didYouMean(k, [...ENDPOINT_SUBKEYS])}`,
        });
        continue;
      }
      if (k === 'side') {
        const num = Number(val);
        if (!Number.isFinite(num) || num <= 0) {
          ir.warnings.push({
            line,
            msg: `endpoints.${side}.side em ${owner} deve ser número > 0 (recebido ${JSON.stringify(val)})`,
          });
          continue;
        }
        entry.side = num;
      } else if (k === 'edgeLayers') {
        entry.edgeLayers = parseWeightedMap(val, line, ir, `${owner}.endpoints.${side}`, 'edgeLayers');
      }
    }
    if (Object.keys(entry).length) out[side] = entry;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseEdgeStyle(v, line, ir, owner) {
  if (v == null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) {
    ir.warnings.push({ line, msg: `style em ${owner} deve ser um mapa` });
    return undefined;
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (!EDGE_STYLE_SUBKEYS.has(k)) {
      ir.warnings.push({
        line,
        msg: `style.${k} desconhecido em ${owner}${didYouMean(k, [...EDGE_STYLE_SUBKEYS])}`,
      });
      continue;
    }
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) {
      ir.warnings.push({
        line,
        msg: `style.${k} em ${owner} deve ser número ≥ 0 (recebido: ${JSON.stringify(val)})`,
      });
      continue;
    }
    out[k] = num;
  }
  return Object.keys(out).length ? out : undefined;
}

function edgeName(edge) {
  return edge.parallelKey != null
    ? `[${edge.source}, ${edge.target}, ${edge.parallelKey}]`
    : `[${edge.source}, ${edge.target}]`;
}

function validateStyle(v, line, ir, owner, attrName) {
  const s = String(v ?? '');
  if (!EDGE_STYLE_PRESETS.includes(s)) {
    ir.warnings.push({
      line,
      msg: `${attrName} desconhecido em ${owner}: "${s}"${didYouMean(s, EDGE_STYLE_PRESETS)}`,
    });
    return DEFAULT_EDGE_STYLE[attrName];
  }
  return s;
}

// ---------- routing meta parser ----------

// Aceita o sub-bloco `options.routing` do DSL. Sub-chaves desconhecidas
// viram warning amigável com sugestão. Sem efeito funcional na 5.1 —
// apenas valida e propaga em `ir.meta.routing` pra consumo posterior
// pelas sub-fases (5.5+ leem `fission`, `fusion`, `snap`; warm-start
// lê `edgePad`).
function parseRouting(v, ir) {
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) {
    ir.warnings.push({ line: 0, msg: 'options.routing deve ser um mapa' });
    return {};
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (!ROUTING_SUBKEYS.has(k)) {
      ir.warnings.push({
        line: 0,
        msg: `options.routing.${k} desconhecido${didYouMean(k, [...ROUTING_SUBKEYS])}`,
      });
      continue;
    }
    if (k === 'endpointBBox') {
      out.endpointBBox = parseRoutingSubMap(val, 'endpointBBox', ENDPOINT_BBOX_SUBKEYS, ir, {
        side: (n) => Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : undefined,
      });
    } else if (k === 'central') {
      out.central = parseRoutingSubMap(val, 'central', CENTRAL_SUBKEYS, ir, {
        k: (n) => Number.isFinite(Number(n)) && Number(n) >= 0 ? Number(n) : undefined,
      });
    } else if (k === 'algebraic') {
      out.algebraic = parseRoutingSubMap(val, 'algebraic', ALGEBRAIC_SUBKEYS, ir, {
        clipAnchors: parseBool,
        snapContainerExternal: parseBool,
        manhattanRebuild: parseBool,
        reanchorHubs: parseBool,
        legacy: parseBool,
      });
    } else if (k === 'physics') {
      out.physics = parseRoutingSubMap(val, 'physics', PHYSICS_SUBKEYS, ir, {
        hardObstacleEscalation: parseBool,
        aStarMidLoop: parseBool,
      });
    } else {
      out[k] = val;
    }
  }
  return out;
}

function parseRoutingSubMap(v, name, allowed, ir, coercions) {
  if (v == null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) {
    ir.warnings.push({ line: 0, msg: `options.routing.${name} deve ser um mapa` });
    return undefined;
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (!allowed.has(k)) {
      ir.warnings.push({
        line: 0,
        msg: `options.routing.${name}.${k} desconhecido${didYouMean(k, [...allowed])}`,
      });
      continue;
    }
    const coerce = coercions[k];
    const coerced = coerce ? coerce(val, undefined) : val;
    if (coerced !== undefined) out[k] = coerced;
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------- value parsers ----------

function parseBool(raw, defaultValue) {
  if (raw == null) return defaultValue;
  if (typeof raw === 'boolean') return raw;
  const v = String(raw).trim().toLowerCase();
  if (v === 'on'  || v === 'true'  || v === 'yes' || v === '1') return true;
  if (v === 'off' || v === 'false' || v === 'no'  || v === '0') return false;
  return defaultValue;
}

function applyPair(v, set) {
  if (Array.isArray(v) && v.length === 2) {
    set([Number(v[0]), Number(v[1])]);
    return;
  }
  // Tolerate the YAML object form { x: …, y: … } / { w: …, h: … }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 2) {
      const a = Number(v[keys[0]]), b = Number(v[keys[1]]);
      set([a, b]);
    }
  }
}

function parseLayerList(v, line, ir, owner) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter(s => typeof s === 'string' && s).map(s => String(s));
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  ir.warnings.push({ line, msg: `viewLayers em ${owner} deve ser uma lista de tags` });
  return [];
}

// Accepts three shapes, all converging on Map<tag, weight ∈ [0, 1]>:
//   1. ["tag", "tag2"]              — bare list, every tag defaults to
//                                     weight 0 ("I'm in this layer, I
//                                     yield fully under collision").
//   2. { tag: 0.5, tag2: 1 }        — explicit per-tag weights. 1 means
//                                     "immovable", 0 means "fully yielding".
//   3. ["L1", "L2", {L3: 0.5}, …]  — mixed list: bare entries take
//                                     weight 0; single-key map entries
//                                     carry their own weight. Multi-key
//                                     maps inside a list are accepted and
//                                     contribute every pair.
//
// Inline (flow) form works the same way: `[L1, L2, {L3: 0.5}, {L4: 1}]`.
export function parseWeightedMap(v, line, ir, owner, attrName) {
  const out = new Map();
  if (v == null) return out;
  // Peso fora de [0,1] é grampeado, com aviso (ADR-0021).
  const add = (tag, w) => {
    const num = addWeight(out, tag, w);
    if (num !== null && (num < 0 || num > 1) && ir) ir.warnings.push({
      line,
      msg: `${attrName} em ${owner}: peso ${num} de "${tag}" fora de [0, 1]; usado ${out.get(tag)}`,
    });
  };
  if (Array.isArray(v)) {
    for (const entry of v) {
      if (typeof entry === 'string' && entry) {
        // YAML flow gotcha: `[tag:weight]` (no space) is parsed as the
        // single string "tag:weight", not as `[{tag: weight}]`. Detect
        // the pattern, coerce to the intended weighted entry, and warn
        // so the author learns to add the space (or use `{tag: weight}`).
        const m = /^([^:\s]+):(-?\d+(?:\.\d+)?)$/.exec(entry);
        if (m) {
          add(m[1], m[2]);
          if (ir) ir.warnings.push({
            line,
            msg: `${attrName} em ${owner}: "${entry}" virou string única; escreva "${m[1]}: ${m[2]}" (com espaço) ou {${m[1]}: ${m[2]}}`,
          });
        } else {
          out.set(entry, 0);
        }
      } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        for (const [tag, w] of Object.entries(entry)) add(tag, w);
      } else if (entry != null && ir) {
        ir.warnings.push({
          line,
          msg: `${attrName} em ${owner}: item inválido (use "tag" ou "tag: peso")`,
        });
      }
    }
    return out;
  }
  if (typeof v === 'object') {
    for (const [tag, w] of Object.entries(v)) add(tag, w);
    return out;
  }
  if (ir) ir.warnings.push({ line, msg: `${attrName} em ${owner} deve ser lista ou mapa de tags` });
  return out;
}

// Grava o peso grampeado em [0,1]; devolve o número lido (null se inválido).
function addWeight(out, tag, w) {
  if (!tag) return null;
  const num = Number(w);
  if (!Number.isFinite(num)) return null;
  out.set(tag, Math.min(1, Math.max(0, num)));
  return num;
}

function parseConstraint(v, line, ir, owner) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    ir.warnings.push({ line, msg: `constraint em ${owner} deve ser um mapa com "type"` });
    return null;
  }
  const type = v.type;
  switch (type) {
    case 'axis-x': return { type: 'axis', axis: 'x', value: Number(v.value) };
    case 'axis-y': return { type: 'axis', axis: 'y', value: Number(v.value) };
    case 'rect':   return { type: 'rect', x: Number(v.x), y: Number(v.y), w: Number(v.w), h: Number(v.h) };
    case 'circle': return { type: 'circle', cx: Number(v.x ?? v.cx), cy: Number(v.y ?? v.cy), r: Number(v.r) };
    case 'parent-bounds': return { type: 'parent-bounds' };
    default:
      ir.warnings.push({ line, msg: `constraint.type desconhecido em ${owner}: "${type}"` });
      return null;
  }
}
