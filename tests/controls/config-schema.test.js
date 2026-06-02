import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  knownChildrenAt,
  defaultForChild,
  helpForChild,
} from '../../src/controls/config-schema.js';

describe('knownChildrenAt — schema discoverability', () => {
  test('root lists every top-level option', () => {
    const got = knownChildrenAt([]);
    for (const k of ['live', 'collision', 'router']) {
      assert.ok(got.includes(k), `root should include ${k}`);
    }
  });

  test('collision lists nodePad and edgePad', () => {
    const got = knownChildrenAt(['collision']);
    assert.ok(got.includes('nodePad'), 'expected nodePad');
    assert.ok(got.includes('edgePad'), 'expected edgePad');
  });

  test('live lists every live knob', () => {
    const got = knownChildrenAt(['live']);
    for (const k of ['center', 'damping', 'collision', 'collisionK']) {
      assert.ok(got.includes(k), `expected live.${k}`);
    }
  });

  test('router lists padding', () => {
    assert.deepEqual(knownChildrenAt(['router']), ['padding']);
  });
});

describe('defaultForChild — placeholder values', () => {
  test('leaf returns schema default (number knob)', () => {
    assert.equal(defaultForChild(['live'], 'damping'), 0.82);
  });

  test('collision pad leaves return their schema defaults', () => {
    assert.equal(defaultForChild(['collision'], 'nodePad'), 12);
    assert.equal(defaultForChild(['collision'], 'edgePad'), 8);
  });

  test('intermediate returns empty object', () => {
    assert.deepEqual(defaultForChild([], 'live'), {});
    assert.deepEqual(defaultForChild([], 'collision'), {});
  });
});

describe('helpForChild — explanation strings', () => {
  test('leaf returns schema help', () => {
    const s = helpForChild(['live'], 'damping');
    assert.match(s, /amortecimento/i); // Portuguese
  });

  test('intermediate returns fallback text', () => {
    const s = helpForChild([], 'live');
    assert.match(s, /objeto/i);
  });

  test('collision pad leaf returns schema help', () => {
    assert.match(helpForChild(['collision'], 'edgePad'), /arestas/i);
  });
});
