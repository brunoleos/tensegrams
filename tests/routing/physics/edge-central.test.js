import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeCornerBody } from '../../../src/routing/physics/bodies.js';
import {
  applyEdgeCentralForce,
  K_EDGE_CENTRAL,
} from '../../../src/routing/physics/forces-edge-central.js';
import { intersectRayWithPerimeter, midpointOfCenters, rectCenter } from '../../../src/routing/anchor-utils.js';
import { step } from '../../../src/routing/physics/solver.js';

function fakeWorld(infoMap) {
  return { bodies: [], edgeIndex: new Map(Object.entries(infoMap)) };
}

describe('applyEdgeCentralForce (P3)', () => {
  test('source anchor with rect is pulled toward edgeCenter', () => {
    const rectS = { x: 0, y: 0, width: 40, height: 40 };
    const rectT = { x: 200, y: 0, width: 40, height: 40 };
    const center = midpointOfCenters(rectS, rectT);  // (120, 20)
    // Anchor sits on the WEST face at (0, 30) — far from center horizontally.
    const a = makeCornerBody({ id: 'A', x: 0, y: 30, pinned: true, rect: rectS, anchorSide: 'source' });
    const b = makeCornerBody({ id: 'B', x: 200, y: 30, pinned: true, rect: rectT, anchorSide: 'target' });
    const world = fakeWorld({
      e1: { corners: [a, b], edgeCenter: center, snapTarget: { source: null, target: null } },
    });
    a.fx = 0; a.fy = 0; b.fx = 0; b.fy = 0;
    applyEdgeCentralForce(world, {});
    // Force on A: -k * (0 - 120) = +k*120 (east) ; -k * (30 - 20) = -k*10 (north).
    assert.ok(a.fx > 0, `expected positive fx (eastward), got ${a.fx}`);
    assert.ok(a.fy < 0, `expected negative fy (northward), got ${a.fy}`);
    // Force on B: -k * (200 - 120) = -k*80 (west).
    assert.ok(b.fx < 0, `expected negative fx (westward), got ${b.fx}`);
  });

  test('snap target overrides edgeCenter for the side it is set on', () => {
    const rectS = { x: 0, y: 0, width: 40, height: 40 };
    const rectT = { x: 200, y: 0, width: 40, height: 40 };
    const center = midpointOfCenters(rectS, rectT);
    const snapPt = { x: 100, y: 50 };  // arbitrary target for source endpoint
    const a = makeCornerBody({ id: 'A', x: 0, y: 30, pinned: true, rect: rectS, anchorSide: 'source' });
    const b = makeCornerBody({ id: 'B', x: 200, y: 30, pinned: true, rect: rectT, anchorSide: 'target' });
    const world = fakeWorld({
      e1: { corners: [a, b], edgeCenter: center, snapTarget: { source: snapPt, target: null } },
    });
    a.fx = 0; a.fy = 0; b.fx = 0; b.fy = 0;
    applyEdgeCentralForce(world, {});
    // A pulled toward snap (100, 50), not center (120, 20).
    // fx = -k * (0 - 100) = +100k
    // fy = -k * (30 - 50) = +20k
    assert.ok(Math.abs(a.fx - K_EDGE_CENTRAL * 100) < 1e-9);
    assert.ok(Math.abs(a.fy - K_EDGE_CENTRAL * 20) < 1e-9);
    // B still pulled toward center.
    assert.ok(b.fx < 0);
  });

  test('anchor without rect (legacy pin) is ignored', () => {
    const a = makeCornerBody({ id: 'A', x: 0, y: 30, pinned: true });   // no rect
    const center = { x: 100, y: 100 };
    const world = fakeWorld({
      e1: { corners: [a, a], edgeCenter: center, snapTarget: null },
    });
    a.fx = 0; a.fy = 0;
    applyEdgeCentralForce(world, {});
    assert.equal(a.fx, 0);
    assert.equal(a.fy, 0);
  });

  test('curve edges are skipped', () => {
    const a = makeCornerBody({ id: 'A', x: 0, y: 0, pinned: true, rect: { x: 0, y: 0, width: 40, height: 40 }, anchorSide: 'source' });
    const world = fakeWorld({
      e1: { corners: [a, a], edgeCenter: { x: 100, y: 100 }, snapTarget: null, kind: 'curve' },
    });
    a.fx = 0; a.fy = 0;
    applyEdgeCentralForce(world, {});
    assert.equal(a.fx, 0);
  });

  test('k = 0 disables the force', () => {
    const a = makeCornerBody({ id: 'A', x: 0, y: 0, pinned: true, rect: { x: 0, y: 0, width: 40, height: 40 }, anchorSide: 'source' });
    const world = fakeWorld({
      e1: { corners: [a, a], edgeCenter: { x: 100, y: 100 }, snapTarget: null },
    });
    a.fx = 0; a.fy = 0;
    applyEdgeCentralForce(world, { kEdgeCentral: 0 });
    assert.equal(a.fx, 0);
  });
});

