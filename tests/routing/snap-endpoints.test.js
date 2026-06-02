// Fase 5.4: snap warm-start. Quando o node declara `snap`/`snapGroups`,
// o endpoint da polyline é projetado pro snap point escolhido ANTES de
// `buildWorld`. Nodes sem declaração mantêm o endpoint contínuo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { snapEndpointsToDiscretePorts } from '../../src/routing/snap-endpoints.js';

function poly(points) { return { points }; }

describe('snapEndpointsToDiscretePorts — opt-in', () => {
  test('node sem snap declarado preserva endpoint contínuo', () => {
    const ir = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ id: 'E', source: 'a', target: 'b' }],
    };
    const routed = new Map([['E', poly([{ x: 13, y: 27 }, { x: 80, y: 27 }])]]);
    const rects = new Map([
      ['a', { x: 0, y: 0, width: 50, height: 50 }],
      ['b', { x: 100, y: 0, width: 50, height: 50 }],
    ]);
    snapEndpointsToDiscretePorts(ir, routed, rects, {});
    const pts = routed.get('E').points;
    assert.deepEqual(pts[0], { x: 13, y: 27 }, 'source endpoint intocado');
    assert.deepEqual(pts[pts.length - 1], { x: 80, y: 27 }, 'target endpoint intocado');
  });

  test('node com snap declarado: endpoint projetado pro snap point mais próximo', () => {
    const ir = {
      nodes: [
        { id: 'a', snap: ['top', 'bottom'] },
        { id: 'b' },
      ],
      edges: [{ id: 'E', source: 'a', target: 'b' }],
    };
    // Polyline original: source em (25, 50) → target em (125, 25). Pra
    // rect 'a' (0,0,50,50), top=(25,0), bottom=(25,50). Ideal=(25,50)
    // está mais perto de bottom.
    const routed = new Map([['E', poly([{ x: 25, y: 50 }, { x: 125, y: 25 }])]]);
    const rects = new Map([
      ['a', { x: 0, y: 0, width: 50, height: 50 }],
      ['b', { x: 100, y: 0, width: 50, height: 50 }],
    ]);
    snapEndpointsToDiscretePorts(ir, routed, rects, {});
    const pts = routed.get('E').points;
    assert.deepEqual(pts[0], { x: 25, y: 50 },
      'source projetado pro bottom (mais próximo de y=50)');
    assert.deepEqual(pts[pts.length - 1], { x: 125, y: 25 },
      'target preservado (sem snap)');
  });

  test('ambos os nodes com snap → ambos os endpoints projetados', () => {
    const ir = {
      nodes: [
        { id: 'a', snap: ['right'] },
        { id: 'b', snap: ['left'] },
      ],
      edges: [{ id: 'E', source: 'a', target: 'b' }],
    };
    const routed = new Map([['E', poly([{ x: 25, y: 25 }, { x: 125, y: 25 }])]]);
    const rects = new Map([
      ['a', { x: 0, y: 0, width: 50, height: 50 }],
      ['b', { x: 100, y: 0, width: 50, height: 50 }],
    ]);
    snapEndpointsToDiscretePorts(ir, routed, rects, {});
    const pts = routed.get('E').points;
    // 'right' do a = (50, 25), 'left' do b = (100, 25).
    assert.equal(pts[0].x, 50);
    assert.equal(pts[0].y, 25);
    assert.equal(pts[pts.length - 1].x, 100);
    assert.equal(pts[pts.length - 1].y, 25);
  });

  test('curves não recebem snap (re.kind=curve pula)', () => {
    const ir = {
      nodes: [{ id: 'a', snap: ['top'] }, { id: 'b' }],
      edges: [{ id: 'E', source: 'a', target: 'b' }],
    };
    const routed = new Map([['E', { kind: 'curve', points: [
      { x: 25, y: 50 }, { x: 60, y: 25 }, { x: 100, y: 25 },
    ] }]]);
    const rects = new Map([
      ['a', { x: 0, y: 0, width: 50, height: 50 }],
      ['b', { x: 100, y: 0, width: 50, height: 50 }],
    ]);
    snapEndpointsToDiscretePorts(ir, routed, rects, {});
    const out = routed.get('E');
    assert.equal(out.kind, 'curve');
    assert.deepEqual(out.points[0], { x: 25, y: 50 }, 'curve intocada');
  });

  test('snap.criterion: minLength escolhe diferente de nearest', () => {
    // Setup: source em (10, 25), target em (140, 25). Snap em 'a':
    // ['top']=(25,0), ['bottom']=(25,50). Para minLength, vence o que
    // minimiza dist a (10,25) + dist a (140,25).
    // top:  √(15²+25²) + √(115²+25²) ≈ 29 + 117.7 ≈ 146.7
    // bottom: √(15²+25²) + √(115²+25²) ≈ 29 + 117.7 ≈ 146.7
    // Empate. Mas com snap=['top','right'], right=(50,25):
    //   top:   √(15²+25²) + √(115²+25²) ≈ 146.7
    //   right: √(40²+0²)  + √(90²+0²)   = 40 + 90 = 130 (vencedor)
    const ir = {
      nodes: [
        { id: 'a', snap: ['top', 'right'] },
        { id: 'b' },
      ],
      edges: [{ id: 'E', source: 'a', target: 'b' }],
    };
    const routed = new Map([['E', poly([{ x: 10, y: 25 }, { x: 140, y: 25 }])]]);
    const rects = new Map([
      ['a', { x: 0, y: 0, width: 50, height: 50 }],
      ['b', { x: 100, y: 0, width: 50, height: 50 }],
    ]);
    const meta = { routing: { snap: { criterion: 'minLength' } } };
    snapEndpointsToDiscretePorts(ir, routed, rects, meta);
    const pts = routed.get('E').points;
    // minLength deve escolher 'right' (menor soma).
    assert.equal(pts[0].x, 50);
    assert.equal(pts[0].y, 25);
  });

  test('edges sem rect (source não em routingRects) são ignoradas sem crash', () => {
    const ir = {
      nodes: [{ id: 'a', snap: ['top'] }, { id: 'b' }],
      edges: [{ id: 'E', source: 'a', target: 'b' }],
    };
    const routed = new Map([['E', poly([{ x: 25, y: 25 }, { x: 125, y: 25 }])]]);
    const rects = new Map();  // vazio
    snapEndpointsToDiscretePorts(ir, routed, rects, {});
    const pts = routed.get('E').points;
    assert.deepEqual(pts[0], { x: 25, y: 25 }, 'sem rect → sem snap');
  });
});
