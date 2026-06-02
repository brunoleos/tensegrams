// midPoint contract — single source of truth shared by the renderer
// (src/renderer/edges.js places the edge label here) and the live
// collision adapter (src/layout/adapters/live/collision-waypoints.js
// computes the labelRect centred here). If this test changes, both
// callers MUST be re-evaluated.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { midPoint } from '../../src/routing/geometry.js';

describe('midPoint', () => {
  test('2 points → arithmetic mean', () => {
    assert.deepEqual(midPoint([{x:0,y:0}, {x:10,y:20}]), {x:5, y:10});
  });
  test('3 points → middle vertex', () => {
    const pts = [{x:0,y:0}, {x:5,y:7}, {x:10,y:20}];
    assert.deepEqual(midPoint(pts), {x:5, y:7});
  });
  test('5 points → middle vertex (index 2)', () => {
    const pts = [{x:0,y:0}, {x:1,y:1}, {x:5,y:5}, {x:9,y:9}, {x:10,y:10}];
    assert.deepEqual(midPoint(pts), {x:5, y:5});
  });
  test('4 points (even) → mean of middle two', () => {
    const pts = [{x:0,y:0}, {x:4,y:4}, {x:6,y:6}, {x:10,y:10}];
    assert.deepEqual(midPoint(pts), {x:5, y:5});
  });
  test('empty → origin', () => {
    assert.deepEqual(midPoint([]), {x:0, y:0});
  });
  test('1 point → that point', () => {
    assert.deepEqual(midPoint([{x:7,y:3}]), {x:7, y:3});
  });
});
