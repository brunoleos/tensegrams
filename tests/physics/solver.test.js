import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addBody, STRIDE, X, Y, HALF_W, HALF_H } from '../../src/physics/world.js';
import { createSolver } from '../../src/physics/solver.js';
import { buildContributors, listFields, createContributor } from '../../src/physics/registry.js';

const L = (...t) => new Set(t);

function pairOverlap(w, a, b) {
  const oa = a * STRIDE, ob = b * STRIDE;
  const ox = (w.data[oa + HALF_W] + w.data[ob + HALF_W]) - Math.abs(w.data[ob + X] - w.data[oa + X]);
  const oy = (w.data[oa + HALF_H] + w.data[ob + HALF_H]) - Math.abs(w.data[ob + Y] - w.data[oa + Y]);
  return Math.min(ox, oy); // >0 em ambos os eixos = sobreposto
}
function dist(w, a, b) {
  const oa = a * STRIDE, ob = b * STRIDE;
  return Math.hypot(w.data[ob + X] - w.data[oa + X], w.data[ob + Y] - w.data[oa + Y]);
}

describe('physics/solver + registry — integração', () => {
  test('campos default: colisão + central acomodam nós sem sobreposição', () => {
    const w = createWorld(8);
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push(addBody(w, { x: i * 3 - 4, y: 0, halfW: 10, halfH: 10, layers: L('g') }));
    const contributors = buildContributors({}, {
      collision: { Kp: 0.3, Ki: 0.04, pad: 4 },
      central: { k: 0.03 },
    });
    const solver = createSolver({ contributors }, { integrator: { damping: 0.5 }, alpha0: 1, alphaDecay: 0 });
    for (let i = 0; i < 800; i++) solver.tick(w);
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++)
        assert.ok(pairOverlap(w, ids[a], ids[b]) < 0.5, `sem overlap entre ${a},${b}`);
  });

  test('nó pinado (invMass 0) permanece fixo sob colisão', () => {
    const w = createWorld(4);
    const fixo = addBody(w, { x: 0, y: 0, halfW: 10, halfH: 10, invMass: 0, layers: L('g') });
    addBody(w, { x: 6, y: 0, halfW: 10, halfH: 10, invMass: 1, layers: L('g') });
    const contributors = buildContributors({ central: false }, { collision: { Kp: 0.3, Ki: 0.04 } });
    const solver = createSolver({ contributors }, { integrator: { damping: 0.5 } });
    for (let i = 0; i < 400; i++) solver.tick(w);
    assert.ok(Math.abs(w.data[fixo * STRIDE + X]) < 1e-6 && Math.abs(w.data[fixo * STRIDE + Y]) < 1e-6, 'pinado fixo');
  });

  test('campo de conectividade (opt-in) puxa nós conectados para o rest length', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: -150, y: 0, halfW: 5, halfH: 5, layers: L('g') });
    const b = addBody(w, { x: 150, y: 0, halfW: 5, halfH: 5, layers: L('g') });
    const contributors = buildContributors(
      { central: false, collision: false, connectivity: true },
      { connectivity: { k: 0.05, edges: [{ a, b, rest: 40 }] } },
    );
    const solver = createSolver({ contributors }, { integrator: { damping: 0.5 } });
    const d0 = dist(w, a, b);
    for (let i = 0; i < 600; i++) solver.tick(w);
    const d1 = dist(w, a, b);
    assert.ok(d0 > 290, 'começam afastados');
    assert.ok(d1 < 80, `mola aproximou para perto do rest (${d1.toFixed(1)})`);
  });

  test('registry/fields: conectividade é opt-in (default off); colisão/central default on', () => {
    const fields = Object.fromEntries(listFields().map((f) => [f.id, f.defaultEnabled]));
    assert.equal(fields.collision, true);
    assert.equal(fields.central, true);
    assert.equal(fields.connectivity, false);
  });

  test('buildContributors respeita defaults e overrides', () => {
    const def = buildContributors();
    assert.equal(def.length, 2, 'collision + central por default');
    const withConn = buildContributors({ connectivity: true }, { connectivity: { edges: [] } });
    assert.equal(withConn.length, 3);
    assert.ok(typeof createContributor('central').apply === 'function');
  });
});
