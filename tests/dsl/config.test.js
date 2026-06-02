import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, CONFIG_PLACEHOLDER } from '../../src/dsl/config.js';

describe('parseConfig', () => {
  test('empty input returns empty options', () => {
    const r = parseConfig('');
    assert.deepEqual(r.options, {});
    assert.deepEqual(r.errors, []);
  });

  test('whitespace-only input returns empty options', () => {
    const r = parseConfig('   \n  \t ');
    assert.deepEqual(r.options, {});
  });

  test('parses valid YAML mapping', () => {
    const r = parseConfig(`live:\n  damping: 0.5\n  collision: false\n`);
    assert.deepEqual(r.options, { live: { damping: 0.5, collision: false } });
    assert.deepEqual(r.errors, []);
  });

  test('reports YAML syntax error', () => {
    const r = parseConfig('a: [unclosed');
    assert.equal(r.options.a, undefined);
    assert.ok(r.errors.length >= 1);
    assert.match(r.errors[0].msg, /config inválido/);
  });

  test('rejects sequences at the top level', () => {
    const r = parseConfig('- 1\n- 2\n');
    assert.ok(r.errors.some(e => /mapa YAML/.test(e.msg)));
  });

  test('rejects null', () => {
    const r = parseConfig('null');
    assert.ok(r.errors.length >= 1);
  });

  test('rejects scalar primitives', () => {
    const r = parseConfig('42');
    assert.ok(r.errors.length >= 1);
  });

  test('keeps unknown keys (forward-compat)', () => {
    const r = parseConfig(`future:\n  x: 1\n`);
    assert.deepEqual(r.options, { future: { x: 1 } });
  });

  test('placeholder snippet is itself valid YAML', () => {
    const r = parseConfig(CONFIG_PLACEHOLDER);
    assert.deepEqual(r.errors, []);
    assert.ok(r.options.live);
    assert.equal(typeof r.options.live.damping, 'number');
  });

  test('keeps the collision pad block verbatim', () => {
    const r = parseConfig(`collision:\n  nodePad: 20\n  edgePad: 6\n`);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.options.collision, { nodePad: 20, edgePad: 6 });
  });
});
