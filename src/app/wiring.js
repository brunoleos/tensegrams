// UI wiring: listeners for selectors, toggles, tabs, chips,
// splitter, zoom buttons, and the `applyUI` reconciler that projects
// store state onto the DOM (theme, drawer, tab visibility, panel
// sizes). Knows about DOM ids; everything else is delegated.

import { listLayoutAdapters } from '../layout/registry.js';
import { listRouters } from '../routing/registry.js';
import { exportDebugPack } from './debug-export.js';
import { exportDSL, exportConfig, applyImport } from './dsl-io.js';

export function createWiring(deps) {
  const {
    store, dom, editor, configEditor, structuredConfig,
    pipeline, gestures,
  } = deps;

  function applyUI(state) {
    document.documentElement.dataset.theme = state.ui.theme;
    document.body.dataset.editorState = state.ui.editorState;
    if (dom.themeSelect.value !== state.ui.theme) dom.themeSelect.value = state.ui.theme;
    dom.editorToggle.setAttribute('aria-expanded', state.ui.editorState === 'expanded' ? 'true' : 'false');
    dom.editorToggle.textContent = state.ui.editorState === 'expanded' ? '▾' : '▸';

    const dsl = state.ui.activeTab !== 'config';
    dom.editorEl.hidden = !dsl;
    dom.configPane.hidden = dsl;
    dom.tabDsl.setAttribute('aria-selected', dsl ? 'true' : 'false');
    dom.tabConfig.setAttribute('aria-selected', dsl ? 'false' : 'true');

    // Config sub-mode (structured form vs. raw text).
    const formMode = state.ui.configMode !== 'text';
    dom.configForm.hidden = !formMode;
    dom.configEditorEl.hidden = formMode;
    dom.cfgModeForm.setAttribute('aria-pressed', formMode ? 'true' : 'false');
    dom.cfgModeText.setAttribute('aria-pressed', formMode ? 'false' : 'true');
    if (formMode) pipeline.refreshStructuredConfig();

    // Debug BBoxes toggle
    if (dom.debugBBoxCheckbox && dom.debugBBoxCheckbox.checked !== state.debugBBoxes) {
      dom.debugBBoxCheckbox.checked = state.debugBBoxes;
    }

    dom.splitEl.style.setProperty('--editor-w', `${state.ui.editorWidth}px`);
    dom.splitEl.style.setProperty('--editor-h', `${state.ui.editorHeight}px`);
  }

  function populateSelectors() {
    for (const desc of listLayoutAdapters()) {
      const opt = document.createElement('option');
      opt.value = desc.id;
      opt.textContent = desc.label;
      dom.layoutSelect.appendChild(opt);
    }
    dom.layoutSelect.value = store.state.layoutId;
    for (const desc of listRouters()) {
      const opt = document.createElement('option');
      opt.value = desc.id;
      opt.textContent = desc.label;
      dom.routerSelect.appendChild(opt);
    }
    dom.routerSelect.value = store.state.routerId;
    dom.themeSelect.value = store.state.ui.theme;
  }

  function bindControls() {
    dom.layoutSelect.addEventListener('change', () => store.setLayout(dom.layoutSelect.value));
    dom.routerSelect.addEventListener('change', () => store.setRouter(dom.routerSelect.value));
    dom.themeSelect.addEventListener('change', () => store.setTheme(dom.themeSelect.value));

    dom.editorToggle.addEventListener('click', () => {
      const next = store.state.ui.editorState === 'collapsed' ? 'expanded' : 'collapsed';
      store.setEditorState(next);
    });

    dom.tabDsl.addEventListener('click', () => store.setActiveTab('dsl'));
    dom.tabConfig.addEventListener('click', () => store.setActiveTab('config'));
    dom.cfgModeForm.addEventListener('click', () => store.setConfigMode('form'));
    dom.cfgModeText.addEventListener('click', () => store.setConfigMode('text'));

    dom.fitBtn.addEventListener('click', gestures.fitToView);
    dom.zoomIn.addEventListener('click', () => gestures.centerZoom(1.25));
    dom.zoomOut.addEventListener('click', () => gestures.centerZoom(1 / 1.25));
    dom.zoomReset.addEventListener('click', () => { gestures.resetZoom(); gestures.fitToView(); });

    if (dom.debugBBoxCheckbox) {
      dom.debugBBoxCheckbox.addEventListener('change', () => {
        store.toggleDebugBBoxes(dom.debugBBoxCheckbox.checked);
      });
    }

    if (dom.debugExportBtn) {
      dom.debugExportBtn.addEventListener('click', async () => {
        dom.debugExportBtn.disabled = true;
        try { await exportDebugPack(store); }
        finally { dom.debugExportBtn.disabled = false; }
      });
    }

    // Export the active tab (DSL or Config) as a .yaml file.
    if (dom.exportBtn) {
      dom.exportBtn.addEventListener('click', () => {
        const cfg = store.state.ui.activeTab === 'config';
        // Flush the editor's debounce first so we export exactly what's on
        // screen, not the value from up to debounceMs ago.
        (cfg ? configEditor : editor).flush();
        (cfg ? exportConfig : exportDSL)(store);
      });
    }

    // Import a .yaml into the active tab. The visible button proxies to a
    // hidden <input type=file>; the read happens on its change event.
    if (dom.importBtn && dom.importFile) {
      dom.importBtn.addEventListener('click', () => dom.importFile.click());
      dom.importFile.addEventListener('change', async () => {
        const file = dom.importFile.files?.[0];
        if (!file) return;
        const text = await file.text();
        const kind = store.state.ui.activeTab === 'config' ? 'config' : 'dsl';
        applyImport(store, kind, text); // persists + emits → pipeline rerenders
        // store→textarea isn't auto-wired (the editor is normally the
        // source), so push the imported text into the visible editor too.
        if (kind === 'config') configEditor.setValue(text);
        else editor.setValue(text);
        dom.importFile.value = ''; // allow re-importing the same file
      });
    }
  }

  function bindSplitter() {
    const splitter = dom.splitter;
    const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

    splitter.addEventListener('pointerdown', (ev) => {
      splitter.setPointerCapture(ev.pointerId);
      splitter.classList.add('active');
      const rect = dom.splitEl.getBoundingClientRect();

      const onMove = (e) => {
        if (e.pointerId !== ev.pointerId) return;
        if (isMobile()) {
          const fromBottom = rect.bottom - e.clientY;
          const h = Math.max(36, Math.min(rect.height - 80, fromBottom));
          dom.splitEl.style.setProperty('--editor-h', `${h}px`);
        } else {
          const w = Math.max(40, Math.min(rect.width - 200, e.clientX - rect.left));
          dom.splitEl.style.setProperty('--editor-w', `${w}px`);
        }
      };
      const onEnd = (e) => {
        if (e.pointerId !== ev.pointerId) return;
        splitter.removeEventListener('pointermove', onMove);
        splitter.removeEventListener('pointerup', onEnd);
        splitter.removeEventListener('pointercancel', onEnd);
        try { splitter.releasePointerCapture(ev.pointerId); } catch { /* capture unsupported */ }
        splitter.classList.remove('active');
        if (isMobile()) {
          const h = parseFloat(dom.splitEl.style.getPropertyValue('--editor-h')) || 280;
          store.setEditorHeight(h);
        } else {
          const w = parseFloat(dom.splitEl.style.getPropertyValue('--editor-w')) || 360;
          store.setEditorWidth(w);
        }
      };
      splitter.addEventListener('pointermove', onMove);
      splitter.addEventListener('pointerup', onEnd);
      splitter.addEventListener('pointercancel', onEnd);
      ev.preventDefault();
    });

    splitter.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 40 : 10;
      if (isMobile()) {
        if (ev.key === 'ArrowUp')   { store.setEditorHeight(store.state.ui.editorHeight + step); ev.preventDefault(); }
        if (ev.key === 'ArrowDown') { store.setEditorHeight(Math.max(36, store.state.ui.editorHeight - step)); ev.preventDefault(); }
      } else {
        if (ev.key === 'ArrowLeft')  { store.setEditorWidth(Math.max(40, store.state.ui.editorWidth - step)); ev.preventDefault(); }
        if (ev.key === 'ArrowRight') { store.setEditorWidth(store.state.ui.editorWidth + step); ev.preventDefault(); }
      }
    });
  }

  function bind() {
    populateSelectors();
    bindControls();
    bindSplitter();
    applyUI(store.state);
  }

  return { bind, applyUI };
}
