import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeCornerBody, makeSegmentBody } from '../../../src/routing/physics/bodies.js';
import {
  applyNodeRepulsion,
  applyParallelRepulsion,
  applyPerpRepulsion,
} from '../../../src/routing/physics/forces.js';

function makeWorldWith2EdgesParallel() {
  // Dois segmentos horizontais sobrepostos em x, separados por 4px em y.
  const a1 = makeCornerBody({ id: 'a1', x: 0, y: 0, pinned: false });
  const a2 = makeCornerBody({ id: 'a2', x: 100, y: 0, pinned: false });
  const segA = makeSegmentBody({ id: 'A#s0', orientation: 'h', prevCorner: a1, nextCorner: a2 });
  const b1 = makeCornerBody({ id: 'b1', x: 0, y: 4, pinned: false });
  const b2 = makeCornerBody({ id: 'b2', x: 100, y: 4, pinned: false });
  const segB = makeSegmentBody({ id: 'B#s0', orientation: 'h', prevCorner: b1, nextCorner: b2 });
  const bodies = [a1, a2, segA, b1, b2, segB];
  const edgeIndex = new Map([
    ['A', { edge: { id: 'A' }, corners: [a1, a2], segments: [segA] }],
    ['B', { edge: { id: 'B' }, corners: [b1, b2], segments: [segB] }],
  ]);
  return { bodies, edgeIndex };
}

function makeWorldWith2EdgesCrossing() {
  // A horizontal em y=0, B vertical em x=50.
  const a1 = makeCornerBody({ id: 'a1', x: 0, y: 0, pinned: false });
  const a2 = makeCornerBody({ id: 'a2', x: 100, y: 0, pinned: false });
  const segA = makeSegmentBody({ id: 'A#s0', orientation: 'h', prevCorner: a1, nextCorner: a2 });
  const b1 = makeCornerBody({ id: 'b1', x: 50, y: -50, pinned: false });
  const b2 = makeCornerBody({ id: 'b2', x: 50, y: 50, pinned: false });
  const segB = makeSegmentBody({ id: 'B#s0', orientation: 'v', prevCorner: b1, nextCorner: b2 });
  const bodies = [a1, a2, segA, b1, b2, segB];
  const edgeIndex = new Map([
    ['A', { edge: { id: 'A' }, corners: [a1, a2], segments: [segA] }],
    ['B', { edge: { id: 'B' }, corners: [b1, b2], segments: [segB] }],
  ]);
  return { bodies, edgeIndex };
}

