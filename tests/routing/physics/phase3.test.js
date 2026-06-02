// Fase 3 do solver físico: repulsão segmento↔node (B18: edges não
// atravessam nós alheios) + repulsão paralela (B17: gap mínimo entre
// segmentos paralelos sobrepostos). Sem fissão/fusão e sem A* — esses
// hooks ficam pra fase futura.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, commitWorld } from '../../../src/routing/physics/warm-start.js';
import { runPhysicsRouter } from '../../../src/routing/physics/index.js';
import { runUntilStable, step } from '../../../src/routing/physics/solver.js';
import {
  applyNodeRepulsion,
  applyParallelRepulsion,
  segmentBBox,
} from '../../../src/routing/physics/forces.js';
import { getSegmentC, makeCornerBody, makeSegmentBody } from '../../../src/routing/physics/bodies.js';

function poly(points) { return { points }; }

describe('physics fase 3 — repulsão paralela (B17)', () => {
  test('dois segmentos horizontais a 1px (com corners livres) separam até minGap', () => {
    // Polylines em U: anchors pinados nos endpoints (y=0), o segmento
    // horizontal intermediário fica em y=-46 / y=-47 e tem corners
    // intermediários LIVRES (necessário pro solver poder mover).
    // Edge A: (0,0) → (0,-46) → (200,-46) → (200,0)
    // Edge B: (50,0) → (50,-47) → (150,-47) → (150,0)
    // Horizontais sobrepõem em x=[50,150] com 1px de gap em y.
    const ir = { edges: [
      { id: 'A', source: 's1', target: 't1' },
      { id: 'B', source: 's2', target: 't2' },
    ] };
    const routed = new Map([
      ['A', poly([
        { x: 0, y: 0 }, { x: 0, y: -46 }, { x: 200, y: -46 }, { x: 200, y: 0 },
      ])],
      ['B', poly([
        { x: 50, y: 0 }, { x: 50, y: -47 }, { x: 150, y: -47 }, { x: 150, y: 0 },
      ])],
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const result = runUntilStable(world, { maxIter: 2000, parallelGap: 12, eps: 0.05 });

    const ptsA = commitWorld(world).get('A').points;
    const ptsB = commitWorld(world).get('B').points;
    // A.points[1].y e A.points[2].y são o segmento horizontal de A.
    // Idem B.points[1].y e B.points[2].y.
    const yA = ptsA[1].y;
    const yB = ptsB[1].y;
    const gap = Math.abs(yA - yB);
    assert.ok(gap >= 11, `gap final deve ser ≥ 11px (foi ${gap.toFixed(2)})`);
    assert.ok(result.converged, `solver deve convergir (${result.iterations} iter)`);
  });

  test('dois segmentos paralelos SEM overlap não se repelem', () => {
    const ir = { edges: [
      { id: 'A', source: 's1', target: 't1' },
      { id: 'B', source: 's2', target: 't2' },
    ] };
    const routed = new Map([
      ['A', poly([{ x: 0,   y: 0 }, { x: 50,  y: 0 }])],
      ['B', poly([{ x: 200, y: 0 }, { x: 300, y: 0 }])],  // não overlap
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    runUntilStable(world, { maxIter: 100, parallelGap: 50 });
    const yA = commitWorld(world).get('A').points[0].y;
    const yB = commitWorld(world).get('B').points[0].y;
    assert.equal(yA, 0);
    assert.equal(yB, 0);
  });

  test('segmentos perpendiculares (orientações diferentes) NÃO entram em repulsão paralela', () => {
    const ir = { edges: [
      { id: 'A', source: 's1', target: 't1' },
      { id: 'B', source: 's2', target: 't2' },
    ] };
    const routed = new Map([
      ['A', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])],   // horizontal
      ['B', poly([{ x: 50, y: -50 }, { x: 50, y: 50 }])], // vertical cruzando
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    // Aplica APENAS repulsão paralela.
    applyParallelRepulsion(world);
    const segA = world.bodies.find((b) => b.id === 'A#s0');
    const segB = world.bodies.find((b) => b.id === 'B#s0');
    // Sem repulsão: corners adjacentes não recebem força perpendicular.
    assert.equal(segA.prevCorner.fy, 0);
    assert.equal(segA.nextCorner.fy, 0);
    assert.equal(segB.prevCorner.fx, 0);
    assert.equal(segB.nextCorner.fx, 0);
  });

  test('segmentos da MESMA edge não se repelem (corrugação)', () => {
    // Edge degenerada com 2 segmentos horizontais paralelos colados
    // (não acontece em geral, mas garantia defensiva).
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([
      ['E', poly([
        { x: 0, y: 0 }, { x: 50, y: 0 },
        { x: 50, y: 1 }, { x: 100, y: 1 },
      ])],
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    applyParallelRepulsion(world);
    // Segmentos h da mesma edge: s0 (y=0) e s2 (y=1) — não devem se
    // repelir um ao outro (corners adjacentes sem força perp).
    const s0 = world.bodies.find((b) => b.id === 'E#s0');
    const s2 = world.bodies.find((b) => b.id === 'E#s2');
    assert.equal(s0.prevCorner.fy, 0);
    assert.equal(s0.nextCorner.fy, 0);
    assert.equal(s2.prevCorner.fy, 0);
    assert.equal(s2.nextCorner.fy, 0);
  });
});

describe('physics fase 3 — repulsão node (B18)', () => {
  test('segmento horizontal com corner livre desvia de nó alheio', () => {
    // Polyline em U: anchors em (0,0) e (200,0); segmento horizontal
    // intermediário pode mover (corners livres em (0,-30) e (200,-30)).
    // Nó "obstacle" bloqueia y=-30 — solver empurra o segmento pra
    // FORA da BBox do obstáculo.
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([
      ['E', poly([
        { x: 0, y: 0 }, { x: 0, y: -30 }, { x: 200, y: -30 }, { x: 200, y: 0 },
      ])],
    ]);
    const rects = new Map([
      ['obstacle', { x: 80, y: -50, width: 40, height: 40 }],  // y=-50..-10
      ['s', { x: -10, y: -10, width: 20, height: 20 }],
      ['t', { x: 190, y: -10, width: 20, height: 20 }],
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    runUntilStable(world, {
      maxIter: 2000,
      routingRects: rects,
      nodePad: 8,
      eps: 0.05,
    });
    const seg = world.bodies.find((b) => b.id === 'E#s1');  // segmento horizontal
    // Após convergir, getSegmentC(seg) deve estar fora da BBox expandida
    // do obstacle (top=-58, bottom=-2). Segmento começou em c=-30 (dentro);
    // origin spring nos corners puxa de volta pra -30 mas repulsão domina.
    const obsTop = -50 - 8;
    const obsBottom = -10 + 8;
    const c = getSegmentC(seg);
    assert.ok(c <= obsTop || c >= obsBottom,
      `seg.c=${c.toFixed(2)} deveria estar fora de [${obsTop}, ${obsBottom}]`);
  });

  test('segmento NÃO é empurrado por nó da própria edge (source/target)', () => {
    const ir = { edges: [{ id: 'E', source: 'src', target: 'tgt' }] };
    const routed = new Map([
      ['E', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])],
    ]);
    const rects = new Map([
      ['src', { x: -20, y: -10, width: 40, height: 20 }],   // BBox cobre x=0
      ['tgt', { x: 80, y: -10, width: 40, height: 20 }],    // BBox cobre x=100
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    applyNodeRepulsion(world, rects, { nodePad: 8 });
    const seg = world.bodies.find((b) => b.id === 'E#s0');
    // source/target estão em allowedNodeIds, não devem repelir →
    // corners adjacentes ao segmento permanecem sem força perpendicular.
    assert.equal(seg.prevCorner.fy, 0);
    assert.equal(seg.nextCorner.fy, 0);
  });

  test('segmento NÃO é empurrado por ancestor do source/target', () => {
    const ir = { edges: [{ id: 'E', source: 'leaf', target: 'tgt' }] };
    const routed = new Map([
      ['E', poly([{ x: 0, y: 0 }, { x: 100, y: 0 }])],
    ]);
    const rects = new Map([
      // Container que contém 'leaf' — deve ser permitido.
      ['container', { x: -50, y: -50, width: 200, height: 100 }],
    ]);
    const ancestors = new Map([
      ['leaf', new Set(['container'])],
      ['tgt',  new Set()],
    ]);
    const world = buildWorld(ir, routed, { ancestors });
    applyNodeRepulsion(world, rects, { nodePad: 8 });
    const seg = world.bodies.find((b) => b.id === 'E#s0');
    assert.equal(seg.prevCorner.fy, 0);
    assert.equal(seg.nextCorner.fy, 0);
  });
});

describe('physics fase 3 — geometria', () => {
  test('segmentBBox horizontal: x0..x1 derivado dos corners; altura = 2*pad', () => {
    const prevCorner = makeCornerBody({ id: 'a', x: 0, y: 10 });
    const nextCorner = makeCornerBody({ id: 'b', x: 100, y: 10 });
    const seg = makeSegmentBody({
      id: 's', orientation: 'h', pad: 0, prevCorner, nextCorner,
    });
    const bb = segmentBBox(seg);
    assert.equal(bb.x, 0);
    assert.equal(bb.y, 10);
    assert.equal(bb.width, 100);
    assert.equal(bb.height, 0);

    const seg2 = makeSegmentBody({
      id: 's2', orientation: 'h', pad: 3, prevCorner, nextCorner,
    });
    const bb2 = segmentBBox(seg2);
    assert.equal(bb2.y, 7);          // 10 - 3
    assert.equal(bb2.height, 6);     // 2 * 3
  });

  test('segmentBBox vertical: y0..y1 derivado dos corners; largura = 2*pad', () => {
    const prevCorner = makeCornerBody({ id: 'a', x: 5, y: 20 });
    const nextCorner = makeCornerBody({ id: 'b', x: 5, y: 80 });
    const seg = makeSegmentBody({
      id: 's', orientation: 'v', pad: 0, prevCorner, nextCorner,
    });
    const bb = segmentBBox(seg);
    assert.equal(bb.x, 5);
    assert.equal(bb.y, 20);
    assert.equal(bb.width, 0);
    assert.equal(bb.height, 60);
  });
});

describe('physics fase 3 — runPhysicsRouter end-to-end', () => {
  test('cenário sem colisões: round-trip ainda preserva polyline', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const input = new Map([
      ['E', poly([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }])],
    ]);
    const { routedEdges } = runPhysicsRouter(
      ir, new Map(), { ancestors: new Map() },
      { _inputRoutedEdges: input, routing: { stepsPerTick: 30 } },
    );
    const out = routedEdges.get('E').points;
    // Sem repulsão: spring de origem mantém a polyline (tol 0.5px).
    assert.ok(Math.abs(out[0].x - 0) < 0.5);
    assert.ok(Math.abs(out[1].x - 50) < 0.5);
    assert.ok(Math.abs(out[2].y - 100) < 0.5);
    assert.ok(Math.abs(out[3].x - 100) < 0.5);
  });

  test('cenário com obstáculo sem corner livre: endpoints permanecem no perímetro (vagão no trilho)', () => {
    // Segmento entre 2 anchors pinados não consegue desviar via
    // movimento direto. Após 5.5, fissão é o mecanismo padrão pra
    // contornar — adiciona corners intermediários. No novo modelo
    // (perimeter anchors), os ANCHORS deslizam tangencialmente no
    // perímetro do nó, mas nunca saem dele.
    const ir = {
      nodes: [{ id: 's' }, { id: 't' }],
      edges: [{ id: 'E', source: 's', target: 't' }],
    };
    const input = new Map([
      ['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])],
    ]);
    const rects = new Map([
      ['obstacle', { x: 80, y: -20, width: 40, height: 40 }],
      ['s', { x: -20, y: -10, width: 20, height: 20 }],
      ['t', { x: 200, y: -10, width: 20, height: 20 }],
    ]);
    const { routedEdges } = runPhysicsRouter(
      ir, rects, { ancestors: new Map() },
      {
        _inputRoutedEdges: input,
        routing: { stepsPerTick: 50, nodePad: 8 },
      },
    );
    const out = routedEdges.get('E').points;
    // Source anchor on s perímetro (east face: x=0, y in [-10, 10]).
    // Pode ter deslizado tangencialmente sob força perp de obstacle.
    assert.equal(out[0].x, 0, `source anchor saiu do perímetro east de s, x=${out[0].x}`);
    assert.ok(out[0].y >= -10 && out[0].y <= 10, `source anchor y=${out[0].y} fora do span da face east`);
    // Target anchor on t perímetro (west face: x=200, y in [-10, 10]).
    const last = out[out.length - 1];
    assert.equal(last.x, 200, `target anchor saiu do perímetro west de t, x=${last.x}`);
    assert.ok(last.y >= -10 && last.y <= 10, `target anchor y=${last.y} fora do span da face west`);
  });

  test('cenário com polyline em U: segmento horizontal desvia de nó alheio', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const input = new Map([
      ['E', poly([
        { x: 0, y: 0 }, { x: 0, y: -30 }, { x: 100, y: -30 }, { x: 100, y: 0 },
      ])],
    ]);
    const rects = new Map([
      ['obstacle', { x: 30, y: -50, width: 40, height: 40 }],  // y=-50..-10
      ['s', { x: -10, y: -10, width: 20, height: 20 }],
      ['t', { x: 90, y: -10, width: 20, height: 20 }],
    ]);
    const { routedEdges } = runPhysicsRouter(
      ir, rects, { ancestors: new Map() },
      {
        _inputRoutedEdges: input,
        routing: { stepsPerTick: 500, nodePad: 8 },
      },
    );
    const out = routedEdges.get('E').points;
    const top = -50 - 8;
    const bottom = -10 + 8;
    // Endpoints fixos.
    assert.equal(out[0].y, 0);
    assert.equal(out[3].y, 0);
    // Segmento horizontal (corners p1 e p2 — devem ter mesmo y).
    const yMid = out[1].y;
    assert.ok(yMid <= top || yMid >= bottom,
      `corner intermediário y=${yMid.toFixed(2)} deveria estar fora de [${top}, ${bottom}]`);
    assert.ok(Math.abs(out[1].y - out[2].y) < 0.01,
      'corners do segmento horizontal devem manter mesma altura (Manhattan)');
  });
});
