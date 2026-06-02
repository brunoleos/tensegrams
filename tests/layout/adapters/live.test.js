import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from '../../../src/layout/adapters/live/index.js';
import { buildIR } from '../../../src/dsl/ir.js';
import { parse } from '../../../src/dsl/parser.js';

// In Node (no requestAnimationFrame), the live adapter does NOT auto-tick.
// Consumer drives it manually via session.tick() — that's what we exercise here.

function start(src) {
  const ir = buildIR(parse(src));
  return adapter.start(ir, {});
}

function runUntilSettled(session, maxTicks = 600) {
  let t = 0;
  while (session.alpha >= 0.005 && t < maxTicks) {
    session.tick();
    t++;
  }
  return t;
}

describe('live adapter — caps & lifecycle', () => {
  test('declares interactive caps', () => {
    assert.equal(adapter.caps.interactive, true);
    assert.equal(adapter.caps.containers, true);
    assert.equal(adapter.id, 'live');
  });

  test('emits initial tick and (eventually) end', async () => {
    const ir = buildIR(parse(`
a: { label: A, pin: [0, 0] }
b: { label: B, pin: [200, 0] }
`));
    const session = adapter.start(ir);
    let ticks = 0;
    session.on('tick', () => ticks++);
    await new Promise(r => session.on('end', r));
    assert.ok(ticks >= 1);
  });

  test('stop() halts further ticks', () => {
    const session = start(`
connections:
  - [a, b]

a: { label: A }
b: { label: B }
`);
    session.stop();
    const before = session.positions.get('a')?.x;
    session.tick();
    session.tick();
    const after = session.positions.get('a')?.x;
    assert.equal(before, after);
  });
});

describe('live adapter — pins', () => {
  test('pinned node stays at its pin position', () => {
    const session = start(`
connections:
  - [a, b]
  - [a, c]

a: { label: A, pin: [50, 80] }
b: { label: B }
c: { label: C }
`);
    runUntilSettled(session);
    const pa = session.positions.get('a');
    assert.equal(pa.x, 50);
    assert.equal(pa.y, 80);
  });

  test('non-pinned nodes do move from their seed', () => {
    const session = start(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`);
    const seedA = { ...session.positions.get('a') };
    runUntilSettled(session);
    const finalA = session.positions.get('a');
    // Either x or y must change.
    assert.ok(
      Math.abs(finalA.x - seedA.x) > 0.01 || Math.abs(finalA.y - seedA.y) > 0.01,
      'expected unpinned node to move during simulation',
    );
  });
});

describe('live adapter — constraints', () => {
  test('axis-x keeps the node on a vertical line', () => {
    const session = start(`
connections:
  - [a, b]

a: { label: A, constraint: { type: axis-x, value: 100 } }
b: { label: B }
`);
    runUntilSettled(session);
    const pa = session.positions.get('a');
    // axis-x:100 puts the node TL.x = 100.
    assert.equal(pa.x, 100);
  });

  test('axis-y keeps the node on a horizontal line', () => {
    const session = start(`
connections:
  - [a, b]

a: { label: A, constraint: { type: axis-y, value: 50 } }
b: { label: B }
`);
    runUntilSettled(session);
    const pa = session.positions.get('a');
    assert.equal(pa.y, 50);
  });

  test('circle constraint keeps node within radius', () => {
    const session = start(`
connections:
  - [hub, client]

hub: { label: Hub, pin: [0, 0] }
client: { label: Client, constraint: { type: circle, x: 0, y: 0, r: 200 } }
`);
    runUntilSettled(session);
    const pc = session.positions.get('client');
    // Use node center for distance check.
    const cx = pc.x + pc.width / 2;
    const cy = pc.y + pc.height / 2;
    const d = Math.sqrt(cx * cx + cy * cy);
    assert.ok(d <= 200 + 0.01, `expected distance ≤ 200, got ${d}`);
  });

  test('rect constraint keeps node inside the rectangle', () => {
    const session = start(`
connections:
  - [a, b]

a: { label: A, constraint: { type: rect, x: 0, y: 0, w: 300, h: 200 } }
b: { label: B, pin: [500, 500] }
`);
    runUntilSettled(session);
    const pa = session.positions.get('a');
    const cx = pa.x + pa.width / 2;
    const cy = pa.y + pa.height / 2;
    assert.ok(cx >= 0 && cx <= 300, `cx ${cx} not in [0,300]`);
    assert.ok(cy >= 0 && cy <= 200, `cy ${cy} not in [0,200]`);
  });
});

describe('live adapter — containers from children', () => {
  test('container bbox derived from member positions', () => {
    const session = start(`
outer: { label: outer }
a: { parent: outer, label: A, pin: [0, 0] }
b: { parent: outer, label: B, pin: [200, 100] }
`);
    runUntilSettled(session);
    const c = session.containers.get('outer');
    assert.ok(c, 'expected container "outer"');
    assert.ok(c.width >= 200);
    assert.ok(c.height >= 100);
  });
});

describe('live adapter — drag / release', () => {
  test('update({drag}) moves the node to the requested position', () => {
    const session = start(`
connections:
  - [a, b]

a: { label: A }
b: { label: B }
`);
    session.tick();
    session.update({ drag: { id: 'a', x: 999, y: 777 } });
    session.tick();
    const pa = session.positions.get('a');
    assert.equal(pa.x, 999);
    assert.equal(pa.y, 777);
  });

  test('release after drag returns the body to the sim (flow mode)', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`));
    const session = adapter.start(ir, { live: { interactionMode: 'flow' } });
    session.update({ drag: { id: 'b', x: 500, y: 500 } });
    for (let i = 0; i < 5; i++) session.tick();
    assert.equal(session.positions.get('b').x, 500);
    session.update({ release: 'b' });
    runUntilSettled(session);
    const pb = session.positions.get('b');
    assert.ok(
      Math.abs(pb.x - 500) > 1 || Math.abs(pb.y - 500) > 1,
      'expected b to move after release in flow mode',
    );
  });

  test('release of a DSL-pinned node snaps back to its pin', () => {
    const session = start(`
connections:
  - [a, b]

a: { label: A, pin: [10, 20] }
b: { label: B }
`);
    session.update({ drag: { id: 'a', x: 999, y: 999 } });
    session.tick();
    session.update({ release: 'a' });
    runUntilSettled(session);
    const pa = session.positions.get('a');
    assert.equal(pa.x, 10);
    assert.equal(pa.y, 20);
  });
});

