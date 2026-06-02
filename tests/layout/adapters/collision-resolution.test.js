import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCollisions } from '../../../src/layout/adapters/live/collision-resolution.js';
import { buildCollisionResolver } from '../../../src/layout/collision.js';

function spec(o) { return new Map(Object.entries(o || {})); }

// Build a minimal live engineState for leaf-only collision tests.
function makeState(leaves) {
  const N = leaves.length;
  const state = {
    leaves,
    containers: [],
    containersWithChildren: [],
    idToIndex: new Map(leaves.map((l, i) => [l.id, i])),
    px: new Float64Array(N),
    py: new Float64Array(N),
    vx: new Float64Array(N),
    vy: new Float64Array(N),
    fx: new Array(N).fill(null),
    fy: new Array(N).fill(null),
    ancestors: new Map(leaves.map(l => [l.id, new Set()])),
  };
  leaves.forEach((l, i) => { state.px[i] = l._cx; state.py[i] = l._cy; });
  return state;
}

function resolverFor(leaves) {
  return buildCollisionResolver({ nodes: leaves, edges: [], layers: [], meta: {}, errors: [] });
}

// k=0.5 chosen so impulses have clean integer values:
//   dv = ±overlap * frac * k.
// Two 100-wide nodes at cx 0 and 40 overlap by 60 (axis=x).
const CFG = { collisionPadding: 0, collisionK: 0.5 };

describe('resolveCollisions — weighted spring impulse', () => {
  test('equal weights → equal opposite impulses, positions unchanged', () => {
    const leaves = [
      { id: 'a', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 0, _cy: 0 },
      { id: 'b', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 40, _cy: 0 },
    ];
    const state = makeState(leaves);
    resolveCollisions(state, CFG, resolverFor(leaves));
    // frac=0.5 each. dv = ±60 * 0.5 * 0.5 = ±15.
    assert.ok(Math.abs(state.vx[0] - (-15)) < 1e-6, `a vx=${state.vx[0]}`);
    assert.ok(Math.abs(state.vx[1] - 15) < 1e-6, `b vx=${state.vx[1]}`);
    // Positions untouched — separation happens via the integrator.
    assert.equal(state.px[0], 0);
    assert.equal(state.px[1], 40);
  });

  test('weight 1 vs 0 → only the loose body receives an impulse', () => {
    const leaves = [
      { id: 'a', width: 100, height: 100, nodeCollision: spec({ g: 1 }), _cx: 0, _cy: 0 },
      { id: 'b', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 40, _cy: 0 },
    ];
    const state = makeState(leaves);
    resolveCollisions(state, CFG, resolverFor(leaves));
    assert.equal(state.vx[0], 0);
    // dv = +60 * 1 * 0.5 = 30.
    assert.ok(Math.abs(state.vx[1] - 30) < 1e-6, `b vx=${state.vx[1]}`);
  });

  test('a pinned node hands its whole fraction to the other side', () => {
    const leaves = [
      { id: 'a', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 0, _cy: 0 },
      { id: 'b', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 40, _cy: 0 },
    ];
    const state = makeState(leaves);
    state.fx[0] = 0; // a pinned on x
    resolveCollisions(state, CFG, resolverFor(leaves));
    assert.equal(state.vx[0], 0);
    // b inherits a's fraction → dv = +60 * 1 * 0.5 = 30.
    assert.ok(Math.abs(state.vx[1] - 30) < 1e-6, `b vx=${state.vx[1]}`);
  });

  test('no shared label → no impulse', () => {
    const leaves = [
      { id: 'a', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 0, _cy: 0 },
      { id: 'b', width: 100, height: 100, nodeCollision: spec({ h: 0 }), _cx: 40, _cy: 0 },
    ];
    const state = makeState(leaves);
    resolveCollisions(state, CFG, resolverFor(leaves));
    assert.equal(state.vx[0], 0);
    assert.equal(state.vx[1], 0);
  });

  test('collisionPadding adds to the overlap depth', () => {
    const leaves = [
      { id: 'a', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 0, _cy: 0 },
      { id: 'b', width: 100, height: 100, nodeCollision: spec({ g: 0 }), _cx: 40, _cy: 0 },
    ];
    const state = makeState(leaves);
    // pad=20 → minDX = 50+50+20 = 120; overlap = 120-40 = 80.
    // dv = ±80 * 0.5 * 0.5 = ±20.
    resolveCollisions(state, { collisionPadding: 20, collisionK: 0.5 }, resolverFor(leaves));
    assert.ok(Math.abs(state.vx[0] - (-20)) < 1e-6, `a vx=${state.vx[0]}`);
    assert.ok(Math.abs(state.vx[1] - 20) < 1e-6, `b vx=${state.vx[1]}`);
  });
});
