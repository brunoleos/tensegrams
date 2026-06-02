// Fase 5.8: fusão curved adaptativa. PointBody pode nascer
// (splitCurvePoint) e morrer (mergeCurvePoint) durante a vida do
// solver — o detector automático fica pra fase futura, mas as funções
// individuais já são plugáveis. applyChainSpring mantém os PointBody
// aproximadamente uniformes ao longo da curva.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld } from '../../../src/routing/physics/warm-start.js';
import { applyChainSpring, K_CHAIN_SPRING } from '../../../src/routing/physics/forces.js';
import {
  splitCurvePoint,
  mergeCurvePoint,
  curvePointNeighborDistance,
  MIN_CONTROL_DISTANCE_DEFAULT,
} from '../../../src/routing/physics/topology.js';

function curve(points) { return { kind: 'curve', points }; }

describe('forces.applyChainSpring', () => {
  test('curva uniforme em equilíbrio: força líquida em cada ponto ≈ 0', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    // 4 pontos equispaçados em y=0: chainLen = 30 cada → ideal=30.
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 90, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const pts = world.edgeIndex.get('E').points;
    // Zera forças antes (warm-start pode ter deixado lixo).
    for (const p of pts) { p.fx = 0; p.fy = 0; }
    applyChainSpring(world);
    // Pontos intermediários: força ≈ 0 (curva uniforme).
    for (let i = 1; i < pts.length - 1; i++) {
      assert.ok(Math.abs(pts[i].fx) < 1e-9, `pts[${i}].fx ≈ 0 (foi ${pts[i].fx})`);
      assert.ok(Math.abs(pts[i].fy) < 1e-9);
    }
  });

  test('ponto deslocado é puxado de volta pela chain spring', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 90, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const pts = world.edgeIndex.get('E').points;
    pts[1].x = 50;  // desloca pra direita (gap maior com pt[0], menor com pt[2])
    for (const p of pts) { p.fx = 0; p.fy = 0; }
    applyChainSpring(world);
    // pts[1] está "esticado" de pts[0] (gap 50 > 30); spring puxa
    // pts[1] na direção de pts[0] → fx negativo. E "comprimido" com
    // pts[2] (gap 10 < 30); spring repele → fx negativo (mesma direção,
    // ambas as forças concorrem no caso). Líquido: fx < 0.
    assert.ok(pts[1].fx < 0, `chain spring deveria puxar pts[1] de volta (fx=${pts[1].fx})`);
  });

  test('orthogonal não é afetada (kind != curve)', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }]]);
    const world = buildWorld(ir, routed, {});
    // Não deve crashar nem aplicar forças (info.kind não é 'curve').
    applyChainSpring(world);
    const corners = world.edgeIndex.get('E').corners;
    for (const c of corners) {
      // Forças não devem ter sido tocadas pela chain spring (warm-start
      // inicializa em 0).
      assert.equal(c.fx, 0);
      assert.equal(c.fy, 0);
    }
  });
});

describe('topology.splitCurvePoint', () => {
  test('insere ponto no midpoint entre 2 vizinhos', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');

    const newPoint = splitCurvePoint(info, 1, world);
    assert.ok(newPoint, 'split retorna novo PointBody');
    assert.equal(info.points.length, 4);
    // Midpoint entre pts[1]=(30,30) e pts[2]=(60,0) → (45, 15).
    assert.equal(info.points[2], newPoint);
    assert.equal(newPoint.x, 45);
    assert.equal(newPoint.y, 15);
    assert.ok(newPoint.topologyCooldown > 0);
    // Cache do chainLen invalidado.
    assert.equal(info._chainLen, null);
  });

  test('idx inválido (fora de [0, length-2]) retorna null', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 100, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    assert.equal(splitCurvePoint(info, -1, world), null);
    assert.equal(splitCurvePoint(info, 1, world), null);  // 1+1 >= length(2)
  });

  test('não opera em edges ortogonais', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    assert.equal(splitCurvePoint(info, 0, world), null);
  });
});

describe('topology.mergeCurvePoint', () => {
  test('remove ponto intermediário', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 0 }, { x: 90, y: 30 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    const removed = mergeCurvePoint(info, 1, world);
    assert.ok(removed);
    assert.equal(info.points.length, 3);
    assert.equal(removed.x, 30);
    // Cache invalidado.
    assert.equal(info._chainLen, null);
  });

  test('não remove endpoint pinned (idx=0 ou último)', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    assert.equal(mergeCurvePoint(info, 0, world), null, 'não pode remover primeiro');
    assert.equal(mergeCurvePoint(info, 2, world), null, 'não pode remover último');
  });

  test('respeita cooldown', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    info.points[1].topologyCooldown = 5;
    assert.equal(mergeCurvePoint(info, 1, world), null);
  });
});

describe('topology.curvePointNeighborDistance', () => {
  test('devolve mínimo entre dist(prev) e dist(next)', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 100, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    // pt[1] está a 10 de pt[0], 90 de pt[2]. min = 10.
    assert.equal(curvePointNeighborDistance(info, 1), 10);
  });

  test('endpoints retornam Infinity', () => {
    const ir = { edges: [{ id: 'E', source: 'a', target: 'b' }] };
    const routed = new Map([['E', curve([
      { x: 0, y: 0 }, { x: 30, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, {});
    const info = world.edgeIndex.get('E');
    assert.equal(curvePointNeighborDistance(info, 0), Infinity);
  });
});

describe('MIN_CONTROL_DISTANCE_DEFAULT', () => {
  test('valor default = 6 (conforme plano)', () => {
    assert.equal(MIN_CONTROL_DISTANCE_DEFAULT, 6);
  });
});
