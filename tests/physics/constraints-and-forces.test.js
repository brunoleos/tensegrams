import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addBody, STRIDE, X, Y, FX, HALF_W } from '../../src/physics/world.js';
import {
  createAxisConstraint, createRectConstraint, createCircleConstraint,
  createParentBoundsConstraint, createConstraint,
} from '../../src/physics/constraints/index.js';
import { createTagForces } from '../../src/physics/contributors/tag-forces.js';

describe('physics/constraints', () => {
  test('axis fixa o centro no eixo (value + meia-extensão)', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 999, y: 0, halfW: 20, halfH: 10 });
    createAxisConstraint(s, 'x', 100).apply(w);
    assert.equal(w.data[s * STRIDE + X], 120); // 100 + halfW
  });

  test('rect clampa o centro dentro do retângulo (considerando meia-extensão)', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: -50, y: 500, halfW: 10, halfH: 10 });
    createRectConstraint(s, { x: 0, y: 0, w: 200, h: 200 }).apply(w);
    assert.equal(w.data[s * STRIDE + X], 10);   // borda esquerda + halfW
    assert.equal(w.data[s * STRIDE + Y], 190);  // borda inferior - halfH
  });

  test('circle clampa ao raio (menos a meia-extensão)', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 1000, y: 0, halfW: 0, halfH: 0 });
    createCircleConstraint(s, { cx: 0, cy: 0, r: 100 }).apply(w);
    assert.ok(Math.abs(w.data[s * STRIDE + X] - 100) < 1e-6);
  });

  test('parent-bounds mantém o nó dentro do rect do pai (com header)', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 5, y: 5, halfW: 10, halfH: 10 });
    const parent = { x: 0, y: 0, width: 200, height: 200 };
    createParentBoundsConstraint(s, () => parent, 22).apply(w);
    assert.ok(w.data[s * STRIDE + X] >= 10 - 1e-6);
    assert.ok(w.data[s * STRIDE + Y] >= 22 + 10 - 1e-6); // header + halfH
  });

  test('createConstraint despacha por type e retorna null p/ desconhecido', () => {
    const w = createWorld(2);
    const s = addBody(w, { x: 0, halfW: 5 });
    assert.ok(createConstraint(s, { type: 'axis', axis: 'x', value: 10 }));
    assert.equal(createConstraint(s, { type: 'nada' }), null);
  });
});

describe('physics/tag-forces', () => {
  test('attractTo puxa em direção a corpos com a tag', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 0, y: 0 });
    const b = addBody(w, { x: 100, y: 0 }); // alvo, tag 'svc'
    const tagToSlots = new Map([['svc', [b]]]);
    const tf = createTagForces({
      entries: [{ slot: a, attractTo: { svc: 1 } }],
      tagToSlots, kAttract: 60,
    });
    tf.apply(w, { alpha: 1 });
    assert.ok(w.data[a * STRIDE + FX] > 0, 'a é puxado para +x (em direção a b)');
  });

  test('repelFrom empurra para longe de corpos com a tag', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 0, y: 0 });
    const b = addBody(w, { x: 100, y: 0 });
    const tagToSlots = new Map([['svc', [b]]]);
    const tf = createTagForces({
      entries: [{ slot: a, repelFrom: { svc: 1 } }],
      tagToSlots, kRepel: 4000,
    });
    tf.apply(w, { alpha: 1 });
    assert.ok(w.data[a * STRIDE + FX] < 0, 'a é empurrado para -x (longe de b)');
  });

  test('não age sobre si mesmo', () => {
    const w = createWorld(2);
    const a = addBody(w, { x: 0, y: 0 });
    const tagToSlots = new Map([['svc', [a]]]);
    const tf = createTagForces({ entries: [{ slot: a, attractTo: { svc: 1 } }], tagToSlots });
    tf.apply(w, { alpha: 1 });
    assert.equal(w.data[a * STRIDE + FX], 0);
  });
});
