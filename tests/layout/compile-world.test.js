import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';
import { startLayoutV2 } from '../../src/layout/compile-world.js';

const ir = (src) => buildIR(parse(src));

// Roda até o 'end' do PRÓPRIO produto — não um limiar local de alpha, que
// escondia o bug do 'end' que nunca saía com corpos livres (R03).
function runUntilSettled(session, maxTicks = 1000) {
  let ended = false;
  const off = session.on('end', () => { ended = true; });
  let t = 0;
  while (!ended && t < maxTicks) { session.tick(); t++; }
  off();
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

// rAF falso: fila de callbacks drenada frame a frame pelo teste.
function installFakeRaf() {
  const prev = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  const queue = new Map();
  let next = 1;
  globalThis.requestAnimationFrame = (cb) => { const h = next++; queue.set(h, cb); return h; };
  globalThis.cancelAnimationFrame = (h) => { queue.delete(h); };
  return {
    pending: () => queue.size,
    // roda um frame; devolve false quando não há nada agendado
    frame() {
      if (!queue.size) return false;
      const cbs = [...queue.values()];
      queue.clear();
      for (const cb of cbs) cb();
      return true;
    },
    restore() {
      globalThis.requestAnimationFrame = prev.raf;
      globalThis.cancelAnimationFrame = prev.caf;
    },
  };
}

describe('layout/compile-world — término do loop (R03)', () => {
  const FREE = `
connections:
  - [a, b]
  - [b, c]
a: { nodeLayers: [g], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
c: { nodeLayers: [g], size: [40, 30] }
`;
  // alpha decai geometricamente até o piso alphaMin (src/physics/solver.js):
  // o número de ticks até o piso é ln(alphaMin) / ln(1 − alphaDecay).
  const scheduleTicks = (alphaMin, alphaDecay) => Math.ceil(Math.log(alphaMin) / Math.log(1 - alphaDecay));

  test('com corpos livres, emite end e para de agendar frames', () => {
    const raf = installFakeRaf();
    try {
      const s = startLayoutV2(ir(FREE), { live: { engine: 'v2' } });
      let ticks = 0, ends = 0;
      s.on('tick', () => { ticks++; });
      s.on('end', () => { ends++; });
      let frames = 0;
      while (raf.frame() && frames < 5000) frames++;
      assert.equal(ends, 1, 'end emitido exatamente uma vez');
      assert.equal(raf.pending(), 0, 'nenhum frame agendado depois do end');
      // O end sai no repouso cinético (R04) e, no máximo, no fim do cronograma
      // de alpha, que é o teto.
      assert.ok(ticks <= scheduleTicks(0.003, 0.012) + 1, `end no cronograma (ticks=${ticks})`);
      s.stop();
    } finally { raf.restore(); }
  });

  test('reaquecer com drag/release religa o loop e termina de novo', () => {
    const raf = installFakeRaf();
    try {
      const s = startLayoutV2(ir(FREE), { live: { engine: 'v2' } });
      let ends = 0;
      s.on('end', () => { ends++; });
      let frames = 0;
      while (raf.frame() && frames < 5000) frames++;
      assert.equal(ends, 1);
      const a = s.positions.get('a');
      s.update({ drag: { id: 'a', x: a.x + 50, y: a.y } });
      assert.ok(raf.pending() > 0, 'drag reagenda o loop');
      s.update({ release: 'a' });
      frames = 0;
      while (raf.frame() && frames < 5000) frames++;
      assert.equal(ends, 2, 'segundo end depois do reaquecimento');
      assert.equal(raf.pending(), 0, 'loop parado de novo');
      s.stop();
    } finally { raf.restore(); }
  });

  test('tick() manual também emite end com corpos livres', () => {
    const s = startLayoutV2(ir(FREE), { live: { engine: 'v2' } });
    let ended = false;
    s.on('end', () => { ended = true; });
    let t = 0;
    while (!ended && t < 2000) { s.tick(); t++; }
    assert.ok(ended, `end emitido (ticks=${t})`);
  });
});

describe('layout/compile-world — mola de conectividade (Fase 3, opt-in)', () => {
  const irOf = (src) => buildIR(parse(src));
  function settle(s, n = 800) { let t = 0; while (s.alpha >= 0.005 && t < n) { s.tick(); t++; } }
  function dist(s, a, b) { const p = s.positions.get(a), q = s.positions.get(b); return Math.hypot((p.x + p.width / 2) - (q.x + q.width / 2), (p.y + p.height / 2) - (q.y + q.height / 2)); }

  const SRC = `
connections:
  - [a, b]
a: { pin: [0, 0], size: [20, 20] }
b: { size: [20, 20] }
`;

  test('ligada: aresta puxa o nó livre para perto do pinado', () => {
    const off = startLayoutV2(irOf(SRC), { live: { engine: 'v2', center: 0 } });
    settle(off);
    const dOff = dist(off, 'a', 'b');
    const on = startLayoutV2(irOf(SRC), { live: { engine: 'v2', center: 0, connectivitySpring: true, edgeRestLength: 40, edgeSpring: 0.08 } });
    settle(on);
    const dOn = dist(on, 'a', 'b');
    assert.ok(dOn < dOff, `mola aproxima (on=${dOn.toFixed(1)} < off=${dOff.toFixed(1)})`);
    assert.ok(dOn < 120, 'distância converge perto do rest length');
  });

  test('desligada (default): nenhum contributor de mola é adicionado', () => {
    // sanity: cena com colisão segue sem overlap (invariante intacto)
    const g = irOf(`
connections: [[a, b]]
a: { nodeLayers: [g], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
`);
    const s = startLayoutV2(g, { live: { engine: 'v2' }, collision: { nodePad: 12 } });
    settle(s);
    const A = s.positions.get('a'), B = s.positions.get('b');
    assert.ok(!(A.x < B.x + B.width && B.x < A.x + A.width && A.y < B.y + B.height && B.y < A.y + A.height), 'sem overlap');
  });
});

describe('layout/compile-world — repouso cinético e limite de velocidade (R04)', () => {
  const FREE = `
connections:
  - [a, b]
  - [b, c]
a: { nodeLayers: [g], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
c: { nodeLayers: [g], size: [40, 30] }
`;
  function runRecording(s, maxTicks = 2000) {
    const speeds = [];
    let ended = false;
    s.on('tick', () => speeds.push(s.maxSpeed));
    s.on('end', () => { ended = true; });
    let t = 0;
    while (!ended && t < maxTicks) { s.tick(); t++; }
    return { speeds, ended, ticks: t };
  }

  test('end sai quando os corpos param, antes do fim do cronograma de alpha', () => {
    const s = startLayoutV2(ir(FREE), { live: { engine: 'v2' } });
    const { speeds, ended, ticks } = runRecording(s);
    assert.ok(ended, 'end emitido');
    assert.ok(ticks < 481, `repouso antes do piso de alpha (ticks=${ticks})`);
    const tail = speeds.slice(-20);
    assert.equal(tail.length, 20);
    for (const v of tail) assert.ok(v < 0.1, `últimos 20 ticks parados (v=${v})`);
    assert.ok(s.kineticEnergy >= 0 && s.kineticEnergy < 0.05, `KE exposta e baixa (KE=${s.kineticEnergy})`);
  });

  test('alpha é teto: sem critério cinético, o end sai no fim do cronograma', () => {
    const s = startLayoutV2(ir(FREE), { live: { engine: 'v2', restSpeed: 0 } });
    const { ended, ticks } = runRecording(s);
    assert.ok(ended);
    assert.ok(ticks >= 480 && ticks <= 482, `ticks=${ticks}`);
  });

  test('a velocidade de nenhum corpo passa do limite (32 sem mola, 8 com mola)', () => {
    // 12 nós grandes empilhados no mesmo ponto: a colisão empurra forte.
    const nodes = Array.from({ length: 12 }, (_, i) => `n${i}: { nodeLayers: [g], size: [200, 100] }`).join('\n');
    const conns = Array.from({ length: 11 }, (_, i) => `  - [n${i}, n${i + 1}]`).join('\n');
    const src = `connections:\n${conns}\n${nodes}\n`;
    for (const [opts, cap] of [[{}, 32], [{ connectivitySpring: true }, 8]]) {
      const s = startLayoutV2(ir(src), { live: { engine: 'v2', ...opts } });
      const { speeds } = runRecording(s, 300);
      const vmax = Math.max(...speeds);
      // cap por eixo (como no v1): a norma fica abaixo de cap·√2
      assert.ok(vmax <= cap * Math.SQRT2 + 1e-6, `vmax=${vmax} cap=${cap}`);
    }
  });
});

describe('layout/compile-world — warm start e semente estável (R04)', () => {
  const BASE = `
connections:
  - [a, b]
  - [b, c]
  - [c, d]
a: { nodeLayers: [g], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
c: { nodeLayers: [g], size: [40, 30] }
d: { nodeLayers: [g], size: [40, 30] }
`;
  const settle = (s) => { runUntilSettled(s, 2000); return s; };
  const seedOf = (s) => {
    const m = new Map();
    for (const [id, r] of s.positions) m.set(id, r);
    for (const [id, r] of s.containers) if (!m.has(id)) m.set(id, r);
    return m;
  };
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  test('reabrir a mesma cena semeada não move os nós', () => {
    const s0 = settle(startLayoutV2(ir(BASE), { live: { engine: 'v2' } }));
    const s1 = startLayoutV2(ir(BASE), { live: { engine: 'v2', seedPositions: seedOf(s0), seedAlpha: s0.alpha } });
    s1.tick();
    for (const id of ['a', 'b', 'c', 'd']) {
      assert.ok(dist(s1.positions.get(id), s0.positions.get(id)) < 1, `${id} após 1 tick`);
    }
    settle(s1);
    for (const id of ['a', 'b', 'c', 'd']) {
      assert.ok(dist(s1.positions.get(id), s0.positions.get(id)) < 5, `${id} após assentar`);
    }
  });

  test('+1 nó: existentes andam < 1 px no 1º tick e o novo nasce perto do vizinho', () => {
    const s0 = settle(startLayoutV2(ir(BASE), { live: { engine: 'v2' } }));
    const plus = BASE.replace('  - [c, d]\n', '  - [c, d]\n  - [d, e]\n') + 'e: { nodeLayers: [g], size: [40, 30] }\n';
    const s1 = startLayoutV2(ir(plus), { live: { engine: 'v2', seedPositions: seedOf(s0), seedAlpha: s0.alpha } });
    const e0 = s1.positions.get('e');
    assert.ok(dist(e0, s0.positions.get('d')) < 120, 'e nasce junto de d (vizinho semeado)');
    s1.tick();
    for (const id of ['a', 'b', 'c']) {
      assert.ok(dist(s1.positions.get(id), s0.positions.get(id)) < 1, `${id} após 1 tick`);
    }
  });

  test('a ordem dos blocos no YAML não muda o layout', () => {
    const lines = BASE.trim().split('\n');
    const head = lines.slice(0, 4), nodes = lines.slice(4);
    const reversed = [...head, ...nodes.reverse()].join('\n') + '\n';
    const s0 = settle(startLayoutV2(ir(BASE), { live: { engine: 'v2' } }));
    const s1 = settle(startLayoutV2(ir(reversed), { live: { engine: 'v2' } }));
    for (const id of ['a', 'b', 'c', 'd']) {
      assert.ok(dist(s1.positions.get(id), s0.positions.get(id)) < 1, `${id}: ${JSON.stringify(s0.positions.get(id))} × ${JSON.stringify(s1.positions.get(id))}`);
    }
  });
});

describe('layout/compile-world — nó novo sem vizinho no warm restart (R04)', () => {
  test('nasce num lugar livre e não empurra os existentes no 1º tick', () => {
    const BASE = `
connections:
  - [a, b]
a: { nodeLayers: [g], size: [40, 30] }
b: { nodeLayers: [g], size: [40, 30] }
`;
    const s0 = startLayoutV2(ir(BASE), { live: { engine: 'v2' } });
    runUntilSettled(s0, 2000);
    const seed = new Map(s0.positions);
    const s1 = startLayoutV2(ir(BASE + 'z: { nodeLayers: [g], size: [40, 30] }\n'), { live: { engine: 'v2', seedPositions: seed, seedAlpha: s0.alpha } });
    s1.tick();
    for (const id of ['a', 'b']) {
      const p = s1.positions.get(id), q = s0.positions.get(id);
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1, `${id} após 1 tick`);
    }
  });
});
