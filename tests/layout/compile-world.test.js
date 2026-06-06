import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';
import { startLayoutV2 } from '../../src/layout/compile-world.js';

const ir = (src) => buildIR(parse(src));

function runUntilSettled(session, maxTicks = 1000) {
  let t = 0;
  while (session.alpha >= 0.005 && t < maxTicks) { session.tick(); t++; }
  return t;
}

function overlaps(p, q) {
  return p.x < q.x + q.width && q.x < p.x + p.width &&
         p.y < q.y + q.height && q.y < p.y + p.height;
}

describe('layout/compile-world (motor v2) — invariantes', () => {
  test('nós na mesma collision layer assentam sem sobreposição', () => {
    const g = ir(`
connections:
  - [a, b]
  - [b, c]
a: { nodeLayers: [g], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
c: { nodeLayers: [g], size: [40, 30] }
`);
    const s = startLayoutV2(g, { live: { engine: 'v2' }, collision: { nodePad: 12 } });
    runUntilSettled(s);
    const A = s.positions.get('a'), B = s.positions.get('b'), C = s.positions.get('c');
    assert.ok(A && B && C, 'posições presentes');
    assert.ok(!overlaps(A, B), 'a×b sem overlap');
    assert.ok(!overlaps(B, C), 'b×c sem overlap');
    assert.ok(!overlaps(A, C), 'a×c sem overlap');
  });

  test('nó pinado fica na posição declarada (top-left = pin)', () => {
    const g = ir(`
connections:
  - [a, b]
a: { pin: [100, 50], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
`);
    const s = startLayoutV2(g, { live: { engine: 'v2' } });
    runUntilSettled(s);
    const A = s.positions.get('a');
    assert.ok(Math.abs(A.x - 100) < 1e-6 && Math.abs(A.y - 50) < 1e-6, 'pin respeitado');
  });

  test('container deriva rect que contém os filhos', () => {
    const g = ir(`
connections:
  - [auth, worker]
backend: {}
auth: { parent: backend, nodeLayers: [g], size: [40, 30] }
worker: { parent: backend, nodeLayers: [g], size: [40, 30] }
`);
    const s = startLayoutV2(g, { live: { engine: 'v2' }, collision: { nodePad: 12 } });
    runUntilSettled(s);
    const frame = s.containers.get('backend');
    const auth = s.positions.get('auth'), worker = s.positions.get('worker');
    assert.ok(frame, 'container derivado');
    assert.ok(auth && worker, 'filhos posicionados');
    // o frame deve englobar os filhos
    for (const ch of [auth, worker]) {
      assert.ok(ch.x >= frame.x - 1e-6 && ch.x + ch.width <= frame.x + frame.width + 1e-6, 'filho dentro (x)');
      assert.ok(ch.y >= frame.y - 1e-6 && ch.y + ch.height <= frame.y + frame.height + 1e-6, 'filho dentro (y)');
    }
    assert.ok(!overlaps(auth, worker), 'irmãos não se sobrepõem');
  });

  test('sem collision layer, overlap é tolerado (sem erro)', () => {
    const g = ir(`
connections:
  - [a, b]
a: { size: [40, 30] }
b: { size: [40, 30] }
`);
    const s = startLayoutV2(g, { live: { engine: 'v2' } });
    assert.doesNotThrow(() => runUntilSettled(s, 300));
    assert.ok(s.positions.get('a') && s.positions.get('b'));
  });

  test('emite tick e end via on()', async () => {
    const g = ir(`
connections: [[a, b]]
a: { pin: [0, 0], size: [20, 20] }
b: { pin: [80, 0], size: [20, 20] }
`);
    const s = startLayoutV2(g, { live: { engine: 'v2' } });
    // tudo pinado → alpha inicial 0 → end assíncrono
    const ended = await new Promise((r) => { s.on('end', () => r(true)); setTimeout(() => r(false), 50); });
    assert.ok(ended, 'end emitido para cena totalmente pinada');
  });
});
