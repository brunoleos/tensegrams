import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildCollisionResolver, computeSplit } from '../../src/layout/collision.js';

function spec(obj) { return new Map(Object.entries(obj || {})); }
function node(id, collision, extra = {}) {
  return { id, hasChildren: false, nodeCollision: spec(collision), ...extra };
}
function edge(id, source, target, opts = {}) {
  return {
    id, source, target,
    nodeCollision: spec(opts.nodeCollision),
    edgeCollision: spec(opts.edgeCollision),
  };
}
function ir(nodes, edges = []) {
  return { nodes, edges, layers: [], meta: {}, errors: [] };
}

describe('computeSplit', () => {
  test('equal weights → 0.5 / 0.5', () => {
    const s = computeSplit(spec({ g: 0.7 }), spec({ g: 0.7 }), ['g']);
    assert.equal(s.a, 0.5);
    assert.equal(s.b, 0.5);
  });

  test('both weight 0 → 0.5 / 0.5', () => {
    const s = computeSplit(spec({ g: 0 }), spec({ g: 0 }), ['g']);
    assert.equal(s.a, 0.5);
  });

  test('1 vs 0 → high-weight side immovable', () => {
    const s = computeSplit(spec({ g: 1 }), spec({ g: 0 }), ['g']);
    assert.equal(s.a, 0);
    assert.equal(s.b, 1);
  });

  test('0.5 vs 0 → heavier side cedes less, both yield', () => {
    // diff = 0.5 → a = 0.25, b = 0.75 (heavier weight-0.5 side still yields
    // 25%, which prevents the multi-body trap with partial-weight anchors)
    const s = computeSplit(spec({ g: 0.5 }), spec({ g: 0 }), ['g']);
    assert.ok(Math.abs(s.a - 0.25) < 1e-9);
    assert.ok(Math.abs(s.b - 0.75) < 1e-9);
  });

  test('1 vs 0.5 → weight-1 side cedes 25%, weight-0.5 side cedes 75%', () => {
    // diff = 0.5 → a = 0.25, b = 0.75 — heavier side still gives a bit
    const s = computeSplit(spec({ g: 1 }), spec({ g: 0.5 }), ['g']);
    assert.ok(Math.abs(s.a - 0.25) < 1e-9);
    assert.ok(Math.abs(s.b - 0.75) < 1e-9);
  });

  test('multi-label averages per side', () => {
    // a avg weight=(1+0)/2=0.5, b avg weight=0 → diff=0.5 → a=0.25
    const s = computeSplit(spec({ g: 1, h: 0 }), spec({ g: 0, h: 0 }), ['g', 'h']);
    assert.ok(Math.abs(s.a - 0.25) < 1e-9);
    assert.ok(Math.abs(s.b - 0.75) < 1e-9);
  });

  test('a + b always sums to 1', () => {
    const s = computeSplit(spec({ g: 0.3 }), spec({ g: 0.9 }), ['g']);
    assert.ok(Math.abs(s.a + s.b - 1) < 1e-12);
  });
});

describe('collision resolver — node-node', () => {
  test('no shared label → null', () => {
    const r = buildCollisionResolver(ir([node('a', { x: 1 }), node('b', { y: 1 })]));
    assert.equal(r.nodeNodePair('a', 'b'), null);
  });

  test('shared label → pair with shared list and frac', () => {
    const r = buildCollisionResolver(ir([node('a', { g: 0.5 }), node('b', { g: 0.5 })]));
    const p = r.nodeNodePair('a', 'b');
    assert.ok(p);
    assert.deepEqual(p.shared, ['g']);
    assert.equal(p.frac.a, 0.5);
  });

  test('weight 1 vs 0 → high-weight side immovable', () => {
    const r = buildCollisionResolver(ir([node('a', { g: 1 }), node('b', { g: 0 })]));
    const p = r.nodeNodePair('a', 'b');
    assert.equal(p.frac.a, 0);
    assert.equal(p.frac.b, 1);
  });

  test('parent/child is never a collision', () => {
    const r = buildCollisionResolver(ir([
      node('box', { g: 0 }, { hasChildren: true }),
      node('a', { g: 0 }, { parent: 'box' }),
    ]));
    assert.equal(r.nodeNodePair('a', 'box'), null);
    assert.equal(r.nodeNodePair('box', 'a'), null);
  });
});

