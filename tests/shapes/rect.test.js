// Fase 5.2: shape registry. rect tem implementação real; circle/
// diamond/polygon/star são stubs com mesma API. Testes validam
// presença da API em todos e correção semântica em rect.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getShape, shapeNames } from '../../src/shapes/index.js';
import * as rect from '../../src/shapes/rect.js';

const NODE = { x: 0, y: 0, width: 100, height: 40 };

describe('shapes/index — registry', () => {
  test('shapeNames inclui rect, circle, diamond, polygon, star', () => {
    const names = shapeNames();
    assert.ok(names.includes('rect'));
    assert.ok(names.includes('circle'));
    assert.ok(names.includes('diamond'));
    assert.ok(names.includes('polygon'));
    assert.ok(names.includes('star'));
  });

  test('getShape com nome desconhecido cai em rect', () => {
    const unknown = getShape('blob-shaped');
    const r = getShape('rect');
    assert.equal(unknown, r);
  });

  test('todos os shapes expõem a mesma API', () => {
    const API = ['bbox', 'boundaryHitFromAngle', 'boundaryHitFromPath',
                 'namedAnchors', 'vertices', 'midpoints', 'intersections'];
    for (const name of shapeNames()) {
      const s = getShape(name);
      for (const fn of API) {
        assert.equal(typeof s[fn], 'function', `${name}.${fn} deve ser função`);
      }
    }
  });
});

describe('shapes/rect — geometria', () => {
  test('bbox devolve a mesma BBox do node', () => {
    assert.deepEqual(rect.bbox(NODE), NODE);
  });

  test('namedAnchors retorna cardinais + center + corner0..3', () => {
    const a = rect.namedAnchors(NODE);
    assert.deepEqual(a.get('top'),     { x: 50, y: 0 });
    assert.deepEqual(a.get('right'),   { x: 100, y: 20 });
    assert.deepEqual(a.get('bottom'),  { x: 50, y: 40 });
    assert.deepEqual(a.get('left'),    { x: 0, y: 20 });
    assert.deepEqual(a.get('center'),  { x: 50, y: 20 });
    assert.deepEqual(a.get('corner0'), { x: 0, y: 0 });
    assert.deepEqual(a.get('corner1'), { x: 100, y: 0 });
    assert.deepEqual(a.get('corner2'), { x: 100, y: 40 });
    assert.deepEqual(a.get('corner3'), { x: 0, y: 40 });
  });

  test('boundaryHitFromAngle(0) = midpoint da face direita (leste)', () => {
    const p = rect.boundaryHitFromAngle(NODE, 0);
    assert.equal(p.x, 100);
    assert.equal(p.y, 20);
  });

  test('boundaryHitFromAngle(90) = midpoint da face inferior (y+, sul)', () => {
    const p = rect.boundaryHitFromAngle(NODE, 90);
    assert.equal(p.x, 50);
    assert.equal(p.y, 40);
  });

  test('boundaryHitFromAngle(180) = midpoint da face esquerda', () => {
    const p = rect.boundaryHitFromAngle(NODE, 180);
    assert.ok(Math.abs(p.x - 0) < 1e-9);
    assert.ok(Math.abs(p.y - 20) < 1e-9);
  });

  test('boundaryHitFromAngle(45) aponta canto inferior-direito (face mais próxima)', () => {
    // Aspect ratio 100:40 → diagonal cardinal cruza face inferior antes
    // da direita pra 45°. Resultado deve estar na face bottom (y=40).
    const p = rect.boundaryHitFromAngle(NODE, 45);
    assert.equal(p.y, 40);
  });

  test('boundaryHitFromPath(0) = corner0 (top-left)', () => {
    assert.deepEqual(rect.boundaryHitFromPath(NODE, 0), { x: 0, y: 0 });
  });

  test('boundaryHitFromPath percorre perímetro em sentido horário', () => {
    // 100x40 → perímetro 280. Top=100, Right=40, Bottom=100, Left=40.
    // t=100/280 ≈ 0.357 → corner1 (top-right)
    const tCorner1 = 100 / 280;
    const p1 = rect.boundaryHitFromPath(NODE, tCorner1);
    assert.ok(Math.abs(p1.x - 100) < 1e-9);
    assert.ok(Math.abs(p1.y - 0) < 1e-9);
    // t=140/280 = 0.5 → corner2 (bottom-right)
    const p2 = rect.boundaryHitFromPath(NODE, 0.5);
    assert.ok(Math.abs(p2.x - 100) < 1e-9);
    assert.ok(Math.abs(p2.y - 40) < 1e-9);
  });

  test('boundaryHitFromPath aceita t fora [0,1] via wrap-around', () => {
    const p0 = rect.boundaryHitFromPath(NODE, 0);
    const p1 = rect.boundaryHitFromPath(NODE, 1);
    const p2 = rect.boundaryHitFromPath(NODE, 2);
    assert.deepEqual(p0, p1);
    assert.deepEqual(p1, p2);
  });

  test('vertices devolve os 4 corners em ordem horária', () => {
    const v = rect.vertices(NODE);
    assert.equal(v.length, 4);
    assert.deepEqual(v[0], { x: 0, y: 0 });
    assert.deepEqual(v[1], { x: 100, y: 0 });
    assert.deepEqual(v[2], { x: 100, y: 40 });
    assert.deepEqual(v[3], { x: 0, y: 40 });
  });

  test('midpoints devolve os 4 midpoints das faces', () => {
    const m = rect.midpoints(NODE);
    assert.equal(m.length, 4);
    assert.deepEqual(m[0], { x: 50, y: 0 });    // top
    assert.deepEqual(m[1], { x: 100, y: 20 });  // right
    assert.deepEqual(m[2], { x: 50, y: 40 });   // bottom
    assert.deepEqual(m[3], { x: 0, y: 20 });    // left
  });

  test('intersections é vazio para rect', () => {
    assert.deepEqual(rect.intersections(NODE), []);
  });
});

describe('shapes/circle — implementação básica (inscrito na BBox)', () => {
  test('boundaryHitFromAngle(0) cai na borda direita do círculo inscrito', () => {
    // BBox 100x40 → raio = min(100,40)/2 = 20. Center=(50,20). Right=(70,20).
    const circle = getShape('circle');
    const p = circle.boundaryHitFromAngle(NODE, 0);
    assert.ok(Math.abs(p.x - 70) < 1e-9);
    assert.ok(Math.abs(p.y - 20) < 1e-9);
  });
  test('vertices é vazio (circle não tem)', () => {
    assert.deepEqual(getShape('circle').vertices(NODE), []);
  });
});

describe('shapes/diamond,polygon,star — stubs API completos', () => {
  for (const name of ['diamond', 'polygon', 'star']) {
    test(`${name}: namedAnchors cobre top/right/bottom/left/center`, () => {
      const s = getShape(name);
      const a = s.namedAnchors(NODE);
      for (const key of ['top', 'right', 'bottom', 'left', 'center']) {
        assert.ok(a.has(key), `${name} deve ter anchor "${key}"`);
      }
    });
  }
});
