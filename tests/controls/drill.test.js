import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from '../dom-mock.js';
installDOM();

const { createDrillControl, topLevelContainers } = await import('../../src/controls/drill.js');

describe('drill control', () => {
  let host, clicked, ctl;
  beforeEach(() => {
    host = document.createElement('div');
    clicked = [];
    ctl = createDrillControl(host, (id) => clicked.push(id));
  });

  test('renders one chip per container with label + data-id', () => {
    ctl.setContainers([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Bravo' },
    ]);
    const chips = host.querySelectorAll('.drill-chip');
    assert.equal(chips.length, 2);
    assert.equal(chips[0].textContent, 'Alpha');
    assert.equal(chips[0].dataset.id, 'a');
    assert.equal(chips[1].textContent, 'Bravo');
    assert.equal(chips[1].dataset.id, 'b');
  });

  test('empty list collapses the control via .empty class', () => {
    ctl.setContainers([]);
    assert.ok(host.querySelector('.drill-control').classList.contains('empty'));
  });

  test('re-render replaces (no duplicates)', () => {
    ctl.setContainers([{ id: 'x', label: 'X' }]);
    ctl.setContainers([{ id: 'y', label: 'Y' }]);
    const chips = host.querySelectorAll('.drill-chip');
    assert.equal(chips.length, 1);
    assert.equal(chips[0].textContent, 'Y');
  });
});

describe('topLevelContainers', () => {
  test('returns containers without a parent (post-projection)', () => {
    const ir = {
      nodes: [
        { id: 'box',   kind: 'container', hasChildren: true, parent: null },
        { id: 'inner', kind: 'container', hasChildren: true, parent: 'box' },
        { id: 'leaf',  kind: 'leaf', hasChildren: false,      parent: 'box' },
      ],
      edges: [],
    };
    const got = topLevelContainers(ir).map(n => n.id);
    assert.deepEqual(got, ['box']);
  });

  test('returns multiple top-level containers when present', () => {
    const ir = {
      nodes: [
        { id: 'a', kind: 'container', hasChildren: true },
        { id: 'b', kind: 'container', hasChildren: true },
        { id: 'l', kind: 'leaf', hasChildren: false },
      ],
      edges: [],
    };
    assert.deepEqual(topLevelContainers(ir).map(n => n.id), ['a', 'b']);
  });

  test('empty when the view has no containers', () => {
    const ir = { nodes: [{ id: 'l', kind: 'leaf', hasChildren: false }], edges: [] };
    assert.deepEqual(topLevelContainers(ir), []);
  });
});
