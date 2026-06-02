const BUILTIN = {
  straight: () => import('./routers/straight.js').then(m => m.router),
  orthogonal: () => import('./routers/orthogonal.js').then(m => m.router),
  curved: () => import('./routers/curved.js').then(m => m.router),
};

const DESCRIPTORS = [
  { id: 'orthogonal', label: 'Ortogonal (Manhattan)', lazy: false },
  { id: 'straight', label: 'Reto', lazy: false },
  { id: 'curved', label: 'Curvo (Bezier)', lazy: false },
];

const cache = new Map();

export function getRouter(id) {
  if (!cache.has(id)) {
    const factory = BUILTIN[id];
    if (!factory) return Promise.reject(new Error(`unknown router: ${id}`));
    cache.set(id, factory());
  }
  return cache.get(id);
}

export function listRouters() {
  return DESCRIPTORS.slice();
}
