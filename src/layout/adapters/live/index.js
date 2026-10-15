// 'live' adapter: force-directed simulation honoring pins, constraints,
// and tag-based attract/repel forces from the DSL. Streaming session:
// emits 'tick' continuously while alpha > min, then 'end' once.
//
// Positions are stored internally as node CENTERS; the public `positions`
// map exposes top-left coords (same contract as the other adapters).
//
// Per-instance tuning comes from opts.live (merged from the JSON config
// panel in the UI). See DEFAULTS below for every knob.

import { DEFAULT_OPTIONS } from '../../adapter.js';
import { startLayoutV2 } from '../../compile-world.js';
import { buildCollisionResolver } from '../../collision.js';
import { setsEqual, freezeOthersForDrag, unfreezeOthersAfterRelease } from './pins.js';
import { HEADER } from './container-geometry.js';
import { resolveCollisions, separateBodiesHard } from './collision-resolution.js';
import { createWaypointState, stepWaypoints, commitWaypoints } from './collision-waypoints.js';

const DEFAULTS = {
  center: 0.012,         // central attractor — the only baseline force
  tagAttract: 60,
  tagRepel: 4000,
  damping: 0.82,
  collision: true,       // overlap-resolving spring impulse on velocity
  collisionK: 0.3,       // collision spring stiffness (elastic+damped feel)
  collisionPadding: 12,  // extra gap beyond touching
  waypointSpring: 0.08,  // pull on an edge waypoint toward its midline
  alphaDecay: 0.012,     // ~50% mais settle vs 0.018 — diagramas complexos têm tempo de acomodar
  alphaMin: 0.003,
  alphaKick: 0.5,   // reaquecimento de drag/release
  // alpha mínimo de um warm restart (edição da DSL/config). Separado do
  // alphaKick: reaquecer a 0,5 a cada edição deslocava a cena ~76 px.
  warmKick: 0.05,
  maxVel: 32,
  // Interaction model — two modes that differ ONLY during a drag:
  //   'frozen' (default): while a body is dragged, every OTHER non-DSL
  //     body is temporarily pinned so the rest of the diagram doesn't
  //     shimmy. On release, EVERY body — including the just-dropped one
  //     — re-enters the simulation and settles via forces and weighted
  //     collision; nothing stays pinned at the drop point.
  //   'flow': classic force-directed feel — nothing is frozen, even
  //     during the drag. Opt-in via opts.live.interactionMode.
  //   DSL-pinned bodies are always pinned, regardless of mode.
  interactionMode: 'frozen',
};

export const adapter = {
  id: 'live',
  label: 'Live (forças)',
  caps: { containers: true, ports: false, layered: false, interactive: true, providesRouting: false },
  async load() { /* nothing */ },
  start(ir, opts = {}) {
    // Cutover atrás de flag: `cfg.live.engine === 'v2'` usa o motor de física
    // unificado (src/physics/ via compile-world). Default segue no v1 legado.
    if (opts.live && opts.live.engine === 'v2') {
      return startLayoutV2(ir, opts);
    }
    return runSession(ir, { ...DEFAULT_OPTIONS, ...opts });
  },
};

