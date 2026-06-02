// Fase 3c — repulsão perpendicular: separa segmentos de orientações
// opostas que se CRUZAM, mas SÓ entre edges que compartilham edgeLayer.
// Regra de design do usuário: "edges podem se cruzar quando não existe
// interseção entre suas edgeLayers". O predicado é `opts.edgePair(eidA,
// eidB)` (vem de `resolver.edgeLayerPair`): null → cruzamento livre;
// {frac:{a,b}} → repelem, com split de deslocamento por peso.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, commitWorld } from '../../../src/routing/physics/warm-start.js';
import { runUntilStable } from '../../../src/routing/physics/solver.js';
import { applyPerpRepulsion } from '../../../src/routing/physics/forces.js';
import { runPhysicsRouter } from '../../../src/routing/physics/index.js';
import { buildCollisionResolver } from '../../../src/layout/collision.js';
import { countSharedLayerCrossings } from '../../../src/routing/crossings.js';

function poly(points) { return { points }; }

// Mundo com DUAS edges que se cruzam em (100, -50):
//   A: U deitado — horizontal médio em y=-50, x∈[0,200], corners LIVRES
//      (pode escapar em y). Anchors pinados em (0,0) e (200,0).
//   B: poste vertical em x=100, y∈[-100,50], AMBOS endpoints pinados →
//      fixo. A escapa pra CIMA (y<-100) em espaço aberto, sem trilho
//      paralelo no caminho.
function crossingWorld() {
  const ir = { edges: [
    { id: 'A', source: 'sA', target: 'tA' },
    { id: 'B', source: 'sB', target: 'tB' },
  ] };
  const routed = new Map([
    ['A', poly([{ x: 0, y: 0 }, { x: 0, y: -50 }, { x: 200, y: -50 }, { x: 200, y: 0 }])],
    ['B', poly([{ x: 100, y: -100 }, { x: 100, y: 50 }])],
  ]);
  return buildWorld(ir, routed, { ancestors: new Map() });
}

// Resolver de mentira: layers compartilhados (sempre colide), 50/50.
const sharedLayer = { frac: { a: 0.5, b: 0.5 } };
const collideEq = () => sharedLayer;