describe('applyParallelRepulsion filter (P7)', () => {
  test('with resolver returning null for the pair → no force', () => {
    const w = makeWorldWith2EdgesParallel();
    const resolver = { edgeEdgePair: () => null };
    for (const b of w.bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyParallelRepulsion(w, { resolver });
    for (const b of w.bodies) {
      if (b.kind === 'corner') {
        assert.equal(b.fy, 0, `body ${b.id} should be unforced`);
      }
    }
  });

  test('with resolver returning non-null for the pair → force applied', () => {
    const w = makeWorldWith2EdgesParallel();
    const resolver = { edgeEdgePair: () => ({ shared: ['L'], frac: { a: 0.5, b: 0.5 } }) };
    for (const b of w.bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyParallelRepulsion(w, { resolver });
    // At least one body should have fy != 0.
    const moved = w.bodies.some(b => b.kind === 'corner' && b.fy !== 0);
    assert.ok(moved, 'expected parallel repulsion to apply force when layers match');
  });

  test('without resolver: legacy behaviour (push every parallel pair)', () => {
    const w = makeWorldWith2EdgesParallel();
    for (const b of w.bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyParallelRepulsion(w, {});
    const moved = w.bodies.some(b => b.kind === 'corner' && b.fy !== 0);
    assert.ok(moved, 'legacy mode pushes regardless of layers');
  });
});

describe('applyPerpRepulsion filter + spare-blanket removed (P7)', () => {
  test('with edgePair function: applies force on crossing pair', () => {
    const w = makeWorldWith2EdgesCrossing();
    for (const b of w.bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyPerpRepulsion(w, { edgePair: () => ({ frac: { a: 0.5, b: 0.5 } }) });
    const moved = w.bodies.some(b => b.kind === 'corner' && (b.fx !== 0 || b.fy !== 0));
    assert.ok(moved, 'expected perp repulsion to act');
  });

  test('no edgePair function: no-op (legacy / undeclared layers)', () => {
    const w = makeWorldWith2EdgesCrossing();
    for (const b of w.bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyPerpRepulsion(w, {});
    for (const b of w.bodies) {
      if (b.kind === 'corner') {
        assert.equal(b.fx, 0);
        assert.equal(b.fy, 0);
      }
    }
  });

  test('shared-node spare-blanket removed: crossings near shared anchors are now resolved', () => {
    // 2 edges sharing endpoint at origin, with segments that cross in the
    // interior (NOT at the shared vertex itself).
    const sa = makeCornerBody({ id: 'sa', x: 0, y: 0, pinned: true });
    const ma1 = makeCornerBody({ id: 'ma1', x: 100, y: 5, pinned: false });
    // segA goes from (0, 0) horizontally — wait, prev/next have different y;
    // we want a horizontal segment at y=5 to cross a vertical segment at x=20.
    const ah = makeCornerBody({ id: 'ah', x: 0, y: 5, pinned: false });
    const segA = makeSegmentBody({ id: 'A#s0', orientation: 'h', prevCorner: ah, nextCorner: ma1 });
    const sb = makeCornerBody({ id: 'sb', x: 20, y: 30, pinned: true });
    const bv = makeCornerBody({ id: 'bv', x: 20, y: -30, pinned: false });
    const segB = makeSegmentBody({ id: 'B#s0', orientation: 'v', prevCorner: sb, nextCorner: bv });
    const bodies = [sa, ma1, ah, segA, sb, bv, segB];
    const edgeIndex = new Map([
      ['A', { edge: { id: 'A' }, corners: [sa, ah, ma1], segments: [segA] }],
      ['B', { edge: { id: 'B' }, corners: [sb, bv], segments: [segB] }],
    ]);
    const w = { bodies, edgeIndex };
    for (const b of bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    // Pair carries sharedNodes (legacy spare hint) — blanket was removed,
    // so this should now act regardless.
    applyPerpRepulsion(w, {
      edgePair: () => ({ frac: { a: 0.5, b: 0.5 }, sharedNodes: ['x'] }),
    });
    // segA horizontal: cH=5, hx0=0, hx1=100. segB vertical: cV=20, vy0=-30, vy1=30.
    // crossing check: 0 < 20 < 100 ✓, -30 < 5 < 30 ✓ → DOES cross.
    const moved = bodies.some(b => b.kind === 'corner' && (b.fx !== 0 || b.fy !== 0));
    assert.ok(moved, 'spare blanket removed: shared-anchor crossings are separated');
  });
});

describe('applyNodeRepulsion filter (existing behaviour — sanity)', () => {
  test('edgeNodePair returning null skips the foreign node', () => {
    const a1 = makeCornerBody({ id: 'a1', x: 0, y: 0, pinned: false });
    const a2 = makeCornerBody({ id: 'a2', x: 100, y: 0, pinned: false });
    const segA = makeSegmentBody({ id: 'A#s0', orientation: 'h', prevCorner: a1, nextCorner: a2 });
    const bodies = [a1, a2, segA];
    const edgeIndex = new Map([
      ['A', { edge: { id: 'A' }, corners: [a1, a2], segments: [segA], allowedNodeIds: new Set() }],
    ]);
    const w = { bodies, edgeIndex };
    const rects = new Map([['n', { x: 40, y: -10, width: 20, height: 20 }]]);
    for (const b of bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyNodeRepulsion(w, rects, { resolver: { edgeNodePair: () => null } });
    assert.equal(a1.fy, 0);
    assert.equal(a2.fy, 0);
  });

  test('without resolver: legacy push always applies', () => {
    const a1 = makeCornerBody({ id: 'a1', x: 0, y: 0, pinned: false });
    const a2 = makeCornerBody({ id: 'a2', x: 100, y: 0, pinned: false });
    const segA = makeSegmentBody({ id: 'A#s0', orientation: 'h', prevCorner: a1, nextCorner: a2 });
    const bodies = [a1, a2, segA];
    const edgeIndex = new Map([
      ['A', { edge: { id: 'A' }, corners: [a1, a2], segments: [segA], allowedNodeIds: new Set() }],
    ]);
    const w = { bodies, edgeIndex };
    const rects = new Map([['n', { x: 40, y: -10, width: 20, height: 20 }]]);
    for (const b of bodies) { if (b.kind === 'corner') { b.fx = 0; b.fy = 0; } }
    applyNodeRepulsion(w, rects, {});
    assert.ok(a1.fy !== 0 || a2.fy !== 0, 'legacy pushes when foreign node overlaps');
  });
});
