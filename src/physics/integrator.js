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
//   'after'  (default, símplético padrão): v = (v + a·dt)·damping
//   'before' (policy estilo live legado):  v = v·damping + a·dt
// Corpos com invMass 0 ou dof FIXED0 são pulados (pinados).

import { STRIDE, X, Y, VX, VY, FX, FY, INV_MASS, DOF } from './world.js';

export function integrate(world, opts = {}) {
  const dt = opts.dt ?? 1;
  const damping = opts.damping ?? 0.85;
  const before = opts.dampingOrder === 'before';
  const cap = opts.velocityCap ?? Infinity;
  const { data, dof, alive, highWater } = world;

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
      vx = vx * damping + ax * dt;
      vy = vy * damping + ay * dt;
    } else {
      vx = (vx + ax * dt) * damping;
      vy = (vy + ay * dt) * damping;
    }

    if (vx > cap) vx = cap; else if (vx < -cap) vx = -cap;
    if (vy > cap) vy = cap; else if (vy < -cap) vy = -cap;

    data[o + VX] = vx;
    data[o + VY] = vy;
    data[o + X] += vx * dt;
    data[o + Y] += vy * dt;
  }
}
