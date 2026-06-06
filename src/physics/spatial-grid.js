// Spatial hash uniforme para broad-phase de colisão (#3).
//
// Constrói um índice cell → slots a partir das BBoxes (infladas por `pad`) dos
// corpos vivos, e enumera pares candidatos (corpos que compartilham célula).
// Substitui o laço O(N²) por O(N + pares-próximos).
//
// Determinismo (requisito da rede de caracterização): corpos são inseridos em
// ordem ascendente de slot; dentro de uma célula os pares saem com a<b; o
// dedupe entre células preserva a primeira emissão. Mesmo mundo → mesma
// sequência de pares.

import { STRIDE, X, Y, HALF_W, HALF_H } from './world.js';

function key(cx, cy) {
  return cx + ',' + cy;
}

// `pad` infla cada BBox na inserção, de modo que dois corpos cujas BBoxes
// padded se tocam caiam na mesma célula. `cellSize` deve ser ≳ maior
// (extensão + pad) para não perder pares; quando omitido, é derivado.
export function buildGrid(world, opts = {}) {
  const pad = opts.pad ?? 0;
  let cellSize = opts.cellSize;
  const { data, alive, highWater } = world;

  if (!cellSize) {
    // Heurística: 2× a maior meia-extensão + pad (cobre o caso de toque).
    let maxHalf = 1;
    for (let slot = 0; slot < highWater; slot++) {
      if (!alive[slot]) continue;
      const o = slot * STRIDE;
      const h = Math.max(data[o + HALF_W], data[o + HALF_H]);
      if (h > maxHalf) maxHalf = h;
    }
    cellSize = Math.max(1, 2 * (maxHalf + pad));
  }

  const cells = new Map();
  const inv = 1 / cellSize;
  for (let slot = 0; slot < highWater; slot++) {
    if (!alive[slot]) continue;
    const o = slot * STRIDE;
    const minX = data[o + X] - data[o + HALF_W] - pad;
    const minY = data[o + Y] - data[o + HALF_H] - pad;
    const maxX = data[o + X] + data[o + HALF_W] + pad;
    const maxY = data[o + Y] + data[o + HALF_H] + pad;
    const cx0 = Math.floor(minX * inv), cx1 = Math.floor(maxX * inv);
    const cy0 = Math.floor(minY * inv), cy1 = Math.floor(maxY * inv);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = key(cx, cy);
        let bucket = cells.get(k);
        if (!bucket) { bucket = []; cells.set(k, bucket); }
        bucket.push(slot);
      }
    }
  }
  return { cellSize, pad, cells };
}

// Enumera pares candidatos únicos (a < b). `fn(a, b)` por par. Dedupe entre
// células via Set (corpos que compartilham várias células aparecem 1 vez).
export function eachCandidatePair(grid, fn) {
  const seen = new Set();
  for (const bucket of grid.cells.values()) {
    const n = bucket.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const a = bucket[i];
      for (let j = i + 1; j < n; j++) {
        const b = bucket[j];
        // bucket está em ordem ascendente de slot → a < b.
        const pk = a * 4294967296 + b; // chave única (a,b)
        if (seen.has(pk)) continue;
        seen.add(pk);
        fn(a, b);
      }
    }
  }
}
