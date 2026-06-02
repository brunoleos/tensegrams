// Unit tests for the geometry-invariant detectors used by
// e2e/debug-snapshot.js (--assert mode). Each detector is exercised
// with a positive and a negative case so regressions are caught both
// ways — a detector that silently stops firing is as bad as one that
// false-positives.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertGeometryInvariants,
  checkPerpendicularEndpoints,
  checkInteriorOutsideEndpoints,
  checkCollinearRedundancy,
} from '../e2e/invariants.js';

const RECT_A = { x: 0,   y: 0,   width: 100, height: 50 };
const RECT_B = { x: 300, y: 100, width: 100, height: 50 };

describe('checkPerpendicularEndpoints (B6 detector)', () => {
  test('positive: source east face + horizontal first leg → clean', () => {
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:100,y:25}, {x:200,y:25}, {x:200,y:125}, {x:300,y:125}] };
    const issues = checkPerpendicularEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.deepEqual(issues, [], `expected no issues, got: ${issues.join('; ')}`);
  });

  test('negative: source east face + vertical first leg (tangent) → flagged', () => {
    // Anchor on east face — first leg should be horizontal. But here
    // the first leg goes vertically (200→200, 25→125) which is tangent
    // to the east face. enforcePerpendicularLegs failed here.
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:100,y:25}, {x:100,y:125}, {x:300,y:125}] };
    const issues = checkPerpendicularEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.equal(issues.length, 1, `expected 1 issue, got ${issues.length}: ${issues.join('; ')}`);
    assert.match(issues[0], /tangent to source face "east"/);
  });

  test('negative: target north face + horizontal last leg → flagged', () => {
    // Target on north face — last leg should be vertical. Here last
    // leg is horizontal: (250,100)→(350,100) is tangent to north.
    // Anchor at x=350 (mid-face) avoids the corner ambiguity at x=300/400.
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:50,y:50}, {x:250,y:100}, {x:350,y:100}] };
    const issues = checkPerpendicularEndpoints(edge, edge.points, null, RECT_B);
    assert.equal(issues.length, 1, `got: ${issues.join('; ')}`);
    assert.match(issues[0], /tangent to target face "north"/);
  });

  test('skip: anchor not on perimeter (face undeterminable) → no false positive', () => {
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:50,y:25}, {x:200,y:25}, {x:300,y:125}] };  // p[0] at center of A
    const issues = checkPerpendicularEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.deepEqual(issues, []);
  });
});

describe('checkInteriorOutsideEndpoints (B7 detector)', () => {
  test('positive: interior points outside both endpoints → clean', () => {
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:100,y:25}, {x:200,y:25}, {x:200,y:125}, {x:300,y:125}] };
    const issues = checkInteriorOutsideEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.deepEqual(issues, []);
  });

  test('negative: interior point inside source → flagged', () => {
    // The A* polyline came out with a waypoint at (50, 25) — strictly
    // inside source RECT_A (0..100, 0..50). Classic B7.
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:100,y:25}, {x:50,y:25}, {x:200,y:125}, {x:300,y:125}] };
    const issues = checkInteriorOutsideEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.equal(issues.length, 1, `got: ${issues.join('; ')}`);
    assert.match(issues[0], /inside source/);
  });

  test('negative: interior point inside target → flagged', () => {
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:100,y:25}, {x:200,y:25}, {x:350,y:125}, {x:300,y:125}] };
    const issues = checkInteriorOutsideEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.equal(issues.length, 1, `got: ${issues.join('; ')}`);
    assert.match(issues[0], /inside target/);
  });

  test('endpoints on perimeter are NOT flagged (only interior counts)', () => {
    // p[0] sits on the east face of A — perimeter, not interior. p[N-1]
    // sits on the west face of B — perimeter too. Detector must not
    // misfire on endpoints.
    const edge = { id: 'e', source: 'A', target: 'B',
      points: [{x:100,y:25}, {x:200,y:25}, {x:200,y:125}, {x:300,y:125}] };
    const issues = checkInteriorOutsideEndpoints(edge, edge.points, RECT_A, RECT_B);
    assert.deepEqual(issues, []);
  });
});

describe('checkCollinearRedundancy (B8 detector)', () => {
  test('positive: 4-point Z with no redundancy → clean', () => {
    const edge = { id: 'e', points: [{x:0,y:0}, {x:50,y:0}, {x:50,y:50}, {x:100,y:50}] };
    const issues = checkCollinearRedundancy(edge, edge.points);
    assert.deepEqual(issues, []);
  });

  test('negative: duplicate consecutive points → flagged', () => {
    const edge = { id: 'e', points: [{x:0,y:0}, {x:50,y:0}, {x:50,y:0.1}, {x:100,y:0}] };
    const issues = checkCollinearRedundancy(edge, edge.points);
    assert.ok(issues.length >= 1, `expected dup flagged, got: ${issues.join('; ')}`);
    assert.match(issues.find(s => /duplicate/.test(s)) || '', /duplicate consecutive/);
  });

  test('negative: collinear interior point → flagged', () => {
    // (0,0) → (5,0) → (10,0): middle is collinear with neighbours.
    const edge = { id: 'e', points: [{x:0,y:0}, {x:5,y:0}, {x:10,y:0}] };
    const issues = checkCollinearRedundancy(edge, edge.points);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /collinear interior point 1/);
  });

  test('positive: sub-pixel kink above threshold → NOT flagged', () => {
    // A 1px kink at the middle point — cross-product non-trivial.
    const edge = { id: 'e', points: [{x:0,y:0}, {x:5,y:1}, {x:10,y:0}] };
    const issues = checkCollinearRedundancy(edge, edge.points);
    assert.deepEqual(issues, []);
  });
});

describe('assertGeometryInvariants (integration)', () => {
  test('clean layout → empty issues', () => {
    const issues = assertGeometryInvariants({
      positions: { A: RECT_A, B: RECT_B },
      edges: [{
        id: 'e1', source: 'A', target: 'B',
        points: [{x:100,y:25}, {x:200,y:25}, {x:200,y:125}, {x:300,y:125}],
      }],
    });
    assert.deepEqual(issues, []);
  });

  test('multi-bug layout: all three detectors fire', () => {
    const issues = assertGeometryInvariants({
      positions: { A: RECT_A, B: RECT_B },
      edges: [
        // B6: tangent first leg
        { id: 'bad-b6', source: 'A', target: 'B',
          points: [{x:100,y:25}, {x:100,y:125}, {x:300,y:125}] },
        // B7: interior inside source
        { id: 'bad-b7', source: 'A', target: 'B',
          points: [{x:100,y:25}, {x:50,y:25}, {x:200,y:125}, {x:300,y:125}] },
        // B8: collinear interior
        { id: 'bad-b8', source: 'A', target: 'B',
          points: [{x:100,y:25}, {x:150,y:25}, {x:200,y:25}, {x:200,y:125}, {x:300,y:125}] },
      ],
    });
    assert.ok(issues.some(s => /tangent to source/.test(s)), 'B6 detected');
    assert.ok(issues.some(s => /inside source/.test(s)), 'B7 detected');
    assert.ok(issues.some(s => /collinear interior/.test(s)), 'B8 detected');
  });

  test('edge with <2 points → flagged as degenerate', () => {
    const issues = assertGeometryInvariants({
      positions: { A: RECT_A, B: RECT_B },
      edges: [{ id: 'broken', source: 'A', target: 'B', points: [{x:0,y:0}] }],
    });
    assert.equal(issues.length, 1);
    assert.match(issues[0], /only 1 point/);
  });
});