describe('integration: anchor converges to closest perimeter point to edgeCenter', () => {
  test('source anchor slides along the perimeter toward the point closest to edgeCenter', () => {
    const rectS = { x: 0, y: 0, width: 40, height: 40 };       // center (20, 20)
    const rectT = { x: 200, y: 100, width: 40, height: 40 };   // center (220, 120)
    const edgeCenter = midpointOfCenters(rectS, rectT);         // (120, 70)
    // Warm-start lives in the intersection of the perimeter with the
    // ray from the node center to edgeCenter: hits east face (x=40) at
    // (40, 30). Under elastic central force the equilibrium drifts to
    // the closest perimeter point — for rectS that's the SE corner
    // (40, 40), distance √(80² + 30²) = √7300.
    const warm = intersectRayWithPerimeter(rectS, rectCenter(rectS), edgeCenter);
    assert.deepEqual(warm, { x: 40, y: 30 });

    const a = makeCornerBody({ id: 'A', x: warm.x, y: warm.y, pinned: true, rect: rectS, anchorSide: 'source' });
    a.face = 'east';
    const b = makeCornerBody({ id: 'B', x: 200, y: 120, pinned: true, rect: rectT, anchorSide: 'target' });
    b.face = 'west';
    const world = {
      bodies: [a, b],
      edgeIndex: new Map([
        ['e1', {
          corners: [a, b],
          segments: [],
          edgeCenter,
          snapTarget: { source: null, target: null },
        }],
      ]),
    };
    for (let i = 0; i < 200; i++) step(world, { kEdgeCentral: 0.04 });
    // Anchor a converges to closest perimeter point to (120, 70) = (40, 40).
    assert.ok(Math.abs(a.x - 40) < 0.5, `a.x converged to ${a.x}, expected 40`);
    assert.ok(Math.abs(a.y - 40) < 0.5, `a.y converged to ${a.y}, expected 40`);
    // b's closest point to (120, 70) on rectT perimeter: face west (x=200),
    // y clamped to [100, 140]. Closest to y=70 is y=100. → (200, 100).
    assert.ok(Math.abs(b.x - 200) < 0.5);
    assert.ok(Math.abs(b.y - 100) < 0.5);
  });

  test('snap target overrides convergence point for that endpoint', () => {
    const rectS = { x: 0, y: 0, width: 40, height: 40 };
    const rectT = { x: 200, y: 100, width: 40, height: 40 };
    const edgeCenter = midpointOfCenters(rectS, rectT);
    // Snap pins source to (40, 10) — anchor should converge there.
    const snapPt = { x: 40, y: 10 };
    const a = makeCornerBody({ id: 'A', x: 40, y: 30, pinned: true, rect: rectS, anchorSide: 'source' });
    a.face = 'east';
    const b = makeCornerBody({ id: 'B', x: 200, y: 120, pinned: true, rect: rectT, anchorSide: 'target' });
    b.face = 'west';
    const world = {
      bodies: [a, b],
      edgeIndex: new Map([
        ['e1', {
          corners: [a, b],
          segments: [],
          edgeCenter,
          snapTarget: { source: snapPt, target: null },
        }],
      ]),
    };
    for (let i = 0; i < 200; i++) step(world, { kEdgeCentral: 0.04 });
    assert.ok(Math.abs(a.x - 40) < 0.5);
    assert.ok(Math.abs(a.y - 10) < 0.5, `a.y converged to ${a.y}, expected 10 (snap)`);
  });
});
