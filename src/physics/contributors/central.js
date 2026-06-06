// Contributor: atrator central. Puxa todo corpo móvel para um ponto (default
// origem). É a força-base do layout (mantida default). Escala por `alpha`
// (resfriamento global), como no live legado.

import { STRIDE, X, Y, FX, FY, INV_MASS } from '../world.js';

export function createCentral(opts = {}) {
  const k = opts.k ?? 0.012;
  const cx = opts.cx ?? 0;
  const cy = opts.cy ?? 0;
  return {
    apply(world, ctx) {
      const alpha = ctx?.alpha ?? 1;
      const { data, alive, highWater } = world;
      const g = k * alpha;
      for (let s = 0; s < highWater; s++) {
        if (!alive[s]) continue;
        const o = s * STRIDE;
        if (data[o + INV_MASS] === 0) continue;
        data[o + FX] += -(data[o + X] - cx) * g;
        data[o + FY] += -(data[o + Y] - cy) * g;
      }
    },
  };
}
