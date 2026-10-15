#!/usr/bin/env node
// CLI do harness.
//   node run.mjs [--scenarios ex:,syn:30] [--variants live-v1,live-v2] [--max-ticks 1500]
//                [--seeds 1,2,3] [--no-stability] [--no-determinism] [--reheat-only] [--external ./meu-layout.mjs]
//                [--out results/results.json] [--md results/table.md]
// --external: módulo que exporta `default` (ou `variants`) = variante(s) criadas com
//             externalVariant(); entram na mesma tabela das internas.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { builtinScenarios } from './lib/scenarios.mjs';
import { BUILTIN_VARIANTS } from './lib/variants.mjs';
import { evaluate } from './lib/evaluate.mjs';
import { toMarkdown } from './lib/report.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);

const seeds = arg('--seeds') ? arg('--seeds').split(',').map(Number) : null;
const scen = builtinScenarios({ include: arg('--scenarios') ? arg('--scenarios').split(',') : null, seeds });
let variants = BUILTIN_VARIANTS;
if (arg('--external')) {
  const mod = await import(pathToFileURL(resolve(arg('--external'))).href);
  const ext = mod.variants || (Array.isArray(mod.default) ? mod.default : [mod.default]);
  variants = has('--only-external') ? ext : [...variants, ...ext];
}
if (arg('--variants')) { const want = arg('--variants').split(','); variants = variants.filter((v) => want.includes(v.name)); }
const maxTicks = Number(arg('--max-ticks', 1500));
const out = arg('--out', resolve(dirname(new URL(import.meta.url).pathname), 'results/results.json'));
const md = arg('--md', out.replace(/\.json$/, '.md'));

const rows = [];
for (const s of scen) {
  for (const v of variants) {
    const big = s.ir.nodes.length > 150;
    const rec = await evaluate(s, v, {
      maxTicks,
      stability: !has('--no-stability') && !(big && has('--no-stability-big')),
      determinism: !has('--no-determinism') && !(big && has('--no-determinism-big')),
      perturb: !has('--reheat-only'),
    });
    rows.push(rec);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(rows, null, 2)); // incremental: sobrevive a interrupção
    console.error(`${s.name.padEnd(24)} ${v.name.padEnd(16)} ticks=${String(rec.ticks).padStart(4)} ended=${rec.ended} kin=${rec.ticksKinetic} ` +
      `viol=${rec.colViol} ovAll=${rec.ovAll} intr=${rec.intrusion} cont=${rec.contain} X=${rec.crossings} ` +
      `t=${rec.timeMs}ms det=${rec.deterministic} warm=${rec.pertWarm ?? '-'}`);
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rows, null, 2));
writeFileSync(md, toMarkdown(rows));
console.error(`\n→ ${out}\n→ ${md}`);
