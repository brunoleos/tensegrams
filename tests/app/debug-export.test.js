// buildDebugPack composes a JSON-serialisable snapshot. Tested with a
// minimal browser-like globalThis stub — the SVG/PNG step is mocked.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Stand-in for the browser globals buildDebugPack reaches for. Must be
// installed BEFORE importing the module (it uses module-level identifiers).
globalThis.window = { __currentIR__: null, __currentLayout__: null };
globalThis.document = {
  getElementById: () => null, // svg canvas missing → screenshotPng = null
  documentElement: { outerHTML: '<html></html>' },
};
globalThis.location = { href: 'http://localhost/?spec=1' };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node-test' }, writable: false, configurable: true });
globalThis.innerWidth = 800;
globalThis.innerHeight = 600;

const { buildDebugPack } = await import('../../src/app/debug-export.js');

const fakeStore = {
  state: {
    dsl: 'a:\n  label: A\n',
    config: 'routing:\n  engine: physics\n',
    options: { routing: { engine: 'physics' } },
    layoutId: 'live',
    routerId: 'orthogonal',
  },
};

describe('buildDebugPack', () => {
  test('captures inputs, selection, build metadata', async () => {
    const pack = await buildDebugPack(fakeStore);
    assert.equal(pack.schema, 'tensegrams-debug-pack/1');
    assert.equal(pack.inputs.dsl, fakeStore.state.dsl);
    assert.equal(pack.inputs.config, fakeStore.state.config);
    assert.deepEqual(pack.selection, { layoutId: 'live', routerId: 'orthogonal' });
    assert.equal(pack.build.url, 'http://localhost/?spec=1');
    assert.deepEqual(pack.build.viewport, { w: 800, h: 600 });
    assert.ok(typeof pack.capturedAt === 'string');
  });

  test('serialises Map and Set values from IR/layout', async () => {
    window.__currentIR__ = {
      nodes: [{ id: 'a' }],
      edges: [],
      warnings: [{ msg: 'w1' }],
      errors: [],
    };
    window.__currentLayout__ = {
      positions: new Map([['a', { x: 0, y: 0, width: 10, height: 10 }]]),
      routedEdges: new Map(),
      bounds: { x0: 0, y0: 0, x1: 10, y1: 10 },
    };
    const pack = await buildDebugPack(fakeStore);
    // Maps round-trip via { __type: 'Map', entries: [...] } envelope.
    assert.equal(pack.layout.positions.__type, 'Map');
    assert.equal(pack.layout.positions.entries[0][0], 'a');
    assert.deepEqual(pack.diagnostics.warnings, [{ msg: 'w1' }]);
  });

  test('omits screenshot when SVG canvas is missing', async () => {
    const pack = await buildDebugPack(fakeStore);
    assert.equal(pack.screenshotPng, null);
  });

  test('captures full page HTML', async () => {
    const pack = await buildDebugPack(fakeStore);
    assert.equal(pack.html, '<html></html>');
  });
});
