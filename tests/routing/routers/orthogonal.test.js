import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { router } from '../../../src/routing/routers/orthogonal.js';

function build(srcAt, tgtAt) {
  return {
    ir: { edges: [{ id: 'e1', source: 'a', target: 'b', layers: [] }] },
    positions: new Map([
      ['a', { x: srcAt.x, y: srcAt.y, width: 100, height: 40 }],
      ['b', { x: tgtAt.x, y: tgtAt.y, width: 100, height: 40 }],
    ]),
  };
}

describe('orthogonal router', () => {
  test('horizontal flow yields 4 points (start, mid, mid, end)', () => {
    const { ir, positions } = build({ x: 0, y: 0 }, { x: 400, y: 50 });
    const e = router.route(ir, positions).get('e1');
    assert.equal(e.points.length, 4);
  });

  test('every segment is axis-aligned', () => {
    const { ir, positions } = build({ x: 0, y: 0 }, { x: 400, y: 200 });
    const pts = router.route(ir, positions).get('e1').points;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      assert.ok(dx === 0 || dy === 0, `segment ${i} is not axis-aligned: dx=${dx} dy=${dy}`);
    }
  });

  test('vertical-dominant geometry exits top/bottom', () => {
    const { ir, positions } = build({ x: 0, y: 0 }, { x: 30, y: 500 });
    const e = router.route(ir, positions).get('e1');
    // Source anchor should be on bottom edge (y = 0 + 40)
    assert.equal(e.sourceAnchor.y, 40);
  });

  test('midline is the midpoint of anchors (not of centers)', () => {
    // Wide rect on the left, narrow on the right. If midX were
    // computed from CENTERS, it would fall inside the wide rect and
    // cause a U-turn. Averaging the ANCHORS keeps the midline in the
    // gap between the two rects.
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', layers: [] }] };
    const positions = new Map([
      ['a', { x: 0,   y: 0, width: 400, height: 40 }],
      ['b', { x: 600, y: 0, width: 100, height: 40 }],
    ]);
    const e = router.route(ir, positions).get('e1');
    assert.equal(e.sourceAnchor.x, 400);
    assert.equal(e.targetAnchor.x, 600);
    const midX = e.points[1].x;
    assert.ok(midX > 400 && midX < 600,
      `midX=${midX} should be in the gap (400, 600), not inside source`);
  });
});
