// Fase 5.7: fusão Manhattan. Quando um segmento ortogonal fica curto
// demais (length < K * strokeWidth), o corner do meio é "absorvido"
// pelos dois segmentos perpendiculares adjacentes — a polyline perde
// o degrau redundante. Limita corrugação A* (B14) e mantém a polyline
// suave após convergência do solver.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld } from '../../../src/routing/physics/warm-start.js';
import { step } from '../../../src/routing/physics/solver.js';
import {
  mergeColinear,
  shouldMerge,
  segmentLength,
  FUSION_MANHATTAN_K_DEFAULT,
  COOLDOWN_DEFAULT,
} from '../../../src/routing/physics/topology.js';

function poly(points) { return { points }; }

describe('topology.segmentLength + shouldMerge — mecânica', () => {
  test('segmentLength devolve |x1-x0| para horizontal, |y1-y0| para vertical', () => {
    const h = { orientation: 'h', prevCorner: { x: 0, y: 5 }, nextCorner: { x: 30, y: 5 } };
    const v = { orientation: 'v', prevCorner: { x: 10, y: 0 }, nextCorner: { x: 10, y: 50 } };
    assert.equal(segmentLength(h), 30);
    assert.equal(segmentLength(v), 50);
  });

  test('shouldMerge true só quando length < K*stroke + sem pin + perpendiculares OK', () => {
    // Edge com 3 segs: V H V. H curto (length=6, stroke=2, K=4 → limiar=8).
    // Corners intermediários livres, perpendiculares OK. Anchors source/
    // target na MESMA coord-x (0) — assim a Manhattan-safety check da fusão
    // (outer pins iguais no eixo do run) não bloqueia. Cenário comum de Z.
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 0, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const hSeg = info.segments[1];
    hSeg.strokeWidth = 2;
    assert.equal(segmentLength(hSeg), 6);
    assert.equal(shouldMerge(hSeg, world, 4), true);

    // Mesmo seg em length=10 (≥ 4*2=8) → não funde.
    hSeg.nextCorner.x = 10;
    assert.equal(shouldMerge(hSeg, world, 4), false);
  });

  test('shouldMerge false quando corner adjacente é pinado', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    // Segmento curto adjacente a anchor — primeiro segmento.
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 30 }, { x: 30, y: 30 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const hShort = info.segments[0];  // primeiro segment (entre anchor e c1)
    hShort.strokeWidth = 2;
    assert.equal(shouldMerge(hShort, world, 4), false,
      'segmento adjacente a anchor não deve fundir');
  });

  test('shouldMerge respeita cooldown', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 4, y: -20 }, { x: 4, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const hSeg = info.segments[1];
    hSeg.strokeWidth = 2;
    hSeg.topologyCooldown = 5;
    assert.equal(shouldMerge(hSeg, world, 4), false);
  });
});

describe('topology.mergeColinear — operação topológica', () => {
  test('absorve segmento curto: 3 segs → 2 segs, 4 corners → 3 corners', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 6, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const hShort = info.segments[1];
    const v0 = info.segments[0];
    const v1 = info.segments[2];

    const result = mergeColinear(hShort, world);
    assert.ok(result, 'merge deve retornar { cm, prevSeg, nextSeg }');
    assert.equal(result.prevSeg, v0);
    assert.equal(result.nextSeg, v1);
    assert.equal(info.segments.length, 2);
    assert.equal(info.corners.length, 3);
    // Cm está no midpoint dos 2 corners absorvidos.
    assert.equal(result.cm.x, 3);
    assert.equal(result.cm.y, -20);
    // v0 e v1 agora apontam pra cm.
    assert.equal(v0.nextCorner, result.cm);
    assert.equal(v1.prevCorner, result.cm);
    // Cooldown setado.
    assert.ok(result.cm.topologyCooldown > 0);
  });

  test('NÃO funde se corner adjacente é pinned (segmento terminal)', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 30 }, { x: 30, y: 30 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    const result = mergeColinear(info.segments[0], world);
    assert.equal(result, null, 'segmento terminal não funde');
    assert.equal(info.segments.length, 3, 'estrutura inalterada');
  });

  test('NÃO funde se adjacentes têm mesma orientação (impossibilidade Manhattan)', () => {
    // Polyline pós-split: 3 segs h em sequência (entre anchors h-h-h).
    // Não deveria existir naturalmente, mas defensivo após split.
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 6, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    // Força orientação inválida: o seg "anterior" agora é h também
    // (mismatch artificial).
    info.segments[0].orientation = info.segments[1].orientation;
    const result = mergeColinear(info.segments[1], world);
    assert.equal(result, null);
  });
});

describe('fusão integrada no solver', () => {
  test('segmento Manhattan-curto detectado e fundido em 1 step', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    // Z com anchors na MESMA coord-x — Manhattan-safety check da fusão libera.
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 0, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    assert.equal(info.segments.length, 3);

    // strokeWidth default = 2 (resolveStroke fallback). K=4 → limiar=8.
    // length(H curto)=6 → < 8 → funde.
    step(world, { fusionEnabled: true });

    assert.equal(info.segments.length, 2);
    assert.equal(info.corners.length, 3);
  });

  test('cooldown bloqueia fusão imediata pós-merge', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 0, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    step(world, { fusionEnabled: true });
    assert.equal(info.segments.length, 2);
    // Imediatamente após, cm tem cooldown. Mesmo se gerássemos outro
    // seg curto, não fundiria nos próximos ticks. Validamos só que
    // cooldown >= 1 imediatamente.
    assert.ok(info.corners[1].topologyCooldown > 0);
  });

  test('fusão sem habilitação não acontece', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 6, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    step(world, {});  // fusionEnabled default false
    assert.equal(info.segments.length, 3, 'sem flag → sem fusão');
  });

  test('K configurável: K=2 funde apenas length<4*2=8', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    // Length=6, stroke=2, K=2 → limiar=4. 6 >= 4 → NÃO funde.
    const routed = new Map([['E', poly([
      { x: 0, y: 0 }, { x: 0, y: -20 }, { x: 6, y: -20 }, { x: 6, y: 0 },
    ])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const info = world.edgeIndex.get('E');
    step(world, { fusionEnabled: true, fusionManhattanK: 2 });
    assert.equal(info.segments.length, 3, 'K=2 + length=6 não dispara fusão');
  });
});

describe('warm-start propaga strokeWidth para seg', () => {
  test('strokeWidth default = 2 quando edge não declara', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't' }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 50, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const seg = world.edgeIndex.get('E').segments[0];
    assert.equal(seg.strokeWidth, 2);
  });

  test('strokeWidth lê edge.style.strokeWidth quando declarado', () => {
    const ir = { edges: [{ id: 'E', source: 's', target: 't', style: { strokeWidth: 5 } }] };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 50, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const seg = world.edgeIndex.get('E').segments[0];
    assert.equal(seg.strokeWidth, 5);
  });

  test('strokeWidth lê meta.routing.fusion.defaultStroke quando edge não tem', () => {
    const ir = {
      edges: [{ id: 'E', source: 's', target: 't' }],
      meta: { routing: { fusion: { defaultStroke: 3 } } },
    };
    const routed = new Map([['E', poly([{ x: 0, y: 0 }, { x: 50, y: 0 }])]]);
    const world = buildWorld(ir, routed, { ancestors: new Map() });
    const seg = world.edgeIndex.get('E').segments[0];
    assert.equal(seg.strokeWidth, 3);
  });
});
