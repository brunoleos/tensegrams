// Containers com filhos como CORPOS COMPOSTOS do motor v2 (R10 / M2, ADR-0010:
// "um container é um corpo que repele peers E hospeda um atrator-região").
//
// O container não tem slot no World: seu rect é DERIVADO, de baixo para cima,
// dos corpos descendentes (padding nos lados, padding + header no topo — a
// convenção do render). Três peças, todas sobre a mesma geometria:
//
//   - geometria: rects de todos os containers a partir do World (usada pela
//     colisão composta e pelo commit que entrega session.containers);
//   - colisão composta: container × peer (outro container não aparentado ou
//     corpo não descendente) com perfil linear Kp·pen sobre o contrato padded;
//     a força é distribuída igualmente aos corpos descendentes (o grupo se
//     move junto);
//   - atrator-região: cada corpo é puxado ao centróide dos corpos de cada
//     container ancestral; escala por alpha.
//
// Para o resto do motor o container é um corpo rígido: forças externas a ele
// (colisão composta aqui; a mola de conectividade em compile-world) são
// divididas igualmente entre os descendentes. Se a mola puxasse só o membro
// ligado, ele sairia do grupo esticando o rect, que empurraria os vizinhos, que
// puxariam outros membros… (bbox ×100 no syn:100 com mola, medido).
//
// Gating por COBERTURA (proposta de ADR 0022): dois elementos a e b só colidem
// diretamente se as "unidades" deles sob o ancestral comum (os filhos do LCA
// que os contêm) NÃO compartilharem layer. Se compartilham, a colisão dessas
// unidades já os separa, e colidir também a e b faria as duas colisões
// brigarem (sem 'end' e com o bbox explodindo, medido na avaliação). Se as
// unidades não compartilham layer (layers desalinhadas da hierarquia), a e b
// colidem direto, como antes.

import { STRIDE, X, Y, FX, FY, HALF_W, HALF_H, INV_MASS } from '../physics/world.js';
import { layersIntersect } from '../physics/collision.js';

export const HEADER = 22;
export const DEFAULT_PADDING = 24;
const HALF = [0.5, 0.5];

// Hierarquia restrita aos nós da IR: parentOf, cadeia até a raiz e as
// "unidades sob o LCA" de um par.
export function createHierarchy(ir) {
  const byId = new Map(ir.nodes.map((n) => [n.id, n]));
  const parentOf = (id) => {
    const p = byId.get(id)?.parent;
    return p && byId.has(p) ? p : null;
  };
  const chains = new Map(); // id -> [id, pai, avô, …, null]
  const chainOf = (id) => {
    let c = chains.get(id);
    if (c) return c;
    c = [id];
    let p = parentOf(id), guard = 0;
    while (p && guard++ < 1000) { c.push(p); p = parentOf(p); }
    c.push(null);
    chains.set(id, c);
    return c;
  };
  // Filhos do LCA que contêm a e b (podem ser os próprios a e b).
  function unitsUnderLca(a, b) {
    const ca = chainOf(a), cb = chainOf(b);
    const inB = new Set(cb);
    const ia = ca.findIndex((x) => inB.has(x));
    const ib = cb.indexOf(ca[ia]);
    return [ca[ia - 1], cb[ib - 1]];
  }
  const depth = (id) => chainOf(id).length - 2;
  return { byId, parentOf, chainOf, unitsUnderLca, depth };
}

// Regra de cobertura: true = o par a×b NÃO colide diretamente, porque suas
// unidades sob o LCA compartilham layer (e colidem entre si).
export function createCoverage(H, layersOf) {
  const memo = new Map();
  return function covered(a, b) {
    const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
    let v = memo.get(key);
    if (v !== undefined) return v;
    const [ua, ub] = H.unitsUnderLca(a, b);
    v = !!ua && !!ub && !(ua === a && ub === b) && layersIntersect(layersOf(ua), layersOf(ub));
    memo.set(key, v);
    return v;
  };
}

