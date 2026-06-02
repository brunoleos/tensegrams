// Seleção de face consciente de cruzamento (face-select.js).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { router } from '../../src/routing/routers/orthogonal.js';
import { reassignFacesToReduceCrossings } from '../../src/routing/face-select.js';
import { countSharedLayerCrossings } from '../../src/routing/crossings.js';

// Quad medido (mesmas posições do caso reportado): a→b cruza c→d perto
// de d porque o roteador base ancora a→b na face sul de a, do lado
// errado de d. Reatribuir a face de a descruza.
const QUAD_RECTS = new Map([
  ['a', { x: -76.2, y: -120.64, width: 140, height: 48 }],
  ['b', { x: 77.31, y: 135.61, width: 140, height: 48 }],
  ['c', { x: -320,  y: -24,     width: 140, height: 48 }],
  ['d', { x: -1.65, y: -27.34,  width: 140, height: 48 }],
]);
const QUAD_EDGES = [
  { id: 'e:a|b', source: 'a', target: 'b' },
  { id: 'e:b|c', source: 'b', target: 'c' },
  { id: 'e:a|c', source: 'c', target: 'a' },
  { id: 'e:c|d', source: 'c', target: 'd' },
];

function sharedLayerResolver(edges) {
  const byId = new Map(edges.map(e => [e.id, e]));
  return {
    ancestors: new Map(),
    edgeLayerPair(idA, idB) {
      const a = byId.get(idA), b = byId.get(idB);
      if (!a || !b || a.id === b.id) return null;
      const sharedNodes = [];
      for (const n of [a.source, a.target]) {
        if (n === b.source || n === b.target) sharedNodes.push(n);
      }
      return { shared: ['edges'], frac: { a: 0.5, b: 0.5 }, sharedNodes };
    },
  };
}

describe('reassignFacesToReduceCrossings', () => {
  test('descruza o quad migrando a face de um endpoint', () => {
    const ir = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: QUAD_EDGES,
    };
    const resolver = sharedLayerResolver(QUAD_EDGES);
    const base = router.route(ir, QUAD_RECTS);
    assert.equal(countSharedLayerCrossings(base, resolver), 1, 'base tem 1 cruzamento');

    reassignFacesToReduceCrossings(ir, base, QUAD_RECTS, resolver);
    assert.equal(countSharedLayerCrossings(base, resolver), 0, 'após reatribuição, 0 cruzamentos');

    // a→b deixou de sair pela face sul de a (passou pra leste).
    const ab = base.get('e:a|b').points;
    const aRect = QUAD_RECTS.get('a');
    const onSouth = Math.abs(ab[0].y - (aRect.y + aRect.height)) < 1e-6;
    assert.ok(!onSouth, 'âncora de origem de a→b não está mais na face sul');
    // Endpoint ainda na borda de a (face leste: x = a.x + width).
    assert.ok(Math.abs(ab[0].x - (aRect.x + aRect.width)) < 1e-6, 'âncora na face leste de a');
  });

  test('no-op quando não há cruzamento (rotas inalteradas)', () => {
    const edges = [
      { id: 'E1', source: 'p', target: 'q' },
      { id: 'E2', source: 'r', target: 's' },
    ];
    const rects = new Map([
      ['p', { x: 0,   y: 0,   width: 40, height: 40 }],
      ['q', { x: 0,   y: 200, width: 40, height: 40 }],
      ['r', { x: 200, y: 0,   width: 40, height: 40 }],
      ['s', { x: 200, y: 200, width: 40, height: 40 }],
    ]);
    const ir = { nodes: [{ id: 'p' }, { id: 'q' }, { id: 'r' }, { id: 's' }], edges };
    const resolver = sharedLayerResolver(edges);
    const base = router.route(ir, rects);
    const before = JSON.stringify([...base].map(([id, re]) => [id, re.points]));
    assert.equal(countSharedLayerCrossings(base, resolver), 0);
    reassignFacesToReduceCrossings(ir, base, rects, resolver);
    const after = JSON.stringify([...base].map(([id, re]) => [id, re.points]));
    assert.equal(after, before, 'rotas inalteradas sem cruzamento');
  });

  test('no-op sem resolver.edgeLayerPair', () => {
    const ir = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: QUAD_EDGES,
    };
    const base = router.route(ir, QUAD_RECTS);
    const before = JSON.stringify([...base].map(([id, re]) => [id, re.points]));
    reassignFacesToReduceCrossings(ir, base, QUAD_RECTS, { ancestors: new Map() });
    const after = JSON.stringify([...base].map(([id, re]) => [id, re.points]));
    assert.equal(after, before, 'sem edgeLayerPair, no-op');
  });

  test('respeita snap: endpoint em nó com snap não migra de face', () => {
    const ir = {
      nodes: [
        { id: 'a', snap: { sides: ['south'] } },
        { id: 'b' }, { id: 'c' }, { id: 'd' },
      ],
      edges: QUAD_EDGES,
    };
    const resolver = sharedLayerResolver(QUAD_EDGES);
    const base = router.route(ir, QUAD_RECTS);
    const aRect = QUAD_RECTS.get('a');
    const baseSouth = Math.abs(base.get('e:a|b').points[0].y - (aRect.y + aRect.height)) < 1e-6;
    assert.ok(baseSouth, 'base ancora a→b na face sul de a');

    reassignFacesToReduceCrossings(ir, base, QUAD_RECTS, resolver);
    const ab = base.get('e:a|b').points;
    assert.ok(
      Math.abs(ab[0].y - (aRect.y + aRect.height)) < 1e-6,
      'com snap em a, a âncora de a→b permanece na face sul',
    );
  });

  test('ignora curvas (passam intactas)', () => {
    const edges = [{ id: 'C', source: 'a', target: 'b' }];
    const rects = new Map([
      ['a', { x: 0, y: 0, width: 40, height: 40 }],
      ['b', { x: 200, y: 0, width: 40, height: 40 }],
    ]);
    const ir = { nodes: [{ id: 'a' }, { id: 'b' }], edges };
    const resolver = sharedLayerResolver(edges);
    const curve = new Map([['C', { kind: 'curve', points: [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 0 }] }]]);
    reassignFacesToReduceCrossings(ir, curve, rects, resolver);
    assert.equal(curve.get('C').kind, 'curve');
    assert.equal(curve.get('C').points.length, 3, 'curva intacta');
  });
});
