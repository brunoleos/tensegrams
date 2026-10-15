import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addBody, STRIDE, FX, FY } from '../../src/physics/world.js';
import { createConnectivitySpring } from '../../src/physics/contributors/connectivity-spring.js';

const fx = (w, s) => w.data[s * STRIDE + FX];
const fy = (w, s) => w.data[s * STRIDE + FY];

describe('physics/contributors/connectivity-spring', () => {
  test('sem ga/gb: força igual e oposta nas pontas', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 0, y: 0, invMass: 1, halfW: 5, halfH: 5 });
    const b = addBody(w, { x: 300, y: 0, invMass: 1, halfW: 5, halfH: 5 });
    createConnectivitySpring({ k: 0.1, edges: [{ a, b, rest: 100 }] }).apply(w, { alpha: 1 });
    assert.ok(Math.abs(fx(w, a) - 20) < 1e-4);
    assert.ok(Math.abs(fx(w, b) + 20) < 1e-4);
  });

  test('ga/gb: a força de cada ponta é dividida igualmente no grupo (soma preservada)', () => {
    const w = createWorld(8);
    const a = addBody(w, { x: 0, y: 0, invMass: 1, halfW: 5, halfH: 5 });
    const a2 = addBody(w, { x: -50, y: 40, invMass: 1, halfW: 5, halfH: 5 });
    const b = addBody(w, { x: 0, y: 300, invMass: 1, halfW: 5, halfH: 5 });
    createConnectivitySpring({ k: 0.1, edges: [{ a, b, rest: 100, ga: [a, a2] }] }).apply(w, { alpha: 0.5 });
    // f = 0.1 · (300 − 100) · 0.5 = 10, ao longo de y
    assert.ok(Math.abs(fy(w, a) - 5) < 1e-4);
    assert.ok(Math.abs(fy(w, a2) - 5) < 1e-4, 'o membro não ligado recebe metade');
    assert.ok(Math.abs(fy(w, b) + 10) < 1e-4);
    assert.ok(Math.abs(fx(w, a) + fx(w, a2) + fx(w, b)) < 1e-4);
  });
});
