// Compilador de LAYOUT: IR → World físico (motor unificado src/physics/).
//
// Traduz o GraphIR num World de corpos + contributors + constraints e expõe o
// MESMO contrato de sessão de src/layout/adapter.js (positions/containers/
// bounds/on/tick/update/stop/alpha), para ser um drop-in do adapter `live`
// atrás da flag `cfg.live.engine === 'v2'`.
//
// Modelo físico:
//   - corpos = leaves + containers vazios (containers com filhos derivam o rect
//     dos descendentes, como no live legado).
//   - massa: peso de colisão vira massa (#1). invMass = pinado ? 0 :
//     max(EPS, 1 - maxWeight). DSL-pin = massa infinita.
//   - layers de colisão = chaves de `nodeCollision`. Exclusão ancestral
//     (nó × container ancestral) via `pairFilter` (a física é agnóstica).
//   - forças: atrator central (default) + tag attract/repel (viewLayers) +
//     colisão PI. Molas de conectividade ficam para a Fase 3 (opt-in).
//   - constraints: axis/rect/circle/parent-bounds por nó.
//
// Calibração (massa/Kp/Ki/substeps) é deliberadamente provisória — ver plano
// (D-massa / D-PI). Paridade é por invariante + equivalência visual, não
// byte-a-byte.

import { buildAncestors } from '../dsl/ancestry.js';
import {
  createWorld, addBody, STRIDE, X, Y, VX, VY, INV_MASS, SHAPE, DOF,
} from '../physics/world.js';
import { createSolver } from '../physics/solver.js';
import { createCentral } from '../physics/contributors/central.js';
import { createTagForces } from '../physics/contributors/tag-forces.js';
import { createConnectivitySpring } from '../physics/contributors/connectivity-spring.js';
import { createCollision } from '../physics/collision.js';
import { createConstraint } from '../physics/constraints/index.js';

const HEADER = 22;
const MASS_EPS = 0.05; // massa mínima: peso 1 fica pesado, não imóvel (D-massa)

const DEFAULTS = {
  engine: 'v1',
  center: 0.012,
  damping: 0.82,
  // Contato P puro (ADR-0011): f = Kp·pen. O termo integral (Ki 0,04) mantinha
  // ciclo-limite e dobrava o tempo de assentamento. Kp 0,9 com 2 sub-passos
  // recupera a folga que o integral fechava (penetração padded máxima média
  // de 0,7 px, contra 0,16 com Ki) e assenta limpo; Kp 0,9 com 1 sub-passo
  // vibra. Medição: bench/layout, ex:+syn:30+syn:100 × 5 seeds (R04).
  collisionK: 0.9,        // Kp do controlador de colisão
  collisionKi: 0,         // Ki (termo integral) — fora do default
  collisionPadding: 12,
  tagAttract: 60,
  tagRepel: 4000,
  alphaDecay: 0.012,
  alphaMin: 0.003,
  alphaKick: 0.5,   // reaquecimento de drag/release
  warmKick: 0.05,   // alpha mínimo de um warm restart (edição da DSL)
  substeps: 2,
  // Repouso cinético (R04): 'end' quando nenhum corpo móvel anda mais que
  // restSpeed px/tick por restTicks ticks seguidos. Alpha vira só teto.
  // restSpeed 0 desliga o critério (só o cronograma de alpha termina).
  restSpeed: 0.1,
  restTicks: 20,
  // Limite de velocidade por eixo (px/tick). null = 8 com a mola de
  // conectividade, 32 sem (o mesmo 32 do v1). Sem limite o pico chegava a
  // 368 px/tick com nós empilhados.
  velocityCap: null,
  interactionMode: 'frozen',
  // Mola de conectividade (#opt-in, Fase 3): arestas puxam seus endpoints.
  // Default OFF preserva o modelo atrator-central. Knobs de baixo nível
  // (ADR-0007) na config; chaves desconhecidas são forward-compat.
  connectivitySpring: false,
  edgeSpring: 0.05,
  edgeRestLength: 120,
};

