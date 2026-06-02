// BBox-vs-BBox em NÓS DIFERENTES (anchors em rects distintos, com edgeLayer
// compartilhada). Mesmo-nó já não dispara força — endpoints podem coincidir
// livremente naquele caso.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeCornerBody } from '../../../src/routing/physics/bodies.js';
import { applyEndpointBBoxRepulsion } from '../../../src/routing/physics/forces-endpoint-bbox.js';

function makeAnchor(rect, x, y, face, edgeId, side) {
  const a = makeCornerBody({ id: `${edgeId}#${side}`, x, y, pinned: true, rect, anchorSide: side });
  a.face = face;
  return a;
}

const layerHit = () => ({ shared: ['L'], frac: { a: 0.5, b: 0.5 } });

describe('applyEndpointBBoxRepulsion — BBox vs BBox em nós diferentes (P5)', () => {
  test('dois rects adjacentes com BBoxes externos sobrepostos: ambos cedem tangencialmente', () => {
    // Rects encostados em x=100/104. BBox externo cobre [100,116]×[40,56] e
    // [88,104]×[44,60] — sobrepõem em [100,104]×[44,56].
    const rectA = { x: 0,   y: 0, width: 100, height: 100 };
    const rectB = { x: 104, y: 0, width: 100, height: 100 };
    const a = makeAnchor(rectA, 100, 48, 'east', 'E1', 'source');
    const b = makeAnchor(rectB, 104, 52, 'west', 'E2', 'source');
    const info1 = { corners: [a, a], edge: { id: 'E1' }, segments: [] };
    const info2 = { corners: [b, b], edge: { id: 'E2' }, segments: [] };
    const world = { edgeIndex: new Map([['E1', info1], ['E2', info2]]) };
    a.fx = a.fy = 0; b.fx = b.fy = 0;
    applyEndpointBBoxRepulsion(world, {
      endpointBBoxSide: 16,
      resolver: { edgeLayerPair: layerHit },
    });
    // Tangente em ambas as faces é y. A acima de B (48 < 52) → A.fy negativo, B.fy positivo.
    assert.ok(a.fy < 0, `A.fy esperado < 0, got ${a.fy}`);
    assert.ok(b.fy > 0, `B.fy esperado > 0, got ${b.fy}`);
    assert.equal(a.fx, 0);
    assert.equal(b.fx, 0);
  });

  test('mesmo nó: BBoxes sobrepostos NÃO geram força (endpoints podem coincidir)', () => {
    const rect = { x: 0, y: 0, width: 200, height: 100 };
    const a = makeAnchor(rect, 200, 48, 'east', 'E1', 'source');
    const b = makeAnchor(rect, 200, 52, 'east', 'E2', 'source');
    const info1 = { corners: [a, a], edge: { id: 'E1' }, segments: [] };
    const info2 = { corners: [b, b], edge: { id: 'E2' }, segments: [] };
    const world = { edgeIndex: new Map([['E1', info1], ['E2', info2]]) };
    a.fx = a.fy = 0; b.fx = b.fy = 0;
    applyEndpointBBoxRepulsion(world, {
      endpointBBoxSide: 16,
      resolver: { edgeLayerPair: layerHit },
    });
    assert.equal(a.fy, 0, 'mesmo nó: A não deve receber força');
    assert.equal(b.fy, 0, 'mesmo nó: B não deve receber força');
  });

  test('nós diferentes + edgeLayerPair retornando null: sem força', () => {
    const rectA = { x: 0,   y: 0, width: 100, height: 100 };
    const rectB = { x: 104, y: 0, width: 100, height: 100 };
    const a = makeAnchor(rectA, 100, 48, 'east', 'E1', 'source');
    const b = makeAnchor(rectB, 104, 52, 'west', 'E2', 'source');
    const info1 = { corners: [a, a], edge: { id: 'E1' }, segments: [] };
    const info2 = { corners: [b, b], edge: { id: 'E2' }, segments: [] };
    const world = { edgeIndex: new Map([['E1', info1], ['E2', info2]]) };
    a.fx = a.fy = 0; b.fx = b.fy = 0;
    applyEndpointBBoxRepulsion(world, {
      endpointBBoxSide: 16,
      resolver: { edgeLayerPair: () => null },
    });
    assert.equal(a.fy, 0);
    assert.equal(b.fy, 0);
  });

  test('sem resolver (modo legado): par em nós diferentes sempre interage', () => {
    const rectA = { x: 0,   y: 0, width: 100, height: 100 };
    const rectB = { x: 104, y: 0, width: 100, height: 100 };
    const a = makeAnchor(rectA, 100, 48, 'east', 'E1', 'source');
    const b = makeAnchor(rectB, 104, 52, 'west', 'E2', 'source');
    const info1 = { corners: [a, a], edge: { id: 'E1' }, segments: [] };
    const info2 = { corners: [b, b], edge: { id: 'E2' }, segments: [] };
    const world = { edgeIndex: new Map([['E1', info1], ['E2', info2]]) };
    a.fx = a.fy = 0; b.fx = b.fy = 0;
    applyEndpointBBoxRepulsion(world, { endpointBBoxSide: 16 });
    assert.ok(a.fy !== 0 || b.fy !== 0);
  });

  test('auto-clamp Q11: 5 anchors na mesma face span 60 e side=20 → side clampado pra 12', () => {
    // Mesmo nó: BBox-vs-BBox não dispara força, mas o auto-clamp ainda
    // calcula `effectiveSide` (e emite warning quando cfg > faceSpan/N).
    const rect = { x: 0, y: 0, width: 200, height: 60 };
    const anchors = [];
    const infoMap = new Map();
    for (let i = 0; i < 5; i++) {
      const a = makeAnchor(rect, 200, 5 + i * 12, 'east', `E${i}`, 'source');
      anchors.push(a);
      infoMap.set(`E${i}`, { corners: [a, a], edge: { id: `E${i}` }, segments: [] });
    }
    const world = { edgeIndex: infoMap };
    const warnings = [];
    for (const a of anchors) { a.fx = 0; a.fy = 0; }
    applyEndpointBBoxRepulsion(world, { endpointBBoxSide: 20, warningsSink: warnings });
    assert.ok(warnings.length > 0, 'expected auto-clamp warning');
    assert.ok(warnings.every(w => /clamped/.test(w.msg)));
  });
});
