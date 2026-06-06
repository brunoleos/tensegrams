// Sistema único de colisão (#2/#3/#4) — broad-phase (spatial hash) +
// narrow-phase (AABB×AABB) + resolução por IMPULSO DE MASSA + controlador PI.
//
// - Impulso por massa: a colisão escreve força IGUAL E OPOSTA nos dois corpos;
//   o integrador converte via massa inversa, então o corpo mais leve cede mais
//   e o pinado (invMass 0) não cede. Não há mais `frac`/computeSplit — a razão
//   de cedência É a razão de massas. O "edge empurra nó" (#4) é só uma colisão
//   normal entre um corpo-segmento e um corpo-nó.
// - Controlador PI: força = Kp·overlap (proporcional) + Ki·∫overlap (integral).
//   O termo integral (acumulador Float64 por contato) elimina o erro de regime
//   permanente — i.e., zera o overlap residual no rest mesmo quando há força
//   competidora puxando os corpos juntos. Substitui o passe de separação dura.
// - Anti-windup: o acumulador é limitado a [0, accMax] e descartado quando o
//   par separa ou sai da candidatura.
//
// Gate por camada: dois corpos só colidem se seus conjuntos de layers se
// intersectam. Exclusões de domínio (nó × seu container ancestral, aresta ×
// seus endpoints) são injetadas pelo compilador via `pairFilter` — a física
// permanece agnóstica de domínio.

import { STRIDE, X, Y, FX, FY, HALF_W, HALF_H } from './world.js';
import { buildGrid, eachCandidatePair } from './spatial-grid.js';

export function layersIntersect(a, b) {
  if (!a || !b || a.size === 0 || b.size === 0) return false;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const l of small) if (big.has(l)) return true;
  return false;
}

// Factory: cria um contributor de colisão com estado interno (acumuladores PI).
// `pairFilter(world, a, b) => boolean` (opcional) aplica exclusões de domínio
// após o gate de camada.
export function createCollision(opts = {}) {
  const Kp = opts.Kp ?? 0.5;
  const Ki = opts.Ki ?? 0.05;
  const pad = opts.pad ?? 0;
  const accMax = opts.accMax ?? 200;
  const pairFilter = opts.pairFilter ?? null;

  const acc = new Map(); // pairKey -> { v: Float64, s: stepStamp }
  let step = 0;

  function apply(world, cfg = {}, _alpha = 1) {
    // Colisão NÃO escala por alpha: precisa permanecer firme no rest para
    // garantir overlap zero (é o termo integral que converge, não o alpha).
    const dt = cfg.dt ?? 1;
    const grid = buildGrid(world, { pad });
    const { data, layers } = world;
    step++;

    eachCandidatePair(grid, (a, b) => {
      if (!layersIntersect(layers[a], layers[b])) return;
      if (pairFilter && !pairFilter(world, a, b)) return;

      const oa = a * STRIDE, ob = b * STRIDE;
      const dx = data[ob + X] - data[oa + X];
      const dy = data[ob + Y] - data[oa + Y];
      const sx = data[oa + HALF_W] + data[ob + HALF_W] + pad;
      const sy = data[oa + HALF_H] + data[ob + HALF_H] + pad;
      const ox = sx - Math.abs(dx);
      const oy = sy - Math.abs(dy);
      const pk = a * 4294967296 + b;

      if (ox <= 0 || oy <= 0) { acc.delete(pk); return; } // separados

      const axisX = ox < oy;
      const pen = axisX ? ox : oy;

      let e = acc.get(pk);
      if (e === undefined) { e = { v: 0, s: step }; acc.set(pk, e); }
      e.s = step;
      e.v += pen * dt;
      if (e.v > accMax) e.v = accMax;          // anti-windup
      else if (e.v < 0) e.v = 0;

      const f = Kp * pen + Ki * e.v;
      if (axisX) {
        const dir = dx >= 0 ? 1 : -1;          // direção a→b
        data[oa + FX] -= f * dir;
        data[ob + FX] += f * dir;
      } else {
        const dir = dy >= 0 ? 1 : -1;
        data[oa + FY] -= f * dir;
        data[ob + FY] += f * dir;
      }
    });

    // Prune: pares que saíram da candidatura (não visitados neste step).
    for (const [k, e] of acc) if (e.s !== step) acc.delete(k);
  }

  return { apply, reset() { acc.clear(); }, _acc: acc };
}
