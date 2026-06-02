import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { projectIR, createBreadcrumb } from '../../src/controls/abstraction.js';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';
import { installDOM } from '../dom-mock.js';

const src = `connections:
  - [a, b]
  - [top, a]

outer:
  label: outer

a:
  parent: outer
  label: A

b:
  parent: outer
  label: B

top:
  label: Top
`;
const full = buildIR(parse(src));

describe('projectIR', () => {
  test('no focus returns original IR', () => {
    const r = projectIR(full, null);
    assert.equal(r, full);
  });

  test('focus on container keeps only descendants', () => {
    const r = projectIR(full, 'outer');
    const ids = r.nodes.map(n => n.id).sort();
    assert.deepEqual(ids, ['a', 'b']);
  });

  test('focus re-parents direct children to root', () => {
    const r = projectIR(full, 'outer');
    for (const n of r.nodes) {
      assert.equal(n.parent, null);
    }
  });

  test('focus drops edges that leave the subtree', () => {
    const r = projectIR(full, 'outer');
    // top -> a edge has source `top` which is outside the subtree
    assert.equal(r.edges.length, 1);
    assert.equal(r.edges[0].id, full.edges.find(e => e.source === 'a').id);
  });

  test('non-existent focus id is ignored', () => {
    const r = projectIR(full, 'xxx');
    assert.equal(r, full);
  });
});

describe('createBreadcrumb', () => {
  const doc = installDOM();
  const deepIr = buildIR(parse(`
root:
  label: Root
mid:
  parent: root
  label: Mid
deep:
  parent: mid
  label: Deep
leaf:
  parent: deep
  label: L
`));

  test('no focus → only the home crumb', () => {
    const el = doc.createElement('div');
    createBreadcrumb(el, deepIr, null, () => {});
    assert.equal(el.querySelectorAll('.crumb').length, 1);
  });

  test('drilling into a nested container shows every ancestor crumb', () => {
    const el = doc.createElement('div');
    createBreadcrumb(el, deepIr, 'deep', () => {});
    const labels = el.querySelectorAll('.crumb').map(c => c.textContent);
    assert.deepEqual(labels, ['raiz', 'Root', 'Mid', 'Deep']);
    assert.equal(el.querySelectorAll('.crumb-sep').length, 3);
  });

  test('intermediate crumbs are buttons; the focused one is a plain span', () => {
    const el = doc.createElement('div');
    createBreadcrumb(el, deepIr, 'deep', () => {});
    const buttons = el.querySelectorAll('button.crumb');
    assert.deepEqual(buttons.map(b => b.textContent), ['raiz', 'Root', 'Mid']);
    const current = el.querySelectorAll('span.crumb');
    assert.deepEqual(current.map(s => s.textContent), ['Deep']);
  });
});
