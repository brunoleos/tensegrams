// Registries de contributors e fields (#6) — espelham o padrão de
// src/layout/registry.js (BUILTIN + cache), mas síncronos (builtins resolvidos
// estaticamente; plugáveis externos podem ser registrados em runtime).
//
// Contributor = objeto `{ apply(world, ctx) }`, produzido por uma factory
// `(opts) => contributor`. Field = bundle nomeado de contributors (+ futuros
// constraints) com `defaultEnabled`.

import { createCentral } from './contributors/central.js';
import { createConnectivitySpring } from './contributors/connectivity-spring.js';
import { createCollision } from './collision.js';

const CONTRIBUTORS = {
  central: createCentral,
  connectivity: createConnectivitySpring,
  collision: createCollision,
};

export function registerContributor(id, factory) {
  CONTRIBUTORS[id] = factory;
}

export function createContributor(id, opts) {
  const factory = CONTRIBUTORS[id];
  if (!factory) throw new Error(`unknown contributor: ${id}`);
  return factory(opts);
}

export function listContributors() {
  return Object.keys(CONTRIBUTORS);
}

// Campos componíveis: bundle nomeado de contributors. `defaultEnabled` define
// se o campo entra por default (molas/conectividade são opt-in).
const FIELDS = {
  collision:    { contributors: ['collision'],    defaultEnabled: true },
  central:      { contributors: ['central'],       defaultEnabled: true },
  connectivity: { contributors: ['connectivity'],  defaultEnabled: false },
};

export function registerField(id, spec) {
  FIELDS[id] = spec;
}

export function getField(id) {
  return FIELDS[id] ?? null;
}

export function listFields() {
  return Object.keys(FIELDS).map((id) => ({ id, ...FIELDS[id] }));
}

// Monta a lista de contributors a partir de um conjunto de campos ativos.
// `enabled` é um objeto { fieldId: bool } que sobrepõe os defaults.
// `optsByContributor` fornece opts por id de contributor.
export function buildContributors(enabled = {}, optsByContributor = {}) {
  const out = [];
  for (const { id, contributors, defaultEnabled } of listFields()) {
    const on = enabled[id] ?? defaultEnabled;
    if (!on) continue;
    for (const cid of contributors) {
      out.push(createContributor(cid, optsByContributor[cid]));
    }
  }
  return out;
}
