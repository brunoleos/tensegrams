// Containers como corpos compostos no motor v2 (R10 / M2 / ADR-0010).
// Violações medidas com a mesma régua da bancada (bench/layout): pares que
// compartilham nodeLayer e se sobrepõem (contrato padded) + contenção.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';
import { EXAMPLES } from '../../src/dsl/examples.js';
import { startLayoutV2 } from '../../src/layout/compile-world.js';
import { graphFromIR } from '../../bench/layout/lib/graph.mjs';
import { computeMetrics } from '../../bench/layout/lib/metrics.mjs';
import { synthYaml } from '../../bench/layout/lib/scenarios.mjs';

const ir = (src) => buildIR(parse(src));

function settle(irv, live = {}, maxTicks = 3000) {
  const s = startLayoutV2(irv, { live: { engine: 'v2', ...live } });
  let ended = false;
  s.on('end', () => { ended = true; });
  let t = 0;
  while (!ended && t < maxTicks) { s.tick(); t++; }
  const m = computeMetrics(graphFromIR(irv), { positions: s.positions, containers: s.containers });
  return { s, ended, ticks: t, m };
}

const TWO_BOXES = `
connections:
  - [a1, b1]
  - [a1, a2]
  - [b1, b2]
A: { nodeLayers: [top] }
B: { nodeLayers: [top] }
a1: { parent: A, nodeLayers: [inA], size: [60, 40] }
a2: { parent: A, nodeLayers: [inA], size: [60, 40] }
b1: { parent: B, nodeLayers: [inB], size: [60, 40] }
b2: { parent: B, nodeLayers: [inB], size: [60, 40] }
solo: { nodeLayers: [top], size: [60, 40] }
`;

describe('layout/container-bodies — container como corpo composto (R10)', () => {
  test('containers irmãos não se sobrepõem e um peer não invade container alheio', () => {
    const { ended, m } = settle(ir(TWO_BOXES));
    assert.ok(ended, 'end emitido');
    assert.equal(m.colViol, 0, `violações de colisão: ${JSON.stringify(m)}`);
    assert.equal(m.contain, 0);
  });

  test('exemplo containers do app: 0 violações e 0 de contenção', () => {
    const { ended, m } = settle(ir(EXAMPLES.containers));
    assert.ok(ended);
    assert.equal(m.colViol, 0);
    assert.equal(m.contain, 0);
  });

  test('sintético de 100 nós com containers aninhados: 0 violações', () => {
    const { ended, m } = settle(ir(synthYaml(100, { seed: 7 })));
    assert.ok(ended, 'assenta');
    assert.equal(m.colViol, 0, `colViol=${m.colViol}`);
    assert.equal(m.contain, 0);
  });

  test('mola de conectividade: 0 violações e área limitada (a mola age no grupo, não arrasta o membro)', () => {
    // Antes, a mola puxava só o membro ligado: o rect esticava e empurrava os
    // vizinhos, sem fim (bbox ~100× o do v2 sem mola no syn:100).
    const irv = ir(synthYaml(100, { seed: 1 }));
    const base = settle(irv).m;
    const { m } = settle(irv, { connectivitySpring: true });
    assert.equal(m.colViol, 0, `colViol=${m.colViol}`);
    assert.equal(m.contain, 0);
    assert.ok(m.bboxArea < 2 * base.bboxArea, `bbox ${m.bboxArea} vs ${base.bboxArea} sem mola`);
  });

  test('layer global em todos (allcollide): assenta e 0 violações', () => {
    const src = synthYaml(60, { seed: 5 }).replace(/nodeLayers: \[([^\]]*)\]/g, (_, l) => `nodeLayers: [${l ? l + ', ' : ''}all]`);
    const { ended, m } = settle(ir(src));
    assert.ok(ended, 'assenta (o gating direto divergia aqui)');
    assert.equal(m.colViol, 0, `colViol=${m.colViol}`);
  });

  test('layers desalinhadas (containers sem layer, folhas na mesma layer): folhas de containers diferentes não se sobrepõem', () => {
    const src = `
connections:
  - [a1, b1]
A: {}
B: {}
a1: { parent: A, nodeLayers: [all], size: [60, 40] }
a2: { parent: A, nodeLayers: [all], size: [60, 40] }
b1: { parent: B, nodeLayers: [all], size: [60, 40] }
b2: { parent: B, nodeLayers: [all], size: [60, 40] }
`;
    const { ended, m } = settle(ir(src));
    assert.ok(ended);
    assert.equal(m.colViol, 0, `colViol=${m.colViol}`);
  });

  test('session.containers segue a convenção do render: padding nos lados e padding + header no topo', () => {
    const { s } = settle(ir(TWO_BOXES));
    const A = s.containers.get('A');
    const a1 = s.positions.get('a1'), a2 = s.positions.get('a2');
    const minY = Math.min(a1.y, a2.y), minX = Math.min(a1.x, a2.x);
    assert.ok(Math.abs(A.x - (minX - 24)) < 1e-6, 'lado esquerdo = minX − padding');
    assert.ok(Math.abs(A.y - (minY - 24 - 22)) < 1e-6, 'topo = minY − padding − header');
  });
});
