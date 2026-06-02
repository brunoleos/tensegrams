import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyLayerFilter, chipLayers, UNTAGGED } from '../../src/layout/layer-filter.js';

// Minimal IR helper — `layers` defaults to [] and edges default to onHidden='omit'.
function ir(nodes, edges = []) {
  return {
    meta: {},
    layers: [],
    errors: [],
    nodes: nodes.map(n => ({ layers: [], ...n })),
    edges: edges.map(e => ({ onHidden: 'omit', layers: [], ...e })),
  };
}

describe('applyLayerFilter — node filtering', () => {
  test('passes through unchanged when no hidden layers', () => {
    const input = ir([{ id: 'a', kind: 'leaf', layers: ['infra'] }], []);
    const out = applyLayerFilter(input, new Set());
    assert.equal(out, input);
  });

  test('drops nodes whose own layer intersects hidden set', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', kind: 'leaf', layers: ['infra'] },
        { id: 'b', kind: 'leaf', layers: ['data'] },
      ]),
      new Set(['infra']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['b']);
  });

  test('hidden container does NOT cascade-hide its children', () => {
    // Children decide their own visibility from their own layers; the
    // container disappearing just re-parents survivors to the nearest
    // visible ancestor (or top-level).
    const out = applyLayerFilter(
      ir([
        { id: 'box',    kind: 'container', layers: ['infra'] },
        { id: 'child',  kind: 'leaf',      parent: 'box', layers: [] },
        { id: 'inner',  kind: 'container', parent: 'box', layers: [] },
        { id: 'gchild', kind: 'leaf',      parent: 'inner', layers: ['data'] },
        { id: 'outside', kind: 'leaf',     layers: [] },
      ]),
      new Set(['infra']),
    );
    // box vanishes; child/inner/gchild/outside all survive.
    assert.deepEqual(
      out.nodes.map(n => n.id).sort(),
      ['child', 'gchild', 'inner', 'outside'],
    );
    // Re-parenting: child loses 'box' (becomes top-level); inner same;
    // gchild keeps 'inner' (still visible).
    const byId = new Map(out.nodes.map(n => [n.id, n]));
    assert.equal(byId.get('child').parent, null);
    assert.equal(byId.get('inner').parent, null);
    assert.equal(byId.get('gchild').parent, 'inner');
  });

  test('grandchild reparents past multiple hidden ancestors', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'outer', kind: 'container', layers: ['infra'] },
        { id: 'mid',   kind: 'container', parent: 'outer', layers: ['infra'] },
        { id: 'leaf',  kind: 'leaf',      parent: 'mid',   layers: ['app'] },
      ]),
      new Set(['infra']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['leaf']);
    assert.equal(out.nodes[0].parent, null);
  });

  test('nodes without any layers are never hidden', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', kind: 'leaf', layers: [] },
        { id: 'b', kind: 'leaf', layers: ['infra'] },
      ]),
      new Set(['infra']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['a']);
  });
});

describe('applyLayerFilter — edge handling: omit (default)', () => {
  test('edge is dropped when either endpoint is hidden', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'a', kind: 'leaf', layers: ['infra'] },
          { id: 'b', kind: 'leaf', layers: [] },
          { id: 'c', kind: 'leaf', layers: [] },
        ],
        [
          { id: 'e1', source: 'a', target: 'b' },          // a hidden → drop
          { id: 'e2', source: 'b', target: 'c' },          // both visible
        ],
      ),
      new Set(['infra']),
    );
    assert.deepEqual(out.edges.map(e => e.id), ['e2']);
  });

  test('edge is dropped when BOTH endpoints are hidden', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'a', kind: 'leaf', layers: ['infra'] },
          { id: 'b', kind: 'leaf', layers: ['infra'] },
        ],
        [{ id: 'e1', source: 'a', target: 'b' }],
      ),
      new Set(['infra']),
    );
    assert.deepEqual(out.edges, []);
  });
});

