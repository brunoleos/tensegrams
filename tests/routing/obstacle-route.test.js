import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyObstacleRouting, hananRoute } from '../../src/routing/obstacle-route.js';
import { buildCollisionResolver } from '../../src/layout/collision.js';

function spec(o) { return new Map(Object.entries(o || {})); }
function node(id, collision, extra = {}) {
  return { id, hasChildren: false, nodeCollision: spec(collision), ...extra };
}
function edge(id, source, target, opts = {}) {
  return {
    id, source, target,
    nodeCollision: spec(opts.nodeCollision),
    edgeCollision: spec(opts.edgeCollision),
  };
}
function mkIr(nodes, edges) {
  return { nodes, edges, layers: [], meta: {}, errors: [] };
}

// True when an axis-aligned segment p→q passes through the interior of r.
function segHitsRect(p, q, r) {
  const x0 = r.x, x1 = r.x + r.width, y0 = r.y, y1 = r.y + r.height;
  if (Math.abs(p.y - q.y) < 1e-6) {
    if (p.y <= y0 || p.y >= y1) return false;
    return Math.max(p.x, q.x) > x0 && Math.min(p.x, q.x) < x1;
  }
  if (Math.abs(p.x - q.x) < 1e-6) {
    if (p.x <= x0 || p.x >= x1) return false;
    return Math.max(p.y, q.y) > y0 && Math.min(p.y, q.y) < y1;
  }
  return false;
}

describe('hananRoute — A* over Hanan grid', () => {
  test('no obstacles → null (caller keeps the original)', () => {
    assert.equal(hananRoute({ x: 0, y: 0 }, { x: 200, y: 0 }, []), null);
  });

  test('routes around a blocking obstacle', () => {
    const obs = [{ x: 80, y: -50, width: 40, height: 100 }];
    const path = hananRoute({ x: 0, y: 0 }, { x: 200, y: 0 }, obs);
    assert.ok(path && path.length >= 2);
    assert.deepEqual(path[0], { x: 0, y: 0 });
    assert.deepEqual(path[path.length - 1], { x: 200, y: 0 });
    for (let i = 0; i + 1 < path.length; i++) {
      assert.equal(segHitsRect(path[i], path[i + 1], obs[0]), false,
        `segment ${i} crosses the obstacle`);
    }
  });

  test('deterministic — same input twice → identical path', () => {
    const obs = [{ x: 80, y: -50, width: 40, height: 100 }];
    const a = hananRoute({ x: 0, y: 0 }, { x: 200, y: 0 }, obs);
    const b = hananRoute({ x: 0, y: 0 }, { x: 200, y: 0 }, obs);
    assert.deepEqual(a, b);
  });

  test('returns null when the source is engulfed', () => {
    const obs = [{ x: -10, y: -10, width: 100, height: 100 }];
    assert.equal(hananRoute({ x: 0, y: 0 }, { x: 200, y: 0 }, obs), null);
  });
});

describe('applyObstacleRouting', () => {
  test('edge without collision labels is left untouched', () => {
    const ir = mkIr([node('a'), node('b')], [edge('e1', 'a', 'b')]);
    const resolver = buildCollisionResolver(ir);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), new Map(), resolver, {});
    assert.equal(out.get('e1'), re);
  });

  test('edge detours around a node sharing its collision label', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('blocker', { wire: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { wire: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const rects = new Map([
      ['a', { x: -20, y: -20, width: 40, height: 40 }],
      ['b', { x: 180, y: -20, width: 40, height: 40 }],
      ['blocker', { x: 80, y: -50, width: 40, height: 100 }],
    ]);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), rects, resolver, { nodePad: 0 });
    const result = out.get('e1');
    assert.ok(result.points.length > 2, 'expected a detour with bends');
    for (let i = 0; i + 1 < result.points.length; i++) {
      assert.equal(segHitsRect(result.points[i], result.points[i + 1], rects.get('blocker')),
        false, `segment ${i} crosses the blocker`);
    }
  });

  test('keeps the original route when no path is found', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('blk', { w: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { w: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const rects = new Map([['blk', { x: -10, y: -10, width: 100, height: 100 }]]);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), rects, resolver, { nodePad: 0 });
    assert.deepEqual(out.get('e1').points, [{ x: 0, y: 0 }, { x: 200, y: 0 }]);
  });

  test('splices live waypoints into the polyline', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('c', { w: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { w: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const rects = new Map([
      ['a', { x: -20, y: -20, width: 40, height: 40 }],
      ['b', { x: 180, y: -20, width: 40, height: 40 }],
    ]);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const wps = new Map([['e1', [{ x: 100, y: -80 }]]]);
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), rects, resolver,
      { edgeWaypoints: wps });
    assert.ok(out.get('e1').points.some(p => p.x === 100 && p.y === -80));
  });

  test('curved edge becomes a spline when detoured', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('blocker', { wire: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { wire: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const rects = new Map([
      ['blocker', { x: 80, y: -50, width: 40, height: 100 }],
    ]);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], kind: 'curve',
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), rects, resolver, { nodePad: 0 });
    assert.equal(out.get('e1').kind, 'spline');
  });

  test('orthogonal router keeps every detour segment axis-aligned', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('c', { w: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { w: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const rects = new Map([
      ['a', { x: -20, y: -20, width: 40, height: 40 }],
      ['b', { x: 180, y: -20, width: 40, height: 40 }],
    ]);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const wps = new Map([['e1', [{ x: 100, y: -80 }]]]);
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), rects, resolver,
      { edgeWaypoints: wps, orthogonal: true });
    const pts = out.get('e1').points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const aligned = Math.abs(pts[i].x - pts[i + 1].x) < 1e-6
                   || Math.abs(pts[i].y - pts[i + 1].y) < 1e-6;
      assert.ok(aligned, `segment ${i} is not axis-aligned`);
    }
  });

  test('curved edge keeps its Bezier when the waypoint needs no detour', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('c', { w: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { w: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const re = { kind: 'curve',
                 points: [{ x: 0, y: 0 }, { x: 60, y: 20 }, { x: 140, y: 20 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    // Waypoint sits on the straight anchor line — no real detour.
    const wps = new Map([['e1', [{ x: 100, y: 0 }]]]);
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), new Map(), resolver,
      { edgeWaypoints: wps });
    assert.equal(out.get('e1'), re, 'curve must not collapse to a straight line');
  });

  test('a label-sharing node off the straight path triggers no reroute', () => {
    const ir = mkIr(
      [node('a'), node('b'), node('far', { w: 0 })],
      [edge('e1', 'a', 'b', { nodeCollision: { w: 0 } })],
    );
    const resolver = buildCollisionResolver(ir);
    const rects = new Map([['far', { x: 40, y: 200, width: 40, height: 40 }]]);
    const re = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
                 sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 200, y: 0 } };
    const out = applyObstacleRouting(ir, new Map([['e1', re]]), rects, resolver, { nodePad: 12 });
    assert.equal(out.get('e1'), re, 'clear straight path must be left untouched');
  });
});
