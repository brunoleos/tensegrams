// Layer-aware parallel repulsion. Mirror of the node-vs-edge fix: when a
// resolver is provided, applyParallelRepulsion only pushes pairs of segments
// from edges that share at least one collision layer (edgeEdgePair !== null).
// Without a resolver, legacy behaviour: every parallel pair pushes.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld } from '../../../src/routing/physics/warm-start.js';
import { applyParallelRepulsion } from '../../../src/routing/physics/forces.js';

function poly(points) { return { points }; }

// Two L-shaped edges with VERTICAL legs nearly overlapping (12px apart in x).
// Without a resolver they push each other; with a resolver returning null
// they shouldn't.
function world() {
  const ir = {
    edges: [
      { id: 'AC', source: 'a', target: 'c' },
      { id: 'BD', source: 'b', target: 'd' },
    ],
  };
  const routed = new Map([
    ['AC', poly([{ x: 19,   y: -63 }, { x: -71, y: -63 }, { x: -71, y: -5 }, { x: -142, y: -5 }])],
    ['BD', poly([{ x: -59, y:  75 }, { x: -59, y: -75 }, { x: -205, y: -75 }, { x: -205, y: -202 }])],
  ]);
  return buildWorld(ir, routed, { ancestors: new Map() });
}

// Total |fx| accumulated on the FREE interior corners of AC and BD — those are
// the only places where applyParallelRepulsion can deposit a parallel push.
function totalParallelForce(w) {
  let total = 0;
  for (const b of w.bodies) {
    if (b.kind === 'corner' && !b.pinned) total += Math.abs(b.fx) + Math.abs(b.fy);
  }
  return total;
}

describe('applyParallelRepulsion — resolver-aware filtering', () => {
  test('NO resolver: legacy — close parallel segs push each other', () => {
    const w = world();
    applyParallelRepulsion(w, { parallelGap: 20 });
    assert.ok(totalParallelForce(w) > 0, 'expected parallel push without resolver');
  });

  test('resolver says no shared edge layer: parallels are IGNORED', () => {
    const w = world();
    const resolver = { edgeEdgePair: () => null };
    applyParallelRepulsion(w, { parallelGap: 20, resolver });
    assert.equal(totalParallelForce(w), 0, 'no force when edges do not share a layer');
  });

  test('resolver says shared layer: parallels still push', () => {
    const w = world();
    const resolver = { edgeEdgePair: () => ({ shared: ['x'], frac: { a: 0.5, b: 0.5 } }) };
    applyParallelRepulsion(w, { parallelGap: 20, resolver });
    assert.ok(totalParallelForce(w) > 0, 'expected push when layer is shared');
  });
});
