// Application boot: instantiate singletons, wire them, kick the first
// render. `main.js` is a thin loader that calls this.

import { installConsoleBuffer } from './console-buffer.js';
installConsoleBuffer();
import { createStore } from '../store.js';
import { createEditor } from '../editor.js';
import { VERSION } from '../version.js';
import { createRenderer } from '../renderer/index.js';
import { createViewport } from '../viewport.js';
import { createStructuredConfigEditor } from '../controls/config-editor.js';
import { createLayerControl } from '../controls/layers.js';
import { createDrillControl } from '../controls/drill.js';
import { createContextMenu } from '../ui/context-menu.js';
import { createActionFab } from '../ui/action-fab.js';

import { createPipeline } from './pipeline.js';
import { EXAMPLES } from '../dsl/examples.js';
import { createGestures } from './gestures.js';
import { createWiring } from './wiring.js';

const $ = (sel, root = document) => root.querySelector(sel);

export async function boot() {
  const store = createStore();
  exposeForTests(store);

  const svg = $('#canvas');
  const renderer = createRenderer(svg);
  const viewport = createViewport();

  const editor = createEditor($('#editor'), { onChange: (text) => store.setDSL(text), highlight: true });
  editor.setValue(store.state.dsl);

  const configEditor = createEditor($('#config-editor'), { onChange: (text) => store.setConfig(text), highlight: true });
  configEditor.setValue(store.state.config);

  const structuredConfig = createStructuredConfigEditor($('#config-form'), {
    onChange: (text) => {
      // Avoid round-trip noise: structured editor emits the canonical
      // pretty-printed JSON. Push it to the textarea AND the store.
      configEditor.setValue(text);
      store.setConfig(text);
    },
  });

  const layerControl = createLayerControl($('#layer-chips'), (_visible, hidden) => {
    // hidden is the source of truth — it may include the synthetic
    // UNTAGGED sentinel for nodes without any `layers=` attribute.
    store.setHiddenLayers(Array.from(hidden));
  });
  const drillControl = createDrillControl($('#drill-chips'), (id) => store.setFocusedContainer(id));

  // Per-node action callbacks — shared by the right-click context menu
  // (desktop) and the action FAB (touch). Single source of truth.
  const nodeActions = {
    onDrill: (id) => store.setFocusedContainer(id),
    onToggleCollapse: (id) => store.toggleCollapsed(id),
    onClearSelection: () => store.setSelected(null),
  };

  const pipeline = createPipeline({
    store, viewport, renderer,
    structuredConfig,
    layerControl, drillControl,
    errorsEl: $('#errors'),
    breadcrumbEl: $('#breadcrumb'),
    configEditorEl: $('#config-editor'),
  });
  // Context menu and FAB read `pipeline.state.currentIR` via a getter
  // callback — avoids the chicken-and-egg of "pipeline needs FAB, FAB
  // needs pipeline.state".
  const getNode = (id) => pipeline.state.currentIR?.nodes.find(n => n.id === id);
  createContextMenu($('#context-menu'), svg, getNode, nodeActions);
  const actionFab = createActionFab($('#action-fab'), nodeActions);
  exposePipelineForTests(pipeline);

  const dom = {
    layoutSelect: $('#layout-select'),
    routerSelect: $('#router-select'),
    themeSelect: $('#theme-select'),
    editorToggle: $('#editor-toggle'),
    editorEl: $('#editor'),
    configPane: $('#config-pane'),
    configEditorEl: $('#config-editor'),
    configForm: $('#config-form'),
    cfgModeForm: $('#cfg-mode-form'),
    cfgModeText: $('#cfg-mode-text'),
    tabDsl: $('#tab-dsl'),
    tabConfig: $('#tab-config'),
    splitEl: $('.split'),
    splitter: $('#splitter'),
    fitBtn: $('#fit'),
    debugExportBtn: $('#debug-export-btn'),
    debugBBoxCheckbox: $('#debug-bbox-checkbox'),
    zoomIn: $('#zoom-in'),
    zoomOut: $('#zoom-out'),
    zoomReset: $('#zoom-reset'),
  };

  const gestures = createGestures({
    svg, viewport, store, pipeline,
    zoomLabelEl: $('#zoom-label'),
    isEditorFocused: () => document.activeElement === $('#editor'),
  });

  const wiring = createWiring({
    store, dom, editor, configEditor, structuredConfig,
    pipeline, gestures,
  });

  // Initial structured-config sync now that the pipeline can populate it.
  pipeline.refreshStructuredConfig();

  // Surface the build version (commit hash on deploy, "dev" locally).
  const versionLabel = $('#version-label');
  if (versionLabel) versionLabel.textContent = VERSION ? `v ${VERSION}` : '';

  wiring.bind();
  gestures.bind();
  pipeline.bindStoreSubscriber({
    applyUI: wiring.applyUI,
    onSelectionChange: (s) => {
      const node = s.selectedNodeId
        ? (pipeline.state.currentIR?.nodes.find(n => n.id === s.selectedNodeId) || null)
        : null;
      actionFab.render(node, s.viewState.focusedContainer);
    },
  });

  await pipeline.rerender();
  // Defer fit-to-view past the first paint so bounds reflect real
  // node positions, not the seed circle.
  setTimeout(() => gestures.fitToView(), 50);
  gestures.updateZoomLabel();
}

function exposeForTests(store) {
  if (typeof window === 'undefined') return;
  // E2E drives state changes without racing the canvas (live sim
  // moves nodes between boundingBox reads).
  window.__store__ = store;
  // Expose example bundle so geometry-invariant tests can iterate
  // every shipped example without duplicating their DSL text.
  window.__examples__ = EXAMPLES;
}

// Pipeline introspection for E2E. Wired here once the pipeline exists.
export function exposePipelineForTests(pipeline) {
  if (typeof window === 'undefined') return;
  Object.defineProperty(window, '__currentIR__', {
    get: () => pipeline.state.currentIR, configurable: true,
  });
  Object.defineProperty(window, '__currentLayout__', {
    get: () => pipeline.state.currentLayout, configurable: true,
  });
}
