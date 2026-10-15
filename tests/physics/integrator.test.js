import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addBody, STRIDE, X, Y, VX, FX, INV_MASS, DOF } from '../../src/physics/world.js';
import { integrate } from '../../src/physics/integrator.js';

describe('physics/integrator — semi-implícito', () => {
  test('força acelera via massa inversa e move a posição', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 0, y: 0, invMass: 1 });
    w.data[s * STRIDE + FX] = 10;
    integrate(w, { dt: 1, damping: 1, dampingOrder: 'after' });
    // v = (0 + 10*1)*1 = 10 ; x += 10
    assert.equal(w.data[s * STRIDE + VX], 10);
    assert.equal(w.data[s * STRIDE + X], 10);
  });

  test('invMass=0 (pinado) não se move', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 5, y: 5, invMass: 0 });
    w.data[s * STRIDE + FX] = 1000;
    integrate(w, { dt: 1, damping: 1 });
    assert.equal(w.data[s * STRIDE + X], 5);
    assert.equal(w.data[s * STRIDE + VX], 0);
  });

  test('dof FIXED0 também é pulado mesmo com massa', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 2, invMass: 1, dof: DOF.FIXED0 });
    w.data[s * STRIDE + FX] = 50;
    integrate(w, { dt: 1, damping: 1 });
    assert.equal(w.data[s * STRIDE + X], 2);
  });

  test('massa maior (invMass menor) acelera menos', () => {
    const w = createWorld(2);
    const leve = addBody(w, { invMass: 1 });
    const pesado = addBody(w, { invMass: 0.25 });
    w.data[leve * STRIDE + FX] = 4;
    w.data[pesado * STRIDE + FX] = 4;
    integrate(w, { dt: 1, damping: 1 });
    assert.equal(w.data[leve * STRIDE + VX], 4);
    assert.equal(w.data[pesado * STRIDE + VX], 1);
  });

  test('damping reduz velocidade; sistema sem força converge a repouso', () => {
    const w = createWorld(2);
    const s = addBody(w, { vx: 100, invMass: 1 });
    for (let i = 0; i < 200; i++) integrate(w, { dt: 1, damping: 0.5 });
    assert.ok(Math.abs(w.data[s * STRIDE + VX]) < 1e-6, 'velocidade decai a zero');
  });

  test('velocityCap limita a velocidade', () => {
    const w = createWorld(2);
    const s = addBody(w, { invMass: 1 });
    w.data[s * STRIDE + FX] = 1000;
    integrate(w, { dt: 1, damping: 1, velocityCap: 16 });
    assert.equal(w.data[s * STRIDE + VX], 16);
  });

  test('dampingOrder before vs after diferem como esperado', () => {
    const mk = () => { const w = createWorld(1); const s = addBody(w, { vx: 10, invMass: 1 }); w.data[s * STRIDE + FX] = 0; return { w, s }; };
    const a = mk(); integrate(a.w, { dt: 1, damping: 0.5, dampingOrder: 'after' });
    const b = mk(); integrate(b.w, { dt: 1, damping: 0.5, dampingOrder: 'before' });
    // sem força, both: v*damping = 5. iguais nesse caso.
    assert.equal(a.w.data[a.s * STRIDE + VX], 5);
    assert.equal(b.w.data[b.s * STRIDE + VX], 5);
    // com força, diferem:
    const c = mk(); c.w.data[c.s * STRIDE + FX] = 4; integrate(c.w, { dt: 1, damping: 0.5, dampingOrder: 'after' });
    const d = mk(); d.w.data[d.s * STRIDE + FX] = 4; integrate(d.w, { dt: 1, damping: 0.5, dampingOrder: 'before' });
    assert.equal(c.w.data[c.s * STRIDE + VX], (10 + 4) * 0.5); // 7
    assert.equal(d.w.data[d.s * STRIDE + VX], 10 * 0.5 + 4);   // 9
  });
});

describe('physics/integrator — damping como taxa por tick (R04)', () => {
  // Corpo livre com v0, sem forças: o deslize total não pode depender do
  // número de sub-passos em que o tick é dividido.
  function glide(substeps, { damping = 0.82, v0 = 10, ticks = 200 } = {}) {
    const w = createWorld(1);
    const s = addBody(w, { x: 0, vx: v0, invMass: 1 });
    const dt = 1 / substeps;
    for (let t = 0; t < ticks * substeps; t++) integrate(w, { dt, damping, dampingOrder: 'after' });
    return { x: w.data[s * STRIDE + X], vx: w.data[s * STRIDE + VX] };
  }

  test('com 1 sub-passo o deslize é o de sempre (v0·d/(1−d))', () => {
    const { x } = glide(1);
    assert.ok(Math.abs(x - 10 * 0.82 / 0.18) < 1e-3, `x=${x}`); // Float32 no World
  });

  test('deslize invariante a 1/2/4/8 sub-passos (±1%)', () => {
    const ref = glide(1).x;
    for (const n of [2, 4, 8]) {
      const { x } = glide(n);
      assert.ok(Math.abs(x - ref) / ref < 0.01, `substeps=${n}: x=${x} ref=${ref}`);
    }
  });

  test('velocidade no fim de cada tick é v0·d^t para qualquer nº de sub-passos', () => {
    for (const n of [1, 2, 4, 8]) {
      const { vx } = glide(n, { ticks: 3 });
      assert.ok(Math.abs(vx - 10 * 0.82 ** 3) < 1e-4, `substeps=${n}: vx=${vx}`);
    }
  });

  test('damping 1 continua sem amortecimento', () => {
    const { x, vx } = glide(4, { damping: 1, ticks: 5 });
    assert.ok(Math.abs(x - 50) < 1e-4 && vx === 10, `x=${x} vx=${vx}`);
  });
});
