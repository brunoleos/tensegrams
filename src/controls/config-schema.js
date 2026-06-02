// Schema for the structured config editor.
//
// Each entry describes ONE editable leaf path. The structured-editor walks
// the parsed config object and, for every leaf it encounters at a known
// path, renders an interactive control instead of plain text. Unknown
// paths render as read-only text (so unknown future keys stay visible).
//
// path:       array of keys from the root, e.g. ['live', 'damping']
// type:       'number' | 'boolean' | 'enum' | 'text'
// values:     for 'enum'
// min/max/step: for 'number'
// default:    the value used when the user "resets" a field
// help:       short string shown in the popover
//
// Collision LAYERS are declared inline in the DSL (`nodeLayers` /
// `edgeLayers`); the YAML config only carries the two global pad knobs.

export const SCHEMA = [
  // ----- live adapter -----
  { path: ['live', 'center'],           type: 'number', min: 0, max: 1,    step: 0.001, default: 0.012,
    help: 'Força do atrator central (puxa todos os nós ao centro).' },
  { path: ['live', 'damping'],          type: 'number', min: 0, max: 1,    step: 0.01, default: 0.82,
    help: 'Amortecimento (fração de velocidade que sobrevive a cada tick).' },
  { path: ['live', 'collision'],        type: 'boolean', default: true,
    help: 'Kill-switch global da resolução de colisão.' },
  { path: ['live', 'collisionK'],       type: 'number', min: 0, max: 1, step: 0.01, default: 0.3,
    help: 'Rigidez da mola de colisão (separa com sensação elástica amortecida).' },
  { path: ['live', 'alphaDecay'],       type: 'number', min: 0.001, max: 0.1, step: 0.001, default: 0.012,
    help: 'Velocidade de resfriamento da simulação por tick (menor = settle mais longo).' },
  { path: ['live', 'alphaMin'],         type: 'number', min: 0.0001, max: 0.05, step: 0.0001, default: 0.003,
    help: 'Limiar de alpha em que a simulação congela.' },
  { path: ['live', 'alphaKick'],        type: 'number', min: 0, max: 1, step: 0.01, default: 0.5,
    help: 'Energia injetada em drag/release e edições incrementais de DSL/config.' },
  { path: ['live', 'interactionMode'], type: 'enum',
    values: ['frozen', 'flow'], default: 'frozen',
    help: 'frozen (default): durante o arraste os outros nós ficam suspensos. flow: simulação contínua, nada é suspenso.' },

  // ----- collision (shared by every layout) -----
  { path: ['collision', 'nodePad'], type: 'number', min: 0, max: 60, step: 1, default: 12,
    help: 'Folga entre nós na resolução de colisão.' },
  { path: ['collision', 'edgePad'], type: 'number', min: 0, max: 60, step: 1, default: 8,
    help: 'Folga de arestas no roteamento que evita obstáculos.' },
  { path: ['collision', 'labelPad'], type: 'number', min: 0, max: 60, step: 1, default: 6,
    help: 'Folga em torno do retângulo do label na resolução de colisão.' },
  { path: ['collision', 'labels'], type: 'boolean', default: true,
    help: 'Trata labels de aresta como obstáculos (waypoints desviam deles).' },

  // ----- router -----
  { path: ['router', 'padding'], type: 'number', min: 0, max: 60, step: 1, default: 12,
    help: 'Folga lateral usada por routers que suportem.' },
];

// Build a path → schema lookup once (paths are arrays so we serialize).
const SCHEMA_BY_PATH = new Map(SCHEMA.map(s => [s.path.join('.'), s]));

export function schemaAt(path) {
  return SCHEMA_BY_PATH.get(path.join('.')) || null;
}

// Discoverability: what keys are KNOWN to be valid as direct children of
// `parentPath`? Derived from the schema's leaf paths (any segment that
// appears as the next-level key under parentPath).
export function knownChildrenAt(parentPath) {
  const out = new Set();
  const prefix = parentPath.join('.');
  for (const entry of SCHEMA) {
    if (entry.path.length <= parentPath.length) continue;
    const head = entry.path.slice(0, parentPath.length).join('.');
    if (head !== prefix) continue;
    out.add(entry.path[parentPath.length]);
  }
  return Array.from(out);
}

// Default value to insert when the user clicks "+ keyName". Leaves get
// their schema-declared default; intermediate (object) keys get an empty
// `{}` so the user can then recurse and add further keys inline.
export function defaultForChild(parentPath, key) {
  const leaf = schemaAt([...parentPath, key]);
  if (leaf) return leaf.default;
  return {};
}

// Human-friendly subtitle for `+ keyName` buttons. Falls back to "objeto"
// for intermediate keys; uses the schema help line for leaves.
export function helpForChild(parentPath, key) {
  const leaf = schemaAt([...parentPath, key]);
  if (leaf) return leaf.help;
  return 'objeto — clique pra abrir e adicionar campos';
}
