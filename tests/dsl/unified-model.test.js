// Sanity check for the unified abstract model: Node + Edge.
//
//   • A Node may have children (and thus render as a container/frame).
//   • Any Node — child-having or leaf-shaped — may be source/target of edges.
//   • Hierarchy is declared via `parent:` references, NOT nesting.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';
import { applyLayerFilter } from '../../src/layout/layer-filter.js';

const ir = (src) => buildIR(parse(src));
const node = (g, id) => g.nodes.find(n => n.id === id);

describe('unified model — YAML hierarchy', () => {
  test('a node referenced as parent becomes a container', () => {
    const g = ir(`
backend:
  label: Backend
api:
  parent: backend
  label: API
`);
    assert.deepEqual(g.errors, []);
    const backend = node(g, 'backend');
    assert.equal(backend.hasChildren, true);
    assert.equal(backend.label, 'Backend');
    assert.equal(node(g, 'api').parent, 'backend');
  });

  test('container falls back to its id when no label is given', () => {
    const g = ir(`
backend: { }
api:
  parent: backend
`);
    const backend = node(g, 'backend');
    assert.equal(backend.label, 'backend');
  });

  test('container with explicit label + viewLayers', () => {
    const g = ir(`
backend:
  label: Camada
  viewLayers: [infra]
api:
  parent: backend
`);
    const backend = node(g, 'backend');
    assert.equal(backend.label, 'Camada');
    assert.deepEqual(backend.layers, ['infra']);
  });

  test('node that nobody declares as parent and that has no children is NOT a container', () => {
    const g = ir(`
a:
  label: A
b:
  label: B
`);
    for (const n of g.nodes) assert.equal(n.hasChildren, false);
  });
});

describe('unified model — edges may target containers', () => {
  test('edge from outside to a container parses cleanly', () => {
    const g = ir(`
connections:
  - [out, box]

box:
  label: Box
inner:
  parent: box
  label: I
out:
  label: Out
`);
    assert.deepEqual(g.errors, []);
    assert.equal(g.edges.length, 1);
    assert.equal(g.edges[0].source, 'out');
    assert.equal(g.edges[0].target, 'box');
    assert.equal(node(g, 'box').hasChildren, true);
  });

  test('container as both source AND target', () => {
    const g = ir(`
connections:
  - [a, b]

a:
  label: A
b:
  label: B
ch1:
  parent: a
ch2:
  parent: b
`);
    assert.deepEqual(g.errors, []);
    assert.equal(g.edges[0].source, 'a');
    assert.equal(g.edges[0].target, 'b');
  });

  test('layer filter drops edge whose endpoint is hidden (default behaviour)', () => {
    const g = ir(`
connections:
  - [out, box]

out:
  label: Out
  viewLayers: [foo]
box:
  label: Box
inner:
  parent: box
`);
    const filtered = applyLayerFilter(g, new Set(['foo']));
    assert.equal(filtered.edges.length, 0);
  });

  test('onHidden=promote walks up to the visible ancestor', () => {
    const g = ir(`
connections:
  - [child, box]

parent:
  label: Parent
child:
  parent: parent
  viewLayers: [foo]
box:
  label: Box
inner:
  parent: box

? [child, box]
: { onHidden: promote }
`);
    const filtered = applyLayerFilter(g, new Set(['foo']));
    assert.equal(filtered.edges.length, 1);
    assert.equal(filtered.edges[0].source, 'parent');
    assert.equal(filtered.edges[0].target, 'box');
  });
});

describe('unified model — IR shape invariants', () => {
  test('IR nodes do NOT carry a `kind` field; hasChildren is canonical', () => {
    const g = ir(`
box:
  label: Box
a:
  label: A
b:
  parent: box
  label: B
`);
    for (const n of g.nodes) {
      assert.equal('kind' in n, false, `node ${n.id} should not have "kind"`);
      assert.equal(typeof n.hasChildren, 'boolean');
    }
  });
});
