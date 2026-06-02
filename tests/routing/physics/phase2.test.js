// Fase 2 do solver físico: round-trip preserva polyline ≤0.5px;
// spring de origem traz corner de volta; pin trava anchor; projeção
// Manhattan realinha após qualquer perturbação no eixo livre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, commitWorld } from '../../../src/routing/physics/warm-start.js';
import { runPhysicsRouter } from '../../../src/routing/physics/index.js';
import { step, runUntilStable } from '../../../src/routing/physics/solver.js';
import { projectManhattanEdge, pinAnchors } from '../../../src/routing/physics/constraints.js';
import { applyOriginSprings } from '../../../src/routing/physics/forces.js';
import { getSegmentC } from '../../../src/routing/physics/bodies.js';

function poly(points) {
  return { points };
}

function pointsClose(a, b, eps = 0.5) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > eps) return false;
    if (Math.abs(a[i].y - b[i].y) > eps) return false;
  }
  return true;
}

describe('physics fase 2 — build/commit round-trip', () => {
  test('buildWorld + commitWorld preserva polyline ortogonal exatamente', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const inputPts = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ];
    const routed = new Map([['e1', poly(inputPts)]]);
    const world = buildWorld(ir, routed, {});
    const out = commitWorld(world);
    const outPts = out.get('e1').points;
    assert.ok(pointsClose(outPts, inputPts, 0.0001));
  });

  test('buildWorld cria corners pinados nos endpoints e livres no meio', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([['e1', poly([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('e1');
    assert.equal(info.corners.length, 4);
    assert.equal(info.corners[0].pinned, true);
    assert.equal(info.corners[1].pinned, false);
    assert.equal(info.corners[2].pinned, false);
    assert.equal(info.corners[3].pinned, true);
    assert.equal(info.segments.length, 3);
  });

  test('buildWorld classifica segmentos h/v corretamente', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([['e1', poly([
      { x: 0, y: 0 },   // → seg horizontal
      { x: 50, y: 0 },  // → seg vertical
      { x: 50, y: 100 }, // → seg horizontal
      { x: 100, y: 100 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const segs = world.edgeIndex.get('e1').segments;
    assert.equal(segs[0].orientation, 'h');
    assert.equal(segs[1].orientation, 'v');
    assert.equal(segs[2].orientation, 'h');
    // c = coordenada perpendicular derivada dos corners endpoints.
    assert.equal(getSegmentC(segs[0]), 0);
    assert.equal(getSegmentC(segs[1]), 50);
    assert.equal(getSegmentC(segs[2]), 100);
  });

  test('curves (kind=curve) e splines (kind=spline) viram PointBody (fase 4)', () => {
    const ir = { edges: [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'c', target: 'd' },
    ] };
    const routed = new Map([
      ['e1', { kind: 'curve', points: [
        { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 70, y: 100 }, { x: 100, y: 100 },
      ] }],
      ['e2', { kind: 'spline', points: [
        { x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 60 },
      ] }],
    ]);
    const world = buildWorld(ir, routed, {});
    assert.equal(world.edgeIndex.get('e1').kind, 'curve');
    assert.equal(world.edgeIndex.get('e2').kind, 'curve');
    assert.equal(world.edgeIndex.get('e1').points.length, 4);
    // Endpoints pinned, control points livres.
    const p = world.edgeIndex.get('e1').points;
    assert.equal(p[0].pinned, true);
    assert.equal(p[3].pinned, true);
    assert.equal(p[1].pinned, false);
    // commit preserva kind + count + posições iniciais.
    const out = commitWorld(world);
    assert.equal(out.get('e1').kind, 'curve');
    assert.equal(out.get('e1').points.length, 4);
    assert.equal(out.get('e1').points[0].x, 0);
    assert.equal(out.get('e1').points[3].x, 100);
    assert.equal(out.get('e2').kind, 'spline');
  });

  test('edges sem points (<2) são ignoradas', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([['e1', poly([{ x: 0, y: 0 }])]]);
    const world = buildWorld(ir, routed, {});
    assert.equal(world.edgeIndex.has('e1'), false);
    assert.equal(world.bodies.length, 0);
  });
});

describe('physics fase 2 — solver step', () => {
  test('step em equilíbrio (warm-start ≡ origem) não move corners', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    for (let i = 0; i < 50; i++) step(world);
    const out = commitWorld(world).get('e1').points;
    assert.ok(pointsClose(out, pts, 0.0001));
  });

  test('segmento deslocado é puxado de volta pela spring de origem dos corners', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    const info = world.edgeIndex.get('e1');
    const corner1 = info.corners[1];
    const corner2 = info.corners[2];
    const seg1 = info.segments[1];  // vertical entre corner1 e corner2 (ambos livres)
    // Desloca ambos os corners do segmento vertical em x (eixo perp).
    // Sem repulsão, spring de origem em cada corner puxa de volta
    // para xOrigin=50; getSegmentC(seg1) acompanha.
    corner1.x = 30;
    corner2.x = 30;
    const dist0 = Math.abs(getSegmentC(seg1) - 50);
    runUntilStable(world, { maxIter: 5000, eps: 0.0001 });
    const distFinal = Math.abs(getSegmentC(seg1) - 50);
    assert.ok(distFinal < dist0 * 0.7,
      `spring deveria reduzir distância (d0=${dist0}, dFinal=${distFinal.toFixed(2)})`);
  });

  test('pinAnchors trava endpoint mesmo sob força externa', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    const c0 = world.edgeIndex.get('e1').corners[0];
    // Tenta empurrar o anchor.
    c0.fx = 999;
    c0.fy = 999;
    step(world);
    assert.equal(c0.x, 0);
    assert.equal(c0.y, 0);
  });

  test('projectManhattanEdge: segmento adjacente a anchor herda coord do pinado', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    const info = world.edgeIndex.get('e1');
    // Perturba corner[1].y → mas seg[0] tem prevCorner (anchor em y=0)
    // pinado. A projeção sobrescreve corner[1].y = pinned.y, mantendo
    // Manhattan estrito.
    info.corners[1].y = 25;
    projectManhattanEdge(info.corners, info.segments);
    pinAnchors(info.corners);
    assert.equal(getSegmentC(info.segments[0]), 0,
      'pinned respect: seg horizontal herda y do anchor adjacente');
    assert.equal(info.corners[0].y, 0);
    assert.equal(info.corners[1].y, 0);
    // Segmento[1] vertical (x=50): corner[1].x permanece 50.
    assert.equal(info.corners[1].x, 50);
  });

  test('projectManhattanEdge: segmento intermediário (sem pinned adjacente) move livre', () => {
    // U-shape: anchors em (0,0) e (100,0); segmento horizontal
    // intermediário entre 2 corners livres → pode mover.
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [
      { x: 0, y: 0 }, { x: 0, y: -30 }, { x: 100, y: -30 }, { x: 100, y: 0 },
    ];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    const info = world.edgeIndex.get('e1');
    // segments[1] é horizontal em y=-30. Mover ambos os corners (1 e 2)
    // pra -50 → projeção mantém (média = -50, sem pin).
    info.corners[1].y = -50;
    info.corners[2].y = -50;
    projectManhattanEdge(info.corners, info.segments);
    pinAnchors(info.corners);
    assert.equal(getSegmentC(info.segments[1]), -50, 'seg intermediário preserva c');
    assert.equal(info.corners[1].y, -50);
    assert.equal(info.corners[2].y, -50);
    assert.equal(info.corners[0].y, 0); // anchor preserva
    assert.equal(info.corners[3].y, 0);
  });

  test('applyOriginSprings acumula força proporcional ao deslocamento', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    const c1 = world.edgeIndex.get('e1').corners[1];
    c1.x = 60;  // 10 px à direita da origem
    applyOriginSprings(world);
    assert.ok(c1.fx < 0, 'spring deve puxar pra esquerda');
  });
});

