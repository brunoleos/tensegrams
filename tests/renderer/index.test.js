import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM, makeSVG } from '../dom-mock.js';

installDOM();
const { createRenderer, computeVisibleWorldRect, rectsIntersect, cullIR, lodLevel } = await import('../../src/renderer/index.js');

describe('lodLevel', () => {
  test('returns full at high zoom', () => assert.equal(lodLevel(1), 'full'));
  test('returns no-labels mid-low zoom', () => assert.equal(lodLevel(0.3), 'no-labels'));
  test('returns simple at very low zoom', () => assert.equal(lodLevel(0.1), 'simple'));
});

describe('rectsIntersect', () => {
  test('overlapping returns true', () => {
    assert.equal(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }), true);
  });
  test('disjoint returns false', () => {
    assert.equal(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 0, width: 10, height: 10 }), false);
  });
  test('touching counts as intersecting', () => {
    assert.equal(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }), true);
  });
});

describe('computeVisibleWorldRect', () => {
  test('zoom 1 returns SVG-sized rect plus margin', () => {
    const svg = makeSVG();
    const r = computeVisibleWorldRect(svg, { x: 0, y: 0, zoom: 1 });
    assert.ok(r.width >= 1000);
    assert.ok(r.height >= 600);
  });

  test('zoom 2 returns smaller world rect', () => {
    const svg = makeSVG();
    const r = computeVisibleWorldRect(svg, { x: 0, y: 0, zoom: 2 });
    assert.ok(r.width < 1000);
  });
});

describe('cullIR — selective loading', () => {
  const ir = {
    nodes: [
      { id: 'a', kind: 'leaf', hasChildren: false, layers: [] },
      { id: 'b', kind: 'leaf', hasChildren: false, layers: [] },
      { id: 'c', kind: 'container', hasChildren: true, layers: [] },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b', layers: [] }],
  };
  const layout = {
    positions: new Map([
      ['a', { x: 0, y: 0, width: 100, height: 40 }],
      ['b', { x: 10000, y: 10000, width: 100, height: 40 }],
    ]),
    containers: new Map([['c', { x: 0, y: 0, width: 200, height: 100, padding: 12 }]]),
    routedEdges: new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 10000, y: 10000 }], sourceAnchor: {}, targetAnchor: {} }],
    ]),
  };

  test('keeps in-viewport nodes', () => {
    const visible = { x: 0, y: 0, width: 1000, height: 1000 };
    const culled = cullIR(ir, layout, visible);
    assert.equal(culled.leafNodes.length, 1);
    assert.equal(culled.leafNodes[0].id, 'a');
    assert.equal(culled.containerNodes.length, 1);
  });

  test('drops edges whose endpoint is culled', () => {
    const visible = { x: 0, y: 0, width: 1000, height: 1000 };
    const culled = cullIR(ir, layout, visible);
    assert.equal(culled.edges.length, 0); // b is off-screen
  });

  test('empty viewport keeps nothing', () => {
    const visible = { x: 1e9, y: 1e9, width: 10, height: 10 };
    const culled = cullIR(ir, layout, visible);
    assert.equal(culled.leafNodes.length, 0);
    assert.equal(culled.containerNodes.length, 0);
    assert.equal(culled.edges.length, 0);
  });
});

describe('createRenderer', () => {
  test('builds viewport group + defs', () => {
    const svg = makeSVG();
    createRenderer(svg);
    assert.ok(svg.querySelector('g.vp'));
    assert.ok(svg.querySelector('defs'));
    assert.ok(svg.querySelector('marker'));
  });

  test('render applies transform from viewport', () => {
    const svg = makeSVG();
    const r = createRenderer(svg);
    const ir = { nodes: [], edges: [], layers: [], meta: {} };
    const layout = { positions: new Map(), containers: new Map(), routedEdges: new Map(), bounds: {} };
    r.render(ir, layout, { x: 10, y: 20, zoom: 2 });
    const vp = svg.querySelector('g.vp');
    assert.match(vp.getAttribute('transform') || '', /translate.*scale/);
  });

  test('toggles LOD classes based on zoom', () => {
    const svg = makeSVG();
    const r = createRenderer(svg);
    const ir = { nodes: [], edges: [], layers: [], meta: {} };
    const layout = { positions: new Map(), containers: new Map(), routedEdges: new Map(), bounds: {} };

    r.render(ir, layout, { x: 0, y: 0, zoom: 1 });
    assert.equal(svg.classList.contains('lod-no-labels'), false);

    r.render(ir, layout, { x: 0, y: 0, zoom: 0.3 });
    assert.equal(svg.classList.contains('lod-no-labels'), true);
    assert.equal(svg.classList.contains('lod-simple'), false);

    r.render(ir, layout, { x: 0, y: 0, zoom: 0.1 });
    assert.equal(svg.classList.contains('lod-simple'), true);
  });
});
