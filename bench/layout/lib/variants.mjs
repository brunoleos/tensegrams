// Variantes de layout e o runner headless.
//
// Uma VARIANTE é { name, run(ir, graph, ctx) => Promise<RunResult> }.
//   ctx = { prev: Layout|null (warm start), prevAlpha: number, maxTicks,
//           onTick?: (positions, tick) => void  (só variantes animadas) }
//   RunResult = { layout: {positions, containers}, ticks, ticksKinetic,
//                 ended, timeMs, msPerTick, warm: bool }
//
// Internas: adapters reais do repo dirigidos por session.tick() (no Node não há
// requestAnimationFrame — ver tests/layout/adapters/live.test.js:7-8).
// Externas: externalVariant(name, fn) embrulha qualquer função
//   fn(graph, { ir, prev }) => positions | { positions, containers }   (sync/async)
import { performance } from 'node:perf_hooks';
import { ADAPTERS } from './repo.mjs';
import { deriveContainers, normalizePositions } from './graph.mjs';

const KIN_EPS = 0.1;     // px/tick: abaixo disso o corpo está "parado"
const KIN_WINDOW = 20;   // ticks consecutivos parados → assentado

function snapshot(session) {
  const cp = (m) => new Map([...m].map(([k, r]) => [k, { x: r.x, y: r.y, width: r.width, height: r.height }]));
  return { positions: cp(session.positions), containers: cp(session.containers || new Map()) };
}

function maxStep(prevPos, pos) {
  let m = 0;
  for (const [id, r] of pos) {
    const p = prevPos.get(id);
    if (!p) continue;
    const d = Math.max(Math.abs(r.x - p.x), Math.abs(r.y - p.y));
    if (d > m) m = d;
  }
  return m;
}

// Replica o warm start do pipeline (src/app/pipeline.js:121-151).
function seedOpts(prev, prevAlpha) {
  if (!prev) return {};
  const seedPositions = new Map();
  for (const [id, r] of prev.positions) seedPositions.set(id, r);
  for (const [id, r] of prev.containers || []) if (!seedPositions.has(id)) seedPositions.set(id, r);
  return { seedPositions, seedAlpha: prevAlpha ?? 0 };
}

export function liveVariant(name, liveOpts = {}, extraOpts = {}) {
  return {
    name,
    async run(ir, _graph, ctx = {}) {
      const maxTicks = ctx.maxTicks ?? 1500;
      const opts = { ...extraOpts, live: { ...liveOpts, ...seedOpts(ctx.prev, ctx.prevAlpha) } };
      const t0 = performance.now();
      const session = ADAPTERS.live.start(ir, opts);
      let ended = false;
      session.on('end', () => { ended = true; });
      const alphaMin = liveOpts.alphaMin ?? 0.003;
      if (session.alpha <= alphaMin) ended = true; // tudo pinado (mesmo critério do motor)
      let ticks = 0, still = 0, ticksKinetic = null, tKin = null;
      let prevPos = snapshot(session).positions;
      if (ctx.onTick) ctx.onTick(session.positions, 0);
      while (!ended && ticks < maxTicks) {
        session.tick();
        ticks++;
        const pos = session.positions;
        if (ctx.onTick) ctx.onTick(pos, ticks);
        const ms = maxStep(prevPos, pos);
        prevPos = new Map([...pos].map(([k, r]) => [k, { x: r.x, y: r.y }]));
        if (ms < KIN_EPS) { still++; if (still >= KIN_WINDOW && ticksKinetic == null) { ticksKinetic = ticks - KIN_WINDOW; tKin = performance.now() - t0; } }
        else still = 0;
      }
      const timeMs = performance.now() - t0;
      const layout = snapshot(session);
      const alpha = session.alpha;
      session.stop();
      return { layout, ticks, ticksKinetic, tKinMs: tKin, ended, timeMs, msPerTick: ticks ? timeMs / ticks : timeMs, warm: !!ctx.prev, alpha };
    },
  };
}

export function staticVariant(name, adapterId, extraOpts = {}) {
  return {
    name,
    async run(ir) {
      const t0 = performance.now();
      const session = ADAPTERS[adapterId].start(ir, { ...extraOpts });
      const timeMs = performance.now() - t0;
      const layout = snapshot(session);
      session.stop();
      return { layout, ticks: 0, ticksKinetic: 0, tKinMs: timeMs, ended: true, timeMs, msPerTick: timeMs, warm: false, alpha: 0 };
    },
  };
}

// Layout EXTERNO: fn(graph, { ir, prev }) devolve posições das folhas
// (Map ou objeto {id:{x,y[,width,height]}}, top-left por default) e,
// opcionalmente, containers. `anchor: 'center'` se a lib devolve centros.
export function externalVariant(name, fn, { anchor = 'topleft' } = {}) {
  return {
    name,
    async run(ir, graph, ctx = {}) {
      const t0 = performance.now();
      const out = await fn(graph, { ir, prev: ctx.prev || null });
      const timeMs = performance.now() - t0;
      const rawPos = out && (out.positions || out);
      const positions = normalizePositions(graph, rawPos, anchor);
      const containers = out && out.containers
        ? (out.containers instanceof Map ? out.containers : new Map(Object.entries(out.containers)))
        : deriveContainers(graph, positions);
      return { layout: { positions, containers }, ticks: out?.ticks ?? 0, ticksKinetic: out?.ticks ?? 0, tKinMs: timeMs, ended: true, timeMs, msPerTick: timeMs, warm: !!ctx.prev, alpha: 0 };
    },
  };
}

export const BUILTIN_VARIANTS = [
  liveVariant('live-v1'),
  liveVariant('live-v2', { engine: 'v2' }),
  liveVariant('live-v2+spring', { engine: 'v2', connectivitySpring: true }),
  staticVariant('custom', 'custom'),
  staticVariant('off', 'off'),
];
