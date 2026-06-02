// downloadTextFile builds a Blob, an object URL, and clicks a synthetic
// <a download>; fileTimestamp produces a filesystem-safe stamp. Tested with
// minimal browser-global stubs (the Node test runner isolates each file in
// its own process, so these globals don't leak to other suites).

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let anchor = null;    // the fake <a> the module creates
let blobArgs = null;  // [parts, opts] captured from the Blob ctor
let revoked = [];

beforeEach(() => { anchor = null; blobArgs = null; revoked = []; });

globalThis.Blob = class { constructor(parts, opts) { blobArgs = [parts, opts]; } };
globalThis.URL = {
  createObjectURL: () => 'blob:fake',
  revokeObjectURL: (u) => revoked.push(u),
};
globalThis.document = {
  createElement: (tag) => {
    const el = {
      tag, href: '', download: '', clicks: 0, removed: false,
      click() { this.clicks++; },
      remove() { this.removed = true; },
    };
    if (tag === 'a') anchor = el;
    return el;
  },
  body: { appendChild() {} },
};

const { downloadTextFile, fileTimestamp } = await import('../../src/app/download.js');

describe('downloadTextFile', () => {
  test('clicks an <a download> with the given filename and blob mime', () => {
    downloadTextFile('thing.yaml', 'hello: world\n', 'text/yaml');
    assert.equal(anchor.download, 'thing.yaml');
    assert.equal(anchor.href, 'blob:fake');
    assert.equal(anchor.clicks, 1);
    assert.equal(anchor.removed, true);
    assert.equal(blobArgs[0][0], 'hello: world\n');
    assert.deepEqual(blobArgs[1], { type: 'text/yaml' });
  });

  test('defaults the mime to text/plain', () => {
    downloadTextFile('x.txt', 'hi');
    assert.deepEqual(blobArgs[1], { type: 'text/plain' });
  });

  test('revokes the object URL after the download starts', () => {
    const realSetTimeout = globalThis.setTimeout;
    let deferred = null;
    globalThis.setTimeout = (fn) => { deferred = fn; return 0; };
    try {
      downloadTextFile('x.yaml', 'a');
      assert.equal(typeof deferred, 'function');
      deferred(); // run the deferred revoke
      assert.deepEqual(revoked, ['blob:fake']);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });
});

describe('fileTimestamp', () => {
  test('has no characters illegal in Windows filenames', () => {
    const ts = fileTimestamp();
    assert.doesNotMatch(ts, /[:.]/);
    assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });
});
