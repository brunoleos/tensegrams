import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM, makeSVG } from '../dom-mock.js';

installDOM();
const { renderNodes } = await import('../../src/renderer/nodes.js');

function makeG() {
  const svg = makeSVG();
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(g);
  return g;
}

describe('renderNodes — leaves', () => {
  test('creates one g per node with data-id', () => {
    const g = makeG();
    const ir = { nodes: [{ id: 'a', kind: 'leaf', hasChildren: false, label: 'A', layers: [] }], edges: [] };
    const positions = new Map([['a', { x: 0, y: 0, width: 100, height: 40 }]]);
    renderNodes(g, ir, positions, new Map());
    assert.equal(g.children.length, 1);
    assert.equal(g.children[0].getAttribute('data-id'), 'a');
  });

  test('idempotent: second render does not duplicate', () => {
    const g = makeG();
    const ir = { nodes: [{ id: 'a', kind: 'leaf', hasChildren: false, label: 'A', layers: [] }], edges: [] };
    const positions = new Map([['a', { x: 0, y: 0, width: 100, height: 40 }]]);
    renderNodes(g, ir, positions, new Map());
    renderNodes(g, ir, positions, new Map());
    assert.equal(g.children.length, 1);
  });

  test('reaps removed nodes', () => {
    const g = makeG();
    const positions = new Map([['a', { x: 0, y: 0, width: 100, height: 40 }]]);
    renderNodes(g, { nodes: [{ id: 'a', kind: 'leaf', hasChildren: false, label: 'A', layers: [] }], edges: [] }, positions, new Map());
    renderNodes(g, { nodes: [], edges: [] }, new Map(), new Map());
    assert.equal(g.children.length, 0);
  });
});

describe('renderNodes — containers', () => {
  test('adds header element', () => {
    const g = makeG();
    const ir = { nodes: [{ id: 'c', kind: 'container', hasChildren: true, label: 'Container', layers: [] }], edges: [] };
    const containers = new Map([['c', { x: 0, y: 0, width: 200, height: 100, padding: 12 }]]);
    renderNodes(g, ir, new Map(), containers);
    const node = g.children[0];
    assert.equal(node.getAttribute('data-id'), 'c');
    assert.ok(node.querySelector('.container-header'));
  });
});

describe('renderNodes — data-layers attribute', () => {
  test('written from node.layers', () => {
    const g = makeG();
    const ir = { nodes: [{ id: 'a', kind: 'leaf', hasChildren: false, label: 'A', layers: ['x', 'y'] }], edges: [] };
    renderNodes(g, ir, new Map([['a', { x: 0, y: 0, width: 100, height: 40 }]]), new Map());
    assert.equal(g.children[0].getAttribute('data-layers'), 'x y');
  });
});