// Hash FNV-1a (32 bits) do id: direção inicial da busca de lugar livre de um
// nó novo, dependente só do id (não da ordem dos blocos no YAML).
function hashId(id) {
  let h = 0x811c9dc5;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Semente de cold start: posições num círculo em ordem de BFS sobre as
// arestas, partindo do menor id e visitando vizinhos em ordem de id. Vizinhos
// nascem lado a lado (a semente domina os cruzamentos finais) e a ordem dos
// blocos no YAML não muda nada.
function circleSeeds(ids, neighbors) {
  const sorted = [...ids].sort();
  const idSet = new Set(ids);
  const order = [], seen = new Set();
  for (const root of sorted) {
    if (seen.has(root)) continue;
    seen.add(root);
    const queue = [root];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      const next = (neighbors.get(id) || []).filter((m) => idSet.has(m) && !seen.has(m)).sort();
      for (const m of next) { seen.add(m); queue.push(m); }
    }
  }
  const out = new Map();
  order.forEach((id, i) => {
    const a = (i / Math.max(1, order.length)) * Math.PI * 2;
    const r = 180 + 35 * (i % 4);
    out.set(id, [Math.cos(a) * r, Math.sin(a) * r]);
  });
  return out;
}

function maxWeight(map) {
  let m = 0;
  if (map) for (const w of map.values()) if (w > m) m = w;
  return m;
}