describe('collision resolver — edge-node', () => {
  test('edge avoids a node with a shared label', () => {
    // edge wire=1, node wire=0.5 → diff=0.5 → edge cedes 0.25, node cedes 0.75
    const r = buildCollisionResolver(ir(
      [node('a'), node('b'), node('c', { wire: 0.5 })],
      [edge('e1', 'a', 'b', { nodeCollision: { wire: 1 } })],
    ));
    const p = r.edgeNodePair('e1', 'c');
    assert.ok(p);
    assert.ok(Math.abs(p.frac.edge - 0.25) < 1e-9);
    assert.ok(Math.abs(p.frac.node - 0.75) < 1e-9);
  });

  test('edge never collides with its own endpoints', () => {
    const r = buildCollisionResolver(ir(
      [node('a', { wire: 1 }), node('b', { wire: 1 })],
      [edge('e1', 'a', 'b', { nodeCollision: { wire: 1 } })],
    ));
    assert.equal(r.edgeNodePair('e1', 'a'), null);
    assert.equal(r.edgeNodePair('e1', 'b'), null);
  });

  test('edge excludes an ancestor of an endpoint', () => {
    const r = buildCollisionResolver(ir(
      [
        node('box', { wire: 1 }, { hasChildren: true }),
        node('a', { wire: 1 }, { parent: 'box' }),
        node('b', { wire: 1 }),
      ],
      [edge('e1', 'a', 'b', { nodeCollision: { wire: 1 } })],
    ));
    assert.equal(r.edgeNodePair('e1', 'box'), null);
  });

  test('geometric necessity wins: edge with paradoxical layer still excludes endpoint+ancestors', () => {
    // Princípio: layers de colisão NÃO bloqueiam a aresta de atravessar
    // o container que contém seu endpoint, mesmo que a aresta declare a
    // mesma layer do container. Multi-level ancestry: nested containers.
    const r = buildCollisionResolver(ir(
      [
        node('outer', { wire: 1 }, { hasChildren: true }),
        node('inner', { wire: 1 }, { hasChildren: true, parent: 'outer' }),
        node('leaf',  { wire: 1 }, { parent: 'inner' }),
        node('peer',  { wire: 1 }),
      ],
      [edge('e1', 'leaf', 'peer', { nodeCollision: { wire: 1 } })],
    ));
    assert.equal(r.edgeNodePair('e1', 'outer'), null,
      'aresta NÃO deve colidir com container ancestral mesmo compartilhando wire=1');
    assert.equal(r.edgeNodePair('e1', 'inner'), null,
      'aresta NÃO deve colidir com container intermediário ancestral');
    assert.equal(r.edgeNodePair('e1', 'leaf'),  null,
      'aresta NÃO deve colidir com o próprio endpoint');
    assert.equal(r.edgeNodePair('e1', 'peer'),  null,
      'aresta NÃO deve colidir com o outro endpoint');
  });
});

describe('collision resolver — edge-edge', () => {
  test('two edges with a shared edge label collide', () => {
    const r = buildCollisionResolver(ir(
      [node('a'), node('b'), node('c'), node('d')],
      [
        edge('e1', 'a', 'b', { edgeCollision: { bus: 0.5 } }),
        edge('e2', 'c', 'd', { edgeCollision: { bus: 0.5 } }),
      ],
    ));
    const p = r.edgeEdgePair('e1', 'e2');
    assert.ok(p);
    assert.equal(p.frac.a, 0.5);
  });

  test('edges sharing an endpoint are excluded', () => {
    const r = buildCollisionResolver(ir(
      [node('a'), node('b'), node('c')],
      [
        edge('e1', 'a', 'b', { edgeCollision: { bus: 1 } }),
        edge('e2', 'a', 'c', { edgeCollision: { bus: 1 } }),
      ],
    ));
    assert.equal(r.edgeEdgePair('e1', 'e2'), null);
  });
});

describe('collision resolver — edgesWithObstacles', () => {
  test('only edges that declare collision labels are listed', () => {
    const r = buildCollisionResolver(ir(
      [node('a'), node('b'), node('c'), node('d')],
      [
        edge('e1', 'a', 'b', { nodeCollision: { w: 1 } }),
        edge('e2', 'c', 'd'),
      ],
    ));
    assert.ok(r.edgesWithObstacles.has('e1'));
    assert.equal(r.edgesWithObstacles.has('e2'), false);
  });
});
