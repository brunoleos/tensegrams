import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from '../src/version.js';

describe('version.js', () => {
  test('exports a non-empty string', () => {
    assert.equal(typeof VERSION, 'string');
    assert.ok(VERSION.length > 0);
  });

  test('default value is "dev" (locally / pre-CI-stamp)', () => {
    // CI overwrites this file before deploy. Locally we expect "dev" so
    // developers spot if they accidentally committed a stamped version.
    // (If you see this fail, check that version.js wasn't overwritten by
    // a misfired CI step.)
    assert.equal(VERSION, 'dev');
  });
});