export function startLayoutV2(ir, opts = {}) {
  const cfg = { ...DEFAULTS, ...(opts.live || {}) };
  if (opts.collision?.nodePad != null) cfg.collisionPadding = opts.collision.nodePad;

  const ancestors = buildAncestors(ir);

  // Seleção de corpos: leaves + containers vazios (sem filho sobrevivente).
  const childIdSet = new Set(ir.nodes.filter((n) => n.parent).map((n) => n.parent));
  const bodyNodes = ir.nodes.filter((n) => !n.hasChildren || !childIdSet.has(n.id));
  const containersWithChildren = ir.nodes.filter((n) => n.hasChildren && childIdSet.has(n.id));

  const world = createWorld(Math.max(8, bodyNodes.length));
  const idToSlot = new Map();
  const slotToNode = new Map();
  const originalInvMass = new Map();

  // Warm start (R04): o pipeline passa o último frame em seedPositions
  // (rects top-left) a cada edição. Corpos com semente nascem onde estavam;
  // corpo novo nasce no primeiro lugar livre perto dos vizinhos semeados
  // (arestas da IR); sem vizinho semeado, na semente de cold start (BFS).
  const seeds = cfg.seedPositions instanceof Map ? cfg.seedPositions : null;
  const seedCenter = (id) => {
    const r = seeds && seeds.get(id);
    return r ? [r.x + (r.width || 0) / 2, r.y + (r.height || 0) / 2] : null;
  };
  const neighbors = new Map();
  for (const e of ir.edges) {
    if (!neighbors.has(e.source)) neighbors.set(e.source, []);
    if (!neighbors.has(e.target)) neighbors.set(e.target, []);
    neighbors.get(e.source).push(e.target);
    neighbors.get(e.target).push(e.source);
  }
  const warmRestart = !!seeds && bodyNodes.some((n) => seeds.has(n.id));
  const sizeOf = (n) => [n.hasChildren ? Math.max(120, n.width) : n.width, n.hasChildren ? Math.max(60, n.height) : n.height];

  // 1ª passada: corpos com posição conhecida (pin ou semente).
  const center = new Map();
  for (const n of bodyNodes) {
    const [w, h] = sizeOf(n);
    if (n.pinned) center.set(n.id, [n.pinned.x + w / 2, n.pinned.y + h / 2]);
    else { const c = seedCenter(n.id); if (c) center.set(n.id, c); }
  }
  // Corpo novo num warm restart: primeiro lugar livre (contrato padded) numa
  // espiral em volta do centróide dos vizinhos já posicionados, começando no
  // ângulo do hash do id. Nascer em cima de um vizinho empurraria a cena toda.
  const pad = cfg.collisionPadding;
  const freeSpot = (n, cx0, cy0) => {
    const [w, h] = sizeOf(n);
    const fits = (x, y) => {
      for (const m of bodyNodes) {
        const c = center.get(m.id);
        if (!c || m === n) continue;
        const [mw, mh] = sizeOf(m);
        if (Math.abs(x - c[0]) < (w + mw) / 2 + 2 * pad && Math.abs(y - c[1]) < (h + mh) / 2 + 2 * pad) return false;
      }
      return true;
    };
    const a0 = (hashId(n.id) / 4294967296) * Math.PI * 2;
    const R = Math.hypot(w, h) / 2 + 2 * pad;
    for (const k of [1, 1.5, 2, 3, 4]) {
      for (let i = 0; i < 16; i++) {
        const a = a0 + (i / 16) * Math.PI * 2;
        const x = cx0 + Math.cos(a) * R * k, y = cy0 + Math.sin(a) * R * k;
        if (fits(x, y)) return [x, y];
      }
    }
    return [cx0 + Math.cos(a0) * R * 5, cy0 + Math.sin(a0) * R * 5];
  };
  const coldSeeds = circleSeeds(bodyNodes.filter((n) => !center.has(n.id)).map((n) => n.id), neighbors);
  for (const n of bodyNodes) {
    if (center.has(n.id)) continue;
    const around = (neighbors.get(n.id) || []).map((id) => center.get(id)).filter(Boolean);
    if (warmRestart && around.length) {
      const cx0 = around.reduce((acc, p) => acc + p[0], 0) / around.length;
      const cy0 = around.reduce((acc, p) => acc + p[1], 0) / around.length;
      center.set(n.id, freeSpot(n, cx0, cy0));
    } else {
      const [sx, sy] = coldSeeds.get(n.id);
      // Num warm restart, mesmo sem vizinho semeado, não nasce em cima de ninguém.
      center.set(n.id, warmRestart ? freeSpot(n, sx, sy) : [sx, sy]);
    }
  }

  bodyNodes.forEach((n) => {
    const [w, h] = sizeOf(n);
    const [cx, cy] = center.get(n.id);
    const invMass = n.pinned ? 0 : Math.max(MASS_EPS, 1 - maxWeight(n.nodeCollision));
    const slot = addBody(world, {
      x: cx, y: cy, invMass,
      halfW: w / 2, halfH: h / 2,
      kind: SHAPE.RECT, dof: n.pinned ? DOF.FIXED0 : DOF.FREE2,
      layers: n.nodeCollision && n.nodeCollision.size ? new Set(n.nodeCollision.keys()) : null,
    });
    idToSlot.set(n.id, slot);
    slotToNode.set(slot, n);
    originalInvMass.set(slot, invMass);
  });

  // Exclusão de domínio: nó não colide com seu container ancestral.
  function pairFilter(_world, a, b) {
    const na = slotToNode.get(a), nb = slotToNode.get(b);
    if (!na || !nb) return true;
    if (ancestors.get(na.id)?.has(nb.id)) return false;
    if (ancestors.get(nb.id)?.has(na.id)) return false;
    return true;
  }

  // tag-forces sobre viewLayers (como no live legado).
  const tagToSlots = new Map();
  for (const n of bodyNodes) {
    if (!n.layers) continue;
    const slot = idToSlot.get(n.id);
    for (const t of n.layers) {
      let bucket = tagToSlots.get(t);
      if (!bucket) { bucket = []; tagToSlots.set(t, bucket); }
      bucket.push(slot);
    }
  }
  const tagEntries = bodyNodes
    .filter((n) => n.forces)
    .map((n) => ({ slot: idToSlot.get(n.id), attractTo: n.forces.attractTo, repelFrom: n.forces.repelFrom }));

  const contributors = [
    createCentral({ k: cfg.center }),
    createTagForces({ entries: tagEntries, tagToSlots, kAttract: cfg.tagAttract, kRepel: cfg.tagRepel }),
    createCollision({ Kp: cfg.collisionK, Ki: cfg.collisionKi, pad: cfg.collisionPadding, pairFilter }),
  ];

  // Campo opt-in: mola de conectividade (Fase 3). Conecta endpoints que são
  // corpos (leaves / containers vazios); arestas tocando container com filhos
  // (posição derivada, sem corpo) são puladas.
  if (cfg.connectivitySpring) {
    const edges = [];
    for (const e of ir.edges) {
      const a = idToSlot.get(e.source), b = idToSlot.get(e.target);
      if (a !== undefined && b !== undefined) edges.push({ a, b, rest: cfg.edgeRestLength });
    }
    if (edges.length) contributors.push(createConnectivitySpring({ k: cfg.edgeSpring, edges }));
  }

  // Estado de saída + cache de containers (para parent-bounds com lag de 1 tick).
  let lastContainers = new Map();
  const getParentRect = (parentId) => lastContainers.get(parentId) || null;

  const constraints = [];
  for (const n of bodyNodes) {
    if (!n.constraint) continue;
    const c = createConstraint(idToSlot.get(n.id), n.constraint, {
      getParentRect: () => getParentRect(n.parent),
      header: HEADER,
    });
    if (c) constraints.push(c);
  }

  const solver = createSolver(
    { contributors, constraints },
    {
      integrator: {
        damping: cfg.damping, dampingOrder: 'after',
        velocityCap: cfg.velocityCap ?? (cfg.connectivitySpring ? 8 : 32),
      },
      substeps: cfg.substeps,
      // Warm restart parte do alpha anterior (no mínimo warmKick), não de 1:
      // a cena reajusta em vez de re-explodir.
      alpha0: anyMovable() ? (warmRestart ? Math.max(cfg.seedAlpha || 0, cfg.warmKick) : 1) : 0,
      alphaDecay: cfg.alphaDecay,
      alphaMin: cfg.alphaMin,
    },
  );

  function anyMovable() {
    for (const im of originalInvMass.values()) if (im > 0) return true;
    return false;
  }

  // ---- mapeamento World → modelo visual ----
  function commit() {
    const positions = new Map();
    const containers = new Map();
    const d = world.data;
    for (const n of bodyNodes) {
      const o = idToSlot.get(n.id) * STRIDE;
      const cx = d[o + X], cy = d[o + Y];
      if (n.hasChildren) {
        const w = Math.max(120, n.width), h = Math.max(60, n.height);
        containers.set(n.id, { x: cx - w / 2, y: cy - h / 2, width: w, height: h, padding: n.padding || 24 });
      } else {
        positions.set(n.id, { x: cx - n.width / 2, y: cy - n.height / 2, width: n.width, height: n.height });
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      for (const c of containersWithChildren) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hits = 0;
        for (const child of ir.nodes) {
          if (child.parent !== c.id) continue;
          const r = positions.get(child.id) || containers.get(child.id);
          if (!r) continue;
          hits++;
          if (r.x < minX) minX = r.x;
          if (r.y < minY) minY = r.y;
          if (r.x + r.width > maxX) maxX = r.x + r.width;
          if (r.y + r.height > maxY) maxY = r.y + r.height;
        }
        if (!hits) continue;
        const pad = c.padding || 24;
        containers.set(c.id, {
          x: minX - pad, y: minY - pad - HEADER,
          width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 + HEADER,
          padding: pad,
        });
      }
    }
    lastContainers = containers;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const merge = (x, y, w, h) => {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w; if (y + h > maxY) maxY = y + h;
    };
    for (const p of positions.values()) merge(p.x, p.y, p.width, p.height);
    for (const c of containers.values()) merge(c.x, c.y, c.width, c.height);
    const bounds = Number.isFinite(minX)
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : { x: 0, y: 0, width: 0, height: 0 };
    session.positions = positions;
    session.containers = containers;
    session.bounds = bounds;
  }

  // ---- sessão (contrato do adapter) ----
  const listeners = { tick: new Set(), end: new Set(), error: new Set() };
  let stopped = false, endEmitted = false, rafHandle = null;

  function emit(ev) { for (const cb of listeners[ev]) cb(session); }

  // Termina quando os corpos param (critério cinético) ou, no máximo, quando
  // alpha chega ao piso: o solver o prende EXATAMENTE em alphaMin
  // (solver.js: max(alphaMin, …)), então o teto é alpha <= alphaMin.
  let stillTicks = 0, maxSpeed = 0, kineticEnergy = 0;

  function measureMotion() {
    const d = world.data;
    let vmax2 = 0, ke = 0;
    for (const slot of originalInvMass.keys()) {
      const o = slot * STRIDE;
      const im = d[o + INV_MASS];
      if (im === 0) continue; // pinado ou congelado no drag
      const v2 = d[o + VX] * d[o + VX] + d[o + VY] * d[o + VY];
      if (v2 > vmax2) vmax2 = v2;
      ke += 0.5 * v2 / im;
    }
    maxSpeed = Math.sqrt(vmax2);
    kineticEnergy = ke;
    if (cfg.restSpeed > 0 && maxSpeed < cfg.restSpeed) stillTicks++;
    else stillTicks = 0;
  }

  const settled = () => solver.alpha <= cfg.alphaMin
    || (cfg.restSpeed > 0 && stillTicks >= cfg.restTicks);

  // Reaquecimento (drag, release, warm restart): zera o contador de repouso.
  function kick(a) { solver.kick(a); stillTicks = 0; }

  function stepOnce() {
    if (stopped) return;
    solver.tick(world);
    measureMotion();
    commit();
    emit('tick');
    if (settled()) {
      if (!endEmitted) { endEmitted = true; emit('end'); }
      cancelLoop();
    } else {
      endEmitted = false;
    }
  }

  function loop() { rafHandle = null; if (stopped) return; stepOnce(); if (!settled()) ensureRunning(); }
  function ensureRunning() {
    if (stopped || rafHandle != null) return;
    if (typeof requestAnimationFrame !== 'undefined') rafHandle = requestAnimationFrame(loop);
  }
  function cancelLoop() {
    if (rafHandle != null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  const session = {
    positions: new Map(),
    containers: new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    on(ev, cb) { listeners[ev].add(cb); return () => listeners[ev].delete(cb); },
    update(patch) {
      if (!patch) return;
      const d = world.data;
      if (patch.drag) {
        const drags = Array.isArray(patch.drag) ? patch.drag : [patch.drag];
        const active = new Set();
        for (const dd of drags) {
          const slot = idToSlot.get(dd.id);
          if (slot === undefined) continue;
          const o = slot * STRIDE;
          const n = slotToNode.get(slot);
          const w = n.hasChildren ? Math.max(120, n.width) : n.width;
          const h = n.hasChildren ? Math.max(60, n.height) : n.height;
          d[o + X] = dd.x + w / 2; d[o + Y] = dd.y + h / 2;
          d[o + VX] = 0; d[o + VY] = 0;
          d[o + INV_MASS] = 0; // fixo no cursor durante o drag
          active.add(slot);
        }
        if (!active.size) return;
        if (cfg.interactionMode === 'frozen') {
          // congela todos os outros móveis no lugar
          for (const slot of originalInvMass.keys()) {
            if (active.has(slot)) continue;
            world.data[slot * STRIDE + INV_MASS] = 0;
          }
        }
        kick(cfg.alphaKick);
        ensureRunning();
      }
      if (patch.release) {
        const rels = Array.isArray(patch.release) ? patch.release : [patch.release];
        for (const id of rels) {
          const slot = idToSlot.get(id);
          if (slot === undefined) continue;
          d[slot * STRIDE + INV_MASS] = originalInvMass.get(slot); // volta à simulação
        }
        if (cfg.interactionMode === 'frozen') {
          for (const [slot, im] of originalInvMass) world.data[slot * STRIDE + INV_MASS] = im;
        }
        kick(cfg.alphaKick);
        ensureRunning();
      }
    },
    tick() { stepOnce(); },
    stop() { stopped = true; cancelLoop(); },
    get alpha() { return solver.alpha; },
    // Observáveis de movimento do último tick (px/tick e ½·Σ m·v²).
    get maxSpeed() { return maxSpeed; },
    get kineticEnergy() { return kineticEnergy; },
  };

  commit(); // commit inicial para subscribers verem algo

  if (solver.alpha <= cfg.alphaMin) {
    queueMicrotask(() => { if (stopped) return; emit('tick'); endEmitted = true; emit('end'); });
  } else if (typeof requestAnimationFrame !== 'undefined') {
    ensureRunning();
  } else {
    queueMicrotask(() => { if (!stopped) emit('tick'); });
  }

  return session;
}
