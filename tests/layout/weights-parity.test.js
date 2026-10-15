// ADR-0021: peso de nodeLayers = split POR PAR pelas layers compartilhadas,
// igual no v1 e no v2. Gate do flip do v2: o mesmo YAML divide a separação
// na mesma proporção nos dois motores.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { adapter } from '../../src/layout/adapters/live/index.js';
import { buildIR } from '../../src/dsl/ir.js';
import { parse } from '../../src/dsl/parser.js';

// Dois nós sobrepostos e nada mais (sem atrator central): o deslocamento de
// cada um é só a parte da separação que ele absorve. Sem limite de velocidade
// no v2, para o limite não cortar o chute do lado mais leve.
function shareOfA(src, engine) {
  const ir = buildIR(parse(src));
  const seedPositions = new Map([
    ['a', { x: -50, y: -20, width: 100, height: 40 }],
    ['b', { x: -20, y: -20, width: 100, height: 40 }],
  ]);
  const s = adapter.start(ir, { live: { engine, center: 0, velocityCap: 1e9, seedPositions, seedAlpha: 1 } });
  const c = (id) => { const r = s.positions.get(id); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const a0 = c('a'), b0 = c('b');
  for (let i = 0; i < 600; i++) s.tick();
  const a1 = c('a'), b1 = c('b');
  const da = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  const db = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
  assert.ok(da + db > 1, `${engine}: o par se separou`);
  return da / (da + db);
}

const CASES = [
  // a pesa 1 numa layer que b NÃO tem: não conta (só as compartilhadas).
  ['layer não compartilhada não pesa', 'a: { size: [100, 40], nodeLayers: { g: 1, h: 0 } }\nb: { size: [100, 40], nodeLayers: { h: 0 } }\n', 0.5],
  ['(1, 0): o lado de peso 0 absorve tudo', 'a: { size: [100, 40], nodeLayers: { h: 1 } }\nb: { size: [100, 40], nodeLayers: [h] }\n', 0],
  ['(0,75, 0,25): diferença 0,5 → 25% / 75%', 'a: { size: [100, 40], nodeLayers: { h: 0.75 } }\nb: { size: [100, 40], nodeLayers: { h: 0.25 } }\n', 0.25],
  ['pesos iguais altos → 50/50', 'a: { size: [100, 40], nodeLayers: { h: 1 } }\nb: { size: [100, 40], nodeLayers: { h: 1 } }\n', 0.5],
];

describe('ADR-0021 — paridade dos pesos de nodeLayers entre v1 e v2', () => {
  for (const [name, src, expected] of CASES) {
    test(name, () => {
      const v1 = shareOfA(src, 'v1');
      const v2 = shareOfA(src, 'v2');
      assert.ok(Math.abs(v1 - expected) < 0.02, `v1: fração de a ${v1.toFixed(3)}, esperado ${expected}`);
      assert.ok(Math.abs(v2 - expected) < 0.02, `v2: fração de a ${v2.toFixed(3)}, esperado ${expected}`);
    });
  }
});

describe('ADR-0021 — lado imóvel no v2', () => {
  // Modo 'flow' (nada congela no arrasto). Nó arrastado (massa infinita)
  // contra container de peso 1 e contra folha de peso 1: o split cederia 0 ao
  // lado pesado, mas com um lado imóvel a força é igual e oposta e o pesado
  // sai da frente.
  const SRC = `
C: { nodeLayers: { top: 1 } }
c1: { parent: C, size: [60, 40] }
heavy: { size: [60, 40], nodeLayers: { top: 1 } }
d: { size: [60, 40], nodeLayers: [top] }
`;
  for (const target of ['C', 'heavy']) {
    test(`arrastar sobre ${target === 'C' ? 'container' : 'folha'} de peso 1 o empurra`, () => {
      const ir = buildIR(parse(SRC));
      const s = adapter.start(ir, { live: { engine: 'v2', interactionMode: 'flow' } });
      for (let i = 0; i < 300; i++) s.tick();
      const rectOf = (id) => s.positions.get(id) || s.containers.get(id);
      const before = { ...rectOf(target) };
      const dr = s.positions.get('d');
      const cx = before.x + before.width / 2 - dr.width / 2, cy = before.y + before.height / 2 - dr.height / 2;
      for (let i = 0; i < 120; i++) { s.update({ drag: { id: 'd', x: cx, y: cy } }); s.tick(); }
      const after = rectOf(target);
      const moved = Math.hypot(after.x - before.x, after.y - before.y);
      assert.ok(moved > 20, `${target} deveria ceder ao nó arrastado; andou ${moved.toFixed(1)} px`);
      s.update({ release: 'd' });
    });
  }
});
