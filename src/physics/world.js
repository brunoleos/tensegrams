// Physics World — store de corpos em layout AoS-interleaved num único
// Float32Array plano (stride fixo). Todos os campos numéricos quentes de um
// corpo ficam contíguos (~1 linha de cache) — ótimo para o loop do integrador,
// zero pressão de GC. Metadados frios (shape kind, dof, layers) vivem em
// arrays paralelos indexados por slot.
//
// Decisão de representação: Float32 interleaved (não SoA paralelo) porque JS
// vanilla não vetoriza (sem SIMD) e o integrador toca todos os campos do mesmo
// corpo por iteração. Acumuladores integrais do controlador PI de colisão NÃO
// moram aqui — são por-contato (poucos) e ficam em Float64 no módulo de
// colisão.
//
// Add/remove (fissão/fusão de arestas) via free-list de slots + contador de
// geração por slot (detecção de handle obsoleto).

// Offsets dentro do stride de cada corpo no Float32Array `data`.
export const X = 0;
export const Y = 1;
export const VX = 2;
export const VY = 3;
export const FX = 4;
export const FY = 5;
export const INV_MASS = 6;   // 0 = corpo imóvel (massa infinita / pinado)
export const HALF_W = 7;     // meia-extensão x da BBox de colisão
export const HALF_H = 8;     // meia-extensão y da BBox de colisão
export const STRIDE = 9;

// Tipos de forma (parallel array `kind`, Uint8).
export const SHAPE = { RECT: 0, POINT: 1, CAPSULE: 2 };

// Graus de liberdade (parallel array `dof`, Uint8). FREE2 = 2 DOFs; RAIL1 =
// 1 DOF (desliza num trilho, projetado por constraint); FIXED0 = sem DOF.
export const DOF = { FREE2: 2, RAIL1: 1, FIXED0: 0 };

const DEFAULT_CAPACITY = 64;

export function createWorld(initialCapacity = DEFAULT_CAPACITY) {
  const cap = Math.max(1, initialCapacity | 0);
  return {
    data: new Float32Array(cap * STRIDE),
    kind: new Uint8Array(cap),
    dof: new Uint8Array(cap),
    layers: new Array(cap).fill(null),  // Set<string> | null por slot
    alive: new Uint8Array(cap),         // 1 = ocupado
    generation: new Uint32Array(cap),   // bump a cada remoção
    capacity: cap,
    count: 0,                           // nº de corpos vivos
    free: [],                           // pilha de slots livres
    onRemove: new Set(),                // fn(slot): quem guarda estado por slot o descarta
    highWater: 0,                       // maior slot já alocado + 1
  };
}

function grow(world) {
  const newCap = world.capacity * 2;
  const data = new Float32Array(newCap * STRIDE);
  data.set(world.data);
  const kind = new Uint8Array(newCap); kind.set(world.kind);
  const dof = new Uint8Array(newCap); dof.set(world.dof);
  const alive = new Uint8Array(newCap); alive.set(world.alive);
  const generation = new Uint32Array(newCap); generation.set(world.generation);
  const layers = world.layers; layers.length = newCap; layers.fill(null, world.capacity);
  world.data = data;
  world.kind = kind;
  world.dof = dof;
  world.alive = alive;
  world.generation = generation;
  world.capacity = newCap;
}

// Aloca um corpo e devolve seu slot. Reusa slots livres (free-list) antes de
// crescer, mantendo a densidade do buffer.
export function addBody(world, {
  x = 0, y = 0, vx = 0, vy = 0,
  invMass = 1, halfW = 0, halfH = 0,
  kind = SHAPE.RECT, dof = DOF.FREE2, layers = null,
} = {}) {
  let slot;
  if (world.free.length) {
    slot = world.free.pop();
  } else {
    if (world.highWater >= world.capacity) grow(world);
    slot = world.highWater++;
  }
  const o = slot * STRIDE;
  const d = world.data;
  d[o + X] = x; d[o + Y] = y;
  d[o + VX] = vx; d[o + VY] = vy;
  d[o + FX] = 0; d[o + FY] = 0;
  d[o + INV_MASS] = invMass;
  d[o + HALF_W] = halfW; d[o + HALF_H] = halfH;
  world.kind[slot] = kind;
  world.dof[slot] = dof;
  world.layers[slot] = layers;
  world.alive[slot] = 1;
  world.count++;
  return slot;
}

// Libera um slot. Bump de geração invalida handles {slot, gen} antigos.
export function removeBody(world, slot) {
  if (!world.alive[slot]) return;
  world.alive[slot] = 0;
  world.layers[slot] = null;
  world.generation[slot]++;
  world.count--;
  world.free.push(slot);
  // Estado indexado por slot (acumuladores de contato, por exemplo) não pode
  // vazar para o próximo corpo que reusar o slot.
  for (const fn of world.onRemove) fn(slot);
}

// Handle estável contra reuso de slot: { slot, gen }.
export function handleOf(world, slot) {
  return { slot, gen: world.generation[slot] };
}

export function isAlive(world, handle) {
  return world.alive[handle.slot] === 1 &&
    world.generation[handle.slot] === handle.gen;
}

// Itera slots vivos em ordem ascendente (determinístico — requisito da rede de
// caracterização). `fn(slot)` por corpo vivo.
export function forEachBody(world, fn) {
  const { alive, highWater } = world;
  for (let slot = 0; slot < highWater; slot++) {
    if (alive[slot]) fn(slot);
  }
}

// Zera os acumuladores de força de todos os corpos vivos. Chamado no início de
// cada (sub)passo do solver.
export function clearForces(world) {
  const { data, alive, highWater } = world;
  for (let slot = 0; slot < highWater; slot++) {
    if (!alive[slot]) continue;
    const o = slot * STRIDE;
    data[o + FX] = 0;
    data[o + FY] = 0;
  }
}
