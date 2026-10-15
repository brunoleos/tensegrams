// Integrador semi-implícito (símplético) de passo único.
//
// Converte força acumulada (fx/fy) em aceleração via massa inversa, integra
// velocidade e posição, aplica damping e clamp de velocidade. Símplético =
// a velocidade é atualizada ANTES da posição (estável para molas).
//
// O sub-stepping de estabilidade (#7) NÃO mora aqui — é o solver que repete
// (clearForces → contributors → integrate) N vezes por tick com dt/N, para que
// as forças sejam recomputadas a cada sub-passo (necessário para molas
// rígidas + termo integral PI). Este módulo é um passo único, parametrizável.
//
// `dampingOrder`:
//   'after'  (default, símplético padrão): v = (v + a·dt)·q
//   'before' (policy estilo live legado):  v = v·q + a·dt
// Corpos com invMass 0 ou dof FIXED0 são pulados (pinados).
//
// `damping` é uma TAXA POR TICK (dt = 1), não por chamada: o fator de cada
// sub-passo é q = damping^dt, então N sub-passos amortecem o mesmo que 1 tick.
// A posição avança v·dt·k, com k escolhido para que o deslize de um corpo
// livre por tick seja o mesmo para qualquer N (k = 1 quando dt = 1, ou seja,
// o caso sem sub-stepping não muda). Antes, o damping era aplicado inteiro a
// cada sub-passo: com 8 sub-passos o deslize caía de 45,6 para 5,7 px.

import { STRIDE, X, Y, VX, VY, FX, FY, INV_MASS, DOF } from './world.js';

export function integrate(world, opts = {}) {
  const dt = opts.dt ?? 1;
  const damping = opts.damping ?? 0.85;
  const before = opts.dampingOrder === 'before';
  const cap = opts.velocityCap ?? Infinity;
  const { data, dof, alive, highWater } = world;
  const [q, k] = dampingFactors(damping, dt);

  for (let slot = 0; slot < highWater; slot++) {
    if (!alive[slot]) continue;
    const o = slot * STRIDE;
    const im = data[o + INV_MASS];
    if (im === 0 || dof[slot] === DOF.FIXED0) continue;

    const ax = data[o + FX] * im;
    const ay = data[o + FY] * im;
    let vx = data[o + VX];
    let vy = data[o + VY];

    if (before) {
      vx = vx * q + ax * dt;
      vy = vy * q + ay * dt;
    } else {
      vx = (vx + ax * dt) * q;
      vy = (vy + ay * dt) * q;
    }

    if (vx > cap) vx = cap; else if (vx < -cap) vx = -cap;
    if (vy > cap) vy = cap; else if (vy < -cap) vy = -cap;

    data[o + VX] = vx;
    data[o + VY] = vy;
    data[o + X] += vx * dt * k;
    data[o + Y] += vy * dt * k;
  }
}

// q = damping^dt (fator do sub-passo). k corrige o passo de posição: num tick
// com N = 1/dt sub-passos, um corpo livre anda Σ v0·q^i·dt·k (i = 1..N), que
// deve igualar o deslize de 1 sub-passo, v0·damping. Resolvendo:
// k = damping·(1 − q) / (dt·q·(1 − damping)).
export function dampingFactors(damping, dt) {
  if (dt === 1 || !(damping > 0 && damping < 1)) return [dt === 1 ? damping : Math.pow(damping, dt), 1];
  const q = Math.pow(damping, dt);
  return [q, (damping * (1 - q)) / (dt * q * (1 - damping))];
}
