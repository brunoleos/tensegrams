// Minimal store for the diagram app.
//
// State is split into two bags internally:
//
//   persisted — written to localStorage on every change. Survives
//     reloads. Contains source-of-truth content (DSL, config),
//     user preferences (layout/router id, options), and view-state
//     the user has reason to expect back (focused container,
//     hidden layers, editor geometry, theme).
//
//   ephemeral — kept in memory only. Reload starts these empty so
//     selections and collapse flags don't outlive the data they
//     point at (DSL edits can rename or remove ids).
//
// `state` (the getter) returns a flat union of the two bags so
// consumers see a single object — the split is an implementation
// detail, not API. Setters declare which bag they touch through
// `makeSetter(key, { bag })`.

import { EXAMPLES } from './dsl/examples.js';

// Bumped to v2 when the DSL/config moved to YAML; the `tensegrams:` prefix
// replaced the old `whiteboard:` brand. The boot path purges any legacy
// blob before reading — a saved old DSL would fail to parse as YAML and
// produce a confusing error, and the old brand keys are no longer ours.
const STORAGE_KEY = 'tensegrams:dsl-v2';
const LEGACY_KEYS = ['tensegrams:dsl-v1', 'whiteboard:dsl-v2', 'whiteboard:dsl-v1'];

const DEFAULT_PERSISTED = {
  dsl: EXAMPLES.quad,
  config: '',
  layoutId: 'custom',
  routerId: 'orthogonal',
  options: {},
  viewState: { hiddenLayers: [], focusedContainer: null },
  ui: {
    theme: 'dark',
    editorState: 'expanded',
    activeTab: 'dsl',
    configMode: 'form',   // 'form' (structured editor) | 'text' (raw JSON)
    editorWidth: 360,
    editorHeight: 280,
  },
};

export function createStore() {
  const persisted = mergePersisted(loadFromStorage());
  // Ephemeral state — owned by this instance, never persisted, never
  // shared across `createStore()` calls.
  const ephemeral = {
    collapsedContainers: [],
    selectedNodeId: null,
    debugBBoxes: false,
  };
  const listeners = new Set();

  // Flat view exposes both bags as a single object. Mutations go
  // through setters; the proxy isn't reactive, it's a read alias.
  // `toJSON` flattens both bags so `JSON.stringify(state)` works for
  // logging/debug — without it the proxy serialises to `{}`.
  const flatView = new Proxy({}, {
    get(_t, key) {
      if (key === 'toJSON') return () => ({ ...persisted, ...ephemeral });
      if (key in ephemeral) return ephemeral[key];
      return persisted[key];
    },
    has(_t, key) {
      return key in ephemeral || key in persisted;
    },
    ownKeys() {
      return Array.from(new Set([...Object.keys(persisted), ...Object.keys(ephemeral)]));
    },
    getOwnPropertyDescriptor(_t, key) {
      const value = (key in ephemeral) ? ephemeral[key] : persisted[key];
      return value === undefined ? undefined
        : { enumerable: true, configurable: true, value };
    },
  });

  function emit() { for (const fn of listeners) fn(flatView); }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)); }
    catch { /* quota */ }
  }

  // Setter factory — collapses ~12 near-identical methods. Skips emit
  // when the new value equals the previous one (referential, for
  // primitives and same-instance objects).
  function makeSetter(read, write, { persist: shouldPersist, dedupe = true } = {}) {
    return function set(value) {
      if (dedupe && read() === value) return;
      write(value);
      if (shouldPersist) persist();
      emit();
    };
  }

  return {
    get state() { return flatView; },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    setDSL:        makeSetter(() => persisted.dsl,      (v) => { persisted.dsl = v; },      { persist: true }),
    setConfig:     makeSetter(() => persisted.config,   (v) => { persisted.config = v; },   { persist: true }),
    setLayout:     makeSetter(() => persisted.layoutId, (v) => { persisted.layoutId = v; }, { persist: true }),
    setRouter:     makeSetter(() => persisted.routerId, (v) => { persisted.routerId = v; }, { persist: true }),

    setTheme:        makeSetter(() => persisted.ui.theme,        (v) => { persisted.ui.theme = v; },        { persist: true }),
    setEditorState:  makeSetter(() => persisted.ui.editorState,  (v) => { persisted.ui.editorState = v; },  { persist: true }),
    setActiveTab:    makeSetter(() => persisted.ui.activeTab,    (v) => { persisted.ui.activeTab = v; },    { persist: true }),
    setConfigMode:   makeSetter(() => persisted.ui.configMode,   (v) => { persisted.ui.configMode = v; },   { persist: true }),
    setEditorWidth:  makeSetter(() => persisted.ui.editorWidth,  (v) => {
      if (!Number.isFinite(v)) return;
      persisted.ui.editorWidth = v;
    }, { persist: true }),
    setEditorHeight: makeSetter(() => persisted.ui.editorHeight, (v) => {
      if (!Number.isFinite(v)) return;
      persisted.ui.editorHeight = v;
    }, { persist: true }),

    // `setOption` writes to a nested map; dedupe per-key is not worth
    // the bookkeeping (callers are rare).
    setOption(key, value) {
      persisted.options[key] = value;
      persist();
      emit();
    },

    setHiddenLayers(arr) {
      persisted.viewState.hiddenLayers = arr.slice();
      persist();
      emit();
    },

    setFocusedContainer(id) {
      persisted.viewState.focusedContainer = id;
      persist();
      emit();
    },

    // Ephemeral container collapse state. Toggling does NOT persist —
    // a reload clears the set so IDs that vanished from the DSL don't
    // linger as zombies.
    toggleCollapsed(id) {
      const i = ephemeral.collapsedContainers.indexOf(id);
      if (i >= 0) ephemeral.collapsedContainers.splice(i, 1);
      else ephemeral.collapsedContainers.push(id);
      emit();
    },

    // Ephemeral selection. Pass null to clear.
    setSelected: makeSetter(
      () => ephemeral.selectedNodeId,
      (v) => { ephemeral.selectedNodeId = v; },
      { persist: false },
    ),

    // Debug mode: toggle collision BBox overlay.
    toggleDebugBBoxes: makeSetter(
      () => ephemeral.debugBBoxes,
      (v) => { ephemeral.debugBBoxes = v; },
      { persist: false },
    ),
  };
}

function mergePersisted(loaded) {
  if (!loaded) return cloneDefaults();
  return {
    ...DEFAULT_PERSISTED,
    ...loaded,
    options:   { ...DEFAULT_PERSISTED.options,   ...(loaded.options   || {}) },
    viewState: { ...DEFAULT_PERSISTED.viewState, ...(loaded.viewState || {}) },
    ui:        { ...DEFAULT_PERSISTED.ui,        ...(loaded.ui        || {}) },
  };
}

function cloneDefaults() {
  return {
    ...DEFAULT_PERSISTED,
    options:   { ...DEFAULT_PERSISTED.options },
    viewState: { ...DEFAULT_PERSISTED.viewState },
    ui:        { ...DEFAULT_PERSISTED.ui },
  };
}

function loadFromStorage() {
  try {
    // Hard cut from the legacy DSL: any v1 blob is purged on boot so
    // it doesn't resurface as broken YAML.
    for (const k of LEGACY_KEYS) {
      try { localStorage.removeItem(k); } catch { /* quota / privacy */ }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.dsl !== 'string') return null;
    return parsed;
  } catch { return null; }
}
