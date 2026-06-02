// Fase 5.5: fissão real. Quando o solver detecta força perpendicular
// líquida persistente em um segmento (típico de "edge entre 2 anchors
// pinados com obstáculo no caminho"), divide o segmento criando um
// CornerBody no midpoint. O novo corner tem DOF próprio e pode se
// mover pra contornar o obstáculo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, commitWorld } from '../../../src/routing/physics/warm-start.js';
import { step, runUntilStable } from '../../../src/routing/physics/solver.js';
import {
  splitSegment,
  updateSplitCounter,
  shouldSplit,
  segmentResidualForce,
  SPLIT_THRESHOLD_DEFAULT,
  SPLIT_TICKS_DEFAULT,
  COOLDOWN_DEFAULT,
} from '../../../src/routing/physics/topology.js';
import { getSegmentC } from '../../../src/routing/physics/bodies.js';

function poly(points) { return { points }; }

describe('topology.splitSegment — mecânica isolada', () => {
  test('split insere corner no midpoint e divide em 2 segmentos', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const seg = info.segments[0];

    const result = splitSegment(seg, world);
    assert.ok(result, 'split deve retornar { cm, seg1, seg2 }');
    assert.equal(info.segments.length, 2, 'agora há 2 segmentos');
    assert.equal(info.corners.length, 3, 'novo corner inserido no meio');
    assert.equal(info.corners[1], result.cm);
    assert.equal(info.corners[1].x, 100);
    assert.equal(info.corners[1].y, 0);
    // Cooldown setado no novo corner + 2 novos segments.
    assert.ok(result.cm.topologyCooldown > 0);
    assert.ok(result.seg1.topologyCooldown > 0);
    assert.ok(result.seg2.topologyCooldown > 0);
  });

  test('split atualiza world.bodies — remove seg antigo, adiciona 3 novos', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const oldSeg = info.segments[0];
    const before = world.bodies.length;

    splitSegment(oldSeg, world);
    // -1 (oldSeg) +3 (cm + seg1 + seg2) = +2.
    assert.equal(world.bodies.length, before + 2);
    assert.ok(!world.bodies.includes(oldSeg), 'oldSeg foi removido de bodies');
  });

  test('preservar orientation e pad nos novos segments', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 100 }, { x: 0, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const seg = info.segments[0];
    seg.pad = 5;
    const { seg1, seg2 } = splitSegment(seg, world);
    assert.equal(seg1.orientation, 'v');
    assert.equal(seg2.orientation, 'v');
    assert.equal(seg1.pad, 5);
    assert.equal(seg2.pad, 5);
  });
});

describe('topology.updateSplitCounter + shouldSplit', () => {
  test('contador zera quando força residual cai abaixo do threshold', () => {
    const seg = { prevCorner: { fx: 0, fy: 5 }, nextCorner: { fx: 0, fy: 5 },
                  orientation: 'h', residualTicks: 0, topologyCooldown: 0 };
    updateSplitCounter(seg, 4);  // |fy_avg|=5 ≥ 4
    assert.equal(seg.residualTicks, 1);
    seg.prevCorner.fy = 1;
    seg.nextCorner.fy = 1;
    updateSplitCounter(seg, 4);  // |fy_avg|=1 < 4
    assert.equal(seg.residualTicks, 0);
  });

  test('shouldSplit respeita cooldown', () => {
    const seg = { prevCorner: { fx: 0, fy: 10 }, nextCorner: { fx: 0, fy: 10 },
                  orientation: 'h', residualTicks: 10, topologyCooldown: 5 };
    assert.equal(shouldSplit(seg, 4, 5), false, 'cooldown ativo bloqueia');
    seg.topologyCooldown = 0;
    assert.equal(shouldSplit(seg, 4, 5), true);
  });

  test('segmentResidualForce calcula média perpendicular', () => {
    const h = { prevCorner: { fx: 0, fy: 8 }, nextCorner: { fx: 0, fy: 4 },
                orientation: 'h' };
    assert.equal(segmentResidualForce(h), 6);
    const v = { prevCorner: { fx: 10, fy: 0 }, nextCorner: { fx: 2, fy: 0 },
                orientation: 'v' };
    assert.equal(segmentResidualForce(v), 6);
  });
});

