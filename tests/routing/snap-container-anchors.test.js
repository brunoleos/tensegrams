import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { snapContainerEndpointsExternal } from '../../src/routing/snap-container-anchors.js';

function buildScenario({ nodes, edges, rects, routedEdges, meta }) {
  const ir = { nodes, edges, meta: meta || { snapContainerAnchor: true } };
  const rectMap = new Map(Object.entries(rects));
  const reMap = new Map(Object.entries(routedEdges));
  const ancestors = new Map();
  for (const n of nodes) {
    const set = new Set();
    let cur = n.parent;
    while (cur) {
      set.add(cur);
      cur = nodes.find(x => x.id === cur)?.parent;
    }
    ancestors.set(n.id, set);
  }
  return { ir, rectMap, reMap, ancestors };
}

describe('snapContainerEndpointsExternal', () => {
  test('leaf → container, other endpoint OUTSIDE on the right: anchor lands on east face', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'inherit' }],
      rects: {
        c: { x: 0,   y: 0,   width: 100, height: 100 },
        a: { x: 200, y: 30,  width: 40,  height: 40 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 220, y: 50 }, { x: 0, y: 50 }],
          sourceAnchor: { x: 220, y: 50 },
          targetAnchor: { x: 0, y: 50 },
        },
      },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    const tgt = out.get('e1').points[1];
    assert.equal(tgt.x, 100, 'target anchor must be on east face of c');
    assert.equal(tgt.y, 50);
  });

  test('leaf → container, other endpoint OUTSIDE above: anchor lands on north face', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'inherit' }],
      rects: {
        c: { x: 0,  y: 100, width: 100, height: 100 },
        a: { x: 30, y: 0,   width: 40,  height: 40 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 50, y: 40 }, { x: 50, y: 200 }],
          sourceAnchor: { x: 50, y: 40 },
          targetAnchor: { x: 50, y: 200 },
        },
      },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    const tgt = out.get('e1').points[1];
    assert.equal(tgt.y, 100, 'target anchor must be on north face of c');
    assert.equal(tgt.x, 50);
  });

  test('leaf → container, other endpoint visually INSIDE the container: anchor still lands on the face nearest the other center', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'inherit' }],
      rects: {
        c: { x: 0,  y: 0,  width: 100, height: 100 },
        a: { x: 10, y: 40, width: 20,  height: 20 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 20, y: 50 }, { x: 100, y: 50 }],
          sourceAnchor: { x: 20, y: 50 },
          targetAnchor: { x: 100, y: 50 },
        },
      },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    const tgt = out.get('e1').points[1];
    assert.equal(tgt.x, 0);
    assert.equal(tgt.y, 50);
  });

  test('edge container → descendant: rule does NOT fire, anchor preserved', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'c', parent: null,  hasChildren: true },
        { id: 'a', parent: 'c',   hasChildren: false },
      ],
      edges: [{ id: 'e1', source: 'c', target: 'a', snap: 'inherit' }],
      rects: {
        c: { x: 0,  y: 0,  width: 100, height: 100 },
        a: { x: 40, y: 40, width: 20,  height: 20 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 50, y: 60 }, { x: 50, y: 40 }],
          sourceAnchor: { x: 50, y: 60 },
          targetAnchor: { x: 50, y: 40 },
        },
      },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    assert.deepEqual(out.get('e1').points[0], { x: 50, y: 60 });
    assert.deepEqual(out.get('e1').points[1], { x: 50, y: 40 });
  });

  test('global off (meta.snapContainerAnchor=false) and edge snap=inherit: rule does NOT fire', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'inherit' }],
      rects: {
        c: { x: 0,   y: 0,   width: 100, height: 100 },
        a: { x: 200, y: 30,  width: 40,  height: 40 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 220, y: 50 }, { x: 0, y: 50 }],
          sourceAnchor: { x: 220, y: 50 },
          targetAnchor: { x: 0, y: 50 },
        },
      },
      meta: { snapContainerAnchor: false },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    assert.deepEqual(out.get('e1').points[1], { x: 0, y: 50 });
  });

  test('global off but edge snap=on: edge override forces the rule to fire', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'on' }],
      rects: {
        c: { x: 0,   y: 0,   width: 100, height: 100 },
        a: { x: 200, y: 30,  width: 40,  height: 40 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 220, y: 50 }, { x: 0, y: 50 }],
          sourceAnchor: { x: 220, y: 50 },
          targetAnchor: { x: 0, y: 50 },
        },
      },
      meta: { snapContainerAnchor: false },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    assert.equal(out.get('e1').points[1].x, 100, 'snap=on overrides global off');
  });

  test('global on but edge snap=off: edge override skips the rule', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'off' }],
      rects: {
        c: { x: 0,   y: 0,   width: 100, height: 100 },
        a: { x: 200, y: 30,  width: 40,  height: 40 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 220, y: 50 }, { x: 0, y: 50 }],
          sourceAnchor: { x: 220, y: 50 },
          targetAnchor: { x: 0, y: 50 },
        },
      },
      meta: { snapContainerAnchor: true },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    assert.deepEqual(out.get('e1').points[1], { x: 0, y: 50 });
  });

  test('orthogonal polyline: adjacent waypoint aligns to the new anchor to keep the leg orthogonal', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'c', snap: 'inherit' }],
      rects: {
        c: { x: 0,   y: 0,   width: 100, height: 100 },
        a: { x: 200, y: 30,  width: 40,  height: 40 },
      },
      routedEdges: {
        e1: {
          points: [
            { x: 200, y: 50 },
            { x: 100, y: 50 },
            { x: 100, y: 60 },
            { x: 0,   y: 60 },
          ],
          sourceAnchor: { x: 200, y: 50 },
          targetAnchor: { x: 0,   y: 60 },
        },
      },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    const points = out.get('e1').points;
    const tgt = points[points.length - 1];
    const neighbor = points[points.length - 2];
    assert.equal(tgt.x, 100, 'target anchor on east face');
    assert.equal(neighbor.y, tgt.y, 'neighbour aligned with target y');
  });

  test('both endpoints are containers, neither is ancestor of the other: rule fires on both sides', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'p', parent: null, hasChildren: true },
        { id: 'q', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'p', target: 'q', snap: 'inherit' }],
      rects: {
        p: { x: 0,   y: 0, width: 100, height: 100 },
        q: { x: 300, y: 0, width: 100, height: 100 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 0, y: 50 }, { x: 400, y: 50 }],
          sourceAnchor: { x: 0, y: 50 },
          targetAnchor: { x: 400, y: 50 },
        },
      },
    });
    const out = snapContainerEndpointsExternal(ir, reMap, rectMap, ancestors);
    const points = out.get('e1').points;
    assert.equal(points[0].x, 100, 'source on east face of p');
    assert.equal(points[1].x, 300, 'target on west face of q');
  });
});
