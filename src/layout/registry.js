// Layout adapter registry. Static for builtin, descriptor-only for lazy.

const BUILTIN = {
  off: () => import('./adapters/off.js').then(m => m.adapter),
  custom: () => import('./adapters/custom/index.js').then(m => m.adapter),
  live: () => import('./adapters/live/index.js').then(m => m.adapter),
};

const LAZY = {
  // dagre / elk land here in future phases
};

const DESCRIPTORS = [
  { id: 'custom', label: 'Custom (estático)', lazy: false, caps: { containers: true, layered: false, interactive: false, providesRouting: false } },
  { id: 'live', label: 'Live (forças)', lazy: false, caps: { containers: true, layered: false, interactive: true, providesRouting: false } },
  { id: 'off', label: 'Off (manual pins)', lazy: false, caps: { containers: true, layered: false, interactive: false, providesRouting: false } },
];

const cache = new Map();

export function getLayoutAdapter(id) {
  if (!cache.has(id)) {
    const builtin = BUILTIN[id];
    const lazy = LAZY[id];
    if (builtin) cache.set(id, builtin());
    else if (lazy) cache.set(id, lazy());
    else return Promise.reject(new Error(`unknown layout adapter: ${id}`));
  }
  return cache.get(id);
}

export function listLayoutAdapters() {
  return DESCRIPTORS.slice();
}
