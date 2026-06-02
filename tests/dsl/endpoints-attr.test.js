import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';

const ir = (src) => buildIR(parse(src));

describe('buildIR — edge.endpoints sub-object (P1)', () => {
  test('parses endpoints.source.side and endpoints.target.side onto edge.endpoints', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: { source: { side: 24 }, target: { side: 16 } } }\n`);
    assert.equal(g.errors.length, 0, JSON.stringify(g.errors));
    assert.deepEqual(g.edges[0].endpoints, { source: { side: 24 }, target: { side: 16 } });
  });

  test('parses endpoints.source.edgeLayers as a weighted map (Map<tag, weight>)', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: { source: { edgeLayers: [Lx] } } }\n`);
    assert.equal(g.errors.length, 0, JSON.stringify(g.errors));
    const layers = g.edges[0].endpoints?.source?.edgeLayers;
    assert.ok(layers instanceof Map);
    assert.equal(layers.get('Lx'), 0);
  });

  test('only one side declared is fine — other side stays absent', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: { source: { side: 12 } } }\n`);
    assert.deepEqual(g.edges[0].endpoints, { source: { side: 12 } });
  });

  test('unknown side warns and is dropped (didYouMean)', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: { typo: { side: 12 } } }\n`);
    assert.equal(g.edges[0].endpoints, undefined);
    assert.ok(g.warnings.some(w => /endpoints\.typo desconhecido/.test(w.msg)),
      `expected a warning about endpoints.typo, got: ${JSON.stringify(g.warnings.map(w => w.msg))}`);
  });

  test('unknown sub-key warns (didYouMean) and is dropped', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: { source: { bogus: 1 } } }\n`);
    assert.equal(g.edges[0].endpoints, undefined);
    assert.ok(g.warnings.some(w => /endpoints\.source\.bogus desconhecido/.test(w.msg)),
      `expected warning, got: ${JSON.stringify(g.warnings.map(w => w.msg))}`);
  });

  test('side <= 0 is dropped with warning', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: { source: { side: -3 } } }\n`);
    assert.equal(g.edges[0].endpoints, undefined);
    assert.ok(g.warnings.some(w => /endpoints\.source\.side.*deve ser número/.test(w.msg)));
  });

  test('non-map endpoints value warns and is dropped', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endpoints: [a, b] }\n`);
    assert.equal(g.edges[0].endpoints, undefined);
    assert.ok(g.warnings.some(w => /endpoints.*deve ser um mapa/.test(w.msg)));
  });
});

describe('buildIR — options.routing.endpointBBox + central + algebraic + physics (P1)', () => {
  test('endpointBBox.side propagates into ir.meta.routing', () => {
    const g = ir(`options:\n  routing:\n    endpointBBox: { side: 18 }\n`);
    assert.deepEqual(g.meta.routing.endpointBBox, { side: 18 });
  });

  test('central.k propagates', () => {
    const g = ir(`options:\n  routing:\n    central: { k: 0.12 }\n`);
    assert.deepEqual(g.meta.routing.central, { k: 0.12 });
  });

  test('algebraic flags propagate as booleans', () => {
    const g = ir(`options:\n  routing:\n    algebraic: { clipAnchors: true, snapContainerExternal: false, legacy: on }\n`);
    assert.deepEqual(g.meta.routing.algebraic, {
      clipAnchors: true,
      snapContainerExternal: false,
      legacy: true,
    });
  });

  test('physics flags propagate as booleans', () => {
    const g = ir(`options:\n  routing:\n    physics: { hardObstacleEscalation: false }\n`);
    assert.deepEqual(g.meta.routing.physics, { hardObstacleEscalation: false });
  });

  test('unknown sub-key in algebraic warns + dropped', () => {
    const g = ir(`options:\n  routing:\n    algebraic: { bogus: true }\n`);
    assert.equal(g.meta.routing.algebraic, undefined);
    assert.ok(g.warnings.some(w => /algebraic\.bogus desconhecido/.test(w.msg)));
  });

  test('endpointBBox.side <= 0 is dropped (no warning needed)', () => {
    const g = ir(`options:\n  routing:\n    endpointBBox: { side: 0 }\n`);
    assert.equal(g.meta.routing.endpointBBox, undefined);
  });
});

describe('buildIR — cascade endpoint > edge > meta', () => {
  // The cascade itself is consumed by warm-start in P2/P5; here we just
  // confirm that the IR exposes all three layers so downstream code can
  // resolve `endpoint.side ?? edge.style.side ?? meta.routing.endpointBBox.side`.
  test('all three layers (per-endpoint, per-edge, meta) coexist on the IR', () => {
    const g = ir([
      'options:',
      '  routing:',
      '    endpointBBox: { side: 8 }',
      'connections:',
      '  - [a, b]',
      '? [a, b]',
      ': { endpoints: { source: { side: 24 } } }',
      '',
    ].join('\n'));
    assert.equal(g.meta.routing.endpointBBox.side, 8);
    assert.equal(g.edges[0].endpoints.source.side, 24);
    // target side falls back to meta (no per-endpoint or per-edge override).
  });
});
