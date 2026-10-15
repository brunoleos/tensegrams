import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addBody, clearForces, STRIDE, X, Y, VX, VY, FX, FY, HALF_W } from '../../src/physics/world.js';
import { createCollision, layersIntersect } from '../../src/physics/collision.js';
import { integrate } from '../../src/physics/integrator.js';
import { createSolver } from '../../src/physics/solver.js';
import { createCentral } from '../../src/physics/contributors/central.js';

const L = (...t) => new Set(t);

function overlapX(w, a, b) {
  const oa = a * STRIDE, ob = b * STRIDE;
  return (w.data[oa + HALF_W] + w.data[ob + HALF_W]) - Math.abs(w.data[ob + X] - w.data[oa + X]);
}

describe('physics/collision — impulso por massa + PI', () => {
  test('layersIntersect: só com tag em comum', () => {
    assert.ok(layersIntersect(L('a', 'b'), L('b')));
    assert.ok(!layersIntersect(L('a'), L('b')));
    assert.ok(!layersIntersect(L('a'), null));
  });

  test('par sobreposto na mesma layer recebe força oposta no eixo de menor overlap', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 0, y: 0, halfW: 10, halfH: 10, layers: L('g') });
    const b = addBody(w, { x: 12, y: 0, halfW: 10, halfH: 10, layers: L('g') }); // overlap x=8
    const col = createCollision({ Kp: 0.5, Ki: 0 });
    clearForces(w); col.apply(w, { dt: 1 });
    assert.ok(w.data[a * STRIDE + FX] < 0, 'a empurrado para -x');
    assert.ok(w.data[b * STRIDE + FX] > 0, 'b empurrado para +x');
    assert.equal(w.data[a * STRIDE + FX], -w.data[b * STRIDE + FX], 'força igual e oposta');
  });

  test('sem layer em comum, nenhuma força', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 0, halfW: 10, halfH: 10, layers: L('a') });
    const b = addBody(w, { x: 5, halfW: 10, halfH: 10, layers: L('b') });
    const col = createCollision();
    clearForces(w); col.apply(w, { dt: 1 });
    assert.equal(w.data[a * STRIDE + FX], 0);
    assert.equal(w.data[b * STRIDE + FX], 0);
  });

  test('massa: corpo pinado (invMass 0) não cede; o leve absorve o movimento', () => {
    const w = createWorld(4);
    const fixo = addBody(w, { x: 0, halfW: 10, halfH: 10, invMass: 0, layers: L('g') });
    const livre = addBody(w, { x: 12, halfW: 10, halfH: 10, invMass: 1, layers: L('g') });
    const col = createCollision({ Kp: 0.4, Ki: 0.03 });
    for (let i = 0; i < 300; i++) {
      clearForces(w); col.apply(w, { dt: 1 }); integrate(w, { damping: 0.6 });
    }
    assert.ok(Math.abs(w.data[fixo * STRIDE + X] - 0) < 1e-6, 'pinado não se moveu');
    assert.ok(w.data[livre * STRIDE + X] > 18, 'livre separou-se');
    assert.ok(overlapX(w, fixo, livre) < 0.5, 'overlap resolvido');
  });

  test('PI: termo integral zera overlap residual sob força competidora (P puro deixa resíduo)', () => {
    // Dois corpos iguais + força constante puxando-os para o centro (simula
    // atrator). P puro equilibra com overlap > 0; PI converge a ~0.
    function run(Ki) {
      const w = createWorld(4);
      const a = addBody(w, { x: -6, halfW: 10, halfH: 10, invMass: 1, layers: L('g') });
      const b = addBody(w, { x: 6, halfW: 10, halfH: 10, invMass: 1, layers: L('g') });
      const col = createCollision({ Kp: 0.3, Ki });
      const PULL = 2.0; // força constante para o centro (x=0)
      for (let i = 0; i < 800; i++) {
        clearForces(w);
        // atrator competidor: puxa cada corpo para x=0
        w.data[a * STRIDE + FX] += -Math.sign(w.data[a * STRIDE + X]) * PULL;
        w.data[b * STRIDE + FX] += -Math.sign(w.data[b * STRIDE + X]) * PULL;
        col.apply(w, { dt: 1 });
        integrate(w, { damping: 0.5 });
      }
      return overlapX(w, a, b);
    }
    const residualP = run(0);
    const residualPI = run(0.05);
    assert.ok(residualP > 1, `P puro deixa overlap residual (${residualP.toFixed(2)})`);
    assert.ok(residualPI < 0.3, `PI zera overlap residual (${residualPI.toFixed(3)})`);
  });

  test('pairFilter exclui pares (exclusão de domínio injetada)', () => {
    const w = createWorld(4);
    const a = addBody(w, { x: 0, halfW: 10, halfH: 10, layers: L('g') });
    const b = addBody(w, { x: 5, halfW: 10, halfH: 10, layers: L('g') });
    const col = createCollision({ pairFilter: () => false });
    clearForces(w); col.apply(w, { dt: 1 });
    assert.equal(w.data[a * STRIDE + FX], 0, 'par filtrado não gera força');
  });

  test('acumulador é limitado por accMax (anti-windup)', () => {
    const w = createWorld(4);
    addBody(w, { x: 0, halfW: 10, halfH: 10, layers: L('g') });
    addBody(w, { x: 1, halfW: 10, halfH: 10, layers: L('g') }); // overlap grande, fixo
    const col = createCollision({ Kp: 0, Ki: 1, accMax: 50 });
    // sem integrar: corpos não se movem, overlap constante → acumulador satura
    for (let i = 0; i < 100; i++) { clearForces(w); col.apply(w, { dt: 1 }); }
    for (const e of col._acc.values()) assert.ok(e.v <= 50, 'acumulador clampado');
  });
});