// Containers com filhos, do mais profundo para o mais raso (ordem bottom-up),
// com os filhos diretos e os corpos descendentes de cada um.
export function createContainerSet(ir, H, idToSlot) {
  const childIds = new Set(ir.nodes.filter((n) => n.parent && H.byId.has(n.parent)).map((n) => n.parent));
  const conts = ir.nodes
    .filter((n) => childIds.has(n.id) && !idToSlot.has(n.id))
    .sort((a, b) => H.depth(b.id) - H.depth(a.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const kids = new Map(conts.map((c) => [c.id, []]));
  for (const n of ir.nodes) {
    const p = H.parentOf(n.id);
    if (p && kids.has(p)) kids.get(p).push(n.id);
  }
  const descSlots = new Map(conts.map((c) => [c.id, []]));
  for (const [id, slot] of idToSlot) {
    for (const anc of H.chainOf(id).slice(1)) if (anc && descSlots.has(anc)) descSlots.get(anc).push(slot);
  }
  return { conts, kids, descSlots };
}

// Rects (top-left + tamanho) de corpos e containers a partir do World.
// Corpos: AABB do slot. Containers: bbox dos filhos + padding / header.
export function computeRects(world, set, idToSlot, out = new Map()) {
  out.clear();
  const d = world.data;
  for (const [id, slot] of idToSlot) {
    const o = slot * STRIDE;
    out.set(id, {
      x: d[o + X] - d[o + HALF_W], y: d[o + Y] - d[o + HALF_H],
      width: 2 * d[o + HALF_W], height: 2 * d[o + HALF_H],
    });
  }
  for (const c of set.conts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of set.kids.get(c.id)) {
      const r = out.get(k);
      if (!r) continue;
      if (r.x < x0) x0 = r.x;
      if (r.y < y0) y0 = r.y;
      if (r.x + r.width > x1) x1 = r.x + r.width;
      if (r.y + r.height > y1) y1 = r.y + r.height;
    }
    if (x0 === Infinity) continue;
    const pad = c.padding || DEFAULT_PADDING;
    out.set(c.id, {
      x: x0 - pad, y: y0 - pad - HEADER,
      width: (x1 - x0) + 2 * pad, height: (y1 - y0) + 2 * pad + HEADER,
      padding: pad,
    });
  }
  return out;
}

// Colisão composta: container × peer. `covered(a, b)` aplica a regra de
// cobertura; `layersOf(id)` devolve o Set de layers do nó (ou null);
// `split(idA, idB)` (opcional) devolve [fa, fb], a divisão dos pesos de
// nodeLayers (ADR-0021): cada lado recebe 2·f·fração.
export function createCompositeCollision({ set, H, idToSlot, layersOf, covered, split = null, Kp = 0.9, pad = 0 }) {
  const rects = new Map();
  const peers = [...set.conts.map((c) => c.id), ...idToSlot.keys()];
  const isCont = new Set(set.conts.map((c) => c.id));
  const contIndex = new Map(set.conts.map((c, i) => [c.id, i]));

  function push(d, id, fx, fy) {
    const slots = set.descSlots.get(id);
    if (slots) {
      if (!slots.length) return;
      const k = 1 / slots.length;
      for (const s of slots) { const o = s * STRIDE; d[o + FX] += fx * k; d[o + FY] += fy * k; }
    } else {
      const o = idToSlot.get(id) * STRIDE;
      d[o + FX] += fx; d[o + FY] += fy;
    }
  }

  return {
    rects,
    apply(world) {
      const d = world.data;
      computeRects(world, set, idToSlot, rects);
      for (let i = 0; i < set.conts.length; i++) {
        const a = set.conts[i].id;
        const ra = rects.get(a);
        if (!ra) continue;
        const ancA = H.chainOf(a);
        for (const b of peers) {
          if (b === a) continue;
          if (isCont.has(b) && contIndex.get(b) < i) continue; // container×container uma vez
          if (ancA.includes(b) || H.chainOf(b).includes(a)) continue; // aparentados
          if (!layersIntersect(layersOf(a), layersOf(b))) continue;
          if (covered(a, b)) continue;
          const rb = rects.get(b);
          if (!rb) continue;
          const ox = Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x) + 2 * pad;
          const oy = Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y) + 2 * pad;
          if (ox <= 0 || oy <= 0) continue;
          const dx = (rb.x + rb.width / 2) - (ra.x + ra.width / 2);
          const dy = (rb.y + rb.height / 2) - (ra.y + ra.height / 2);
          const [sa, sb] = split ? split(a, b) : HALF;
          if (ox < oy) {
            const f = 2 * Kp * ox * (dx >= 0 ? 1 : -1);
            push(d, a, -f * sa, 0); push(d, b, f * sb, 0);
          } else {
            const f = 2 * Kp * oy * (dy >= 0 ? 1 : -1);
            push(d, a, 0, -f * sa); push(d, b, 0, f * sb);
          }
        }
      }
    },
  };
}

// Atrator-região: cada corpo móvel → centróide dos corpos descendentes de cada
// container ancestral (soma zero no grupo). Escala por alpha (como o atrator
// central).
export function createRegionAttractor({ set, k = 0.02 }) {
  const groups = [];
  for (const c of set.conts) {
    const slots = set.descSlots.get(c.id);
    if (slots.length < 2) continue;
    groups.push(slots);
  }
  return {
    apply(world, ctx) {
      const g = k * (ctx?.alpha ?? 1);
      if (!g) return;
      const d = world.data;
      for (const slots of groups) {
        let cx = 0, cy = 0;
        for (const s of slots) { cx += d[s * STRIDE + X]; cy += d[s * STRIDE + Y]; }
        cx /= slots.length; cy /= slots.length;
        for (const s of slots) {
          const o = s * STRIDE;
          if (d[o + INV_MASS] === 0) continue;
          d[o + FX] -= (d[o + X] - cx) * g;
          d[o + FY] -= (d[o + Y] - cy) * g;
        }
      }
    },
  };
}
