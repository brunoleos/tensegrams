import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from '../../../../src/layout/adapters/custom/index.js';
import { parse } from '../../../../src/dsl/parser.js';
import { buildIR } from '../../../../src/dsl/ir.js';

function runOnce(ir, opts = {}) {
  return new Promise((resolve) => {
    const session = adapter.start(ir, opts);
    session.on('end', () => resolve(session));
  });
}

describe('custom adapter — flat', () => {
  test('places every leaf node', async () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`));
    const s = await runOnce(ir);
    assert.equal(s.positions.size, 3);
  });

  test('without a collision layer, leaves pile up overlapping at the centre', async () => {
    const ir = buildIR(parse(`
a: { label: A }
b: { label: B }
`));
    const s = await runOnce(ir);
    const a = s.positions.get('a'), b = s.positions.get('b');
    const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
                      a.y + a.height <= b.y || b.y + b.height <= a.y);
    assert.equal(overlap, true, 'no collision layer → nodes pile up overlapping');
  });

  test('a shared collision layer spreads leaves apart', async () => {
    const ir = buildIR(parse(`
a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
`));
    const s = await runOnce(ir);
    const a = s.positions.get('a'), b = s.positions.get('b');
    const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
                      a.y + a.height <= b.y || b.y + b.height <= a.y);
    assert.equal(overlap, false, 'collision layer should separate the two');
  });
});

describe('custom adapter — containers', () => {
  test('container rect encloses its children', async () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]

outer: { label: outer }
a: { parent: outer, label: A }
b: { parent: outer, label: B }
`));
    const s = await runOnce(ir);
    const outer = s.containers.get('outer');
    const a = s.positions.get('a');
    const b = s.positions.get('b');
    assert.ok(outer, 'container should be positioned');
    assert.ok(a.x >= outer.x);
    assert.ok(a.y >= outer.y);
    assert.ok(a.x + a.width <= outer.x + outer.width);
    assert.ok(b.x + b.width <= outer.x + outer.width);
  });

  test('nested containers placed bottom-up', async () => {
    const ir = buildIR(parse(`
outer: { label: outer }
inner: { parent: outer, label: inner }
leaf:  { parent: inner, label: L }
`));
    const s = await runOnce(ir);
    const outer = s.containers.get('outer');
    const inner = s.containers.get('inner');
    const leaf = s.positions.get('leaf');
    assert.ok(outer && inner && leaf);
    assert.ok(inner.x >= outer.x);
    assert.ok(leaf.x >= inner.x);
  });
});

describe('custom adapter — session', () => {
  test('emits exactly one tick + end', async () => {
    const ir = buildIR(parse(`a: { label: A }`));
    const session = adapter.start(ir);
    let ticks = 0, ended = false;
    session.on('tick', () => ticks++);
    session.on('end', () => { ended = true; });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(ticks, 1);
    assert.equal(ended, true);
  });

  test('stop before tick suppresses emit', async () => {
    const ir = buildIR(parse(`a: { label: A }`));
    const session = adapter.start(ir);
    session.stop();
    let ticks = 0;
    session.on('tick', () => ticks++);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(ticks, 0);
  });
});
