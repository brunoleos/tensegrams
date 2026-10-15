// Cenários: exemplos embutidos (src/dsl/examples.js) + sintéticos determinísticos
// (YAML gerado com PRNG semeado, passando pelo parser real) + perturbações.
import { EXAMPLES, irFromYaml } from './repo.mjs';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grafo sintético com containers aninhados (até maxDepth níveis).
// Colisão: irmãos (mesmo pai) compartilham a layer `g_<pai>` — mesmo padrão do
// exemplo `containers` (topo / mod / dado por nível).
export function synthYaml(N, { seed = 1, containerFrac = 0.15, maxDepth = 3, edgeFactor = 1.3, collide = true } = {}) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const nC = Math.max(1, Math.round(N * containerFrac));
  const nL = N - nC;
  const conts = [];
  for (let i = 0; i < nC; i++) {
    const candidates = conts.filter((c) => c.depth < maxDepth - 1);
    const parent = i === 0 || rnd() < 0.35 || !candidates.length ? null : pick(candidates);
    conts.push({ id: `c${i}`, parent: parent ? parent.id : null, depth: parent ? parent.depth + 1 : 0 });
  }
  const leaves = [];
  for (let i = 0; i < nL; i++) {
    // garante >=1 filho por container; depois 20% raiz, resto aleatório
    let parent = null;
    if (i < nC) parent = conts[nC - 1 - i].id;
    else if (rnd() >= 0.2) parent = pick(conts).id;
    leaves.push({ id: `n${i}`, parent, w: 100 + Math.round(rnd() * 80), h: 40 + Math.round(rnd() * 20) });
  }
  const byParent = new Map();
  for (const l of leaves) { const k = l.parent || ''; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(l); }
  const edges = new Set();
  const addEdge = (a, b) => { if (a === b) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; edges.add(k); };
  for (const l of leaves) {
    const sib = byParent.get(l.parent || '');
    if (rnd() < 0.7 && sib.length > 1) addEdge(l.id, pick(sib).id);
    else addEdge(l.id, pick(leaves).id);
  }
  let guard = 0;
  while (edges.size < Math.round(N * edgeFactor) - Math.round(N * 0.03) && guard++ < N * 20) addEdge(pick(leaves).id, pick(leaves).id);
  for (let i = 0; i < Math.round(N * 0.03); i++) addEdge(pick(conts).id, pick(leaves).id);

  const lines = ['options:', `  title: synth-${N}`, '', 'connections:'];
  for (const k of edges) { const [a, b] = k.split('|'); lines.push(`  - [${a}, ${b}]`); }
  lines.push('');
  for (const c of conts) {
    lines.push(`${c.id}:`);
    lines.push(`  label: ${c.id.toUpperCase()}`);
    if (c.parent) lines.push(`  parent: ${c.parent}`);
    if (collide) lines.push(`  nodeLayers: [g_${c.parent || 'root'}]`);
  }
  for (const l of leaves) {
    lines.push(`${l.id}:`);
    if (l.parent) lines.push(`  parent: ${l.parent}`);
    lines.push(`  size: [${l.w}, ${l.h}]`);
    if (collide) lines.push(`  nodeLayers: [g_${l.parent || 'root'}]`);
  }
  return lines.join('\n') + '\n';
}

// Sonda: cadeia de containers aninhados com profundidade `depth`.
// childFirst=true declara os filhos ANTES dos pais no YAML (a ordem da IR segue
// a ordem de declaração — src/dsl/ir.js:72-93).
export function deepChainYaml(depth = 6, { childFirst = false } = {}) {
  const blocks = [];
  for (let i = 0; i < depth; i++) {
    const b = [`d${i}:`, `  label: D${i}`];
    if (i > 0) b.push(`  parent: d${i - 1}`);
    b.push(`  nodeLayers: [g_${i > 0 ? `d${i - 1}` : 'root'}]`);
    blocks.push(b.join('\n'));
    blocks.push([`x${i}:`, `  parent: d${i}`, `  nodeLayers: [g_d${i}]`].join('\n'));
  }
  blocks.push(['r0:', '  nodeLayers: [g_root]'].join('\n'));
  if (childFirst) blocks.reverse();
  const conns = ['connections:'];
  for (let i = 0; i + 1 < depth; i++) conns.push(`  - [x${i}, x${i + 1}]`);
  conns.push(`  - [r0, x${depth - 1}]`);
  return `options:\n  title: deep-${depth}\n\n${conns.join('\n')}\n\n${blocks.join('\n')}\n`;
}

