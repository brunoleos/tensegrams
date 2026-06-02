import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './dom-mock.js';

installLocalStorage();
const { createStore } = await import('../src/store.js');
const { EXAMPLES } = await import('../src/dsl/examples.js');

beforeEach(() => { globalThis.localStorage.clear(); });

describe('store — defaults', () => {
  test('initial state has DSL and default ids', () => {
    const s = createStore();
    assert.ok(s.state.dsl.length > 0);
    assert.equal(s.state.layoutId, 'custom');
    assert.equal(s.state.routerId, 'orthogonal');
  });

  test('default DSL é EXAMPLES.quad (fixture canônica)', () => {
    const s = createStore();
    assert.equal(s.state.dsl, EXAMPLES.quad);
  });
});

describe('store — mutations notify subscribers', () => {
  test('setDSL emits and persists', () => {
    const s = createStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.setDSL('a: A');
    assert.equal(calls, 1);
    assert.equal(s.state.dsl, 'a: A');
    assert.ok(localStorage.getItem('tensegrams:dsl-v2'));
  });

  test('no emit when value unchanged', () => {
    const s = createStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.setDSL(s.state.dsl);
    assert.equal(calls, 0);
  });

  test('setLayout/setRouter/setOption update state', () => {
    const s = createStore();
    s.setLayout('off');
    s.setRouter('straight');
    s.setOption('foo', 'bar');
    assert.equal(s.state.layoutId, 'off');
    assert.equal(s.state.routerId, 'straight');
    assert.equal(s.state.options.foo, 'bar');
  });

  test('setHiddenLayers stores a copy', () => {
    const s = createStore();
    const arr = ['x', 'y'];
    s.setHiddenLayers(arr);
    arr.push('z');
    assert.deepEqual(s.state.viewState.hiddenLayers, ['x', 'y']);
  });

  test('setFocusedContainer stores id and null', () => {
    const s = createStore();
    s.setFocusedContainer('outer');
    assert.equal(s.state.viewState.focusedContainer, 'outer');
    s.setFocusedContainer(null);
    assert.equal(s.state.viewState.focusedContainer, null);
  });
});

describe('store — ui (theme / drawer)', () => {
  test('defaults to dark theme and expanded editor', () => {
    const s = createStore();
    assert.equal(s.state.ui.theme, 'dark');
    assert.equal(s.state.ui.editorState, 'expanded');
  });

  test('setTheme updates state and persists', () => {
    const s = createStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.setTheme('light');
    assert.equal(s.state.ui.theme, 'light');
    assert.equal(calls, 1);
  });

  test('setTheme is a no-op when value unchanged', () => {
    const s = createStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.setTheme(s.state.ui.theme);
    assert.equal(calls, 0);
  });

  test('setEditorState toggles drawer state', () => {
    const s = createStore();
    s.setEditorState('collapsed');
    assert.equal(s.state.ui.editorState, 'collapsed');
    s.setEditorState('expanded');
    assert.equal(s.state.ui.editorState, 'expanded');
  });

  test('ui state survives reload', () => {
    const s1 = createStore();
    s1.setTheme('sepia');
    s1.setEditorState('collapsed');
    const s2 = createStore();
    assert.equal(s2.state.ui.theme, 'sepia');
    assert.equal(s2.state.ui.editorState, 'collapsed');
  });

  test('setActiveTab toggles between dsl and config', () => {
    const s = createStore();
    assert.equal(s.state.ui.activeTab, 'dsl');
    s.setActiveTab('config');
    assert.equal(s.state.ui.activeTab, 'config');
    s.setActiveTab('dsl');
    assert.equal(s.state.ui.activeTab, 'dsl');
  });

  test('setEditorWidth / setEditorHeight persist sizes', () => {
    const s = createStore();
    s.setEditorWidth(420);
    s.setEditorHeight(320);
    assert.equal(s.state.ui.editorWidth, 420);
    assert.equal(s.state.ui.editorHeight, 320);
    const s2 = createStore();
    assert.equal(s2.state.ui.editorWidth, 420);
    assert.equal(s2.state.ui.editorHeight, 320);
  });

  test('setEditorWidth rejects non-finite values', () => {
    localStorage.clear();
    const s = createStore();
    s.setEditorWidth(NaN);
    s.setEditorWidth(Infinity);
    assert.equal(s.state.ui.editorWidth, 360);
  });

  test('mutating one store instance does not poison defaults', () => {
    localStorage.clear();
    const s1 = createStore();
    s1.setEditorWidth(999);
    localStorage.clear();
    const s2 = createStore();
    assert.equal(s2.state.ui.editorWidth, 360);
  });

  test('setConfig stores config text and emits', () => {
    const s = createStore();
    let calls = 0;
    s.subscribe(() => calls++);
    s.setConfig('{"live":{}}');
    assert.equal(s.state.config, '{"live":{}}');
    assert.equal(calls, 1);
  });
});

describe('store — persistence', () => {
  test('reloads from storage', () => {
    const s1 = createStore();
    s1.setDSL('persistent: P');
    s1.setLayout('off');

    const s2 = createStore();
    assert.equal(s2.state.dsl, 'persistent: P');
    assert.equal(s2.state.layoutId, 'off');
  });

  test('survives malformed storage', () => {
    localStorage.setItem('tensegrams:dsl-v1', 'not json');
    const s = createStore();
    assert.ok(s.state.dsl.length > 0);
  });
});

describe('store — unsubscribe', () => {
  test('unsubscribe stops notifications', () => {
    const s = createStore();
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.setDSL('a: A');
    off();
    s.setDSL('b: B');
    assert.equal(calls, 1);
  });
});
