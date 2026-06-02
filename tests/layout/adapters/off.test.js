import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from '../../../src/layout/adapters/off.js';
import { buildIR } from '../../../src/dsl/ir.js';
import { parse } from '../../../src/dsl/parser.js';

function runOnce(ir) {
  return new Promise((resolve) => {
    const session = adapter.start(ir);
    session.on('end', () => resolve(session));
  });
}

describe('off adapter', () => {
  test('respects pin positions', async () => {
    const ir = buildIR(parse(`
a: { label: A, pin: [10, 20] }
b: { label: B, pin: [100, 50] }
`));
    const s = await runOnce(ir);
    assert.deepEqual(s.positions.get('a'), { x: 10, y: 20, width: 140, height: 48 });
    assert.deepEqual(s.positions.get('b'), { x: 100, y: 50, width: 140, height: 48 });
  });

  test('auto-grids unpinned nodes', async () => {
    const ir = buildIR(parse(`
a: { label: A }
b: { label: B }
c: { label: C }
`));
    const s = await runOnce(ir);
    assert.equal(s.positions.size, 3);
    for (const p of s.positions.values()) {
      assert.ok(p.width > 0 && p.height > 0);
    }
  });

  test('computes container bounding box from children', async () => {
    const ir = buildIR(parse(`
outer: { label: outer }
a: { parent: outer, label: A, pin: [0, 0] }
b: { parent: outer, label: B, pin: [200, 100] }
`));
    const s = await runOnce(ir);
    const c = s.containers.get('outer');
    assert.ok(c);
    assert.ok(c.width >= 200);
    assert.ok(c.height >= 100);
  });

  test('emits tick before end exactly once', async () => {
    const ir = buildIR(parse(`a: { label: A }`));
    let ticks = 0;
    const session = adapter.start(ir);
    session.on('tick', () => ticks++);
    await new Promise(resolve => session.on('end', resolve));
    assert.equal(ticks, 1);
  });

  test('declares caps', () => {
    assert.equal(adapter.caps.containers, true);
    assert.equal(adapter.caps.interactive, false);
  });
});
