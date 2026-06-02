import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../../../src/routing/physics/warm-start.js';

function poly(points) {
  return { kind: 'orthogonal', points };
}

describe('warm-start snap selection (P4)', () => {
  test('endpoint cujo node tem snap declarado recebe info.snapTarget mais próximo do anchor', () => {
    const ir = {
      nodes: [
        // Node `s` declara 4 cardinais (top/right/bottom/left).
        { id: 's', snap: ['top', 'right', 'bottom', 'left'] },
        { id: 't' },
      ],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: {},
    };
    const sRect = { x: 0, y: 0, width: 40, height: 40 };       // center (20, 20)
    const tRect = { x: 200, y: 100, width: 40, height: 40 };   // center (220, 120)
    const rects = new Map([['s', sRect], ['t', tRect]]);
    const routedEdges = new Map([['E', poly([{ x: 20, y: 20 }, { x: 220, y: 120 }])]]);

    const world = buildWorld(ir, routedEdges, { ancestors: new Map() }, { routingRects: rects });
    const info = world.edgeIndex.get('E');
    assert.ok(info.snapTarget, 'expected snapTarget on info');
    // Anchor warm-start é (40, 30) [intersection of perimeter w/ ray to edgeCenter].
    // Cardinais de s: top (20,0), right (40,20), bottom (20,40), left (0,20).
    // Mais próximo de (40, 30): right (40, 20). Distance² = 0 + 100 = 100.
    // Bottom (20, 40): dist² = 400 + 100 = 500. Top dist² = 400+900=1300. Left dist²=1600+100=1700.
    assert.deepEqual(info.snapTarget.source, { x: 40, y: 20 });
  });

  test('endpoint sem snap declarado deixa snapTarget[side] null', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: {},
    };
    const sRect = { x: 0, y: 0, width: 40, height: 40 };
    const tRect = { x: 200, y: 100, width: 40, height: 40 };
    const rects = new Map([['s', sRect], ['t', tRect]]);
    const routedEdges = new Map([['E', poly([{ x: 20, y: 20 }, { x: 220, y: 120 }])]]);

    const world = buildWorld(ir, routedEdges, { ancestors: new Map() }, { routingRects: rects });
    const info = world.edgeIndex.get('E');
    assert.equal(info.snapTarget.source, null);
    assert.equal(info.snapTarget.target, null);
  });

  test('múltiplos endpoints PODEM compartilhar o mesmo snap point', () => {
    const ir = {
      nodes: [
        { id: 'hub', snap: ['right'] },   // único snap point: (40, 20)
        { id: 'a' },
        { id: 'b' },
      ],
      edges: [
        { id: 'E1', source: 'hub', target: 'a' },
        { id: 'E2', source: 'hub', target: 'b' },
      ],
      meta: {},
    };
    const hubRect = { x: 0, y: 0, width: 40, height: 40 };
    const aRect = { x: 100, y: 0, width: 40, height: 40 };
    const bRect = { x: 100, y: 80, width: 40, height: 40 };
    const rects = new Map([['hub', hubRect], ['a', aRect], ['b', bRect]]);
    const routedEdges = new Map([
      ['E1', poly([{ x: 20, y: 20 }, { x: 120, y: 20 }])],
      ['E2', poly([{ x: 20, y: 20 }, { x: 120, y: 100 }])],
    ]);
    const world = buildWorld(ir, routedEdges, { ancestors: new Map() }, { routingRects: rects });
    const info1 = world.edgeIndex.get('E1');
    const info2 = world.edgeIndex.get('E2');
    // Ambas as arestas devem ter snapTarget.source no mesmo ponto.
    assert.deepEqual(info1.snapTarget.source, { x: 40, y: 20 });
    assert.deepEqual(info2.snapTarget.source, { x: 40, y: 20 });
  });

  test('snap point off-perimeter é re-projetado pro perímetro mais próximo (sem cardinais default)', () => {
    const ir = {
      nodes: [
        // snapGroups vazio desliga cardinais default; snap só com 1
        // ponto interno → projeção pro perímetro.
        { id: 's', snap: [[0.5, 0.5]], snapGroups: { cardinals: 'off' } },
        { id: 't' },
      ],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: {},
    };
    const sRect = { x: 0, y: 0, width: 40, height: 40 };
    const tRect = { x: 200, y: 100, width: 40, height: 40 };
    const rects = new Map([['s', sRect], ['t', tRect]]);
    const routedEdges = new Map([['E', poly([{ x: 20, y: 20 }, { x: 220, y: 120 }])]]);
    const world = buildWorld(ir, routedEdges, { ancestors: new Map() }, { routingRects: rects });
    const info = world.edgeIndex.get('E');
    // Snap interno (20, 20). projectToPerimeter com todos lados equidist
    // escolhe west primeiro (ordem do if): (0, 20).
    assert.equal(info.snapTarget.source.x, 0);
    assert.equal(info.snapTarget.source.y, 20);
  });

  test('snap declarado em apenas um endpoint (source) → target permanece null', () => {
    const ir = {
      nodes: [
        { id: 's', snap: ['top'], snapGroups: { cardinals: 'off' } },
        { id: 't' },
      ],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: {},
    };
    const sRect = { x: 0, y: 0, width: 40, height: 40 };
    const tRect = { x: 200, y: 100, width: 40, height: 40 };
    const rects = new Map([['s', sRect], ['t', tRect]]);
    const routedEdges = new Map([['E', poly([{ x: 20, y: 20 }, { x: 220, y: 120 }])]]);
    const world = buildWorld(ir, routedEdges, { ancestors: new Map() }, { routingRects: rects });
    const info = world.edgeIndex.get('E');
    assert.deepEqual(info.snapTarget.source, { x: 20, y: 0 });
    assert.equal(info.snapTarget.target, null);
  });
});
