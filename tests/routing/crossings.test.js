// Métrica de cruzamentos (Fase 3c). `countSharedLayerCrossings` conta
// interseções em X entre segmentos perpendiculares de edges que
// COMPARTILHAM edgeLayer (predicado `resolver.edgeEdgePair`). Cruzamentos
// entre edges de layers disjuntos são permitidos pela regra de design e
// NÃO contam. Função pura — sem DOM; usada por testes e debug-snapshot.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { countSharedLayerCrossings } from '../../src/routing/crossings.js';

// Resolvers de mentira: "tudo colide" (compartilham layer) e "nada
// colide" (layers disjuntos). O contador consulta `edgeLayerPair` — o
// predicado de cruzamento da Fase 3c (interseção de edgeLayer pura, sem
// exclusão de endpoint compartilhado).
const allCollide = { edgeLayerPair: () => ({ shared: ['L'], frac: { a: 0.5, b: 0.5 } }) };
const noneCollide = { edgeLayerPair: () => null };

function edges(obj) {
  return new Map(Object.entries(obj).map(([id, points]) => [id, { points }]));
}

describe('countSharedLayerCrossings', () => {
  test('par perpendicular que se cruza conta 1', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],   // horizontal
      B: [{ x: 50, y: 0 }, { x: 50, y: 100 }],    // vertical cruzando
    });
    assert.equal(countSharedLayerCrossings(re, allCollide), 1);
  });

  test('par perpendicular SEM interseção conta 0', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      B: [{ x: 200, y: 0 }, { x: 200, y: 100 }],  // vertical fora do span de A
    });
    assert.equal(countSharedLayerCrossings(re, allCollide), 0);
  });

  test('segmentos paralelos (mesma orientação) não são cruzamento', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      B: [{ x: 0, y: 60 }, { x: 100, y: 60 }],
    });
    assert.equal(countSharedLayerCrossings(re, allCollide), 0);
  });

  test('toque em T (endpoint sobre a linha) não conta como cruzamento', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      B: [{ x: 50, y: 50 }, { x: 50, y: 150 }],   // topo de B encosta em A
    });
    assert.equal(countSharedLayerCrossings(re, allCollide), 0);
  });

  test('REGRA DO USUÁRIO: layers disjuntos cruzam livremente (conta 0)', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      B: [{ x: 50, y: 0 }, { x: 50, y: 100 }],    // geometria cruza...
    });
    // ...mas resolver diz que não compartilham layer → não conta.
    assert.equal(countSharedLayerCrossings(re, noneCollide), 0);
  });

  test('dois cruzamentos entre o mesmo par contam 2', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 200, y: 50 }],     // horizontal longa
      B: [                                          // dois verticais cruzando
        { x: 30, y: 0 }, { x: 30, y: 100 },
        { x: 70, y: 100 }, { x: 70, y: 0 },
      ],
    });
    assert.equal(countSharedLayerCrossings(re, allCollide), 2);
  });

  test('edges curvas são ignoradas', () => {
    const re = new Map([
      ['A', { kind: 'curve', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] }],
      ['B', { points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] }],
    ]);
    assert.equal(countSharedLayerCrossings(re, allCollide), 0);
  });

  // Pares que compartilham nó (sharedNodes não vazio): cruzamentos perto
  // de um endpoint do par são ignorados (vizinhança do nó comum); longe
  // são contados normalmente.
  const sharedRes = { edgeLayerPair: () => ({ shared: ['L'], frac: { a: 0.5, b: 0.5 }, sharedNodes: ['N'] }) };

  test('nó comum: cruzamento PERTO de um endpoint não conta', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      B: [{ x: 10, y: 0 }, { x: 10, y: 100 }],   // cruza em (10,50), a 10px de (0,50)
    });
    assert.equal(countSharedLayerCrossings(re, sharedRes), 0);
  });

  test('nó comum: cruzamento LONGE dos endpoints conta', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 200, y: 50 }],
      B: [{ x: 100, y: 0 }, { x: 100, y: 200 }],  // cruza em (100,50), ≥50px de todo endpoint
    });
    assert.equal(countSharedLayerCrossings(re, sharedRes), 1);
  });

  test('SEM nó comum: proximidade de endpoint não importa (conta)', () => {
    const re = edges({
      A: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      B: [{ x: 10, y: 0 }, { x: 10, y: 100 }],
    });
    // allCollide não tem sharedNodes → sem exceção de vizinhança.
    assert.equal(countSharedLayerCrossings(re, allCollide), 1);
  });

  test('entradas inválidas → 0 (sem throw)', () => {
    assert.equal(countSharedLayerCrossings(null, allCollide), 0);
    assert.equal(countSharedLayerCrossings(edges({ A: [{ x: 0, y: 0 }] }), allCollide), 0);
    assert.equal(countSharedLayerCrossings(edges({ A: [], B: [] }), {}), 0);
  });
});
