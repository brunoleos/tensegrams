// Orquestra: roda uma variante sobre um cenário e mede qualidade, custo,
// determinismo e estabilidade a perturbação (cold e warm start).
import { graphFromIR } from './graph.mjs';
import { computeMetrics, displacement, maxPositionDiff } from './metrics.mjs';
import { perturbations } from './scenarios.mjs';

export async function evaluate(scenario, variant, opts = {}) {
  const { determinism = true, stability = true, perturb = true, maxTicks = 1500 } = opts;
  const ir = scenario.ir;
  const graph = graphFromIR(ir);
  const base = await variant.run(ir, graph, { maxTicks });
  const metrics = computeMetrics(graph, base.layout);
  const rec = {
    scenario: scenario.name, variant: variant.name,
    ticks: base.ticks, ended: base.ended, ticksKinetic: base.ticksKinetic,
    timeMs: +base.timeMs.toFixed(1), tKinMs: base.tKinMs == null ? null : +base.tKinMs.toFixed(1),
    msPerTick: +base.msPerTick.toFixed(3), alphaFinal: base.alpha,
    ...metrics,
  };
  if (determinism) {
    const again = await variant.run(ir, graph, { maxTicks });
    rec.detMaxDiff = maxPositionDiff(base.layout, again.layout);
    rec.deterministic = rec.detMaxDiff === 0;
  }
  if (stability) {
    // Reaquecimento sem mudança (ex.: editar só o label de uma aresta): warm
    // restart da MESMA IR. Ideal = 0 px.
    // `transient` = pior deslocamento médio (vs. layout anterior) visto em
    // QUALQUER frame da animação — captura "re-explosão" que o estado final esconde.
    const tr = transientTracker(base.layout);
    const re = await variant.run(ir, graph, { maxTicks, prev: base.layout, prevAlpha: base.alpha, onTick: tr.onTick });
    const dr = displacement(base.layout, re.layout);
    rec.reheatDrift = +dr.raw.toFixed(1);
    rec.reheatDriftMax = +dr.max.toFixed(1);
    rec.reheatTransient = +Math.max(tr.max, dr.raw).toFixed(1);
    const perts = perturb ? perturbations(ir) : [];
    const cold = [], warm = [];
    const diag = Math.hypot(metrics.bboxW, metrics.bboxH) || 1;
    rec.perturbations = [];
    for (const p of perts) {
      const g2 = graphFromIR(p.ir);
      // só os nós que existem nos dois (e não o recém-criado)
      const ids = new Set(g2.nodes.filter((n) => !n.isContainer && n.id !== '__pert_new').map((n) => n.id));
      const c = await variant.run(p.ir, g2, { maxTicks });
      const trw = transientTracker(base.layout, ids);
      const w = await variant.run(p.ir, g2, { maxTicks, prev: base.layout, prevAlpha: base.alpha, onTick: trw.onTick });
      const dc = displacement(base.layout, c.layout, ids);
      const dw = displacement(base.layout, w.layout, ids);
      dw.transient = Math.max(trw.max, dw.raw);
      cold.push(dc); warm.push(dw);
      rec.perturbations.push({ kind: p.kind, desc: p.desc, cold: round(dc), warm: { ...round(dw), transient: +dw.transient.toFixed(1) }, warmTicks: w.ticks });
    }
    const avg = (arr, k) => arr.length ? arr.reduce((s, d) => s + d[k], 0) / arr.length : 0;
    if (!perts.length) return rec;
    rec.pertCold = +avg(cold, 'raw').toFixed(1);
    rec.pertColdAligned = +avg(cold, 'aligned').toFixed(1);
    rec.pertWarm = +avg(warm, 'raw').toFixed(1);
    rec.pertWarmAligned = +avg(warm, 'aligned').toFixed(1);
    rec.pertWarmTransient = +avg(warm, 'transient').toFixed(1);
    rec.pertWarmPctDiag = +(100 * avg(warm, 'raw') / diag).toFixed(1);
    rec.pertColdPctDiag = +(100 * avg(cold, 'raw') / diag).toFixed(1);
  }
  return rec;
}

function transientTracker(baseLayout, ids = null) {
  const t = { max: 0 };
  t.onTick = (positions) => {
    const d = displacement(baseLayout, { positions }, ids);
    if (d.raw > t.max) t.max = d.raw;
  };
  return t;
}

function round(d) { return { raw: +d.raw.toFixed(1), aligned: +d.aligned.toFixed(1), max: +d.max.toFixed(1), n: d.n }; }