describe('applyLayerFilter — edge handling: promote', () => {
  test('endpoint rerouted to nearest visible ancestor container', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'box',   kind: 'container', layers: [] },
          { id: 'inner', kind: 'leaf',      parent: 'box', layers: ['infra'] },
          { id: 'other', kind: 'leaf',      layers: [] },
        ],
        [{ id: 'e1', source: 'other', target: 'inner', onHidden: 'promote' }],
      ),
      new Set(['infra']),
    );
    assert.equal(out.edges.length, 1);
    assert.equal(out.edges[0].source, 'other');
    assert.equal(out.edges[0].target, 'box');
  });

  test('promotion walks UP until it finds a visible container', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'root',  kind: 'container', layers: [] },
          { id: 'mid',   kind: 'container', parent: 'root', layers: ['infra'] },
          { id: 'leaf',  kind: 'leaf',      parent: 'mid',  layers: ['infra'] },
          { id: 'other', kind: 'leaf', layers: [] },
        ],
        [{ id: 'e1', source: 'other', target: 'leaf', onHidden: 'promote' }],
      ),
      new Set(['infra']),
    );
    // `leaf` hidden (own layer); `mid` hidden (own layer); `root` visible.
    assert.equal(out.edges[0].target, 'root');
  });

  test('drops edge when no visible ancestor exists', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'a', kind: 'leaf', layers: ['infra'] },
          { id: 'b', kind: 'leaf', layers: [] },
        ],
        [{ id: 'e1', source: 'a', target: 'b', onHidden: 'promote' }],
      ),
      new Set(['infra']),
    );
    assert.deepEqual(out.edges, []);
  });

  test('self-loop after promotion is dropped', () => {
    // Both leaf endpoints share the same parent box, and both get hidden →
    // promotion sends both to `box`, producing box→box. Drop.
    const out = applyLayerFilter(
      ir(
        [
          { id: 'box', kind: 'container', layers: [] },
          { id: 'a',   kind: 'leaf', parent: 'box', layers: ['infra'] },
          { id: 'b',   kind: 'leaf', parent: 'box', layers: ['infra'] },
        ],
        [{ id: 'e1', source: 'a', target: 'b', onHidden: 'promote' }],
      ),
      new Set(['infra']),
    );
    assert.deepEqual(out.edges, []);
  });

  test('mixed: one endpoint visible, one promoted', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'box', kind: 'container', layers: [] },
          { id: 'a',   kind: 'leaf', parent: 'box', layers: ['infra'] },
          { id: 'b',   kind: 'leaf', layers: [] },
        ],
        [{ id: 'e1', source: 'a', target: 'b', onHidden: 'promote' }],
      ),
      new Set(['infra']),
    );
    assert.equal(out.edges.length, 1);
    assert.equal(out.edges[0].source, 'box');
    assert.equal(out.edges[0].target, 'b');
  });

  test('per-edge attribute: same DSL pair can mix omit and promote', () => {
    const out = applyLayerFilter(
      ir(
        [
          { id: 'box', kind: 'container', layers: [] },
          { id: 'h',   kind: 'leaf', parent: 'box', layers: ['infra'] },
          { id: 'v',   kind: 'leaf', layers: [] },
        ],
        [
          { id: 'omit',    source: 'h', target: 'v', onHidden: 'omit' },
          { id: 'promote', source: 'h', target: 'v', onHidden: 'promote' },
        ],
      ),
      new Set(['infra']),
    );
    assert.deepEqual(out.edges.map(e => e.id), ['promote']);
    assert.equal(out.edges[0].source, 'box');
  });
});

describe('applyLayerFilter — layers list reflects surviving entities', () => {
  test('output ir.layers excludes hidden tags', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', kind: 'leaf', layers: ['infra'] },
        { id: 'b', kind: 'leaf', layers: ['data'] },
      ]),
      new Set(['infra']),
    );
    assert.deepEqual(out.layers, ['data']);
  });
});

describe('applyLayerFilter — multi-tag OR-visibility', () => {
  // A node tagged with multiple layers stays visible as long as AT LEAST
  // ONE of those layers is visible. Only hidden when EVERY layer it carries
  // is in the hidden set.
  test('node with two layers stays when only ONE is hidden', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', layers: ['infra', 'data'] },
        { id: 'b', layers: ['infra'] },
      ]),
      new Set(['infra']),
    );
    // `a` survives (still has `data` visible); `b` is dropped (only infra).
    assert.deepEqual(out.nodes.map(n => n.id), ['a']);
  });

  test('node with two layers is hidden only when BOTH layers are hidden', () => {
    const out = applyLayerFilter(
      ir([{ id: 'a', layers: ['infra', 'data'] }]),
      new Set(['infra', 'data']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), []);
  });

  test('hiding all layers except one keeps multi-tag nodes that carry the survivor', () => {
    // `keep` is tagged `infra,data,public`; user hides infra+data → `keep`
    // survives because `public` is still visible.
    const out = applyLayerFilter(
      ir([
        { id: 'keep', layers: ['infra', 'data', 'public'] },
        { id: 'gone', layers: ['infra', 'data'] },
      ]),
      new Set(['infra', 'data']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['keep']);
  });
});

describe('applyLayerFilter — untagged semantics (Option B)', () => {
  test('a node with empty layers is visible by default', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', layers: [] },
        { id: 'b', layers: ['infra'] },
      ]),
      new Set(['infra']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['a']);
  });

  test('hiding the synthetic UNTAGGED chip hides untagged nodes', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', layers: [] },
        { id: 'b', layers: ['infra'] },
      ]),
      new Set([UNTAGGED]),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['b']);
  });

  test('UNTAGGED hidden combined with a real tag hidden', () => {
    const out = applyLayerFilter(
      ir([
        { id: 'a', layers: [] },
        { id: 'b', layers: ['infra'] },
        { id: 'c', layers: ['data'] },
      ]),
      new Set([UNTAGGED, 'infra']),
    );
    assert.deepEqual(out.nodes.map(n => n.id), ['c']);
  });
});

describe('chipLayers — synthesizes UNTAGGED chip only on mix', () => {
  test('all tagged → no UNTAGGED chip', () => {
    const got = chipLayers({
      nodes: [
        { id: 'a', layers: ['x'] },
        { id: 'b', layers: ['y'] },
      ],
      layers: ['x', 'y'],
    });
    assert.deepEqual(got, ['x', 'y']);
  });

  test('all untagged → no UNTAGGED chip (nothing to isolate against)', () => {
    const got = chipLayers({
      nodes: [{ id: 'a', layers: [] }, { id: 'b', layers: [] }],
      layers: [],
    });
    assert.equal(got.includes(UNTAGGED), false);
  });

  test('mix of tagged and untagged → UNTAGGED chip appears, last in order', () => {
    const got = chipLayers({
      nodes: [
        { id: 'a', layers: ['infra'] },
        { id: 'b', layers: [] },
      ],
      layers: ['infra'],
    });
    assert.deepEqual(got, ['infra', UNTAGGED]);
  });
});
