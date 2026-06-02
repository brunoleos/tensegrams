import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clipAnchorsToContainerFaces } from '../../src/routing/clip-anchors.js';

function buildScenario({ nodes, edges, rects, routedEdges }) {
  const ir = { nodes, edges };
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

describe('clipAnchorsToContainerFaces', () => {
  test('anchor outside every foreign container: no-op', () => {
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        a: { x: 0,   y: 0, width: 100, height: 50 },
        b: { x: 300, y: 0, width: 100, height: 50 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 100, y: 25 }, { x: 300, y: 25 }],
          sourceAnchor: { x: 100, y: 25 },
          targetAnchor: { x: 300, y: 25 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    assert.deepEqual(out.get('e1').points[0], { x: 100, y: 25 });
    assert.deepEqual(out.get('e1').points[1], { x: 300, y: 25 });
  });

  test('anchor inside a foreign container is projected to the nearest face', () => {
    // Edge a→b where b's anchor lands inside container c (not source,
    // target, or ancestor of either). The anchor must move to the
    // face of c facing the previous polyline point.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        a: { x: 0,   y: 0,   width: 50, height: 50 },
        b: { x: 200, y: 100, width: 50, height: 50 },
        c: { x: 100, y: 50,  width: 200, height: 200 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 50, y: 25 }, { x: 225, y: 125 }],
          sourceAnchor: { x: 50, y: 25 },
          targetAnchor: { x: 225, y: 125 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    const tgt = out.get('e1').points[1];
    const cRect = rectMap.get('c');
    const onPerimeter =
      Math.abs(tgt.x - cRect.x) < 1e-6 ||
      Math.abs(tgt.x - (cRect.x + cRect.width)) < 1e-6 ||
      Math.abs(tgt.y - cRect.y) < 1e-6 ||
      Math.abs(tgt.y - (cRect.y + cRect.height)) < 1e-6;
    assert.ok(onPerimeter, `target anchor ${JSON.stringify(tgt)} must be on perimeter of c ${JSON.stringify(cRect)}`);
  });

  test('anchor inside an ancestor container is preserved', () => {
    // a is a child of c. Edge a→b crosses c's interior at the source.
    // c is an ancestor of a, so c must NOT clip the anchor.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'c', parent: null, hasChildren: true },
        { id: 'a', parent: 'c', hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        c: { x: 0,   y: 0,   width: 300, height: 300 },
        a: { x: 50,  y: 50,  width: 50,  height: 50 },
        b: { x: 400, y: 100, width: 50,  height: 50 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 100, y: 75 }, { x: 400, y: 125 }],
          sourceAnchor: { x: 100, y: 75 },
          targetAnchor: { x: 400, y: 125 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    assert.deepEqual(out.get('e1').points[0], { x: 100, y: 75 });
  });

  test('anchor inside a leaf (not a container) is not clipped', () => {
    // Leaves cannot "engulf" anchors of unrelated edges; only
    // containers do. The post-processor ignores leaf rects.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: false },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        a: { x: 0,   y: 0,   width: 50, height: 50 },
        b: { x: 200, y: 0,   width: 50, height: 50 },
        c: { x: 100, y: -20, width: 80, height: 80 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 50, y: 25 }, { x: 140, y: 25 }, { x: 200, y: 25 }],
          sourceAnchor: { x: 50, y: 25 },
          targetAnchor: { x: 200, y: 25 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    // simplifyCollinear runs unconditionally now (B8): the interior
    // point (140, 25) was collinear with both endpoints, so it gets
    // dropped — the leaf at (100, -20) is correctly ignored (no
    // clipping was needed), AND the collinear interior is cleaned up.
    const pts = out.get('e1').points;
    assert.deepEqual(pts[0], { x: 50, y: 25 });
    assert.deepEqual(pts[pts.length - 1], { x: 200, y: 25 });
  });

  test('nested foreign containers: iterates until anchor is outside all of them', () => {
    // Anchor starts inside both outer and inner. After one pass it
    // exits inner but is still inside outer. Must keep iterating.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
        { id: 'outer', parent: null, hasChildren: true },
        { id: 'inner', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        a: { x: -200, y: 0, width: 50, height: 50 },
        b: { x: 50,   y: 25, width: 50, height: 50 },
        outer: { x: 0,  y: 0,  width: 300, height: 300 },
        inner: { x: 30, y: 30, width: 100, height: 100 },
      },
      routedEdges: {
        e1: {
          // target endpoint at (80, 60) — inside both inner and outer
          points: [{ x: -150, y: 25 }, { x: 80, y: 60 }],
          sourceAnchor: { x: -150, y: 25 },
          targetAnchor: { x: 80, y: 60 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    const tgt = out.get('e1').points[1];
    const outerRect = rectMap.get('outer');
    const innerRect = rectMap.get('inner');
    const insideOuter = tgt.x > outerRect.x && tgt.x < outerRect.x + outerRect.width
                     && tgt.y > outerRect.y && tgt.y < outerRect.y + outerRect.height;
    const insideInner = tgt.x > innerRect.x && tgt.x < innerRect.x + innerRect.width
                     && tgt.y > innerRect.y && tgt.y < innerRect.y + innerRect.height;
    assert.equal(insideInner, false, 'anchor must end up outside inner');
    assert.equal(insideOuter, false, 'anchor must end up outside outer');
  });

  test('orthogonal polyline stays orthogonal after clip (no diagonal segment)', () => {
    // Reproduces the "diagonal between web and queue" bug observed in
    // the mobile screenshot of the `containers` example. When `web`
    // falls visually inside container `backend` (overlap permissive)
    // while `api` sits outside, the orthogonal router emits a
    // Manhattan polyline whose first waypoint already lies outside
    // backend. The clip post-processor projects points[0] onto
    // backend's east face — far from points[1]'s y. Before the fix,
    // points[1] kept its old y and the first segment was diagonal.
    // The Manhattan invariant must hold: every adjacent pair of
    // points shares either x or y.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'web', parent: null, hasChildren: false },
        { id: 'api', parent: null, hasChildren: false },
        { id: 'backend', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'web', target: 'api' }],
      rects: {
        web:     { x: 60,  y: 110, width: 50,  height: 30 },   // inside backend
        api:     { x: 400, y: 110, width: 50,  height: 30 },   // outside (east)
        backend: { x: 50,  y: 100, width: 150, height: 200 },  // east face at x=200
      },
      routedEdges: {
        // Output of orthogonal router (horizontal-first):
        e1: {
          points: [
            { x: 110, y: 125 },  // east face of web — INSIDE backend
            { x: 255, y: 125 },  // midX, source y — OUTSIDE backend
            { x: 255, y: 125 },  // midX, target y
            { x: 400, y: 125 },  // west face of api — OUTSIDE backend
          ],
          sourceAnchor: { x: 110, y: 125 },
          targetAnchor: { x: 400, y: 125 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    const pts = out.get('e1').points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const sameX = Math.abs(a.x - b.x) < 1e-6;
      const sameY = Math.abs(a.y - b.y) < 1e-6;
      assert.ok(
        sameX || sameY,
        `segment ${i}→${i + 1} must be axis-aligned (got ${JSON.stringify(a)}→${JSON.stringify(b)})`,
      );
    }
  });

  test('polyline fully engulfed: anchor left untouched (degenerate)', () => {
    // Both endpoints of the edge sit inside container c (not source/
    // target). No good projection target — leave anchors alone.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        a: { x: 110, y: 110, width: 20, height: 20 },
        b: { x: 180, y: 180, width: 20, height: 20 },
        c: { x: 100, y: 100, width: 200, height: 200 },
      },
      routedEdges: {
        e1: {
          points: [{ x: 130, y: 120 }, { x: 180, y: 190 }],
          sourceAnchor: { x: 130, y: 120 },
          targetAnchor: { x: 180, y: 190 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    assert.deepEqual(out.get('e1').points[0], { x: 130, y: 120 });
    assert.deepEqual(out.get('e1').points[1], { x: 180, y: 190 });
  });

  test('B8: output sem pontos duplicados/colineares após anchor move', () => {
    // Cenário: aresta a→b cujo target cai dentro do container `c` (não
    // ancestral). clip-anchors projeta o target pra fora; o rebuild
    // posterior pode gerar polilinha com pontos colineares/dup.
    // simplifyCollinear no fim do clipEdge deve removê-los.
    const { ir, rectMap, reMap, ancestors } = buildScenario({
      nodes: [
        { id: 'a', parent: null, hasChildren: false },
        { id: 'b', parent: null, hasChildren: false },
        { id: 'c', parent: null, hasChildren: true },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      rects: {
        a: { x: 0,   y: 0,   width: 50, height: 50 },
        b: { x: 200, y: 200, width: 50, height: 50 },
        c: { x: 150, y: 180, width: 80, height: 80 }, // engole target
      },
      routedEdges: {
        e1: {
          // 4-point Z manual com middle colinear com endpoint após o clip.
          points: [{ x: 50, y: 25 }, { x: 125, y: 25 }, { x: 125, y: 220 }, { x: 200, y: 220 }],
          sourceAnchor: { x: 50, y: 25 },
          targetAnchor: { x: 200, y: 220 },
        },
      },
    });
    const out = clipAnchorsToContainerFaces(ir, reMap, rectMap, ancestors);
    const pts = out.get('e1').points;
    // Nenhum par consecutivo duplicado, nenhum interior colinear.
    for (let i = 0; i + 1 < pts.length; i++) {
      const dx = Math.abs(pts[i].x - pts[i + 1].x);
      const dy = Math.abs(pts[i].y - pts[i + 1].y);
      assert.ok(dx > 0.1 || dy > 0.1, `pontos consecutivos ${i}/${i + 1} duplicados: ${JSON.stringify(pts[i])} ≈ ${JSON.stringify(pts[i + 1])}`);
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1], q = pts[i], r = pts[i + 1];
      const cross = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      assert.ok(Math.abs(cross) > 1e-3, `ponto interior ${i} ${JSON.stringify(q)} colinear (cross=${cross})`);
    }
  });
});
