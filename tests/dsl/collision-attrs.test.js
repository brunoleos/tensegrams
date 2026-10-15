import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeightedMap, buildIR } from '../../src/dsl/ir.js';
import { parse } from '../../src/dsl/parser.js';

describe('parseWeightedMap (YAML list or map form)', () => {
  const ir = { warnings: [] };

  test('list form: every tag → weight 0 (yielding by default)', () => {
    const m = parseWeightedMap(['a', 'b'], 0, ir, 'n', 'nodeLayers');
    assert.equal(m.get('a'), 0);
    assert.equal(m.get('b'), 0);
  });

  test('B3: contrato lista [tag] = peso 0 (sela alinhamento doc-código)', () => {
    // Defesa contra drift entre doc e código. Em commits passados o
    // comentário em examples.js dizia "lista [tag] equivale a peso 1"
    // mas o código sempre devolveu 0. Se alguém mudar para 1 sem
    // atualizar a doc (ou vice-versa), este teste falha.
    const m = parseWeightedMap(['tag'], 0, ir, 'n', 'nodeLayers');
    assert.equal(m.get('tag'), 0, 'lista [tag] DEVE virar peso 0');
    assert.notEqual(m.get('tag'), 1, 'lista [tag] NÃO é peso 1');
  });

  test('map form: explicit weights', () => {
    const m = parseWeightedMap({ A: 1, B: 0.5 }, 0, ir, 'n', 'nodeLayers');
    assert.equal(m.get('A'), 1);
    assert.equal(m.get('B'), 0.5);
  });

  test('weight > 1 clamped to 1', () => {
    const m = parseWeightedMap({ A: 2 }, 0, ir, 'n', 'nodeLayers');
    assert.equal(m.get('A'), 1);
  });

  test('peso fora de [0, 1] gera aviso (ADR-0021); dentro, não', () => {
    const warns = { warnings: [] };
    parseWeightedMap({ A: 2, B: -1, C: 0.5 }, 3, warns, 'n', 'nodeLayers');
    parseWeightedMap([{ D: 1.5 }, 'E', 'F:3'], 4, warns, 'n', 'nodeLayers');
    const range = warns.warnings.filter((w) => /fora de \[0, 1\]/.test(w.msg));
    assert.deepEqual(range.map((w) => w.msg.match(/"(\w)"/)[1]), ['A', 'B', 'D', 'F']);
    assert.ok(range.every((w) => w.line === 3 || w.line === 4));
  });

  test('weight < 0 clamped to 0', () => {
    const m = parseWeightedMap({ A: -0.5 }, 0, ir, 'n', 'nodeLayers');
    assert.equal(m.get('A'), 0);
  });

  test('empty input → empty map', () => {
    assert.equal(parseWeightedMap(null, 0, ir, 'n', 'x').size, 0);
    assert.equal(parseWeightedMap(undefined, 0, ir, 'n', 'x').size, 0);
  });

  test('non-list, non-map → empty map + warning', () => {
    const warns = { warnings: [] };
    const m = parseWeightedMap('A[0.5]', 0, warns, 'n', 'nodeLayers');
    assert.equal(m.size, 0);
    assert.ok(warns.warnings.some(w => /nodeLayers/.test(w.msg)));
  });

  test('non-numeric weights dropped silently', () => {
    const m = parseWeightedMap({ A: 'abc', B: 0.3 }, 0, ir, 'n', 'nodeLayers');
    assert.equal(m.has('A'), false);
    assert.equal(m.get('B'), 0.3);
  });

  test('mixed list: bare strings default to 0, single-key maps carry weight', () => {
    const m = parseWeightedMap(
      ['L1', 'L2', { L3: 0.5 }, { L4: 1 }],
      0, ir, 'n', 'nodeLayers',
    );
    assert.equal(m.get('L1'), 0);
    assert.equal(m.get('L2'), 0);
    assert.equal(m.get('L3'), 0.5);
    assert.equal(m.get('L4'), 1);
  });

  test('mixed list: weight in single-key entry is clamped to [0, 1]', () => {
    const m = parseWeightedMap(
      [{ A: -2 }, { B: 5 }],
      0, ir, 'n', 'nodeLayers',
    );
    assert.equal(m.get('A'), 0);
    assert.equal(m.get('B'), 1);
  });

  test('mixed list: multi-key map entry contributes every pair', () => {
    const m = parseWeightedMap(
      ['L1', { L2: 0.3, L3: 0.7 }],
      0, ir, 'n', 'nodeLayers',
    );
    assert.equal(m.get('L1'), 0);
    assert.equal(m.get('L2'), 0.3);
    assert.equal(m.get('L3'), 0.7);
  });

  test('YAML flow gotcha [tag:weight] (no space) → coerce + warn', () => {
    // `[store:1]` parses as `["store:1"]` (single string) per YAML
    // spec — `:` only starts a flow mapping when followed by whitespace.
    // We auto-correct and warn so the diagram still works.
    const warns = { warnings: [] };
    const m = parseWeightedMap(['store:1'], 7, warns, 'db', 'nodeLayers');
    assert.equal(m.get('store'), 1);
    assert.equal(m.has('store:1'), false);
    assert.ok(
      warns.warnings.some(w => /store:1.*com espaço/.test(w.msg)),
      `expected gotcha warning, got: ${JSON.stringify(warns.warnings)}`,
    );
  });

  test('flow gotcha pattern: decimal weight is also coerced', () => {
    const warns = { warnings: [] };
    const m = parseWeightedMap(['L3:0.5'], 0, warns, 'n', 'nodeLayers');
    assert.equal(m.get('L3'), 0.5);
    assert.equal(warns.warnings.length, 1);
  });

  test('string entry with colon but non-numeric RHS → kept as literal tag, no warning', () => {
    // Don’t second-guess deliberate tag names like "ns:foo".
    const warns = { warnings: [] };
    const m = parseWeightedMap(['ns:foo'], 0, warns, 'n', 'nodeLayers');
    assert.equal(m.get('ns:foo'), 0);
    assert.equal(warns.warnings.length, 0);
  });

  test('mixed list: invalid entry → warning, others survive', () => {
    const warns = { warnings: [] };
    const m = parseWeightedMap(
      ['L1', 42, { L2: 0.5 }],
      0, warns, 'n', 'nodeLayers',
    );
    assert.equal(m.get('L1'), 0);
    assert.equal(m.get('L2'), 0.5);
    assert.ok(warns.warnings.some(w => /nodeLayers/.test(w.msg)));
  });

  test('full DSL parse: block list with weighted entries', () => {
    const ir = buildIR(parse(`
a:
  label: A
  nodeLayers:
    - L1
    - L2
    - L3: 0.5
    - L4: 1
`));
    const c = ir.nodes.find(n => n.id === 'a').nodeCollision;
    assert.equal(c.get('L1'), 0);
    assert.equal(c.get('L2'), 0);
    assert.equal(c.get('L3'), 0.5);
    assert.equal(c.get('L4'), 1);
  });

  test('full DSL parse: inline flow list with weighted entries', () => {
    const ir = buildIR(parse(`
a: { label: A, nodeLayers: [L1, L2, {L3: 0.5}, {L4: 1}] }
`));
    const c = ir.nodes.find(n => n.id === 'a').nodeCollision;
    assert.equal(c.get('L1'), 0);
    assert.equal(c.get('L2'), 0);
    assert.equal(c.get('L3'), 0.5);
    assert.equal(c.get('L4'), 1);
  });

  test('full DSL parse: edge edgeLayers accepts the same mixed list', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
? [a, b]
: { edgeLayers: [feixe, {pesado: 0.8}] }
`));
    const e = ir.edges[0];
    assert.equal(e.edgeCollision.get('feixe'), 0);
    assert.equal(e.edgeCollision.get('pesado'), 0.8);
  });
});

describe('collision attrs in IR', () => {
  test('node nodeLayers populates nodeCollision (list form → weight 0)', () => {
    const ir = buildIR(parse(`a:\n  nodeLayers: [grp]\n`));
    assert.equal(ir.nodes.find(n => n.id === 'a').nodeCollision.get('grp'), 0);
  });

  test('edge nodeLayers + edgeLayers', () => {
    const ir = buildIR(parse(`connections:\n  - [a, b]\n? [a, b]\n: { nodeLayers: { x: 0.5 }, edgeLayers: { y: 1 } }\n`));
    const e = ir.edges[0];
    assert.equal(e.nodeCollision.get('x'), 0.5);
    assert.equal(e.edgeCollision.get('y'), 1);
  });

  test('node without nodeLayers gets an empty map', () => {
    const ir = buildIR(parse(`a:\n  label: A\n`));
    assert.equal(ir.nodes.find(n => n.id === 'a').nodeCollision.size, 0);
  });

  test('edgeLayers on a node is rejected as unknown attr (warning)', () => {
    const ir = buildIR(parse(`a:\n  edgeLayers: [z]\n`));
    // edgeLayers is not in NODE_ATTRS → unknown-attr warning, no field set.
    assert.ok(ir.warnings.some(w => /edgeLayers/.test(w.msg)));
    assert.equal(ir.nodes.find(n => n.id === 'a').edgeCollision, undefined);
  });
});
