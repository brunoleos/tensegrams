// Contributor: mola de conectividade (#opt-in). Cada aresta vira uma mola axial
// entre os corpos dos seus endpoints, puxando-os ao comprimento de repouso
// (`rest`). É a força que dá comportamento force-directed clássico (nós
// conectados se atraem) — DESLIGADA por default (campo opt-in).
//
// `edges`: array de { a, b, rest?, ga?, gb? } (slots de corpo). `k` = rigidez.
// O comprimento é medido entre a e b; `ga`/`gb` (opcionais) são os slots que
// RECEBEM a força de cada ponta, dividida igualmente (corpo composto: a força
// age no grupo inteiro, não só no membro ligado).
// Força igual e oposta; o integrador divide por massa (pinado não cede).
// Escala por `alpha` para acompanhar o resfriamento global.

import { STRIDE, X, Y, FX, FY } from '../world.js';

export function createConnectivitySpring(opts = {}) {
  const k = opts.k ?? 0.05;
  const restDefault = opts.restLength ?? 0;
  const edges = opts.edges ?? [];
  return {
    apply(world, ctx) {
      const alpha = ctx?.alpha ?? 1;
      const { data } = world;
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const oa = e.a * STRIDE, ob = e.b * STRIDE;
        const dx = data[ob + X] - data[oa + X];
        const dy = data[ob + Y] - data[oa + Y];
        const d = Math.hypot(dx, dy) || 1e-6;
        const rest = e.rest ?? restDefault;
        const f = k * (d - rest) * alpha;   // >0 = esticada → puxa juntos
        const ux = dx / d, uy = dy / d;
        if (e.ga) spread(data, e.ga, ux * f, uy * f);
        else { data[oa + FX] += ux * f; data[oa + FY] += uy * f; }
        if (e.gb) spread(data, e.gb, -ux * f, -uy * f);
        else { data[ob + FX] -= ux * f; data[ob + FY] -= uy * f; }
      }
    },
  };
}

function spread(data, slots, fx, fy) {
  const k = 1 / slots.length;
  for (const s of slots) { const o = s * STRIDE; data[o + FX] += fx * k; data[o + FY] += fy * k; }
}