describe('physics/collision — contrato de pad (gap por lado)', () => {
  test('no rest não há overlap da PADDED BBox: gap >= halfA+halfB+2*pad (igual ao v1)', () => {
    // A colisão só empurra (nunca puxa); sem força oposta o gap fica >= contato
    // padded (e pode derivar além por inércia). O contrato é o limite inferior:
    // nenhuma sobreposição da BBox inflada por `pad` em cada lado.
    const w = createWorld(4);
    const a = addBody(w, { x: -5, halfW: 10, halfH: 10, layers: L('g'), invMass: 1 });
    const b = addBody(w, { x: 5, halfW: 10, halfH: 10, layers: L('g'), invMass: 1 });
    const pad = 8;
    const col = createCollision({ Kp: 0.3, Ki: 0.05, pad });
    for (let i = 0; i < 1500; i++) { clearForces(w); col.apply(w, { dt: 1 }); integrate(w, { damping: 0.5 }); }
    const gap = Math.abs(w.data[b * STRIDE + X] - w.data[a * STRIDE + X]);
    const minGap = 10 + 10 + 2 * pad; // 36 — contato da padded BBox
    assert.ok(gap >= minGap - 1e-3, `gap ${gap.toFixed(2)} >= ${minGap} (sem overlap padded)`);
  });
});

describe('physics/collision — anel sob carga assenta sem ciclo-limite (R04/M0)', () => {
  // 6 corpos em anel, sobrepostos e puxados ao centro, com os parâmetros
  // default do v2 (Kp 0,9, Ki 0, 2 sub-passos): a energia cinética vai a zero.
  // O termo integral mantinha um ciclo-limite (KE ≈ 3,7 perpétua na auditoria
  // do motor), e Kp 0,9 com 1 sub-passo vibra (KE ≈ 0,014).
  function ring(Ki) {
    const w = createWorld(8);
    const g = new Set(['g']);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addBody(w, { x: Math.cos(a) * 20, y: Math.sin(a) * 20, invMass: 1, halfW: 20, halfH: 15, layers: g });
    }
    const solver = createSolver({ contributors: [createCentral({ k: 0.012 }), createCollision({ Kp: 0.9, Ki, pad: 12 })] },
      { integrator: { damping: 0.82, dampingOrder: 'after', velocityCap: 32 }, substeps: 2, alpha0: 1, alphaDecay: 0, alphaMin: 1 });
    for (let t = 0; t < 3000; t++) solver.tick(w);
    let ke = 0;
    for (let s = 0; s < 6; s++) { const o = s * STRIDE; ke += 0.5 * (w.data[o + VX] ** 2 + w.data[o + VY] ** 2); }
    return ke;
  }
  test('Ki = 0: energia cinética < 1e-6 depois de 3000 ticks', () => {
    const ke = ring(0);
    assert.ok(ke < 1e-6, `KE=${ke}`);
  });
});

describe('physics/collision — slot reusado não herda estado (R04/M0)', () => {
  test('remover um corpo descarta o acumulador do par; o novo dono do slot começa do zero', async () => {
    const { removeBody } = await import('../../src/physics/world.js');
    const g = new Set(['g']);
    const w = createWorld(4);
    const a = addBody(w, { x: 0, y: 0, invMass: 0, halfW: 10, halfH: 10, layers: g });
    const b = addBody(w, { x: 15, y: 0, invMass: 0, halfW: 10, halfH: 10, layers: g });
    const col = createCollision({ Kp: 0.5, Ki: 0.5, pad: 0 });
    for (let i = 0; i < 10; i++) { clearForces(w); col.apply(w, { dt: 1 }); }
    assert.ok(col._acc.size > 0, 'acumulador formado');

    removeBody(w, b);
    const c = addBody(w, { x: 15, y: 0, invMass: 0, halfW: 10, halfH: 10, layers: g });
    assert.equal(c, b, 'slot reusado');
    clearForces(w);
    col.apply(w, { dt: 1 });
    // Penetração 5 px: força de um contato novo = Kp·5 + Ki·5 = 5.
    assert.ok(Math.abs(w.data[a * STRIDE + FX] + 5) < 1e-6, `fx=${w.data[a * STRIDE + FX]}`);
  });
});
