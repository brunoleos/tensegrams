// Fusion safety: mergeColinear may not erase a corner when the result is a
// non-Manhattan polyline. The case: a 4-corner Z whose two outer corners are
// pinned anchors at DIFFERENT perpendicular coordinates. Removing the middle
// short segment would fuse the two perpendicular legs into a single run with
// two pinned ends at incompatible coords — projectManhattanEdge can only
// satisfy one of them, leaving the other leg diagonal. shouldMerge must
// detect this and block the fusion.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld } from '../../../src/routing/physics/warm-start.js';
import { shouldMerge } from '../../../src/routing/physics/topology.js';

function poly(points) { return { points }; }

// Build the exact CD topology from the user's debug pack: c at top-anchor and
// d at bottom-anchor, both vertical faces, x slightly offset. After the base
// router emits a 4-point Z, the middle short horizontal segment is a fusion
// candidate by length. But it MUST NOT fuse: the two outer V legs are pinned
// to different x.
function worldZAcrossPinnedAnchorsAtDifferentX() {
  const ir = { edges: [{ id: 'CD', source: 'c', target: 'd' }] };
  const routed = new Map([
    ['CD', poly([
      { x: -212, y: -29 },   // C0 pinned (c north)
      { x: -212, y: -115 },  // Ca
      { x: -205, y: -115 },  // Cb — short horizontal seg between Ca and Cb (length 7)
      { x: -205, y: -202 },  // C3 pinned (d south)
    ])],
  ]);
  return buildWorld(ir, routed, { ancestors: new Map() });
}

function worldZWithFreeOuter() {
  // Sanity: SAME topology except the polyline has 5 corners so the middle
  // run's outer corners aren't both anchors (one is an interior free corner).
  // Fusion is safe — projectManhattanEdge can equalise the merged x via the
  // free corner. shouldMerge should allow it.
  const ir = { edges: [{ id: 'CD', source: 'c', target: 'd' }] };
  const routed = new Map([
    ['CD', poly([
      { x: -212, y: -29 },   // C0 pinned
      { x: -212, y: -60 },   // free interior
      { x: -212, y: -115 },  // Ca — adjacent to short H seg
      { x: -205, y: -115 },  // Cb — adjacent to short H seg
      { x: -205, y: -202 },  // C3 pinned
    ])],
  ]);
  return buildWorld(ir, routed, { ancestors: new Map() });
}

// Pick the short horizontal seg (the actual fusion candidate) — its index
// depends on polyline length.
function shortHorizSeg(w, edgeId) {
  const segs = w.edgeIndex.get(edgeId).segments;
  return segs.find(s => s.orientation === 'h');
}

const K_MERGE = 4; // FUSION_MANHATTAN_K_DEFAULT
const STROKE = 2;

describe('shouldMerge — safety: cannot fuse a run with pinned anchors at incompatible coords', () => {
  test('rejects fusion when both run-outer corners are anchors at different perp coords', () => {
    const w = worldZAcrossPinnedAnchorsAtDifferentX();
    const m = shortHorizSeg(w, 'CD');
    m.strokeWidth = STROKE;
    assert.equal(shouldMerge(m, w, K_MERGE), false,
      'fusion would create a diagonal leg — must be blocked');
  });

  test('accepts fusion when one run-outer corner is FREE (interior)', () => {
    const w = worldZWithFreeOuter();
    const m = shortHorizSeg(w, 'CD');
    m.strokeWidth = STROKE;
    assert.equal(shouldMerge(m, w, K_MERGE), true,
      'free outer corner can absorb the perpendicular shift — fusion is safe');
  });
});
