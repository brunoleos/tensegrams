// Fase 5.3: snap resolver. Resolve declarações heterogêneas de
// `node.snap` / `node.snapGroups` em pontos `{x,y}` candidatos e
// escolhe o melhor por `criterion`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolveNodeSnapPoints, pickSnapPoint } from '../../src/routing/snap-resolver.js';

const RECT = { x: 0, y: 0, width: 100, height: 40 };

describe('resolveNodeSnapPoints — opt-in via snap/snapGroups', () => {
  test('node sem snap nem snapGroups → array vazio (snap discreto OFF)', () => {
    const points = resolveNodeSnapPoints({}, RECT, {});
    assert.deepEqual(points, [], 'sem declaração → contínuo, sem snap discreto');
  });

  test('node.snap: [] (lista vazia) ativa snap discreto com grupos default', () => {
    // Declaração explícita "ativo snap mas sem pontos custom" — usa
    // grupos default (cardinals on).
    const points = resolveNodeSnapPoints({ snap: [] }, RECT, {});
    assert.equal(points.length, 4);
  });

  test('node.snapGroups: [] ativa snap mas desliga TODOS os grupos', () => {
    // Lista vazia em snapGroups: opt-in pra snap discreto, mas
    // nenhum grupo ativo → 0 pontos.
    const points = resolveNodeSnapPoints({ snapGroups: [] }, RECT, {});
    assert.deepEqual(points, []);
  });

  test('node null → array vazio', () => {
    assert.deepEqual(resolveNodeSnapPoints(null, RECT, {}), []);
  });

  test('rect null → array vazio', () => {
    assert.deepEqual(resolveNodeSnapPoints({}, null, {}), []);
  });
});

describe('resolveNodeSnapPoints — itens explícitos em node.snap', () => {
  test('nome de anchor resolvido via shape.namedAnchors', () => {
    const node = { snap: ['top'], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    // cardinals desativados via snapGroups vazio.
    assert.equal(points.length, 1);
    assert.deepEqual(points[0], { x: 50, y: 0 });
  });

  test('corner0..3 funciona', () => {
    const node = { snap: ['corner0', 'corner1', 'corner2', 'corner3'], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 4);
    assert.deepEqual(points[0], { x: 0, y: 0 });
    assert.deepEqual(points[2], { x: 100, y: 40 });
  });

  test('angle (graus): {angle: 0} = meio da face direita', () => {
    const node = { snap: [{ angle: 0 }], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 1);
    assert.equal(points[0].x, 100);
    assert.equal(points[0].y, 20);
  });

  test('coord relativa [u,v]: [0.5, 0] = midpoint top', () => {
    const node = { snap: [[0.5, 0]], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 1);
    assert.deepEqual(points[0], { x: 50, y: 0 });
  });

  test('path: {path: 0.25} = canto top-right (perímetro 100/280)', () => {
    const node = { snap: [{ path: 100 / 280 }], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 1);
    assert.ok(Math.abs(points[0].x - 100) < 1e-9);
    assert.ok(Math.abs(points[0].y - 0) < 1e-9);
  });

  test('mix de 4 formas em uma única lista', () => {
    const node = {
      snap: ['top', { angle: 90 }, [0.25, 0], { path: 0.5 }],
      snapGroups: [],
    };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 4);
  });

  test('item desconhecido (nome inválido) ignorado', () => {
    const node = { snap: ['foo', 'top'], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 1, 'foo ignorado, top resolvido');
  });

  test('dedupe: mesmo ponto declarado 2 vezes vira 1', () => {
    const node = { snap: ['top', { angle: 270 }], snapGroups: [] };
    // angle 270 (graus matemáticos = -90 em CSS) = norte = top da rect.
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 1, 'duplicado descartado');
  });
});

describe('resolveNodeSnapPoints — grupos', () => {
  test('grupo "cardinals" expande pra 4 cardinais', () => {
    const node = { snap: ['cardinals'], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 4);
  });

  test('grupo "vertices" expande pros 4 corners (rect)', () => {
    const node = { snap: ['vertices'], snapGroups: [] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 4);
    assert.deepEqual(points[0], { x: 0, y: 0 });
  });

  test('node.snapGroups: [vertices] ativa só vertices', () => {
    const node = { snapGroups: ['vertices'] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    assert.equal(points.length, 4);
  });

  test('node.snapGroups: [cardinals, vertices] ativa ambos (8 pontos sem overlap em rect)', () => {
    const node = { snapGroups: ['cardinals', 'vertices'] };
    const points = resolveNodeSnapPoints(node, RECT, {});
    // 4 cardinais + 4 vertices = 8 pontos distintos (rect 100x40).
    assert.equal(points.length, 8);
  });

  test('meta.routing.snap.groups define default global (após opt-in do node)', () => {
    const meta = { routing: { snap: { groups: { vertices: 'on', cardinals: 'off' } } } };
    // Node opt-in via `snap: []` mas sem grupos próprios → herda
    // override global. cardinals → off, vertices → on. Resultado: 4
    // corners do rect.
    const points = resolveNodeSnapPoints({ snap: [] }, RECT, meta);
    assert.equal(points.length, 4);
    assert.deepEqual(points[0], { x: 0, y: 0 });
  });
});

describe('pickSnapPoint — criterion', () => {
  const candidates = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 40 },
  ];

  test('nearest: ideal=(10,5) escolhe (0,0)', () => {
    const p = pickSnapPoint(candidates, { x: 10, y: 5 }, 'nearest');
    assert.deepEqual(p, { x: 0, y: 0 });
  });

  test('nearest: ideal=(90,5) escolhe (100,0)', () => {
    const p = pickSnapPoint(candidates, { x: 90, y: 5 }, 'nearest');
    assert.deepEqual(p, { x: 100, y: 0 });
  });

  test('minLength: minimiza dist(ideal,p) + dist(other,p)', () => {
    // ideal=(0,0), other=(50,40). Candidate (50,40) tem d1=√(50²+40²)
    // ≈ 64, d2=0; total ≈ 64.
    // Candidate (0,0) tem d1=0, d2=√(50²+40²) ≈ 64; total ≈ 64.
    // Candidate (100,0) tem d1=100, d2=√(50²+40²) ≈ 64; total ≈ 164.
    // Empate entre (0,0) e (50,40) — primeiro empate vence.
    const p = pickSnapPoint(candidates, { x: 0, y: 0 }, 'minLength',
                            { otherEndpoint: { x: 50, y: 40 } });
    assert.ok(p === candidates[0] || p === candidates[2]);
  });

  test('minLength sem otherEndpoint cai em nearest', () => {
    const p = pickSnapPoint(candidates, { x: 10, y: 5 }, 'minLength');
    assert.deepEqual(p, { x: 0, y: 0 });
  });

  test('astar (stub) cai em nearest na 5.3', () => {
    const p = pickSnapPoint(candidates, { x: 10, y: 5 }, 'astar');
    assert.deepEqual(p, { x: 0, y: 0 });
  });

  test('candidates vazio devolve null', () => {
    assert.equal(pickSnapPoint([], { x: 0, y: 0 }, 'nearest'), null);
  });

  test('sem ideal devolve primeiro candidate', () => {
    const p = pickSnapPoint(candidates, null, 'nearest');
    assert.deepEqual(p, candidates[0]);
  });
});
