// Contributor: forças de atração/repulsão por tag (DSL `attractTo`/`repelFrom`).
// Espelha o termo tag-based do live legado. Escala por `alpha`.
//
// `entries`: array de { slot, attractTo: {tag:str}, repelFrom: {tag:str} }.
// `tagToSlots`: Map<tag, slot[]> (todos os corpos que carregam a tag).
// `kAttract` / `kRepel`: constantes globais de intensidade.

import { STRIDE, X, Y, FX, FY } from '../world.js';

export function createTagForces(opts = {}) {
  const entries = opts.entries ?? [];
  const tagToSlots = opts.tagToSlots ?? new Map();
  const kAttract = opts.kAttract ?? 60;
  const kRepel = opts.kRepel ?? 4000;

  return {
    apply(world, ctx) {
      const alpha = ctx?.alpha ?? 1;
      const { data } = world;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const oi = e.slot * STRIDE;
        if (e.attractTo) {
          for (const tag in e.attractTo) {
            const str = e.attractTo[tag];
            const bucket = tagToSlots.get(tag);
            if (!bucket) continue;
            for (let b = 0; b < bucket.length; b++) {
              const j = bucket[b];
              if (j === e.slot) continue;
              const oj = j * STRIDE;
              const dx = data[oj + X] - data[oi + X];
              const dy = data[oj + Y] - data[oi + Y];
              const d = Math.hypot(dx, dy) || 0.01;
              const f = kAttract * str * alpha / d;
              data[oi + FX] += (dx / d) * f;
              data[oi + FY] += (dy / d) * f;
            }
          }
        }
        if (e.repelFrom) {
          for (const tag in e.repelFrom) {
            const str = e.repelFrom[tag];
            const bucket = tagToSlots.get(tag);
            if (!bucket) continue;
            for (let b = 0; b < bucket.length; b++) {
              const j = bucket[b];
              if (j === e.slot) continue;
              const oj = j * STRIDE;
              const dx = data[oj + X] - data[oi + X];
              const dy = data[oj + Y] - data[oi + Y];
              const d2 = dx * dx + dy * dy + 1;
              const d = Math.sqrt(d2);
              const f = kRepel * str * alpha / d2;
              data[oi + FX] -= (dx / d) * f;
              data[oi + FY] -= (dy / d) * f;
            }
          }
        }
      }
    },
  };
}
