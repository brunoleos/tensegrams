// Canonical attribute sets for the YAML DSL.
//
// Validators consult these to decide which keys are recognized vs.
// unknown (warning) for each kind of block.

export const OPTION_KEYS = new Set([
  'title',
  'snapContainerAnchor',
  'routing',
]);

// Sub-chaves aceitas dentro de options.routing — pluga config do
// solver físico (fase 5.x) sem invadir adapter knobs do config.js.
// Chaves desconhecidas viram warning amigável via didYouMean.
export const ROUTING_SUBKEYS = new Set([
  'engine',         // 'algebraic' | 'physics' (default 'algebraic')
  'edgePad',        // 'stroke' (= strokeWidth do edge) | número (px)
  'fission',        // { trigger, threshold, ticks }
  'fusion',         // { manhattanK, defaultStroke, minControlDistance, ticks }
  'snap',           // { criterion, groups }
  'endpointBBox',   // { side } — default global do BBox de endpoint
  'central',        // { k } — constante da força central por aresta
  'algebraic',      // { clipAnchors, snapContainerExternal, manhattanRebuild, reanchorHubs, legacy }
  'physics',        // { hardObstacleEscalation, aStarMidLoop }
]);

// Sub-chaves aceitas em options.routing.endpointBBox.
export const ENDPOINT_BBOX_SUBKEYS = new Set(['side']);

// Sub-chaves aceitas em options.routing.central.
export const CENTRAL_SUBKEYS = new Set(['k']);

// Sub-chaves aceitas em options.routing.algebraic — bandeiras dos opt-ins
// migrados pra OFF por default no engine puramente físico (P8).
export const ALGEBRAIC_SUBKEYS = new Set([
  'clipAnchors',
  'snapContainerExternal',
  'manhattanRebuild',
  'reanchorHubs',
  'legacy',
]);

// Sub-chaves aceitas em options.routing.physics.
export const PHYSICS_SUBKEYS = new Set([
  'hardObstacleEscalation',
  'aStarMidLoop',
]);

export const NODE_ATTRS = new Set([
  'label',
  'parent',
  'viewLayers',
  'nodeLayers',
  'size',
  'pin',
  'padding',
  'attractTo',
  'repelFrom',
  'constraint',
  'shape',       // 'rect' (default) | 'circle' | 'diamond' | 'polygon' | 'star'
  'snap',        // lista heterogênea de snap points (nomes, ângulos, coords)
  'snapGroups',  // override do default global por grupos
  'snapAngles',  // ângulos (graus) p/ raycast custom da face
  'anchors',     // ancoragens nomeadas custom
]);

export const EDGE_ATTRS = new Set([
  'label',
  'viewLayers',
  'nodeLayers',
  'edgeLayers',
  'snap',
  'onHidden',
  'startStyle',
  'endStyle',
  'style',       // { strokeWidth?: number, edgePad?: number } (fase 5.x)
  'endpoints',   // { source?: { edgeLayers?, side? }, target?: { edgeLayers?, side? } }
]);

// Lados aceitos dentro de edge.endpoints.
export const ENDPOINTS_SIDES = ['source', 'target'];

// Sub-chaves aceitas em edge.endpoints.{source|target}.
export const ENDPOINT_SUBKEYS = new Set(['edgeLayers', 'side']);

// Sub-chaves aceitas dentro de edge.style — escopo enxuto da fase 5.1.
// Outras chaves de estilo (cor, dash, etc.) entram em fases futuras.
export const EDGE_STYLE_SUBKEYS = new Set([
  'strokeWidth',
  'edgePad',
]);

export const RESERVED_TOP_KEYS = new Set([
  'options',
  'connections',
]);

// Preset names for arrow / endpoint shapes. The renderer maps each to
// a drawing function; unknown names fall back to 'none'.
export const EDGE_STYLE_PRESETS = [
  'none',
  'filledArrow',
  'outlineArrow',
  'crowfoot',
  'diamond',
  'circle',
];

// Default end-styles when the edge declares neither:
//   start = no decoration ; end = filled arrow (matches the legacy
//   "always draw an arrow at the to-end" behaviour).
export const DEFAULT_EDGE_STYLE = { startStyle: 'none', endStyle: 'filledArrow' };

// Snap accepts the same three states as before.
export const SNAP_VALUES = new Set(['on', 'off', 'inherit']);
export const ON_HIDDEN_VALUES = new Set(['promote', 'omit']);
