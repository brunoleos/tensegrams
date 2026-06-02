// End-to-end: DSL text → parser → IR → layout adapter → router → final positions.
// No DOM; tests the pipeline as wired in main.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/dsl/parser.js';
import { buildIR } from '../src/dsl/ir.js';
import { getLayoutAdapter } from '../src/layout/registry.js';
import { getRouter } from '../src/routing/registry.js';
import { projectIR } from '../src/controls/abstraction.js';
import { buildCollisionResolver } from '../src/layout/collision.js';
import { applyObstacleRouting } from '../src/routing/obstacle-route.js';

async function pipeline(src, { layoutId = 'custom', routerId = 'orthogonal', focused = null } = {}) {
  const ir = projectIR(buildIR(parse(src)), focused);
  const adapter = await getLayoutAdapter(layoutId);
  const router = await getRouter(routerId);
  const session = adapter.start(ir, {});
  await new Promise(r => session.on('end', r));
  const routed = session.routedEdges || router.route(ir, session.positions);
  return { ir, positions: session.positions, containers: session.containers, routed };
}

const SRC = `
options:
  title: Test

connections:
  - [api, db]
  - [api, cache]
  - [api, auth]
  - [auth, worker]

api:
  label: API
  viewLayers: [public]

db:
  label: Database
  viewLayers: [data]

cache:
  label: Redis
  viewLayers: [infra]

backend:
  label: Backend
  viewLayers: [infra]

auth:
  parent: backend
  label: Auth

worker:
  parent: backend
  label: Worker
`;

describe('pipeline — custom + orthogonal', () => {
  test('renders all leaf nodes', async () => {
    const r = await pipeline(SRC);
    const leafIds = r.ir.nodes.filter(n => !n.hasChildren).map(n => n.id);
    for (const id of leafIds) {
      assert.ok(r.positions.has(id), `missing position for ${id}`);
    }
  });

  test('renders the container', async () => {
    const r = await pipeline(SRC);
    assert.ok(r.containers.has('backend'));
  });

  test('routes every edge', async () => {
    const r = await pipeline(SRC);
    for (const e of r.ir.edges) {
      const re = r.routed.get(e.id);
      assert.ok(re, `missing routed edge ${e.id}`);
      assert.ok(re.points.length >= 2);
    }
  });
});

describe('pipeline — off + straight', () => {
  test('respects pinned nodes', async () => {
    const r = await pipeline(`
a:
  label: A
  pin: [10, 20]
`, { layoutId: 'off', routerId: 'straight' });
    assert.deepEqual(r.positions.get('a'), { x: 10, y: 20, width: 140, height: 48 });
  });
});

describe('pipeline — projection (abstraction drill-in)', () => {
  test('focused container yields only its subtree', async () => {
    const r = await pipeline(SRC, { focused: 'backend' });
    const ids = r.ir.nodes.map(n => n.id).sort();
    assert.deepEqual(ids, ['auth', 'worker']);
  });

  test('focused subtree has its single internal edge', async () => {
    const r = await pipeline(SRC, { focused: 'backend' });
    assert.equal(r.ir.edges.length, 1);
    assert.equal(r.routed.size, 1);
  });
});

describe('pipeline — every router works with custom layout', () => {
  for (const routerId of ['straight', 'orthogonal', 'curved']) {
    test(`router ${routerId} produces routed edges`, async () => {
      const r = await pipeline(SRC, { routerId });
      assert.ok(r.routed.size > 0);
    });
  }
});

describe('pipeline — collision layers + obstacle routing', () => {
  const COLL = `
connections:
  - [a, b]

a:
  label: A
  pin: [0, 0]
b:
  label: B
  pin: [400, 0]
blk:
  label: Block
  pin: [190, -30]
  nodeLayers: [wire]

? [a, b]
: { nodeLayers: [wire] }
`;
  // `off` honors pins, so the obstacle (blk) sits between a and b; this
  // exercises real obstacle routing. `custom` ignores pins, so its nodes
  // would all coincide — not a meaningful obstacle-routing scenario.
  for (const layoutId of ['off']) {
    for (const routerId of ['straight', 'orthogonal', 'curved']) {
      test(`${layoutId} + ${routerId}: collision attrs route cleanly`, async () => {
        const ir = buildIR(parse(COLL));
        const adapter = await getLayoutAdapter(layoutId);
        const router = await getRouter(routerId);
        const session = adapter.start(ir, {});
        await new Promise(r => session.on('end', r));
        const rects = new Map(session.positions);
        for (const [id, rc] of session.containers) rects.set(id, rc);
        const raw = router.route(ir, rects);
        const resolver = buildCollisionResolver(ir);
        const out = applyObstacleRouting(ir, raw, rects, resolver, {
          orthogonal: routerId === 'orthogonal',
        });
        const edge = ir.edges[0];
        const re = out.get(edge.id);
        assert.ok(re && re.points.length >= 2, `edge ${edge.id} should be routed`);
      });
    }
  }

  test('collision attrs survive layer filtering', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]

? [a, b]
: { nodeLayers: { wire: 0.5 }, viewLayers: [net] }
`));
    assert.equal(ir.edges[0].nodeCollision.get('wire'), 0.5);
    assert.deepEqual(ir.edges[0].layers, ['net']);
  });
});
