import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clipToRect, centerOf } from '../../src/routing/router.js';

describe('centerOf', () => {
  test('computes center of rect', () => {
    assert.deepEqual(centerOf({ x: 0, y: 0, width: 100, height: 40 }), { x: 50, y: 20 });
  });
});

describe('clipToRect', () => {
  const rect = { x: 0, y: 0, width: 100, height: 40 };

  test('clips horizontal exit to right edge', () => {
    const p = clipToRect(rect, 1000, 20);
    assert.ok(Math.abs(p.x - 100) < 1e-6);
  });

  test('clips horizontal exit to left edge', () => {
    const p = clipToRect(rect, -500, 20);
    assert.ok(Math.abs(p.x - 0) < 1e-6);
  });

  test('clips vertical exit to bottom', () => {
    const p = clipToRect(rect, 50, 9999);
    assert.ok(Math.abs(p.y - 40) < 1e-6);
  });

  test('zero direction returns center', () => {
    const p = clipToRect(rect, 50, 20);
    assert.equal(p.x, 50);
    assert.equal(p.y, 20);
  });
});
