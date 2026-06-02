import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { router } from '../../../src/routing/routers/straight.js';

const ir = {
  edges: [{ id: 'e1', source: 'a', target: 'b', layers: [] }],
};
const positions = new Map([
  ['a', { x: 0, y: 0, width: 100, height: 40 }],
  ['b', { x: 300, y: 100, width: 100, height: 40 }],
]);

describe('straight router', () => {
  test('produces 2-point polyline', () => {
    const out = router.route(ir, positions);
    const e = out.get('e1');
    assert.equal(e.points.length, 2);
  });

  test('source anchor sits on source rect edge', () => {
    const e = router.route(ir, positions).get('e1');
    const a = positions.get('a');
    // Should sit on right or bottom edge of a
    const onRight = Math.abs(e.sourceAnchor.x - (a.x + a.width)) < 1e-6;
    const onBottom = Math.abs(e.sourceAnchor.y - (a.y + a.height)) < 1e-6;
    assert.ok(onRight || onBottom);
  });

  test('skips edges with missing endpoints', () => {
    const partial = new Map([['a', positions.get('a')]]);
    const out = router.route(ir, partial);
    assert.equal(out.size, 0);
  });
});