function runSession(ir, opts) {
  const cfg = { ...DEFAULTS, ...(opts.live || {}) };
  // Collision padding is a global knob (`collision.nodePad`) shared by
  // every layout; fall back to the live default when absent.
  if (opts.collision?.nodePad != null) cfg.collisionPadding = opts.collision.nodePad;
  // Label collision knobs (collision.labelPad / collision.labels) lifted
  // into the live cfg para que stepWaypoints leia direto.
  cfg.labelPad = opts.collision?.labelPad ?? 6;
  cfg.labelCollision = opts.collision?.labels !== false;
  // Collision model is derived straight from the IR — collision layers
  // are declared inline in the DSL (nodeCollision/edgeCollision), not in
  // JSON config. Edge-anchor correctness against foreign containers is
  // enforced downstream by `clipAnchorsToContainerFaces`.
  const collision = buildCollisionResolver(ir);
  // One virtual waypoint per edge that declares a collision label; the
  // obstacle router threads the edge through it.
  const waypoints = createWaypointState(ir, collision);

  // Simulation BODIES = anything that needs its own px/py:
  //   - nodes without children (leaves)
  //   - empty containers (hasChildren=true but no surviving descendant in
  //     this IR — typically a container whose subtree was layer-filtered
  //     away). They still need a position so the frame can render.
  // Containers WITH at least one descendant derive their rect from the
  // descendants' bbox (the `containersWithChildren` set, below).
  const childIdSet = new Set(ir.nodes.filter(n => n.parent).map(n => n.parent));
  const leaves = ir.nodes.filter(n => !n.hasChildren || !childIdSet.has(n.id));
  const containersWithChildren = ir.nodes.filter(n => n.hasChildren && childIdSet.has(n.id));
  const containers = ir.nodes.filter(n => n.hasChildren); // ALL nodes that render as container
  const idToIndex = new Map();
  const N = leaves.length;

  // Physics state — center coords, separate arrays for tight loops.
  const px = new Float64Array(N);
  const py = new Float64Array(N);
  const vx = new Float64Array(N);
  const vy = new Float64Array(N);
  const fx = new Array(N).fill(null);
  const fy = new Array(N).fill(null);

  for (let i = 0; i < N; i++) {
    const n = leaves[i];
    idToIndex.set(n.id, i);
    if (n.pinned) {
      const cx = n.pinned.x + n.width / 2;
      const cy = n.pinned.y + n.height / 2;
      px[i] = cx; py[i] = cy;
      fx[i] = cx; fy[i] = cy;
    } else if (cfg.seedPositions && cfg.seedPositions.has(n.id)) {
      // Continuity: reuse the last frame's center so DSL/config edits
      // feel like a smooth readjustment instead of re-exploding from
      // the default circle seed. New bodies (no seed entry) still
      // start on the circle below.
      const prev = cfg.seedPositions.get(n.id);
      px[i] = prev.x + prev.width / 2;
      py[i] = prev.y + prev.height / 2;
    } else {
      // Seed on a circle — gives the collision resolver a non-degenerate
      // starting spread before the central attractor pulls everything in.
      const a = (i / Math.max(1, N)) * Math.PI * 2;
      const r = 180 + 35 * (i % 4);
      px[i] = Math.cos(a) * r;
      py[i] = Math.sin(a) * r;
    }
  }

  // Edges exert NO force — they are purely passive in this model. The
  // simulation never reads `ir.edges`; routing and obstacle waypoints
  // consume them downstream.

  // Tag → list of node indices (for attract/repel-by-tag).
  const tagToNodes = new Map();
  for (let i = 0; i < N; i++) {
    for (const t of leaves[i].layers) {
      let bucket = tagToNodes.get(t);
      if (!bucket) { bucket = []; tagToNodes.set(t, bucket); }
      bucket.push(i);
    }
  }

  const listeners = { tick: new Set(), end: new Set(), error: new Set() };
  let stopped = false;
  let endEmitted = false;
  let rafHandle = null;
  // Warm restart: when at least one body in the new IR matches the
  // seed snapshot (i.e. an in-place DSL/config edit, not a drill-in
  // or layout switch with disjoint ids), bound the starting alpha at
  // the kick so the diagram readjusts smoothly instead of re-exploding.
  // A cold start (no overlap with the seed) keeps the historical alpha=1
  // so new layouts still settle with full energy.
  const warmRestart = !!cfg.seedPositions
    && leaves.some(n => cfg.seedPositions.has(n.id));
  const warmAlpha = Math.max(cfg.seedAlpha || 0, cfg.warmKick);
  let alpha = anyFree() ? (warmRestart ? warmAlpha : 1) : 0;

  // Frozen-mode interaction state.
  //   currentDragSet: the bodies currently under the user's cursor.
  //                   Container drag selects multiple leaves at once;
  //                   single-leaf drag is the common case where the set
  //                   contains one index. While set, every OTHER
  //                   non-DSL-pinned body is frozen at its current
  //                   position (temporary pin via fx/fy).
  // On release: the released bodies become the new non-DSL pins; every
  // other body (including any previously-released one) is unfrozen —
  // there is no sticky / accumulating pin from prior drops.
  let currentDragSet = null;
  // Shared state view consumed by the sub-modules under `./`. Captured
  // once after the typed arrays exist; the references stay stable for
  // the lifetime of the session, so sub-modules can hold onto it.
  const engineState = {
    leaves, containers, containersWithChildren, idToIndex,
    px, py, vx, vy, fx, fy,
    ancestors: collision.ancestors,
    labelBBoxes: null,  // pointer atribuído após session existir (ver abaixo).
  };

  const session = {
    positions: new Map(),
    containers: new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    routedEdges: undefined,
    // Canal de feedback do renderer: após paint o renderer chama
    // session.reportLabelBBox(edgeId, {width, height}) com getBBox real
    // do label. O próximo tick lê isso em waypoints.labelDims e trata o
    // rect do label como obstáculo. 1-tick lag aceito (primeiro frame
    // desenha sem colisão de label).
    labelBBoxes: cfg.seedLabelBBoxes ? new Map(cfg.seedLabelBBoxes) : new Map(),
    reportLabelBBox(id, bbox) {
      if (bbox == null) session.labelBBoxes.delete(id);
      else session.labelBBoxes.set(id, bbox);
    },
    on(event, cb) {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    update(patch) {
      if (!patch) return;
      if (patch.drag) {
        // Accepts a single body or an array (container drag — every
        // descendant leaf moves together).
        const drags = Array.isArray(patch.drag) ? patch.drag : [patch.drag];
        const activeSet = new Set();
        for (const d of drags) {
          const i = idToIndex.get(d.id);
          if (i === undefined) continue;
          activeSet.add(i);
          const n = leaves[i];
          const cx = d.x + n.width / 2;
          const cy = d.y + n.height / 2;
          fx[i] = cx; fy[i] = cy;
          px[i] = cx; py[i] = cy;
          vx[i] = 0; vy[i] = 0;
        }
        if (activeSet.size === 0) return;
        // Drag start (frozen mode only): freeze every body OUTSIDE the
        // active set at its current position so the rest of the diagram
        // doesn't shimmy. If the user grabs a different body without
        // releasing the previous, the previous stays in fx/fy — natural.
        if (cfg.interactionMode === 'frozen' && !setsEqual(currentDragSet, activeSet)) {
          freezeOthersForDrag(engineState, activeSet);
          currentDragSet = activeSet;
        }
        alpha = Math.max(alpha, cfg.alphaKick);
        ensureRunning();
      }
      if (patch.release) {
        const releases = Array.isArray(patch.release) ? patch.release : [patch.release];
        const activeSet = new Set();
        for (const id of releases) {
          const i = idToIndex.get(id);
          if (i === undefined) continue;
          activeSet.add(i);
          const n = leaves[i];
          if (n.pinned) {
            // DSL pins always win — snap back to declared pin.
            fx[i] = n.pinned.x + n.width / 2;
            fy[i] = n.pinned.y + n.height / 2;
          } else {
            // Release returns the body to the simulation: it rejoins the
            // forces and weighted collision with its own weight. It is
            // never left pinned at the drop point — with weighted
            // collision that no longer makes sense.
            fx[i] = null; fy[i] = null;
          }
        }
        if (activeSet.size === 0) return;
        if (cfg.interactionMode === 'frozen') {
          // Everything OUTSIDE the released group is unfrozen and
          // rejoins the simulation. No accumulated pins from prior
          // drops survive.
          unfreezeOthersAfterRelease(engineState, activeSet);
        }
        if (currentDragSet) {
          for (const i of activeSet) currentDragSet.delete(i);
          if (currentDragSet.size === 0) currentDragSet = null;
        }
        alpha = Math.max(alpha, cfg.alphaKick);
        ensureRunning();
      }
    },
    stop() {
      stopped = true;
      cancelLoop();
    },
    tick() { step(); },
    get alpha() { return alpha; },
  };
  // Engine state expõe o Map de labelBBoxes da sessão para
  // collision-waypoints consumir como obstáculos no próximo tick.
  engineState.labelBBoxes = session.labelBBoxes;

  function anyFree() {
    for (let i = 0; i < N; i++) if (fx[i] == null) return true;
    return false;
  }

  function emit(event) {
    for (const cb of listeners[event]) cb(session);
  }

  function step() {
    if (stopped) return;

    // Central attractor — the only baseline force. Pulls every body
    // toward the board origin; edges exert nothing. Together with
    // the velocity damping applied below it forms a spring-damped
    // system, so a body travels to the centre with an elastic feel —
    // that pairing IS the animation. Collision layers are the only
    // thing that spreads bodies back apart.
    for (let i = 0; i < N; i++) {
      vx[i] -= px[i] * cfg.center * alpha;
      vy[i] -= py[i] * cfg.center * alpha;
    }

    // Tag-based attract / repel.
    for (let i = 0; i < N; i++) {
      const forces = leaves[i].forces;
      if (!forces) continue;
      for (const [tag, str] of Object.entries(forces.attractTo || {})) {
        const bucket = tagToNodes.get(tag);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const f = cfg.tagAttract * str * alpha / d;
          vx[i] += (dx / d) * f * d / Math.max(d, 1);
          vy[i] += (dy / d) * f * d / Math.max(d, 1);
        }
      }
      for (const [tag, str] of Object.entries(forces.repelFrom || {})) {
        const bucket = tagToNodes.get(tag);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const d2 = dx * dx + dy * dy + 1;
          const d = Math.sqrt(d2);
          const f = cfg.tagRepel * str * alpha / d2;
          vx[i] -= (dx / d) * f;
          vy[i] -= (dy / d) * f;
        }
      }
    }

    // Collision impulse — overlap produces a spring force on velocity
    // (not a hard position snap). Combined with the damping applied in
    // the integrator below, bodies separate with an elastic, damped feel
    // instead of teleporting apart. Runs BEFORE the integrator so the
    // impulse becomes part of the same motion the integrator smooths.
    // `cfg.collision === false` is the kill-switch.
    if (cfg.collision) {
      resolveCollisions(engineState, cfg, collision);
    }

    // Integrate, clamp, apply constraints.
    for (let i = 0; i < N; i++) {
      if (fx[i] != null) { px[i] = fx[i]; vx[i] = 0; }
      else {
        vx[i] *= cfg.damping;
        if (vx[i] > cfg.maxVel) vx[i] = cfg.maxVel;
        else if (vx[i] < -cfg.maxVel) vx[i] = -cfg.maxVel;
        px[i] += vx[i];
      }
      if (fy[i] != null) { py[i] = fy[i]; vy[i] = 0; }
      else {
        vy[i] *= cfg.damping;
        if (vy[i] > cfg.maxVel) vy[i] = cfg.maxVel;
        else if (vy[i] < -cfg.maxVel) vy[i] = -cfg.maxVel;
        py[i] += vy[i];
      }
      applyConstraint(i);
    }

    // Hard separation: positions are FINAL for the tick — guarantee
    // same-layer padded BBoxes don't overlap at rest. The soft impulse above
    // gives the elastic feel during the animation; this pass kills the
    // residual overlap that the impulse alone leaves behind as alpha decays.
    if (cfg.collision) {
      separateBodiesHard(engineState, cfg, collision);
    }

    // Edge waypoints — read final node positions for this tick.
    if (cfg.collision) {
      stepWaypoints(waypoints, engineState, collision, cfg, alpha);
    }

    alpha = Math.max(0, alpha * (1 - cfg.alphaDecay));

    commitOutputs();
    emit('tick');

    if (alpha < cfg.alphaMin && !endEmitted) {
      endEmitted = true;
      emit('end');
      cancelLoop();
    } else if (alpha >= cfg.alphaMin) {
      endEmitted = false;
    }
  }


  function applyConstraint(i) {
    const c = leaves[i].constraint;
    if (!c) return;
    const n = leaves[i];
    const hw = n.width / 2, hh = n.height / 2;
    switch (c.type) {
      case 'axis':
        if (c.axis === 'x') { px[i] = c.value + hw; vx[i] = 0; }
        else                { py[i] = c.value + hh; vy[i] = 0; }
        break;
      case 'rect': {
        if (px[i] < c.x + hw)            { px[i] = c.x + hw;            vx[i] = 0; }
        if (px[i] > c.x + c.w - hw)      { px[i] = c.x + c.w - hw;      vx[i] = 0; }
        if (py[i] < c.y + hh)            { py[i] = c.y + hh;            vy[i] = 0; }
        if (py[i] > c.y + c.h - hh)      { py[i] = c.y + c.h - hh;      vy[i] = 0; }
        break;
      }
      case 'circle': {
        const dx = px[i] - c.cx;
        const dy = py[i] - c.cy;
        const d2 = dx * dx + dy * dy;
        const rMax = Math.max(0, c.r - Math.max(hw, hh));
        if (d2 > rMax * rMax && rMax > 0) {
          const d = Math.sqrt(d2);
          const k = rMax / d;
          px[i] = c.cx + dx * k;
          py[i] = c.cy + dy * k;
          vx[i] *= 0.5; vy[i] *= 0.5;
        }
        break;
      }
      case 'parent-bounds': {
        if (!n.parent) break;
        const rect = session.containers.get(n.parent);
        if (!rect) break;
        const innerX = rect.x;
        const innerY = rect.y + HEADER;
        const innerW = rect.width;
        const innerH = rect.height - HEADER;
        if (px[i] < innerX + hw)             { px[i] = innerX + hw;             vx[i] = 0; }
        if (px[i] > innerX + innerW - hw)    { px[i] = innerX + innerW - hw;    vx[i] = 0; }
        if (py[i] < innerY + hh)             { py[i] = innerY + hh;             vy[i] = 0; }
        if (py[i] > innerY + innerH - hh)    { py[i] = innerY + innerH - hh;    vy[i] = 0; }
        break;
      }
    }
  }

  function commitOutputs() {
    session.positions.clear();
    session.containers.clear();
    // Commit bodies. An empty container is a body too — its rect is its
    // OWN px/py + (default-sized) bbox, so the frame stays visible even
    // when its subtree was filtered away by the layer control.
    for (let i = 0; i < N; i++) {
      const n = leaves[i];
      if (n.hasChildren) {
        const w = Math.max(120, n.width);
        const h = Math.max(60, n.height);
        session.containers.set(n.id, {
          x: px[i] - w / 2,
          y: py[i] - h / 2,
          width: w,
          height: h,
          padding: n.padding || 24,
        });
      } else {
        session.positions.set(n.id, {
          x: px[i] - n.width / 2,
          y: py[i] - n.height / 2,
          width: n.width,
          height: n.height,
        });
      }
    }
    // Containers WITH children derive their rect from descendants — multiple
    // passes for nesting. Empty containers were already committed above.
    for (let pass = 0; pass < 3; pass++) {
      for (const c of containersWithChildren) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hits = 0;
        for (const n of leaves) {
          if (n.parent !== c.id) continue;
          const p = session.positions.get(n.id); if (!p) continue;
          hits++;
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x + p.width > maxX) maxX = p.x + p.width;
          if (p.y + p.height > maxY) maxY = p.y + p.height;
        }
        for (const cc of containers) {
          if (cc.parent !== c.id) continue;
          const r = session.containers.get(cc.id); if (!r) continue;
          hits++;
          if (r.x < minX) minX = r.x;
          if (r.y < minY) minY = r.y;
          if (r.x + r.width > maxX) maxX = r.x + r.width;
          if (r.y + r.height > maxY) maxY = r.y + r.height;
        }
        if (hits === 0) continue;
        const pad = c.padding || 24;
        session.containers.set(c.id, {
          x: minX - pad,
          y: minY - pad - HEADER,
          width: (maxX - minX) + pad * 2,
          height: (maxY - minY) + pad * 2 + HEADER,
          padding: pad,
        });
      }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const merge = (x, y, w, h) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    };
    for (const p of session.positions.values()) merge(p.x, p.y, p.width, p.height);
    for (const c of session.containers.values()) merge(c.x, c.y, c.width, c.height);
    if (Number.isFinite(minX)) {
      session.bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    // Edge waypoints (undefined until the first sim step seeds them).
    session.edgeWaypoints = waypoints.seeded ? commitWaypoints(waypoints) : undefined;
  }

  function loop() {
    rafHandle = null;
    if (stopped) return;
    step();
    if (alpha >= cfg.alphaMin) ensureRunning();
  }

  function ensureRunning() {
    if (stopped || rafHandle != null) return;
    if (typeof requestAnimationFrame !== 'undefined') {
      rafHandle = requestAnimationFrame(loop);
    }
  }

  function cancelLoop() {
    if (rafHandle != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafHandle);
    }
    rafHandle = null;
  }

  // Seed an initial commit so subscribers immediately see something.
  commitOutputs();

  if (alpha < cfg.alphaMin) {
    // All pinned — emit once asynchronously like the static adapters.
    queueMicrotask(() => {
      if (stopped) return;
      emit('tick');
      endEmitted = true;
      emit('end');
    });
  } else if (typeof requestAnimationFrame !== 'undefined') {
    ensureRunning();
  } else {
    // Test / SSR: emit a tick microtask so subscribers can attach;
    // consumer drives the simulation via session.tick().
    queueMicrotask(() => {
      if (!stopped) emit('tick');
    });
  }

  return session;
}
