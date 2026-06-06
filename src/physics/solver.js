// Solver genérico — superset dos dois loops de física (layout live + routing).
//
// Um `schedule` declara as fases: contributors (forças), topology ops (fissão/
// fusão, opcional) e constraints (projeção dura pós-integração). O solver é
// agnóstico de domínio: layout e routing apenas montam schedules diferentes
// sobre o MESMO World e o MESMO solver.
//
// Sub-stepping (#7): cada tick roda `substeps` sub-passos com dt/substeps,
// RECOMPUTANDO forças a cada sub-passo (necessário para estabilidade com molas
// rígidas + termo integral PI da colisão). `alpha` (resfriamento global) decai
// 1× por tick, não por sub-passo.
//
// Cada contributor/constraint é um objeto `{ apply(world, ctx) }`; `ctx` tem
// `{ dt, alpha }`.

import { clearForces } from './world.js';
import { integrate } from './integrator.js';

export function createSolver(schedule = {}, opts = {}) {
  const contributors = schedule.contributors ?? [];
  const topology = schedule.topology ?? [];
  const constraints = schedule.constraints ?? [];

  const substeps = Math.max(1, opts.substeps ?? 1);
  const baseDt = opts.dt ?? 1;
  const integratorOpts = opts.integrator ?? {};
  const alphaDecay = opts.alphaDecay ?? 0;
  const alphaMin = opts.alphaMin ?? 0;

  let alpha = opts.alpha0 ?? 1;

  function tick(world) {
    const dt = baseDt / substeps;
    for (let s = 0; s < substeps; s++) {
      const ctx = { dt, alpha };
      clearForces(world);
      for (let i = 0; i < contributors.length; i++) contributors[i].apply(world, ctx);
      for (let i = 0; i < topology.length; i++) topology[i].apply(world, ctx);
      integrate(world, { ...integratorOpts, dt });
      for (let i = 0; i < constraints.length; i++) constraints[i].apply(world, ctx);
    }
    alpha = Math.max(alphaMin, alpha * (1 - alphaDecay));
    return alpha;
  }

  return {
    tick,
    get alpha() { return alpha; },
    set alpha(v) { alpha = v; },
    kick(a) { alpha = Math.max(alpha, a); },
  };
}
