import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse, canonicalEdgeKey } from '../../src/dsl/parser.js';

describe('parse — empty / malformed', () => {
  test('empty input returns empty shape', () => {
    const r = parse('');
    assert.deepEqual(r.options, {});
    assert.deepEqual(r.connections, []);
    assert.equal(r.nodes.size, 0);
    assert.equal(r.edges.size, 0);
    assert.deepEqual(r.errors, []);
  });

  test('non-mapping top-level is rejected', () => {
    const r = parse('- a\n- b\n');
    assert.ok(r.errors.some(e => /mapa YAML/.test(e.msg)));
  });

  test('broken YAML reports an error with a line', () => {
    const r = parse('a: [unclosed\n');
    assert.equal(r.errors.length >= 1, true);
    assert.match(r.errors[0].msg, /YAML inválido/);
    assert.ok(r.errors[0].line >= 1);
  });
});

describe('parse — options', () => {
  test('reads options block (booleans normalised by buildIR, not parser)', () => {
    const r = parse(`options:\n  title: T\n  snapContainerAnchor: on\n`);
    assert.equal(r.options.title, 'T');
    // YAML 1.2 core schema keeps "on" as a string — buildIR coerces it.
    assert.equal(r.options.snapContainerAnchor, 'on');
  });

  test('true/false in options parse as booleans', () => {
    const r = parse(`options:\n  snapContainerAnchor: false\n`);
    assert.equal(r.options.snapContainerAnchor, false);
  });

  test('rejects non-mapping options', () => {
    const r = parse(`options: 42\n`);
    assert.ok(r.errors.some(e => /options/.test(e.msg)));
  });
});

describe('parse — connections', () => {
  test('pairs declare edges without registering node defs', () => {
    const r = parse(`connections:\n  - [a, b]\n  - [a, c]\n`);
    assert.deepEqual(r.connections.map(c => [c.a, c.b, c.key]), [
      ['a', 'b', undefined], ['a', 'c', undefined],
    ]);
    assert.equal(r.nodes.size, 0); // implicit nodes are materialised by buildIR
  });

  test('triple form carries a discriminator', () => {
    const r = parse(`connections:\n  - [a, b, 1]\n  - [a, b, 2]\n`);
    assert.equal(r.connections[0].key, '1');
    assert.equal(r.connections[1].key, '2');
  });

  test('rejects items with wrong arity', () => {
    const r = parse(`connections:\n  - [a]\n  - [a, b, c, d]\n`);
    assert.equal(r.errors.length, 2);
  });

  test('rejects non-list connections', () => {
    const r = parse(`connections: foo\n`);
    assert.ok(r.errors.some(e => /lista/.test(e.msg)));
  });
});

describe('parse — node entries', () => {
  test('top-level string keys become node entries', () => {
    const r = parse(`a:\n  label: Web\nb:\n  label: App\n`);
    assert.equal(r.nodes.size, 2);
    assert.equal(r.nodes.get('a').attrs.label, 'Web');
    assert.equal(r.nodes.get('b').attrs.label, 'App');
  });

  test('node block must be a mapping', () => {
    const r = parse(`a: 42\n`);
    assert.ok(r.errors.some(e => /precisa ser um mapa/.test(e.msg)));
  });

  test('lines are attached', () => {
    const r = parse(`a:\n  label: A\nb:\n  label: B\n`);
    assert.equal(r.nodes.get('a').line, 1);
    assert.equal(r.nodes.get('b').line, 3);
  });
});

describe('parse — edge decorations (composite keys)', () => {
  test('? [a, b] : { … } decorates an edge', () => {
    const r = parse(`? [a, b]\n: { label: uses }\n`);
    assert.equal(r.edges.size, 1);
    const edge = r.edges.get(canonicalEdgeKey('a', 'b'));
    assert.deepEqual(edge.pair, ['a', 'b']);
    assert.equal(edge.attrs.label, 'uses');
  });

  test('canonical key is order-independent (b,a finds the same edge)', () => {
    const r = parse(`? [b, a]\n: { label: uses }\n`);
    const edge = r.edges.get(canonicalEdgeKey('a', 'b'));
    assert.ok(edge, 'b,a should canonicalise to the same key as a,b');
    assert.deepEqual(edge.pair, ['b', 'a']); // observed order preserved
  });

  test('triple key carries the discriminator', () => {
    const r = parse(`? [a, b, 2]\n: { label: second }\n`);
    const edge = r.edges.get(canonicalEdgeKey('a', 'b', '2'));
    assert.equal(edge.key, '2');
    assert.equal(edge.attrs.label, 'second');
  });

  test('decoration line is reported', () => {
    const r = parse(`a:\n  label: A\n\n? [a, b]\n: { label: x }\n`);
    const edge = r.edges.get(canonicalEdgeKey('a', 'b'));
    assert.equal(edge.line, 4);
  });

  test('duplicate decorations for the same edge are an error', () => {
    const r = parse(`? [a, b]\n: { label: one }\n? [a, b]\n: { label: two }\n`);
    assert.ok(r.errors.some(e => /duplicada/.test(e.msg)));
  });

  test('1-element or 4-element composite keys are an error', () => {
    const r = parse(`? [a]\n: { label: bad }\n`);
    assert.ok(r.errors.some(e => /2 ou 3/.test(e.msg)));
  });
});
