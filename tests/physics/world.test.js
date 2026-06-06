import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld, addBody, removeBody, handleOf, isAlive,
  forEachBody, clearForces,
  STRIDE, X, Y, VX, FX, FY, INV_MASS, HALF_W, SHAPE, DOF,
} from '../../src/physics/world.js';

describe('physics/world — store interleaved + free-list', () => {
  test('addBody grava campos contíguos no stride correto', () => {
    const w = createWorld(4);
    const s = addBody(w, { x: 10, y: 20, vx: 1, invMass: 0.5, halfW: 8, kind: SHAPE.RECT });
    const o = s * STRIDE;
    assert.equal(w.data[o + X], 10);
    assert.equal(w.data[o + Y], 20);
    assert.equal(w.data[o + VX], 1);
    assert.equal(w.data[o + INV_MASS], 0.5);
    assert.equal(w.data[o + HALF_W], 8);
    assert.equal(w.kind[s], SHAPE.RECT);
    assert.equal(w.count, 1);
  });

  test('slots crescem além da capacidade inicial preservando dados', () => {
    const w = createWorld(2);
    const slots = [];
    for (let i = 0; i < 10; i++) slots.push(addBody(w, { x: i }));
    assert.equal(w.count, 10);
    assert.ok(w.capacity >= 10);
    for (let i = 0; i < 10; i++) {
      assert.equal(w.data[slots[i] * STRIDE + X], i);
    }
  });

  test('removeBody libera o slot e a free-list o reusa', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 1 });
    const b = addBody(w, { x: 2 });
    removeBody(w, a);
    assert.equal(w.count, 1);
    const c = addBody(w, { x: 3 });
    assert.equal(c, a, 'slot livre deve ser reusado');
    assert.equal(w.count, 2);
    assert.equal(w.data[b * STRIDE + X], 2, 'corpo vizinho intacto');
  });

  test('handle detecta slot reusado via geração', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 1 });
    const h = handleOf(w, a);
    assert.ok(isAlive(w, h));
    removeBody(w, a);
    assert.ok(!isAlive(w, h), 'handle obsoleto após remoção');
    const c = addBody(w, { x: 9 }); // reusa o slot a
    assert.equal(c, a);
    assert.ok(!isAlive(w, h), 'handle antigo não revive com slot reusado');
    assert.ok(isAlive(w, handleOf(w, c)));
  });

  test('forEachBody itera só vivos, em ordem ascendente de slot', () => {
    const w = createWorld(8);
    const a = addBody(w, { x: 0 });
    const b = addBody(w, { x: 1 });
    const c = addBody(w, { x: 2 });
    removeBody(w, b);
    const seen = [];
    forEachBody(w, (slot) => seen.push(slot));
    assert.deepEqual(seen, [a, c]);
  });

  test('clearForces zera fx/fy só dos vivos', () => {
    const w = createWorld(4);
    const a = addBody(w, {});
    const b = addBody(w, {});
    w.data[a * STRIDE + FX] = 5; w.data[a * STRIDE + FY] = -3;
    w.data[b * STRIDE + FX] = 7;
    removeBody(w, b);
    clearForces(w);
    assert.equal(w.data[a * STRIDE + FX], 0);
    assert.equal(w.data[a * STRIDE + FY], 0);
  });

  test('dof e layers ficam nos arrays paralelos', () => {
    const w = createWorld(2);
    const s = addBody(w, { dof: DOF.RAIL1, layers: new Set(['svc']) });
    assert.equal(w.dof[s], DOF.RAIL1);
    assert.ok(w.layers[s].has('svc'));
  });
});
