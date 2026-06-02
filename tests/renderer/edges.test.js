import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM, makeSVG } from '../dom-mock.js';

installDOM();
const { renderEdges } = await import('../../src/renderer/edges.js');

function makeG() {
  const svg = makeSVG();
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(g);
  return g;
}

describe('renderEdges', () => {
  test('creates a path for each edge', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: '', layers: [] }] };
    const routed = new Map([
      ['e1', {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        sourceAnchor: { x: 0, y: 0 }, targetAnchor: { x: 100, y: 0 },
      }],
    ]);
    renderEdges(g, ir, routed);
    assert.equal(g.children.length, 1);
    const path = g.children[0].querySelector('path');
    assert.match(path.getAttribute('d'), /^M\s*0\s*0\s*L\s*100\s*0/);
  });

  test('emits a Bezier d for curve kind', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: '', layers: [] }] };
    const routed = new Map([
      ['e1', {
        kind: 'curve',
        points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 60, y: 100 }, { x: 100, y: 100 }],
        sourceAnchor: {}, targetAnchor: {},
      }],
    ]);
    renderEdges(g, ir, routed);
    const d = g.children[0].querySelector('path').getAttribute('d');
    assert.match(d, /C/);
  });

  test('shows/hides label based on edge.label', () => {
    const g = makeG();
    const irNoLabel = { edges: [{ id: 'e1', source: 'a', target: 'b', label: '', layers: [] }] };
    const irWithLabel = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'hello', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, irNoLabel, routed);
    assert.equal(g.children[0].querySelector('.edge-label').style.display, 'none');
    renderEdges(g, irWithLabel, routed);
    assert.notEqual(g.children[0].querySelector('.edge-label').style.display, 'none');
  });

  test('reportLabelBBox callback é chamado quando label visível, bbox veio do mock', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'hello world', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    const reports = [];
    renderEdges(g, ir, routed, (id, bbox) => reports.push({ id, bbox }));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'e1');
    // dom-mock getBBox heurística: width = text.length * 7, height = 14.
    assert.equal(reports[0].bbox.width, 'hello world'.length * 7);
    assert.equal(reports[0].bbox.height, 14);
  });

  test('reportLabelBBox é chamado com null quando label vazio (limpa cache)', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: '', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    const reports = [];
    renderEdges(g, ir, routed, (id, bbox) => reports.push({ id, bbox }));
    // Sem o cleanup, apagar o label não removia o BBox de session.labelBBoxes
    // — o rect antigo permanecia atuando como obstáculo. Agora o renderer
    // emite (id, null) pra session deletar o entry.
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'e1');
    assert.equal(reports[0].bbox, null);
  });

  test('mask de occlusion: path tem mask=url(#…) e <mask> contém fill branco + occlusion preto', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'AB', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const edge = g.children[0];
    const path = edge.querySelector('path.edge-path');
    assert.match(path.getAttribute('mask') || '', /^url\(#edge-mask-/);
    const mask = edge.querySelector('mask.edge-mask');
    assert.ok(mask, '<mask> deve existir');
    const fill = mask.querySelector('rect.edge-mask-fill');
    const occlusion = mask.querySelector('rect.edge-label-occlusion');
    assert.equal(fill.getAttribute('fill'), 'white');
    assert.equal(occlusion.getAttribute('fill'), 'black');
  });

  test('occlusion rect é dimensionado pelo bbox do label + padding', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'AB', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const occlusion = g.children[0].querySelector('rect.edge-label-occlusion');
    // padX=4 padY=1, bbox.width = "AB".length * 7 = 14, height = 14
    assert.equal(Number(occlusion.getAttribute('width')),  14 + 8);
    assert.equal(Number(occlusion.getAttribute('height')), 14 + 2);
    assert.notEqual(occlusion.style.display, 'none');
  });

  test('mask cobre o BBox dos pontos da edge + padding', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'X', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 10, y: 20 }, { x: 110, y: 80 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const mask = g.children[0].querySelector('mask.edge-mask');
    // pad = 8 no sizeMask: cobre 10..110 → -8..118 em x, 20..80 → 12..88 em y
    assert.equal(Number(mask.getAttribute('x')), -8 + 10);
    assert.equal(Number(mask.getAttribute('y')), -8 + 20);
    assert.equal(Number(mask.getAttribute('width')),  100 + 16);
    assert.equal(Number(mask.getAttribute('height')), 60 + 16);
    assert.equal(mask.getAttribute('maskUnits'), 'userSpaceOnUse');
  });

  test('occlusion é escondida quando label vazio (mask vira pass-through)', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: '', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const occlusion = g.children[0].querySelector('rect.edge-label-occlusion');
    assert.equal(occlusion.style.display, 'none');
  });

  test('mask id é derivado do edge.id e referenciado pelo path', () => {
    // edge.id "e:a|b" tem caracteres não-CSS-safe; o mask id deve
    // sobreviver a esse formato (id SVG aceita; url() resolve).
    const g = makeG();
    const ir = { edges: [{ id: 'e:a|b', source: 'a', target: 'b', label: 'X', layers: [] }] };
    const routed = new Map([
      ['e:a|b', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const edge = g.children[0];
    const mask = edge.querySelector('mask.edge-mask');
    const path = edge.querySelector('path.edge-path');
    const id = mask.getAttribute('id');
    assert.equal(id, 'edge-mask-e:a|b');
    assert.equal(path.getAttribute('mask'), `url(#${id})`);
  });

  test('re-render com label diferente atualiza occlusion (sem vazar dimensões antigas)', () => {
    const g = makeG();
    const ir1 = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'X', layers: [] }] };
    const ir2 = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'XXXXX', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir1, routed);
    const occlusion = g.children[0].querySelector('rect.edge-label-occlusion');
    const w1 = Number(occlusion.getAttribute('width'));
    renderEdges(g, ir2, routed);
    const w2 = Number(occlusion.getAttribute('width'));
    // "X" = 7px, "XXXXX" = 35px → bbox.width muda → occlusion.width muda.
    assert.ok(w2 > w1, `occlusion width deve crescer (w1=${w1} w2=${w2})`);
  });

  test('re-render com points diferentes atualiza dimensões do mask', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'X', layers: [] }] };
    const r1 = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    const r2 = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 300, y: 200 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, r1);
    const mask = g.children[0].querySelector('mask.edge-mask');
    const w1 = Number(mask.getAttribute('width'));
    const h1 = Number(mask.getAttribute('height'));
    renderEdges(g, ir, r2);
    const w2 = Number(mask.getAttribute('width'));
    const h2 = Number(mask.getAttribute('height'));
    assert.ok(w2 > w1 && h2 > h1, `mask deve crescer (w:${w1}→${w2}, h:${h1}→${h2})`);
  });

  test('label volta a aparecer após edge passar por estado label="" (occlusion re-mostrada)', () => {
    const g = makeG();
    const ir1 = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'AB', layers: [] }] };
    const ir2 = { edges: [{ id: 'e1', source: 'a', target: 'b', label: '',   layers: [] }] };
    const ir3 = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'CD', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir1, routed);
    const occlusion = g.children[0].querySelector('rect.edge-label-occlusion');
    renderEdges(g, ir2, routed);
    assert.equal(occlusion.style.display, 'none');
    renderEdges(g, ir3, routed);
    assert.notEqual(occlusion.style.display, 'none');
  });

  test('mask fill e mask cobrem mesma região (fill subindo a mask = pass-through correto)', () => {
    const g = makeG();
    const ir = { edges: [{ id: 'e1', source: 'a', target: 'b', label: 'X', layers: [] }] };
    const routed = new Map([
      ['e1', { points: [{ x: 5, y: 10 }, { x: 95, y: 60 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const mask = g.children[0].querySelector('mask.edge-mask');
    const fill = g.children[0].querySelector('rect.edge-mask-fill');
    for (const a of ['x', 'y', 'width', 'height']) {
      assert.equal(mask.getAttribute(a), fill.getAttribute(a),
        `mask.${a} deve igualar fill.${a}`);
    }
  });

  test('reaps disappeared edges', () => {
    const g = makeG();
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, { edges: [{ id: 'e1', source: 'a', target: 'b', label: '', layers: [] }] }, routed);
    renderEdges(g, { edges: [] }, new Map());
    assert.equal(g.children.length, 0);
  });

  test('startStyle/endStyle map to marker-start / marker-end', () => {
    const g = makeG();
    const ir = { edges: [{
      id: 'e1', source: 'a', target: 'b', label: '', layers: [],
      startStyle: 'crowfoot', endStyle: 'filledArrow',
    }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const path = g.children[0].querySelector('path');
    assert.match(path.getAttribute('marker-start'), /crowfoot/);
    assert.match(path.getAttribute('marker-end'),   /filledArrow/);
  });

  test('startStyle="none" omits marker-start attribute', () => {
    const g = makeG();
    const ir = { edges: [{
      id: 'e1', source: 'a', target: 'b', label: '', layers: [],
      startStyle: 'none', endStyle: 'filledArrow',
    }] };
    const routed = new Map([
      ['e1', { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], sourceAnchor: {}, targetAnchor: {} }],
    ]);
    renderEdges(g, ir, routed);
    const path = g.children[0].querySelector('path');
    assert.equal(path.getAttribute('marker-start'), null);
    assert.match(path.getAttribute('marker-end'), /filledArrow/);
  });
});
