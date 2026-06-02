// Fase 5.6: trigger de fissão (`meta.routing.fission.trigger`) +
// A* warm-start. Default + três modos:
//   - ausente/'off' (DEFAULT): solver puro; fissão DESLIGADA (opt-in).
//   - 'residual': solver puro; fissão ativa pra criar corners quando
//     força residual persiste.
//   - 'astar': hananRoute semeia topologia inicial; fissão DESLIGADA
//     (A* já resolveu o contorno).
//   - 'hybrid': hananRoute semeia + fissão pra splits residuais
//     adicionais (refina topologia A* quando necessário).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { runPhysicsRouter } from '../../../src/routing/physics/index.js';

function poly(points) { return { points }; }

describe('trigger default (fissão opt-in)', () => {
  test('sem meta.routing.fission, fissionEnabled=false (default off)', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: {},
    };
    const input = new Map([['E', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])]]);
    const { state } = runPhysicsRouter(
      ir, new Map(), { ancestors: new Map() },
      { _inputRoutedEdges: input },
    );
    // Fissão é opt-in: sem trigger explícito ela fica desligada. A fissão
    // por resíduo explode em grafos densos (shelves em cascata nas pernas
    // terminais presas ao pin) e não reduz cruzamentos no caso medido.
    assert.equal(state.world.fissionEnabled, false);
  });

  test('cenário sem obstáculo: residual preserva polyline original', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: { routing: { fission: { trigger: 'residual' } } },
    };
    const input = new Map([['E', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), { ancestors: new Map() },
      { _inputRoutedEdges: input },
    );
    const pts = routedEdges.get('E').points;
    assert.equal(pts.length, 2);
  });
});

describe('trigger.astar', () => {
  test('com obstáculo: hananRoute semeia contorno', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }, { id: 'obs' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: { routing: { fission: { trigger: 'astar' } } },
    };
    const input = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const rects = new Map([
      ['obs', { x: 80, y: -20, width: 40, height: 40 }],
    ]);
    const { routedEdges, state } = runPhysicsRouter(
      ir, rects, { ancestors: new Map() },
      { _inputRoutedEdges: input },
    );
    // A* deve produzir polyline com mais que 2 pontos pra contornar.
    const pts = routedEdges.get('E').points;
    assert.ok(pts.length >= 3, `A* deveria contornar (pts=${pts.length})`);
    // fissionEnabled = false em modo astar.
    assert.equal(state.world.fissionEnabled, false);
    // Endpoints preservados.
    assert.equal(pts[0].x, 0);
    assert.equal(pts[pts.length - 1].x, 200);
  });

  test('sem obstáculo: hananRoute retorna null, polyline original preservada', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: { routing: { fission: { trigger: 'astar' } } },
    };
    const input = new Map([['E', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])]]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), { ancestors: new Map() },
      { _inputRoutedEdges: input },
    );
    const pts = routedEdges.get('E').points;
    assert.equal(pts.length, 2);
  });
});

describe('trigger.hybrid', () => {
  test('A* semeia + fissão habilitada', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }, { id: 'obs' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: { routing: { fission: { trigger: 'hybrid' } } },
    };
    const input = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const rects = new Map([
      ['obs', { x: 80, y: -20, width: 40, height: 40 }],
    ]);
    const { state } = runPhysicsRouter(
      ir, rects, { ancestors: new Map() },
      { _inputRoutedEdges: input },
    );
    assert.equal(state.world.fissionEnabled, true);
  });
});

describe('A* ignora rects de source/target/ancestors', () => {
  test('obstacle não-relacionado contorna; source/target não viram obstáculo', () => {
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: { routing: { fission: { trigger: 'astar' } } },
    };
    const input = new Map([['E', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])]]);
    const rects = new Map([
      // s e t cobrem o início/fim do segmento; se entrassem como
      // obstáculos, hananRoute falharia (origem em obstacle).
      ['s', { x: -10, y: -10, width: 20, height: 20 }],
      ['t', { x: 90,  y: -10, width: 20, height: 20 }],
    ]);
    const { routedEdges } = runPhysicsRouter(
      ir, rects, { ancestors: new Map() },
      { _inputRoutedEdges: input },
    );
    const pts = routedEdges.get('E').points;
    // Sem obstáculo real → preserva polyline reta. Após o redesenho do
    // warm-start (anchor no perímetro), os endpoints saem do CENTRO e
    // pousam na face do nó mais próxima do edgeCenter — para esses rects
    // de 20×20 centrados em (0,0) e (100,0), isso é (10, 0) e (90, 0).
    assert.equal(pts.length, 2);
    assert.equal(pts[0].x, 10);
    assert.equal(pts[1].x, 90);
  });
});
