// Import/export of DSL & config. The pure logic (validate/applyImport)
// needs no DOM; the export helpers go through the download primitive, so we
// stub the same browser globals as download.test.js (isolated per file).

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let anchor = null;
let blobArgs = null;
beforeEach(() => { anchor = null; blobArgs = null; });

globalThis.Blob = class { constructor(parts, opts) { blobArgs = [parts, opts]; } };
globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL() {} };
globalThis.document = {
  createElement: (tag) => {
    const el = { tag, href: '', download: '', click() {}, remove() {} };
    if (tag === 'a') anchor = el;
    return el;
  },
  body: { appendChild() {} },
};

const { exportDSL, exportConfig, validateDSL, validateConfig, applyImport } =
  await import('../../src/app/dsl-io.js');

function fakeStore(dsl = '', config = '') {
  const calls = [];
  return {
    state: { dsl, config },
    setDSL(t) { calls.push(['dsl', t]); this.state.dsl = t; },
    setConfig(t) { calls.push(['config', t]); this.state.config = t; },
    calls,
  };
}

describe('validateDSL', () => {
  test('a valid YAML map is ok', () => {
    const r = validateDSL('connections:\n  - [a, b]\n');
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });
  test('a non-map document is rejected without throwing', () => {
    const r = validateDSL('- a\n- b\n');
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => /mapa YAML/.test(e.msg)));
  });
});

describe('validateConfig', () => {
  test('a config map is ok', () => {
    assert.equal(validateConfig('router:\n  padding: 12\n').ok, true);
  });
  test('a non-map config is rejected', () => {
    const r = validateConfig('- 1\n- 2\n');
    assert.equal(r.ok, false);
    assert.ok(r.errors.length >= 1);
  });
  test('an empty config is valid', () => {
    assert.equal(validateConfig('').ok, true);
  });
});

describe('applyImport', () => {
  test('applies valid DSL to the store', () => {
    const s = fakeStore();
    const r = applyImport(s, 'dsl', 'connections:\n  - [a, b]\n');
    assert.equal(r.applied, true);
    assert.deepEqual(s.calls, [['dsl', 'connections:\n  - [a, b]\n']]);
  });
  test('applies valid config to the store', () => {
    const s = fakeStore();
    const r = applyImport(s, 'config', 'router:\n  padding: 9\n');
    assert.equal(r.applied, true);
    assert.deepEqual(s.calls, [['config', 'router:\n  padding: 9\n']]);
  });
  test('applies invalid content by default (errors surfaced, store still updated)', () => {
    const s = fakeStore();
    const r = applyImport(s, 'config', '- 1\n');
    assert.equal(r.applied, true);
    assert.ok(r.errors.length >= 1);
    assert.equal(s.calls.length, 1);
  });
  test('reject:true refuses invalid content and leaves the store untouched', () => {
    const s = fakeStore('orig-dsl');
    const r = applyImport(s, 'dsl', '- not a map\n', { reject: true });
    assert.equal(r.applied, false);
    assert.equal(s.calls.length, 0);
    assert.equal(s.state.dsl, 'orig-dsl');
  });
  test('an empty string is valid and applied', () => {
    const s = fakeStore();
    const r = applyImport(s, 'dsl', '');
    assert.equal(r.applied, true);
    assert.deepEqual(s.calls, [['dsl', '']]);
  });
});

describe('exportDSL / exportConfig', () => {
  test('exportDSL downloads the dsl string as tensegrams-dsl-*.yaml', () => {
    exportDSL(fakeStore('hello: world\n', 'cfg'));
    assert.match(anchor.download, /^tensegrams-dsl-.*\.yaml$/);
    assert.equal(blobArgs[0][0], 'hello: world\n');
    assert.deepEqual(blobArgs[1], { type: 'text/yaml' });
  });
  test('exportConfig downloads the config string as tensegrams-config-*.yaml', () => {
    exportConfig(fakeStore('dsl', 'router:\n  padding: 1\n'));
    assert.match(anchor.download, /^tensegrams-config-.*\.yaml$/);
    assert.equal(blobArgs[0][0], 'router:\n  padding: 1\n');
    assert.deepEqual(blobArgs[1], { type: 'text/yaml' });
  });
});
