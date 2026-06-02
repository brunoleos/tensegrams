import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createViewport, screenToWorld, worldToScreen, zoomAt, pan,
} from '../src/viewport.js';

test('createViewport returns identity', () => {
  const vp = createViewport();
  assert.deepEqual(vp, { x: 0, y: 0, zoom: 1 });
});

test('screen ↔ world inverse', () => {
  const vp = { x: 50, y: -30, zoom: 2 };
  const s = { x: 200, y: 100 };
  const w = screenToWorld(vp, s.x, s.y);
  const s2 = worldToScreen(vp, w.x, w.y);
  assert.ok(Math.abs(s2.x - s.x) < 1e-9);
  assert.ok(Math.abs(s2.y - s.y) < 1e-9);
});

test('zoomAt keeps the anchor point fixed', () => {
  const vp = { x: 0, y: 0, zoom: 1 };
  const before = screenToWorld(vp, 300, 200);
  zoomAt(vp, 300, 200, 2);
  const after = screenToWorld(vp, 300, 200);
  assert.ok(Math.abs(before.x - after.x) < 1e-6);
  assert.ok(Math.abs(before.y - after.y) < 1e-6);
});

test('zoomAt clamps to MIN/MAX zoom', () => {
  const vp = { x: 0, y: 0, zoom: 1 };
  for (let i = 0; i < 100; i++) zoomAt(vp, 0, 0, 2);
  assert.ok(vp.zoom <= 8);
  for (let i = 0; i < 100; i++) zoomAt(vp, 0, 0, 0.5);
  assert.ok(vp.zoom >= 0.1);
});

test('pan adds to viewport offset', () => {
  const vp = { x: 10, y: 20, zoom: 1 };
  pan(vp, 5, -3);
  assert.deepEqual(vp, { x: 15, y: 17, zoom: 1 });
});