describe('physics fase 2 — runPhysicsRouter', () => {
  test('end-to-end: polyline ortogonal preservada ≤0.5px (critério da fase 2)', () => {
    const ir = { edges: [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ] };
    const pts1 = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ];
    const pts2 = [
      { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 200, y: 200 },
    ];
    const input = new Map([
      ['e1', poly(pts1)],
      ['e2', poly(pts2)],
    ]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), {}, { _inputRoutedEdges: input, routing: { stepsPerTick: 10 } },
    );
    assert.ok(pointsClose(routedEdges.get('e1').points, pts1, 0.5));
    assert.ok(pointsClose(routedEdges.get('e2').points, pts2, 0.5));
  });

  test('end-to-end: curva preservada intacta (não-ortogonal não roda no solver)', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const input = new Map([['e1', {
      kind: 'curve',
      points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 70, y: 100 }, { x: 100, y: 100 }],
    }]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), {}, { _inputRoutedEdges: input },
    );
    const out = routedEdges.get('e1');
    assert.equal(out.kind, 'curve');
    assert.equal(out.points.length, 4);
    assert.equal(out.points[0].x, 0);
    assert.equal(out.points[3].x, 100);
  });

  test('end-to-end: state preservado entre chamadas contém world', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const input = new Map([['e1', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])]]);
    const { state } = runPhysicsRouter(
      ir, new Map(), {}, { _inputRoutedEdges: input },
    );
    assert.ok(state, 'state deve ser retornado');
    assert.ok(state.world, 'state.world deve existir');
    assert.ok(state.world.bodies.length > 0, 'world.bodies não deve ser vazio');
  });

  test('runUntilStable converge em poucas iterações com warm-start ≡ origem', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const pts = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 },
    ];
    const world = buildWorld(ir, new Map([['e1', poly(pts)]]), {});
    const result = runUntilStable(world);
    assert.ok(result.converged, 'deve convergir');
    assert.ok(result.iterations <= 5, `convergência rápida esperada (${result.iterations} iter)`);
  });
});
