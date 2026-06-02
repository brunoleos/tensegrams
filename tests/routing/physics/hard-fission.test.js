// Phase G — hard reroute for edge-vs-foreign-node (Q3).
//
// The hard case: a straight edge whose two anchors sit on opposite sides of
// a foreign node, so the single segment is speared THROUGH the node body and
// cannot slide out — both its corners are pinned. Node repulsion adds force
// but pinned corners don't move, so the edge stays inside. Fission is the
// existing obstacle-detour mechanism, but it's globally OFF by default.
// Phase G turns it on LOCALLY for exactly such pinned, foreign-crossing
// segments, so the edge bulges around the node.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld } from '../../../src/routing/physics/warm-start.js';
import { step } from '../../../src/routing/physics/solver.js';

function poly(points) { return { points }; }

// Edge AB: a straight 2-point edge a(0,0)→b(200,0). Foreign node `c` sits in
// the middle, so the single segment crosses c's body.
function world() {
  const ir = { edges: [{ id: 'AB', source: 'a', target: 'b' }] };
  const routed = new Map([
    ['AB', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])],
  ]);
  return buildWorld(ir, routed, { ancestors: new Map() });
}

const routingRects = new Map([
  ['a', { x: -10, y: -10, width: 20, height: 20 }],
  ['b', { x: 190, y: -10, width: 20, height: 20 }],
  ['c', { x: 70, y: -30, width: 60, height: 60 }], // core y∈[-30,30]
]);

const segCount = (w) => w.edgeIndex.get('AB').segments.length;
const maxAbsY = (w) => Math.max(...w.edgeIndex.get('AB').corners.map(c => Math.abs(c.y)));

// Does any segment still cross c's core BBox (the node body)?
function crossesCoreC(w) {
  const c = routingRects.get('c');
  for (const seg of w.edgeIndex.get('AB').segments) {
    const a = seg.prevCorner, b = seg.nextCorner;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    if (x1 >= c.x && x0 <= c.x + c.width && y1 >= c.y && y0 <= c.y + c.height) return true;
  }
  return false;
}

const OPTS = { routingRects, nodePad: 12, fissionEnabled: false };

describe('Phase G — hard fission for foreign-node penetration', () => {
  test('global fission OFF: a pinned segment speared through a foreign node splits', () => {
    const w = world();
    assert.equal(segCount(w), 1, 'starts as a single straight segment');
    for (let i = 0; i < 30; i++) step(w, OPTS);
    assert.ok(segCount(w) > 1, `expected a split, got ${segCount(w)} segments`);
  });

  test('the edge detours: it bulges out past the node body', () => {
    const w = world();
    for (let i = 0; i < 150; i++) step(w, OPTS);
    // A detour means some corner left the y=0 line by more than the node's
    // core half-height (30) — the edge routed around c instead of through it.
    assert.ok(maxAbsY(w) > 30, `edge did not bulge out: maxAbsY=${maxAbsY(w).toFixed(1)}`);
  });

  test('does not cascade: segment count stays bounded', () => {
    const w = world();
    for (let i = 0; i < 150; i++) step(w, OPTS);
    assert.ok(segCount(w) < 12, `runaway fission: ${segCount(w)} segments`);
  });

  test('no foreign node → no spurious split (single segment preserved)', () => {
    const w = world();
    const rectsNoC = new Map([
      ['a', routingRects.get('a')],
      ['b', routingRects.get('b')],
    ]);
    for (let i = 0; i < 30; i++) step(w, { routingRects: rectsNoC, nodePad: 12, fissionEnabled: false });
    assert.equal(segCount(w), 1, 'no obstacle, no split');
  });

  test('free middle segment slides out — not flagged, no fission', () => {
    // A 4-point edge whose middle segment is free can slide; it must NOT be
    // treated as a hard obstacle (no spurious cascade).
    const ir = { edges: [{ id: 'XY', source: 'x', target: 'y' }] };
    const routed = new Map([
      ['XY', poly([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 140, y: 0 }, { x: 200, y: 0 }])],
    ]);
    const w = buildWorld(ir, routed, { ancestors: new Map() });
    const rects = new Map([
      ['x', { x: -10, y: -10, width: 20, height: 20 }],
      ['y', { x: 190, y: -10, width: 20, height: 20 }],
      ['z', { x: 80, y: -30, width: 40, height: 60 }], // foreign, over the free mid seg
    ]);
    for (let i = 0; i < 40; i++) step(w, { routingRects: rects, nodePad: 12, fissionEnabled: false });
    assert.ok(w.edgeIndex.get('XY').segments.length < 6, 'free segment should slide, not cascade-split');
  });
});
