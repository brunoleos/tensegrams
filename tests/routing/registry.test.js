import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getRouter, listRouters } from '../../src/routing/registry.js';

describe('router registry', () => {
  test('lists builtin routers', () => {
    const ids = listRouters().map(d => d.id);
    assert.ok(ids.includes('straight'));
    assert.ok(ids.includes('orthogonal'));
    assert.ok(ids.includes('curved'));
  });

  test('loads each builtin', async () => {
    for (const id of ['straight', 'orthogonal', 'curved']) {
      const r = await getRouter(id);
      assert.equal(r.id, id);
      assert.equal(typeof r.route, 'function');
    }
  });

  test('unknown rejects', async () => {
    await assert.rejects(() => getRouter('zzz'), /unknown router/);
  });
});