describe('fissão integrada no solver', () => {
  test('força residual persistente dispara shelf split em seg com anchor pinado', () => {
    // Edge ponto-a-ponto com obstáculo — C1 e C2 pinados como anchors.
    // Split simples (1 corner colinear) colapsaria pra mesma y dos
    // anchors pela projeção Manhattan, sem desvio. Engine seleciona
    // shelf-shape: cria 4 corners + 5 segs alternando H-V-H-V-H. O seg
    // V central tem DOF perpendicular livre — permite afastamento real.
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const rects = new Map([
      ['obstacle', { x: 80, y: -20, width: 40, height: 40 }],
      ['s', { x: -10, y: -10, width: 20, height: 20 }],
      ['t', { x: 190, y: -10, width: 20, height: 20 }],
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    assert.equal(info.segments.length, 1, 'começa com 1 segmento');

    for (let i = 0; i < SPLIT_TICKS_DEFAULT + 1; i++) {
      step(world, { routingRects: rects, nodePad: 8, fissionEnabled: true });
    }
    assert.equal(info.segments.length, 5, 'shelf split: 1→5 segs');
    assert.equal(info.corners.length, 6, 'shelf: 2 anchors + 4 corners novos');
    // Orientações alternadas: H-V-H-V-H (a edge original era H).
    assert.deepEqual(
      info.segments.map((s) => s.orientation),
      ['h', 'v', 'h', 'v', 'h'],
    );
    // Novos corpos têm cooldown ativo.
    for (let i = 1; i <= 4; i++) {
      assert.ok(info.corners[i].topologyCooldown > 0, `Cm${i} tem cooldown`);
    }
    for (const s of info.segments) {
      assert.ok(s.topologyCooldown > 0, 'novos segs têm cooldown');
    }
  });

  test('fissão NÃO ocorre sem força residual persistente', () => {
    // Mesma fixture mas sem obstáculo. Solver converge sem precisar
    // de split — nenhum segmento atinge o threshold por K ticks.
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const before = info.segments.length;

    runUntilStable(world, { maxIter: 200, eps: 0.05, fissionEnabled: true });

    assert.equal(info.segments.length, before, 'sem força → sem split');
    assert.equal(info.corners.length, 2);
  });

  test('shelf afasta de obstáculo: cm2/cm3 movem em y livre do anchor pin', () => {
    // Regressão pra fase 5.x: o teste anterior validava só que o split
    // aconteceu. Aqui validamos que o seg V central da shelf de fato
    // ALCANÇA afastamento — sem isso, edge H atravessava nodes mesmo
    // com fissão ativa (anchor pinava todo o run via projectRun).
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const rects = new Map([
      ['obstacle', { x: 80, y: -20, width: 40, height: 40 }],
      ['s', { x: -10, y: -10, width: 20, height: 20 }],
      ['t', { x: 190, y: -10, width: 20, height: 20 }],
    ]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');

    // Roda steps suficientes pra (a) acumular residualTicks → shelf
    // split, (b) cooldown decremente, (c) forças continuem empurrando
    // os corners centrais (cm2, cm3) pra fora do obstáculo.
    for (let i = 0; i < 50; i++) {
      step(world, { routingRects: rects, nodePad: 8, fissionEnabled: true });
    }
    assert.equal(info.segments.length, 5, 'shelf intacta');
    const [, cm1, cm2, cm3, cm4] = info.corners;
    // cm1/cm4 ficam na y do anchor (pinned por seg H adjacente ao anchor).
    assert.ok(Math.abs(cm1.y - 0) < 0.1, `cm1.y deve ≈ 0 (anchor pin), got ${cm1.y}`);
    assert.ok(Math.abs(cm4.y - 0) < 0.1, `cm4.y deve ≈ 0 (anchor pin), got ${cm4.y}`);
    // cm2/cm3 são o "shelf" — devem ter |y| significativo, fora da
    // BBox do obstáculo (que é y ∈ [-20, 20]).
    assert.ok(Math.abs(cm2.y) >= 20, `cm2.y deve afastar do obstáculo, got ${cm2.y}`);
    assert.ok(Math.abs(cm3.y) >= 20, `cm3.y deve afastar do obstáculo, got ${cm3.y}`);
    // cm2 e cm3 compartilham y (estão no mesmo seg H central via projection).
    assert.ok(Math.abs(cm2.y - cm3.y) < 0.1, 'cm2/cm3 colineares (seg H central)');
  });

  test('cooldown bloqueia novo split imediato no segmento recém-criado', () => {
    // Validação direta de `shouldSplit` no contexto pós-split — o
    // teste integrado de cascata em ticks longos depende de timing
    // (residualTicks vs cooldown decrement); aqui isolamos a regra.
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 200, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const { seg1 } = splitSegment(info.segments[0], world);
    // Após split, seg1 tem cooldown=COOLDOWN_DEFAULT (>0). Mesmo com
    // contador já alto, shouldSplit DEVE ser false.
    seg1.residualTicks = 999;
    seg1.prevCorner.fy = 999;
    seg1.nextCorner.fy = 999;
    assert.equal(shouldSplit(seg1, SPLIT_THRESHOLD_DEFAULT, SPLIT_TICKS_DEFAULT),
      false, 'cooldown bloqueia novo split');
  });
});
