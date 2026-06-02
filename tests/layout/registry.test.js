import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getLayoutAdapter, listLayoutAdapters } from '../../src/layout/registry.js';

describe('layout registry', () => {
  test('lists at least off and custom', () => {
    const ids = listLayoutAdapters().map(d => d.id);
    assert.ok(ids.includes('off'));
    assert.ok(ids.includes('custom'));
  });

  test('descriptors expose caps', () => {
    for (const d of listLayoutAdapters()) {
      assert.ok(typeof d.caps === 'object' && d.caps !== null);
    }
  });

  test('getLayoutAdapter loads off', async () => {
    const a = await getLayoutAdapter('off');
    assert.equal(a.id, 'off');
    assert.equal(typeof a.start, 'function');
  });

  test('getLayoutAdapter loads custom', async () => {
    const a = await getLayoutAdapter('custom');
    assert.equal(a.id, 'custom');
  });

  test('unknown id rejects', async () => {
    await assert.rejects(() => getLayoutAdapter('nonexistent'), /unknown layout adapter/);
  });

  test('memoizes loads (same promise)', async () => {
    const p1 = getLayoutAdapter('off');
    const p2 = getLayoutAdapter('off');
    assert.equal(p1, p2);
  });
});
