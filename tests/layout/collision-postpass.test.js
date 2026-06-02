import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyCollisionPostPass } from '../../src/layout/collision-postpass.js';
import { buildCollisionResolver } from '../../src/layout/collision.js';

function spec(o) { return new Map(Object.entries(o || {})); }
function node(id, collision, extra = {}) {
  return { id, hasChildren: false, nodeCollision: spec(collision), ...extra };
}
function mkIr(nodes) {
  return { nodes, edges: [], layers: [], meta: {}, errors: [] };
}
function run(nodes, positions, opts = {}) {
  const ir = mkIr(nodes);
  applyCollisionPostPass(ir, positions, new Map(), buildCollisionResolver(ir),
    { nodePad: 0, passes: 8, ...opts });
}

describe('applyCollisionPostPass', () => {
  test('separates two overlapping nodes sharing a layer', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0, width: 100, height: 100 }],
      ['b', { x: 40, y: 0, width: 100, height: 100 }],
    ]);
    run([node('a', { g: 0 }), node('b', { g: 0 })], positions);
    const a = positions.get('a'), b = positions.get('b');
    assert.ok(a.x + a.width <= b.x + 1e-6 || b.x + b.width <= a.x + 1e-6,
      `still overlapping: a@${a.x} b@${b.x}`);
  });

  test('high-weight node stays put, low-weight node absorbs the move', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0, width: 100, height: 100 }],
      ['b', { x: 40, y: 0, width: 100, height: 100 }],
    ]);
    run([node('a', { g: 1 }), node('b', { g: 0 })], positions);
    assert.equal(positions.get('a').x, 0);
    assert.ok(Math.abs(positions.get('b').x - 100) < 1e-6);
  });

  test('a pinned node does not move', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0, width: 100, height: 100 }],
      ['b', { x: 40, y: 0, width: 100, height: 100 }],
    ]);
    run([node('a', { g: 0 }, { pinned: { x: 0, y: 0 } }), node('b', { g: 0 })], positions);
    assert.equal(positions.get('a').x, 0);
    assert.ok(Math.abs(positions.get('b').x - 100) < 1e-6);
  });

  test('nodes without a shared layer are not moved', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0, width: 100, height: 100 }],
      ['b', { x: 40, y: 0, width: 100, height: 100 }],
    ]);
    run([node('a', { g: 0 }), node('b', { h: 0 })], positions);
    assert.equal(positions.get('a').x, 0);
    assert.equal(positions.get('b').x, 40);
  });

  test('a moved leaf reflows its ancestor container rect', () => {
    const nodes = [
      node('box', { g: 0 }, { hasChildren: true, padding: 10 }),
      node('child', null, { parent: 'box' }),
      node('other', { g: 0 }),
    ];
    const positions = new Map([
      ['child', { x: 0, y: 0, width: 60, height: 60 }],
      ['other', { x: 30, y: 0, width: 100, height: 100 }],
    ]);
    const containers = new Map([
      ['box', { x: -10, y: -10, width: 80, height: 80, padding: 10 }],
    ]);
    const ir = mkIr(nodes);
    applyCollisionPostPass(ir, positions, containers, buildCollisionResolver(ir),
      { nodePad: 0, passes: 8, header: 0 });
    // box and other must not overlap after the pass
    const box = containers.get('box'), other = positions.get('other');
    assert.ok(box.x + box.width <= other.x + 1e-6 || other.x + other.width <= box.x + 1e-6,
      `box and other still overlap`);
    // box rect still hugs its child
    const child = positions.get('child');
    assert.ok(Math.abs(box.x - (child.x - 10)) < 1e-6, 'box rect not reflowed to child');
  });
});
