// Fumaça da bancada de layout (bench/layout): garante que ela continua rodando
// contra o src/ atual, para não apodrecer fora da suíte.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { builtinScenarios } from '../../bench/layout/lib/scenarios.mjs';
import { BUILTIN_VARIANTS } from '../../bench/layout/lib/variants.mjs';
import { evaluate } from '../../bench/layout/lib/evaluate.mjs';
import gridPack from '../../bench/layout/example-external.mjs';

const variant = (name) => BUILTIN_VARIANTS.find((v) => v.name === name);

describe('bench/layout — fumaça', () => {
  test('seleciona cenários por nome e gera sintéticos por seed', () => {
    const one = builtinScenarios({ include: ['ex:quad'] });
    assert.deepEqual(one.map((s) => s.name), ['ex:quad']);
    const seeded = builtinScenarios({ include: ['syn:30'], seeds: [1, 2] });
    assert.deepEqual(seeded.map((s) => s.name), ['syn:30@s1', 'syn:30@s2']);
    assert.notEqual(seeded[0].yaml, seeded[1].yaml, 'seeds diferentes geram grafos diferentes');
  });

  test('live-v2 termina (emite end) e é determinístico no ex:quad', async () => {
    const [scenario] = builtinScenarios({ include: ['ex:quad'] });
    const rec = await evaluate(scenario, variant('live-v2'), { stability: false, perturb: false });
    assert.equal(rec.ended, true, 'v2 emite end antes de --max-ticks');
    assert.ok(rec.ticks > 0 && rec.ticks < 1500, `ticks=${rec.ticks}`);
    assert.equal(rec.deterministic, true);
    assert.equal(typeof rec.colViol, 'number');
  });

  test('layout externo plugável: grid-pack sem violação de colisão', async () => {
    const [scenario] = builtinScenarios({ include: ['ex:containers'] });
    const rec = await evaluate(scenario, gridPack, { stability: false, perturb: false, determinism: false });
    assert.equal(rec.variant, gridPack.name);
    assert.equal(rec.colViol, 0);
    assert.equal(rec.contain, 0);
  });
});