// seeds: null = uma seed fixa por tamanho (30/100/300, comparável com as
// medições da avaliação de 2026-09-30); lista = cada sintético em cada seed,
// nomeado `syn:N@sK`.
export function builtinScenarios({ include = null, seeds = null } = {}) {
  const out = [];
  for (const [name, src] of Object.entries(EXAMPLES)) out.push({ name: `ex:${name}`, yaml: src });
  for (const N of [30, 100, 300]) {
    if (!seeds) out.push({ name: `syn:${N}`, yaml: synthYaml(N, { seed: N }) });
    else for (const k of seeds) out.push({ name: `syn:${N}@s${k}`, yaml: synthYaml(N, { seed: k }) });
  }
  out.push({ name: 'probe:deep6', yaml: deepChainYaml(6) });
  out.push({ name: 'probe:deep6-childfirst', yaml: deepChainYaml(6, { childFirst: true }) });
  for (const s of out) s.ir = irFromYaml(s.yaml);
  // match exato, ou prefixo terminado em ':' (ex.: 'ex:', 'probe:', 'syn:')
  // match exato (ignorando o sufixo @sK de seed), ou prefixo terminado em ':' (ex.: 'ex:', 'probe:', 'syn:')
  const base = (n) => n.split('@')[0];
  return include ? out.filter((s) => include.some((p) => s.name === p || base(s.name) === p || (p.endsWith(':') && s.name.startsWith(p)))) : out;
}

// ---------------------------------------------------------------------------
// Perturbações em nível de IR (o que o usuário faz ao editar o YAML):
// remover/adicionar 1 aresta, adicionar/remover 1 folha. Determinísticas.
// ---------------------------------------------------------------------------
function leafIdsOf(ir) {
  const childIdSet = new Set(ir.nodes.filter((n) => n.parent).map((n) => n.parent));
  return ir.nodes.filter((n) => !(n.hasChildren && childIdSet.has(n.id))).map((n) => n.id);
}
function mkEdge(a, b) {
  return {
    id: `e:pert:${a}:${b}`, canonical: `pert:${a}:${b}`, source: a, target: b, parallelKey: null,
    label: '', layers: [], nodeCollision: new Map(), edgeCollision: new Map(),
    snap: 'inherit', onHidden: 'omit', startStyle: 'none', endStyle: 'none', _line: 0,
  };
}

export function perturbations(ir) {
  const out = [];
  const leaves = leafIdsOf(ir).filter((id) => {
    const n = ir.nodes.find((m) => m.id === id);
    return !n.pinned && !n.hasChildren;
  });
  if (ir.edges.length) {
    const e = ir.edges[Math.floor(ir.edges.length / 2)];
    out.push({ kind: 'rmEdge', desc: `remove ${e.id}`, ir: { ...ir, edges: ir.edges.filter((x) => x !== e) }, moved: null });
  }
  if (leaves.length >= 3) {
    const adj = new Set(ir.edges.map((e) => `${e.source}|${e.target}`));
    let pair = null;
    for (let i = 0; i < leaves.length && !pair; i++) {
      const a = leaves[i], b = leaves[(i + Math.floor(leaves.length / 2)) % leaves.length];
      if (a !== b && !adj.has(`${a}|${b}`) && !adj.has(`${b}|${a}`)) pair = [a, b];
    }
    if (pair) out.push({ kind: 'addEdge', desc: `add ${pair.join('-')}`, ir: { ...ir, edges: [...ir.edges, mkEdge(pair[0], pair[1])] } });
  }
  if (leaves.length) {
    const sibId = leaves[Math.floor(leaves.length / 3)];
    const sib = ir.nodes.find((n) => n.id === sibId);
    const nn = { ...sib, id: '__pert_new', label: 'Novo', pinned: false, constraint: null, forces: null, nodeCollision: new Map(sib.nodeCollision), layers: [...sib.layers] };
    out.push({ kind: 'addNode', desc: `add node ao lado de ${sibId}`, ir: { ...ir, nodes: [...ir.nodes, nn], edges: [...ir.edges, mkEdge(sibId, '__pert_new')] } });
  }
  if (leaves.length >= 3) {
    // remove folha que não seja filho único (não esvazia container)
    const cand = leaves.filter((id) => {
      const n = ir.nodes.find((m) => m.id === id);
      return !n.parent || ir.nodes.filter((m) => m.parent === n.parent).length > 1;
    });
    const rid = cand[Math.floor(cand.length * 2 / 3)];
    if (rid) {
      out.push({ kind: 'rmNode', desc: `remove ${rid}`, ir: { ...ir, nodes: ir.nodes.filter((n) => n.id !== rid), edges: ir.edges.filter((e) => e.source !== rid && e.target !== rid) } });
    }
  }
  return out;
}
