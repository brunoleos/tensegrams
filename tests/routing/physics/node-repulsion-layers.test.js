// Layer-aware node-vs-edge collision in the physics solver. The A* router
// (obstacle-route) already filters node obstacles per edge via
// `resolver.edgeNodePair(edge, nodeId)`: only nodes that share at least one
// collision layer with the edge count as obstacles. The physics solver, on
// the other hand, used to treat EVERY foreign node as an obstacle — pushing
// edges away from nodes they shouldn't even see. That caused spurious
// fission (Phase G) on edges with no declared collision layers.
//
// This locks the same predicate: when a resolver is provided, applyNodeRepulsion
// only pushes against nodes that share a layer with the edge. Without a
// resolver (legacy callers/tests), behaviour is unchanged — every foreign
// node still counts as an obstacle.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld } from '../../../src/routing/physics/warm-start.js';
import { applyNodeRepulsion } from '../../../src/routing/physics/forces.js';

function poly(points) { return { points }; }

// Foreign node `c` whose padded BBox overlaps the middle of edge AB. Without
// a resolver, applyNodeRepulsion pushes AB's middle segment away from c.
function world() {
  const ir = { edges: [{ id: 'AB', source: 'a', target: 'b' }] };
  const routed = new Map([
    ['AB', poly([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 140, y: 0 }, { x: 200, y: 0 }])],
  ]);
  return buildWorld(ir, routed, { ancestors: new Map() });
}

const routingRects = new Map([
  ['a', { x: -10, y: -10, width: 20, height: 20 }],
  ['b', { x: 190, y: -10, width: 20, height: 20 }],
  ['c', { x: 70, y: -30, width: 60, height: 60 }],
]);

const midSegForceY = (w) => {
  const c1 = w.bodies.find(b => b.id === 'AB#c1');
  const c2 = w.bodies.find(b => b.id === 'AB#c2');
  return (c1.fy + c2.fy) / 2;
};

describe('applyNodeRepulsion — resolver-aware filtering', () => {
  test('NO resolver: legacy behaviour — foreign node always pushes', () => {
    const w = world();
    applyNodeRepulsion(w, routingRects, {});
    assert.notEqual(midSegForceY(w), 0, 'middle segment should be pushed away from c');
  });

  test('resolver says no shared layer: foreign node is IGNORED', () => {
    const w = world();
    // Stub resolver returning null = no shared collision layer.
    const resolver = { edgeNodePair: () => null };
    applyNodeRepulsion(w, routingRects, { resolver });
    assert.equal(midSegForceY(w), 0, 'no force when edge and node do not share a layer');
  });

  test('resolver says shared layer: foreign node still pushes', () => {
    const w = world();
    const resolver = { edgeNodePair: (_e, nodeId) => nodeId === 'c' ? { shared: ['top'], frac: { edge: 0.5, node: 0.5 } } : null };
    applyNodeRepulsion(w, routingRects, { resolver });
    assert.notEqual(midSegForceY(w), 0, 'force should apply when layer is shared');
  });

  test('source/target/ancestor never repels regardless of resolver answer', () => {
    const w = world();
    // Even if the resolver says "shared layer", an edge's own anchor node
    // must never collide with itself (that's the existing allowedNodeIds rule).
    const resolver = { edgeNodePair: () => ({ shared: ['x'], frac: { edge: 0.5, node: 0.5 } }) };
    const onlyOwn = new Map([['a', routingRects.get('a')]]);
    applyNodeRepulsion(w, onlyOwn, { resolver });
    assert.equal(midSegForceY(w), 0);
  });
});
