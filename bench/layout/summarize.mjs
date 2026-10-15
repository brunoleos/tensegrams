#!/usr/bin/env node
// Junta vários results/*.json numa tabela compacta (colunas-chave).
//   node summarize.mjs results/main.json results/syn300-others.json results/syn300-v1.json > results/summary.md
import { readFileSync } from 'node:fs';
const rows = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const order = ['ex:quad', 'ex:intro', 'ex:containers', 'ex:forces', 'syn:30', 'syn:100', 'syn:300', 'probe:deep6', 'probe:deep6-childfirst'];
const vorder = ['live-v1', 'live-v2', 'live-v2+spring', 'custom', 'off'];
rows.sort((a, b) => (order.indexOf(a.scenario) - order.indexOf(b.scenario)) || ((vorder.indexOf(a.variant) + 99) % 99 - (vorder.indexOf(b.variant) + 99) % 99));
const f = (v, d = 0) => v == null ? '–' : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(d)) : String(v));
const kpx = (v) => v == null ? '–' : (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : (v / 1e3).toFixed(0) + 'k');
console.log('| cenário | variante | ticks (end?) | assenta em | ms/tick | viol. colisão | overlap folhas | contenção | bbox px² (aspecto) | densid. | aresta/diag | cruzam. | aresta×nó | determ. | reaquec. final/pico px | Δ cold px | Δ warm final/pico px |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.scenario} | ${r.variant} | ${r.ticks}${r.ended ? '' : ' (NÃO)'} | ${f(r.ticksKinetic)} | ${f(r.msPerTick, 2)} | ${r.colViol} | ${r.ovAll} | ${r.contain} | ${kpx(r.bboxArea)} (${f(r.aspect, 2)}) | ${f(r.density, 2)} | ${f(r.edgeLenNorm, 2)} | ${r.crossings} | ${r.edgeThruNode} | ${r.deterministic == null ? '–' : (r.deterministic ? 'sim' : 'NÃO')} | ${f(r.reheatDrift, 1)}/${f(r.reheatTransient, 1)} | ${f(r.pertCold, 1)} | ${f(r.pertWarm, 1)}/${f(r.pertWarmTransient, 1)} |`);
}
