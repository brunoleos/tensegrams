import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { router } from '../../../src/routing/routers/curved.js';

const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', layers: [] }] };
const positions = new Map([
  ['a', { x: 0, y: 0, width: 100, height: 40 }],
  ['b', { x: 400, y: 200, width: 100, height: 40 }],
]);

describe('curved router', () => {
  test('emits a 4-point cubic Bezier', () => {
    const e = router.route(ir, positions).get('e1');
    assert.equal(e.points.length, 4);
    assert.equal(e.kind, 'curve');
  });

  test('endpoints are clipped to node rects', () => {
    const e = router.route(ir, positions).get('e1');
    const a = positions.get('a');
    const b = positions.get('b');
    assert.ok(e.points[0].x >= a.x && e.points[0].x <= a.x + a.width);
    assert.ok(e.points[3].x >= b.x && e.points[3].x <= b.x + b.width);
  });
});
