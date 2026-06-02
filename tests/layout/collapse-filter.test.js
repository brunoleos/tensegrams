import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyCollapseFilter } from '../../src/layout/collapse-filter.js';

function ir(nodes, edges = []) {
  // Auto-derive hasChildren from parent refs unless the node already
  // declares it (lets tests pass through explicit container intent).
  const childIds = new Set(nodes.filter(n => n.parent).map(n => n.parent));
  const fullNodes = nodes.map(n => ({
    layers: [],
    hasChildren: n.hasChildren ?? childIds.has(n.id),
    ...n,
  }));
  return { nodes: fullNodes, edges, layers: [] };
}

describe('applyCollapseFilter — no-op cases', () => {
  test('empty / null set returns input unchanged', () => {
    const input = ir([{ id: 'a' }]);
    assert.equal(applyCollapseFilter(input, new Set()), input);
    assert.equal(applyCollapseFilter(input, null), input);
  });

  test('id missing from IR is ignored', () => {
    const input = ir([{ id: 'a' }]);
    const out = applyCollapseFilter(input, new Set(['ghost']));
    assert.equal(out, input);
  });

  test('id pointing at a leaf (not container) is ignored', () => {
    const input = ir([{ id: 'a' }, { id: 'b' }]);
    const out = applyCollapseFilter(input, new Set(['a']));
    assert.equal(out, input);
  });
});

describe('applyCollapseFilter — node removal', () => {
  test('descendants of a collapsed container are removed; container stays with collapsed=true', () => {
    const out = applyCollapseFilter(
      ir([
        { id: 'box',   hasChildren: true },
        { id: 'child', parent: 'box' },
        { id: 'gchild', parent: 'child' },
        { id: 'outside' },
      ]),
      new Set(['box']),
    );
    assert.deepEqual(out.nodes.map(n => n.id).sort(), ['box', 'outside']);
    const box = out.nodes.find(n => n.id === 'box');
    assert.equal(box.collapsed, true);
    // outside untouched (no `collapsed` flag).
    const outside = out.nodes.find(n => n.id === 'outside');
    assert.equal(outside.collapsed, undefined);
  });

  test('nested collapsed containers — outer collapse subsumes inner', () => {
    const out = applyCollapseFilter(
      ir([
        { id: 'outer', hasChildren: true },
        { id: 'inner', parent: 'outer', hasChildren: true },
        { id: 'leaf',  parent: 'inner' },
      ]),
      new Set(['outer', 'inner']),
    );
    // Only outer survives; inner and leaf are gone. outer.collapsed=true.
    assert.deepEqual(out.nodes.map(n => n.id), ['outer']);
    assert.equal(out.nodes[0].collapsed, true);
  });

  test('does not mutate input', () => {
    const input = ir([
      { id: 'box',  hasChildren: true },
      { id: 'leaf', parent: 'box' },
    ]);
    const snapshot = JSON.stringify(input);
    applyCollapseFilter(input, new Set(['box']));
    assert.equal(JSON.stringify(input), snapshot);
  });
});

describe('applyCollapseFilter — edges', () => {
  test('edge into a descendant is rewritten to the collapsed container', () => {
    const out = applyCollapseFilter(
      ir(
        [
          { id: 'box',   hasChildren: true },
          { id: 'child', parent: 'box' },
          { id: 'outside' },
        ],
        [{ id: 'e1', source: 'outside', target: 'child' }],
      ),
      new Set(['box']),
    );
    assert.equal(out.edges.length, 1);
    assert.equal(out.edges[0].source, 'outside');
    assert.equal(out.edges[0].target, 'box');
  });

  test('edge between two descendants of the SAME collapsed container is dropped (self-loop)', () => {
    const out = applyCollapseFilter(
      ir(
        [
          { id: 'box', hasChildren: true },
          { id: 'a',   parent: 'box' },
          { id: 'b',   parent: 'box' },
        ],
        [{ id: 'e1', source: 'a', target: 'b' }],
      ),
      new Set(['box']),
    );
    assert.equal(out.edges.length, 0);
  });

  test('edge between descendants of DIFFERENT collapsed containers is rewritten', () => {
    const out = applyCollapseFilter(
      ir(
        [
          { id: 'b1', hasChildren: true },
          { id: 'b2', hasChildren: true },
          { id: 'a',  parent: 'b1' },
          { id: 'b',  parent: 'b2' },
        ],
        [{ id: 'e1', source: 'a', target: 'b' }],
      ),
      new Set(['b1', 'b2']),
    );
    assert.equal(out.edges.length, 1);
    assert.equal(out.edges[0].source, 'b1');
    assert.equal(out.edges[0].target, 'b2');
  });

  test('edge endpoints outside collapsed containers are untouched', () => {
    const out = applyCollapseFilter(
      ir(
        [
          { id: 'a' }, { id: 'b' },
          { id: 'box', hasChildren: true },
          { id: 'c',   parent: 'box' },
        ],
        [{ id: 'e1', source: 'a', target: 'b' }],
      ),
      new Set(['box']),
    );
    assert.equal(out.edges[0].source, 'a');
    assert.equal(out.edges[0].target, 'b');
  });

  test('original DSL edge metadata (id, layers, label) preserved on promotion', () => {
    const out = applyCollapseFilter(
      ir(
        [
          { id: 'box', hasChildren: true },
          { id: 'child', parent: 'box' },
          { id: 'outside' },
        ],
        [{ id: 'e1', source: 'outside', target: 'child', label: 'calls', layers: ['public'] }],
      ),
      new Set(['box']),
    );
    assert.equal(out.edges[0].id, 'e1');
    assert.equal(out.edges[0].label, 'calls');
    assert.deepEqual(out.edges[0].layers, ['public']);
  });
});