describe('physics fase 3c — repulsão perpendicular', () => {
  test('aplica força que separa o cruzamento (layer compartilhada)', () => {
    const world = crossingWorld();
    applyPerpRepulsion(world, { edgePair: collideEq });
    // A#s1 é horizontal (corners A#c1, A#c2) — empurrado em y.
    const Ac1 = world.bodies.find((b) => b.id === 'A#c1');
    const Ac2 = world.bodies.find((b) => b.id === 'A#c2');
    // B#s0 é vertical (corners B#c0, B#c1) — empurrado em x.
    const Bc0 = world.bodies.find((b) => b.id === 'B#c0');
    const Bc1 = world.bodies.find((b) => b.id === 'B#c1');
    // Saída de A é pra cima (up=50 < down=100) → -y.
    assert.ok(Ac1.fy < 0 && Ac2.fy < 0, `A devia ser empurrado em -y (fy=${Ac1.fy},${Ac2.fy})`);
    assert.equal(Ac1.fx, 0, 'A horizontal não recebe força em x');
    // B empurrado em x (ambos corners mesma direção).
    assert.ok(Bc0.fx !== 0 && Bc1.fx !== 0, `B devia ser empurrado em x (fx=${Bc0.fx},${Bc1.fx})`);
    assert.equal(Math.sign(Bc0.fx), Math.sign(Bc1.fx));
    assert.equal(Bc0.fy, 0, 'B vertical não recebe força em y');
  });

  test('REGRA DO USUÁRIO: layers disjuntos → sem força (cruzamento livre)', () => {
    const world = crossingWorld();
    applyPerpRepulsion(world, { edgePair: () => null });
    for (const id of ['A#c1', 'A#c2', 'B#c0', 'B#c1']) {
      const b = world.bodies.find((x) => x.id === id);
      assert.equal(b.fx, 0, `${id}.fx`);
      assert.equal(b.fy, 0, `${id}.fy`);
    }
  });

  test('sem predicado edgePair → no-op (preserva step das fases 2–5)', () => {
    const world = crossingWorld();
    applyPerpRepulsion(world, {});
    for (const b of world.bodies) {
      if (b.kind === 'segment') continue;
      assert.equal(b.fx, 0);
      assert.equal(b.fy, 0);
    }
  });

  test('perpendiculares que NÃO se cruzam não recebem força', () => {
    const ir = { edges: [
      { id: 'A', source: 'sA', target: 'tA' },
      { id: 'B', source: 'sB', target: 'tB' },
    ] };
    const routed = new Map([
      ['A', poly([{ x: 0, y: 0 }, { x: 0, y: -50 }, { x: 200, y: -50 }, { x: 200, y: 0 }])],
      // Poste vertical bem à direita do span de A — sem cruzamento.
      ['B', poly([{ x: 350, y: -100 }, { x: 350, y: 50 }])],
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    applyPerpRepulsion(world, { edgePair: collideEq });
    for (const b of world.bodies) {
      if (b.kind === 'segment') continue;
      assert.equal(b.fx, 0);
      assert.equal(b.fy, 0);
    }
  });

  test('split por peso: frac {a:0,b:1} → só a edge B cede', () => {
    const world = crossingWorld();
    // edgeIndex é populado na ordem de ir.edges → eidA='A', eidB='B'.
    // frac.a se aplica a A, frac.b a B.
    applyPerpRepulsion(world, { edgePair: () => ({ frac: { a: 0, b: 1 } }) });
    const Ac1 = world.bodies.find((b) => b.id === 'A#c1');
    const Bc0 = world.bodies.find((b) => b.id === 'B#c0');
    assert.equal(Ac1.fy, 0, 'A (frac.a=0) não deve receber deslocamento');
    assert.ok(Bc0.fx !== 0, 'B (frac.b=1) deve absorver todo o deslocamento');
  });

  // Decisão de design: pares que COMPARTILHAM nó também se repelem, mas
  // NÃO perto do nó comum (a âncora pinada faz jitter). `edgePair`
  // sinaliza isso via `sharedNodes`.
  function sharedNodeWorld(bPole) {
    const ir = { edges: [
      { id: 'A', source: 'N', target: 'tA' },
      { id: 'B', source: 'N', target: 'tB' },
    ] };
    const routed = new Map([
      ['A', poly([{ x: 0, y: 0 }, { x: 0, y: -50 }, { x: 200, y: -50 }, { x: 200, y: 0 }])],
      ['B', poly(bPole)],
    ]);
    return buildWorld(ir, routed, { ancestors: new Map() });
  }
  const sharedPair = () => ({ frac: { a: 0.5, b: 0.5 }, sharedNodes: ['N'] });
  const noSharePair = () => ({ frac: { a: 0.5, b: 0.5 }, sharedNodes: [] });

  test('nó comum: cruzamento PERTO da âncora → SEPARA (P7/Q1 removeu spare-blanket)', () => {
    // Poste curto: cruza A em (100,-50), a 5px do endpoint (100,-55).
    // ANTES de P7: spare-blanket pulava cruzamentos perto de âncora comum.
    // DEPOIS de P7: spare-blanket removido; o vagão-no-trilho (P2) absorve
    // o jitter no anchor, então não precisa mais poupar.
    const world = sharedNodeWorld([{ x: 100, y: -55 }, { x: 100, y: 50 }]);
    applyPerpRepulsion(world, { edgePair: sharedPair });
    const Ac1 = world.bodies.find((b) => b.id === 'A#c1');
    assert.ok(Ac1.fy !== 0, 'cruzamento perto do nó comum agora é separado normalmente');
  });

  test('nó comum: cruzamento LONGE da âncora → força aplicada', () => {
    // Poste longo: cruza A em (100,-50), a 50px do endpoint mais próximo.
    const world = sharedNodeWorld([{ x: 100, y: -100 }, { x: 100, y: 50 }]);
    applyPerpRepulsion(world, { edgePair: sharedPair });
    const Ac1 = world.bodies.find((b) => b.id === 'A#c1');
    assert.ok(Ac1.fy !== 0, 'cruzamento longe do nó comum é separado');
  });

  test('SEM nó comum: proximidade não importa → força aplicada', () => {
    const world = sharedNodeWorld([{ x: 100, y: -55 }, { x: 100, y: 50 }]);
    applyPerpRepulsion(world, { edgePair: noSharePair });
    const Ac1 = world.bodies.find((b) => b.id === 'A#c1');
    assert.ok(Ac1.fy !== 0, 'sem nó comum, a exceção de vizinhança não se aplica');
  });

  test('convergência: cruzamento é resolvido (layer compartilhada)', () => {
    const world = crossingWorld();
    const before = countSharedLayerCrossings(commitWorld(world), { edgeLayerPair: collideEq });
    assert.equal(before, 1, 'cenário inicial tem exatamente 1 cruzamento');

    const res = runUntilStable(world, { maxIter: 4000, edgePair: collideEq, eps: 0.05 });

    const after = countSharedLayerCrossings(commitWorld(world), { edgeLayerPair: collideEq });
    assert.equal(after, 0, `cruzamento devia ser resolvido (sobrou ${after}, ${res.iterations} iter)`);
    // Endpoints pinados nunca se movem.
    const pts = commitWorld(world).get('A').points;
    assert.equal(pts[0].x, 0); assert.equal(pts[0].y, 0);
    assert.equal(pts[3].x, 200); assert.equal(pts[3].y, 0);
  });

  test('convergência: layers disjuntos → cruzamento PRESERVADO', () => {
    const world = crossingWorld();
    runUntilStable(world, { maxIter: 4000, edgePair: () => null, eps: 0.05 });
    const after = countSharedLayerCrossings(commitWorld(world), { edgeLayerPair: collideEq });
    assert.equal(after, 1, 'sem layer compartilhada o solver não desfaz o cruzamento');
  });
});

describe('physics fase 3c — wiring via runPhysicsRouter + resolver real', () => {
  test('edges compartilhando edgeLayer descruzam end-to-end', () => {
    const ir = {
      nodes: [{ id: 'sA' }, { id: 'tA' }, { id: 'sB' }, { id: 'tB' }],
      edges: [
        { id: 'A', source: 'sA', target: 'tA', nodeCollision: new Map(), edgeCollision: new Map([['L', 0.5]]) },
        { id: 'B', source: 'sB', target: 'tB', nodeCollision: new Map(), edgeCollision: new Map([['L', 0.5]]) },
      ],
    };
    const resolver = buildCollisionResolver(ir);
    const input = new Map([
      ['A', poly([{ x: 0, y: 0 }, { x: 0, y: -50 }, { x: 200, y: -50 }, { x: 200, y: 0 }])],
      ['B', poly([{ x: 100, y: -100 }, { x: 100, y: 50 }])],
    ]);
    const before = countSharedLayerCrossings(input, resolver);
    assert.equal(before, 1);

    const { routedEdges } = runPhysicsRouter(ir, new Map(), resolver, {
      _inputRoutedEdges: input,
      routing: { stepsPerTick: 800 },
    });
    const after = countSharedLayerCrossings(routedEdges, resolver);
    assert.ok(after < before, `crossings devem reduzir end-to-end (antes ${before}, depois ${after})`);
  });

  test('resolver sem edgeLayerPair (ex.: {ancestors}) não quebra runPhysicsRouter', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const input = new Map([
      ['E', poly([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }])],
    ]);
    const { routedEdges } = runPhysicsRouter(ir, new Map(), { ancestors: new Map() }, {
      _inputRoutedEdges: input, routing: { stepsPerTick: 30 },
    });
    const out = routedEdges.get('E').points;
    assert.ok(Math.abs(out[0].x - 0) < 0.5);
    assert.ok(Math.abs(out[3].x - 100) < 0.5);
  });
});
