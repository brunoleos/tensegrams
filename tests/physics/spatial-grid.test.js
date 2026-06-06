import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addBody, STRIDE, X, Y, HALF_W, HALF_H } from '../../src/physics/world.js';
import { buildGrid, eachCandidatePair } from '../../src/physics/spatial-grid.js';

// brute-force: todo par cujas BBoxes padded se sobrepõem
function bruteOverlapPairs(world, pad) {
  const { data, alive, highWater } = world;
  const out = new Set();
  for (let a = 0; a < highWater; a++) {
    if (!alive[a]) continue;
    for (let b = a + 1; b < highWater; b++) {
      if (!alive[b]) continue;
      const oa = a * STRIDE, ob = b * STRIDE;
      const dx = Math.abs(data[oa + X] - data[ob + X]);
      const dy = Math.abs(data[oa + Y] - data[ob + Y]);
      const sx = data[oa + HALF_W] + data[ob + HALF_W] + 2 * pad;
      const sy = data[oa + HALF_H] + data[ob + HALF_H] + 2 * pad;
      if (dx < sx && dy < sy) out.add(a * 1e6 + b);
    }
  }
  return out;
}

function candidateSet(world, pad) {
  const grid = buildGrid(world, { pad });
  const out = new Set();
  eachCandidatePair(grid, (a, b) => out.add(a * 1e6 + b));
  return out;
}

describe('physics/spatial-grid — broad-phase', () => {
  test('corpos próximos viram par candidato; distantes não', () => {
    const w = createWorld(8);
    addBody(w, { x: 0, y: 0, halfW: 10, halfH: 10 });
    addBody(w, { x: 15, y: 0, halfW: 10, halfH: 10 });   // sobrepõe o 0
    addBody(w, { x: 1000, y: 1000, halfW: 10, halfH: 10 }); // longe
    const cand = candidateSet(w, 0);
    assert.ok(cand.has(0 * 1e6 + 1), 'par próximo presente');
    assert.ok(!cand.has(0 * 1e6 + 2), 'par distante ausente');
  });

  test('paridade: todo par realmente sobreposto (padded) é candidato', () => {
    const w = createWorld(64);
    // grade pseudo-aleatória determinística
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 40; i++) {
      addBody(w, { x: rnd() * 400, y: rnd() * 400, halfW: 8 + rnd() * 12, halfH: 8 + rnd() * 12 });
    }
    const pad = 6;
    const brute = bruteOverlapPairs(w, pad);
    const cand = candidateSet(w, pad);
    for (const p of brute) {
      assert.ok(cand.has(p), `par sobreposto ${p} deve ser candidato`);
    }
  });

  test('pares candidatos são únicos (sem duplicata entre células)', () => {
    const w = createWorld(8);
    // corpos grandes que cobrem várias células
    addBody(w, { x: 0, y: 0, halfW: 60, halfH: 60 });
    addBody(w, { x: 30, y: 30, halfW: 60, halfH: 60 });
    const grid = buildGrid(w, { pad: 4, cellSize: 20 });
    let count = 0;
    eachCandidatePair(grid, () => count++);
    assert.equal(count, 1, 'par (0,1) emitido uma única vez');
  });

  test('determinismo: mesma sequência de pares em duas construções', () => {
    const mk = () => { const w = createWorld(8); addBody(w, { x: 0, halfW: 10, halfH: 10 }); addBody(w, { x: 12, halfW: 10, halfH: 10 }); addBody(w, { x: 24, halfW: 10, halfH: 10 }); return w; };
    const seqOf = (w) => { const s = []; eachCandidatePair(buildGrid(w, { pad: 2 }), (a, b) => s.push([a, b])); return s; };
    assert.deepEqual(seqOf(mk()), seqOf(mk()));
  });
});
