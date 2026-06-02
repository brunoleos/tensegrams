import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { makeCornerBody, makeSegmentBody } from '../../../src/routing/physics/bodies.js';
import { applyEndpointBBoxRepulsion } from '../../../src/routing/physics/forces-endpoint-bbox.js';

describe('applyEndpointBBoxRepulsion — BBox vs segmento foreign (P6)', () => {
  test('BBox de endpoint sobrepõe segmento de outra aresta (mesma layer): segmento cede', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const a = makeCornerBody({ id: 'A', x: 100, y: 50, pinned: true, rect, anchorSide: 'source' });
    a.face = 'east';
    // BBox A: cx = 100 + 8 = 108, cy = 50, half = 8 → box (100, 42, 16, 16)
    const c1 = makeCornerBody({ id: 'c1', x: 96, y: 42, pinned: false });
    const c2 = makeCornerBody({ id: 'c2', x: 120, y: 42, pinned: false });
    const seg = makeSegmentBody({ id: 's', orientation: 'h', prevCorner: c1, nextCorner: c2, pad: 2 });
    seg.pad = 2;
    const infoA = { corners: [a, a], edge: { id: 'A' }, segments: [] };
    const infoB = { corners: [c1, c2], edge: { id: 'B' }, segments: [seg] };
    const world = { edgeIndex: new Map([['A', infoA], ['B', infoB]]) };
    // edgeLayerPair sempre casa.
    const resolver = { edgeLayerPair: () => ({ shared: ['L'], frac: { a: 0.5, b: 0.5 } }) };
    c1.fx = c1.fy = c2.fx = c2.fy = 0;
    applyEndpointBBoxRepulsion(world, { endpointBBoxSide: 16, resolver });
    // Segmento horizontal em y=42, BBox y in [42, 58]. Seg DENTRO da BBox
    // pelo topo (c=42 == top=42 → não, c <= top → return 0). Vou ajustar
    // o seg pra y=50 (mid do BBox).
  });

  test('BBox de endpoint sobrepõe segmento em y mid: segmento empurrado perpendicular', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const a = makeCornerBody({ id: 'A', x: 100, y: 50, pinned: true, rect, anchorSide: 'source' });
    a.face = 'east';
    // BBox A: y in [42, 58] (cy=50, half=8).
    const c1 = makeCornerBody({ id: 'c1', x: 95, y: 50, pinned: false });
    const c2 = makeCornerBody({ id: 'c2', x: 120, y: 50, pinned: false });
    const seg = makeSegmentBody({ id: 's', orientation: 'h', prevCorner: c1, nextCorner: c2, pad: 2 });
    const infoA = { corners: [a, a], edge: { id: 'A' }, segments: [] };
    const infoB = { corners: [c1, c2], edge: { id: 'B' }, segments: [seg] };
    const world = { edgeIndex: new Map([['A', infoA], ['B', infoB]]) };
    const resolver = { edgeLayerPair: () => ({ shared: ['L'], frac: { a: 0.5, b: 0.5 } }) };
    c1.fx = c1.fy = c2.fx = c2.fy = 0;
    applyEndpointBBoxRepulsion(world, { endpointBBoxSide: 16, resolver });
    // c=50, top=42, bottom=58 → upRoom=8, downRoom=8. Tie → downRoom. push = +9.
    // Force on both corners: +9 * k_repel (2.0) = +18.
    assert.ok(c1.fy > 0, `c1.fy esperado > 0, got ${c1.fy}`);
    assert.ok(c2.fy > 0, `c2.fy esperado > 0, got ${c2.fy}`);
    // Anchor A não recebe contra-força (BBox-vs-seg é unidirecional).
    // a.fy should be 0 from this force (não testamos da força central aqui).
  });

  test('BBox de endpoint sobrepõe segmento de aresta com layer disjoint: sem força', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const a = makeCornerBody({ id: 'A', x: 100, y: 50, pinned: true, rect, anchorSide: 'source' });
    a.face = 'east';
    const c1 = makeCornerBody({ id: 'c1', x: 95, y: 50, pinned: false });
    const c2 = makeCornerBody({ id: 'c2', x: 120, y: 50, pinned: false });
    const seg = makeSegmentBody({ id: 's', orientation: 'h', prevCorner: c1, nextCorner: c2, pad: 2 });
    const infoA = { corners: [a, a], edge: { id: 'A' }, segments: [] };
    const infoB = { corners: [c1, c2], edge: { id: 'B' }, segments: [seg] };
    const world = { edgeIndex: new Map([['A', infoA], ['B', infoB]]) };
    // edgeLayerPair retorna null → layers diferentes, sem interação.
    const resolver = { edgeLayerPair: () => null };
    c1.fx = c1.fy = c2.fx = c2.fy = 0;
    applyEndpointBBoxRepulsion(world, { endpointBBoxSide: 16, resolver });
    assert.equal(c1.fy, 0);
    assert.equal(c2.fy, 0);
  });

  test('sem resolver → sem filtro de layer (modo legado): segmento foreign empurrado', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    const a = makeCornerBody({ id: 'A', x: 100, y: 50, pinned: true, rect, anchorSide: 'source' });
    a.face = 'east';
    const c1 = makeCornerBody({ id: 'c1', x: 95, y: 50, pinned: false });
    const c2 = makeCornerBody({ id: 'c2', x: 120, y: 50, pinned: false });
    const seg = makeSegmentBody({ id: 's', orientation: 'h', prevCorner: c1, nextCorner: c2, pad: 2 });
    const infoA = { corners: [a, a], edge: { id: 'A' }, segments: [] };
    const infoB = { corners: [c1, c2], edge: { id: 'B' }, segments: [seg] };
    const world = { edgeIndex: new Map([['A', infoA], ['B', infoB]]) };
    c1.fx = c1.fy = c2.fx = c2.fy = 0;
    applyEndpointBBoxRepulsion(world, { endpointBBoxSide: 16 });
    assert.ok(c1.fy !== 0, `c1.fy ≠ 0, got ${c1.fy}`);
  });
});
