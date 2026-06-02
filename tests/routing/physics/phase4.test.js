// Fase 4: PointBody integrado ao solver (curves participam) + hook
// `cfg.routing.warmStart.aStar`. Default da flag `routing.engine`
// permanece 'algebraic' até calibração + fissão amadurecerem — esta
// fase entrega arquitetura, não flip de default.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, commitWorld } from '../../../src/routing/physics/warm-start.js';
import { runPhysicsRouter } from '../../../src/routing/physics/index.js';
import { step, runUntilStable } from '../../../src/routing/physics/solver.js';

function pointsClose(a, b, eps = 0.5) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > eps) return false;
    if (Math.abs(a[i].y - b[i].y) > eps) return false;
  }
  return true;
}

describe('physics fase 4 — curves participam do solver', () => {
  test('curva kind=curve cria 4 PointBody, endpoints pinned', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([
      ['e1', { kind: 'curve', points: [
        { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 70, y: 100 }, { x: 100, y: 100 },
      ] }],
    ]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('e1');
    assert.equal(info.kind, 'curve');
    assert.equal(info.points.length, 4);
    assert.equal(info.points[0].pinned, true);
    assert.equal(info.points[3].pinned, true);
    assert.equal(info.points[1].pinned, false);
    assert.equal(info.points[2].pinned, false);
    // PointBody preserva x/y + xOrigin/yOrigin.
    assert.equal(info.points[0].x, 0);
    assert.equal(info.points[1].xOrigin, 30);
  });

  test('curva spline com N pontos cria N PointBody', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([
      ['e1', { kind: 'spline', points: [
        { x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 60 }, { x: 150, y: 0 },
      ] }],
    ]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('e1');
    assert.equal(info.points.length, 4);
    assert.equal(info.points[0].pinned, true);
    assert.equal(info.points[3].pinned, true);
  });

  test('solver de curva sem perturbação preserva polyline (round-trip ≤0.5px)', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const inputPts = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 70, y: 100 }, { x: 100, y: 100 },
    ];
    const routed = new Map([['e1', { kind: 'curve', points: inputPts }]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), {}, { _inputRoutedEdges: routed },
    );
    const out = routedEdges.get('e1');
    assert.equal(out.kind, 'curve');
    assert.ok(pointsClose(out.points, inputPts, 0.5));
  });

  test('pinAnchors trava endpoints da curva mesmo sob força', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([
      ['e1', { kind: 'curve', points: [
        { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 70, y: 100 }, { x: 100, y: 100 },
      ] }],
    ]);
    const world = buildWorld(ir, routed, {});
    const p0 = world.edgeIndex.get('e1').points[0];
    p0.fx = 999;
    p0.fy = 999;
    step(world);
    assert.equal(p0.x, 0);
    assert.equal(p0.y, 0);
  });

  test('control point livre é puxado de volta pela spring de origem após perturbação', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const routed = new Map([
      ['e1', { kind: 'curve', points: [
        { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 70, y: 100 }, { x: 100, y: 100 },
      ] }],
    ]);
    const world = buildWorld(ir, routed, {});
    const p1 = world.edgeIndex.get('e1').points[1];
    p1.x = 100;  // bem longe da origem (30, 0)
    p1.y = 50;
    const distInicial = Math.hypot(p1.x - p1.xOrigin, p1.y - p1.yOrigin);
    runUntilStable(world, { maxIter: 5000 });
    const distFinal = Math.hypot(p1.x - p1.xOrigin, p1.y - p1.yOrigin);
    assert.ok(distFinal < distInicial * 0.5,
      `spring deveria aproximar control point da origem (d0=${distInicial.toFixed(2)}, dFinal=${distFinal.toFixed(2)})`);
  });
});

describe('physics fase 4 — hook warmStart.aStar', () => {
  test('runPhysicsRouter aceita cfg.routing.warmStart.aStar = false (default)', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const input = new Map([['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), {},
      { _inputRoutedEdges: input, routing: { warmStart: { aStar: false } } },
    );
    assert.ok(routedEdges.get('e1'));
  });

  test('runPhysicsRouter aceita cfg.routing.warmStart.aStar = true sem crash (hook)', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const input = new Map([['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), {},
      { _inputRoutedEdges: input, routing: { warmStart: { aStar: true } } },
    );
    // Hook ainda não invoca A* na entrega da fase 4 — apenas aceita
    // a config sem quebrar. Fase posterior pluga hananRoute como seed.
    assert.ok(routedEdges.get('e1'));
  });

  test('runPhysicsRouter aceita cfg.routing.warmStart.aStar = "on-stuck"', () => {
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b' }] };
    const input = new Map([['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), {},
      { _inputRoutedEdges: input, routing: { warmStart: { aStar: 'on-stuck' } } },
    );
    assert.ok(routedEdges.get('e1'));
  });
});

describe('physics fase 4 — engine flag default', () => {
  test('store default mantém engine algébrico (fissão é pré-requisito pro flip)', async () => {
    // Importa fresh pra evitar contaminação de cache do localStorage.
    const { installLocalStorage } = await import('../../dom-mock.js');
    installLocalStorage();
    globalThis.localStorage.clear();
    const { createStore } = await import('../../../src/store.js');
    const s = createStore();
    // Solver físico funcional em cenários sintéticos (testes phase3
    // passam), mas em polilinhas curtas (Z/L produzidas pelo router
    // ortogonal) os segmentos adjacentes a anchors ficam fixos via
    // projeção Manhattan estrita — não conseguem desviar de
    // obstáculos sem inserir corner intermediário (fissão).
    // Flag fica opt-in via options.routing.engine = 'physics' até
    // fissão amadurecer.
    assert.equal(s.state.options.routing, undefined);
  });
});
