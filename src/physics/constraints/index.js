// Constraints — projeções de posição pós-integração (#5). Cada constraint é um
// objeto `{ apply(world, ctx) }` que projeta UM corpo (por slot) num conjunto
// viável e zera a velocidade no eixo restringido. O compilador instancia um
// constraint por nó que declara `constraint:` na DSL.
//
// Coordenadas são de CENTRO (o World guarda centros + meia-extensão; o mapeador
// converte para top-left no fim). Espelha a semântica de applyConstraint do
// live legado (axis/rect/circle/parent-bounds).

import { STRIDE, X, Y, VX, VY, HALF_W, HALF_H } from '../world.js';

export function createAxisConstraint(slot, axis, value) {
  return {
    apply(world) {
      if (!world.alive[slot]) return;
      const o = slot * STRIDE, d = world.data;
      if (axis === 'x') { d[o + X] = value + d[o + HALF_W]; d[o + VX] = 0; }
      else { d[o + Y] = value + d[o + HALF_H]; d[o + VY] = 0; }
    },
  };
}

export function createRectConstraint(slot, rect) {
  return {
    apply(world) {
      if (!world.alive[slot]) return;
      const o = slot * STRIDE, d = world.data;
      const hw = d[o + HALF_W], hh = d[o + HALF_H];
      if (d[o + X] < rect.x + hw) { d[o + X] = rect.x + hw; d[o + VX] = 0; }
      if (d[o + X] > rect.x + rect.w - hw) { d[o + X] = rect.x + rect.w - hw; d[o + VX] = 0; }
      if (d[o + Y] < rect.y + hh) { d[o + Y] = rect.y + hh; d[o + VY] = 0; }
      if (d[o + Y] > rect.y + rect.h - hh) { d[o + Y] = rect.y + rect.h - hh; d[o + VY] = 0; }
    },
  };
}

export function createCircleConstraint(slot, c) {
  return {
    apply(world) {
      if (!world.alive[slot]) return;
      const o = slot * STRIDE, d = world.data;
      const hw = d[o + HALF_W], hh = d[o + HALF_H];
      const dx = d[o + X] - c.cx, dy = d[o + Y] - c.cy;
      const d2 = dx * dx + dy * dy;
      const rMax = Math.max(0, c.r - Math.max(hw, hh));
      if (d2 > rMax * rMax && rMax > 0) {
        const dist = Math.sqrt(d2), k = rMax / dist;
        d[o + X] = c.cx + dx * k; d[o + Y] = c.cy + dy * k;
        d[o + VX] *= 0.5; d[o + VY] *= 0.5;
      }
    },
  };
}

// parent-bounds: mantém o nó dentro do retângulo INTERNO do container pai.
// `getParentRect()` devolve o rect {x,y,width,height} do pai (com lag de 1 tick
// — derivado ao fim do tick anterior, como no live legado) ou null.
export function createParentBoundsConstraint(slot, getParentRect, header) {
  const HEADER = header ?? 0;
  return {
    apply(world) {
      if (!world.alive[slot]) return;
      const rect = getParentRect();
      if (!rect) return;
      const o = slot * STRIDE, d = world.data;
      const hw = d[o + HALF_W], hh = d[o + HALF_H];
      const innerX = rect.x, innerY = rect.y + HEADER;
      const innerW = rect.width, innerH = rect.height - HEADER;
      if (d[o + X] < innerX + hw) { d[o + X] = innerX + hw; d[o + VX] = 0; }
      if (d[o + X] > innerX + innerW - hw) { d[o + X] = innerX + innerW - hw; d[o + VX] = 0; }
      if (d[o + Y] < innerY + hh) { d[o + Y] = innerY + hh; d[o + VY] = 0; }
      if (d[o + Y] > innerY + innerH - hh) { d[o + Y] = innerY + innerH - hh; d[o + VY] = 0; }
    },
  };
}

export function createConstraint(slot, spec, deps = {}) {
  switch (spec?.type) {
    case 'axis': return createAxisConstraint(slot, spec.axis, spec.value);
    case 'rect': return createRectConstraint(slot, { x: spec.x, y: spec.y, w: spec.w, h: spec.h });
    case 'circle': return createCircleConstraint(slot, { cx: spec.cx, cy: spec.cy, r: spec.r });
    case 'parent-bounds':
      return createParentBoundsConstraint(slot, deps.getParentRect, deps.header);
    default: return null;
  }
}