describe('live adapter — central attractor', () => {
  test('unpinned nodes converge near the origin', () => {
    const session = start(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`);
    runUntilSettled(session);
    // No collision layers → nothing spreads the bodies; the attractor
    // pulls every node onto the board centre.
    for (const id of ['a', 'b', 'c']) {
      const p = session.positions.get(id);
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      assert.ok(Math.hypot(cx, cy) < 40, `${id} did not settle near origin: ${cx},${cy}`);
    }
  });
});

describe('live adapter — collision layers', () => {
  // Rectangle-intersection test on settled positions.
  function overlaps(a, b) {
    return !(a.x + a.width <= b.x || b.x + b.width <= a.x ||
             a.y + a.height <= b.y || b.y + b.height <= a.y);
  }
  function anyOverlap(positions) {
    const arr = Array.from(positions.values());
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        if (overlaps(arr[i], arr[j])) return [arr[i], arr[j]];
    return null;
  }

  test('nodes sharing a collision layer settle without overlap', () => {
    const ir = buildIR(parse(`
connections:
  - [hub, client1]
  - [hub, client2]
  - [hub, client3]
  - [hub, worker]
  - [worker, service]
  - [service, queue]

hub:     { label: Hub,      pin: [0, 0], nodeLayers: [g] }
client1: { label: Client A, nodeLayers: [g] }
client2: { label: Client B, nodeLayers: [g] }
client3: { label: Client C, nodeLayers: [g] }
worker:  { label: Worker,   nodeLayers: [g] }
service: { label: Service,  nodeLayers: [g] }
queue:   { label: Queue,    nodeLayers: [g] }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    const hit = anyOverlap(session.positions);
    assert.equal(hit, null, hit ? `still overlapping: ${JSON.stringify(hit)}` : '');
  });

  test('nodes without a shared collision layer are free to overlap', () => {
    const ir = buildIR(parse(`
connections:
  - [hub, a]
  - [hub, b]

hub: { label: Hub, pin: [0, 0] }
a: { label: A }
b: { label: B }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    // No collision labels → resolver never forces separation; just assert
    // the run completed without error.
    assert.ok(session.positions.size >= 3);
  });

  test('kill-switch: opts.live.collision=false disables resolution', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]

a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
`));
    const session = adapter.start(ir, { live: { collision: false } });
    runUntilSettled(session);
    const arr = Array.from(session.positions.values());
    const overlap = arr[0].x + arr[0].width > arr[1].x && arr[1].x + arr[1].width > arr[0].x
                 && arr[0].y + arr[0].height > arr[1].y && arr[1].y + arr[1].height > arr[0].y;
    assert.equal(overlap, true);
  });

  test('both sides share a layer → split push, no overlap', () => {
    const ir = buildIR(parse(`
a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    assert.equal(overlaps(session.positions.get('a'), session.positions.get('b')), false);
  });

  test('PADDED BBoxes (rect+nodePad) do NOT overlap at rest', () => {
    // The collision contract is the PADDED BBox, not the raw shape: same-layer
    // padded BBoxes must never overlap once the sim has settled. Soft impulse
    // alone is elastic and freezes with residual overlap inside the pad zone —
    // this test locks in the hard separation guarantee.
    const ir = buildIR(parse(`
a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    const a = session.positions.get('a');
    const b = session.positions.get('b');
    const pad = 12; // default cfg.collisionPadding
    const inflate = (r) => ({ x: r.x - pad, y: r.y - pad, width: r.width + 2 * pad, height: r.height + 2 * pad });
    const ia = inflate(a), ib = inflate(b);
    const gapX = Math.max(ib.x - (ia.x + ia.width), ia.x - (ib.x + ib.width));
    const gapY = Math.max(ib.y - (ia.y + ia.height), ia.y - (ib.y + ib.height));
    // Separated iff max(gapX, gapY) >= 0; touching is fine (allow ε for FP).
    assert.ok(Math.max(gapX, gapY) >= -1e-6,
      `padded BBoxes overlap (gapX=${gapX}, gapY=${gapY}): a@(${a.x},${a.y}) b@(${b.x},${b.y})`);
  });

  test('sibling containers sharing a layer separate', () => {
    const ir = buildIR(parse(`
box1: { label: box1, nodeLayers: [g] }
a: { parent: box1, label: A, pin: [0, 0] }
b: { parent: box1, label: B, pin: [80, 0] }
box2: { label: box2, nodeLayers: [g] }
c: { parent: box2, label: C }
d: { parent: box2, label: D }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    const r1 = session.containers.get('box1');
    const r2 = session.containers.get('box2');
    assert.equal(overlaps(r1, r2), false,
      `containers still overlap: ${JSON.stringify(r1)} vs ${JSON.stringify(r2)}`);
  });

  test('foreign leaf is pushed out of a container sharing its layer', () => {
    const ir = buildIR(parse(`
box: { label: box, nodeLayers: [g] }
inner1: { parent: box, label: I1, pin: [0, 0] }
inner2: { parent: box, label: I2, pin: [80, 0] }
loose: { label: L, nodeLayers: [g] }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    const c = session.containers.get('box');
    const loose = session.positions.get('loose');
    assert.equal(overlaps(loose, c), false,
      `loose at ${JSON.stringify(loose)} still overlaps box ${JSON.stringify(c)}`);
  });

  test('a container child is never pushed out of its own container', () => {
    const ir = buildIR(parse(`
box: { label: box, nodeLayers: [g] }
child: { parent: box, label: C, pin: [10, 10], nodeLayers: [g] }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    const child = session.positions.get('child');
    assert.equal(child.x, 10);
    assert.equal(child.y, 10);
  });
});

describe('live adapter — frozen mode (default)', () => {
  test('during drag, all OTHER bodies stay frozen at their current pos', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`));
    const session = adapter.start(ir, {}); // default: frozen
    runUntilSettled(session);
    const aBefore = { ...session.positions.get('a') };
    const cBefore = { ...session.positions.get('c') };
    session.update({ drag: { id: 'b', x: 700, y: -200 } });
    for (let i = 0; i < 20; i++) session.tick();
    const aAfter = session.positions.get('a');
    const cAfter = session.positions.get('c');
    assert.equal(aBefore.x, aAfter.x);
    assert.equal(aBefore.y, aAfter.y);
    assert.equal(cBefore.x, cAfter.x);
    assert.equal(cBefore.y, cAfter.y);
  });

  test('on release, the dropped body re-enters the sim (no drop-point pin)', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    session.update({ drag: { id: 'b', x: 800, y: 800 } });
    for (let i = 0; i < 5; i++) session.tick();
    session.update({ release: 'b' });
    runUntilSettled(session);
    // b is no longer pinned at the drop point — it re-enters the sim and
    // the central attractor pulls it back toward the origin.
    const bAfter = session.positions.get('b');
    assert.ok(
      Math.abs(bAfter.x - 800) > 1 || Math.abs(bAfter.y - 800) > 1,
      `b should re-enter the sim after release; got ${JSON.stringify(bAfter)}`,
    );
  });

  test('a body dropped earlier still freezes during a later drag, then re-enters the sim', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    session.update({ drag: { id: 'b', x: 800, y: 800 } });
    for (let i = 0; i < 3; i++) session.tick();
    session.update({ release: 'b' });
    runUntilSettled(session);
    const bAfterFirst = { ...session.positions.get('b') };
    // Dragging c freezes every OTHER body — including b — for the
    // duration of the drag.
    session.update({ drag: { id: 'c', x: -200, y: -200 } });
    for (let i = 0; i < 20; i++) session.tick();
    const bDuringSecond = session.positions.get('b');
    assert.equal(bDuringSecond.x, bAfterFirst.x);
    assert.equal(bDuringSecond.y, bAfterFirst.y);
    // Releasing c returns it to the sim too — nothing stays pinned.
    session.update({ release: 'c' });
    runUntilSettled(session);
    const cFinal = session.positions.get('c');
    assert.ok(
      Math.abs(cFinal.x - (-200)) > 1 || Math.abs(cFinal.y - (-200)) > 1,
      `c should re-enter the sim after release; got ${JSON.stringify(cFinal)}`,
    );
  });
});

describe('live adapter — flow mode (opt-in)', () => {
  test('release returns the dragged body to forces', () => {
    const ir = buildIR(parse(`
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`));
    const session = adapter.start(ir, { live: { interactionMode: 'flow' } });
    session.update({ drag: { id: 'b', x: 600, y: 600 } });
    for (let i = 0; i < 5; i++) session.tick();
    session.update({ release: 'b' });
    runUntilSettled(session);
    const after = session.positions.get('b');
    // In flow mode, b drifts away from (600,600) under the central attractor.
    assert.ok(
      Math.abs(after.x - 600) > 5 || Math.abs(after.y - 600) > 5,
      `flow mode should let b drift; got ${JSON.stringify(after)}`,
    );
  });
});

describe('live adapter — container with all children filtered out still has a rect', () => {
  test('empty container is committed at its own px/py with default size', () => {
    // The IR builder only flags a node as a container when something
    // declares it as parent. Use a hidden helper child to do so.
    const ir = buildIR(parse(`
empty: { label: empty }
_e_child: { parent: empty, label: ' ' }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    const rect = session.containers.get('empty');
    assert.ok(rect, 'empty container must be committed');
    assert.ok(rect.width >= 120, `width: ${rect.width}`);
    assert.ok(rect.height >= 60, `height: ${rect.height}`);
  });

  test('empty container coexists with sibling leaves', () => {
    const ir = buildIR(parse(`
empty: { label: empty }
_e_child: { parent: empty, label: ' ' }
sibling: { label: S }
`));
    const session = adapter.start(ir, {});
    runUntilSettled(session);
    assert.ok(session.containers.get('empty'));
    assert.ok(session.positions.get('sibling'));
  });
});

describe('live adapter — warm restart via seedPositions', () => {
  // The pipeline snapshots positions before stopping the previous
  // session and passes them as `live.seedPositions` to the next, so
  // DSL/config edits don't re-explode the diagram.
  test('seeded bodies start exactly at the supplied (centered) coords', () => {
    const ir = buildIR(parse(`
a: { label: A }
b: { label: B }
`));
    const seedPositions = new Map([
      ['a', { x: 100, y: 200, width: 140, height: 48 }],
      ['b', { x: 400, y: 200, width: 140, height: 48 }],
    ]);
    const session = adapter.start(ir, { live: { seedPositions } });
    // Inspect the very first commit — no ticks driven yet.
    const a = session.positions.get('a');
    const b = session.positions.get('b');
    assert.equal(a.x, 100);
    assert.equal(a.y, 200);
    assert.equal(b.x, 400);
    assert.equal(b.y, 200);
  });

  test('bodies missing from the seed fall back to the circle seed', () => {
    const ir = buildIR(parse(`
a: { label: A }
b: { label: B }
`));
    const seedPositions = new Map([
      ['a', { x: 500, y: 500, width: 140, height: 48 }],
      // b absent: should not crash, should land on the circle.
    ]);
    const session = adapter.start(ir, { live: { seedPositions } });
    const a = session.positions.get('a');
    const b = session.positions.get('b');
    assert.equal(a.x, 500);
    // b on the radius-180+ ring around the origin → far from (500,500).
    const distFromSeed = Math.hypot(b.x - 500, b.y - 500);
    assert.ok(distFromSeed > 100, `b should not be at seed pos, got ${b.x},${b.y}`);
  });

  test('warm restart starts at <=alphaKick instead of full alpha=1', () => {
    const ir = buildIR(parse(`a: { label: A }`));
    const seedPositions = new Map([
      ['a', { x: 0, y: 0, width: 140, height: 48 }],
    ]);
    const session = adapter.start(ir, { live: { seedPositions } });
    // DEFAULTS.alphaKick is 0.5 — warm restart shouldn't exceed it
    // (no seedAlpha supplied → max(0, 0.5) = 0.5).
    assert.ok(session.alpha <= 0.5 + 1e-9,
      `warm restart alpha should be <= alphaKick (0.5), got ${session.alpha}`);
  });

  test('cold start (no seed) still uses alpha=1', () => {
    const ir = buildIR(parse(`a: { label: A }`));
    const session = adapter.start(ir, {});
    assert.ok(session.alpha >= 0.999,
      `cold start alpha should be ~1, got ${session.alpha}`);
  });

  test('seed for ids that do NOT match any body → cold start', () => {
    // Drill-in / layout-switch case: the seed snapshot belongs to a
    // different view, so the new IR shouldn't inherit the lower alpha.
    const ir = buildIR(parse(`a: { label: A }`));
    const seedPositions = new Map([
      ['ghost1', { x: 100, y: 100, width: 140, height: 48 }],
      ['ghost2', { x: 200, y: 200, width: 140, height: 48 }],
    ]);
    const session = adapter.start(ir, { live: { seedPositions } });
    assert.ok(session.alpha >= 0.999,
      `disjoint-seed restart should be cold, got alpha=${session.alpha}`);
  });

  test('seeded body keeps its position after settling (no drift back to origin past it)', () => {
    // Single isolated body with seed near origin → central attractor
    // already happy → no significant motion expected.
    const ir = buildIR(parse(`a: { label: A }`));
    const seedPositions = new Map([
      ['a', { x: -70, y: -24, width: 140, height: 48 }], // center exactly at (0,0)
    ]);
    const session = adapter.start(ir, { live: { seedPositions } });
    runUntilSettled(session);
    const a = session.positions.get('a');
    // Centered at origin → x = -width/2, y = -height/2.
    assert.equal(a.x, -70);
    assert.equal(a.y, -24);
  });
});

describe('live adapter — config knobs', () => {
  test('opts.collision.nodePad widens the gap between colliding nodes', () => {
    const src = `
a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
`;
    const tight = adapter.start(buildIR(parse(src)), { collision: { nodePad: 4 } });
    const wide  = adapter.start(buildIR(parse(src)), { collision: { nodePad: 90 } });
    runUntilSettled(tight);
    runUntilSettled(wide);
    const gap = (s) => {
      const a = s.positions.get('a'), b = s.positions.get('b');
      return Math.hypot(
        (a.x + a.width / 2) - (b.x + b.width / 2),
        (a.y + a.height / 2) - (b.y + b.height / 2),
      );
    };
    assert.ok(gap(wide) > gap(tight) + 50,
      `expected larger nodePad → larger gap, got tight=${gap(tight)} wide=${gap(wide)}`);
  });
});
