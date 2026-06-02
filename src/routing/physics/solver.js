// Solver iterativo: aplica forças, integra velocidades, projeta
// constraints, devolve world atualizado.
//
// Após 5.0: apenas CornerBody e PointBody são integrados — SegmentBody
// é derivado dos endpoints e não tem DOF próprio. Forças sobre
// segmentos foram redistribuídas pros corners em `forces.js`.

import { clearForces } from './bodies.js';
import {
  applyOriginSprings,
  applyNodeRepulsion,
  applyParallelRepulsion,
  applyPerpRepulsion,
  applyChainSpring,
} from './forces.js';
import { applyEdgeCentralForce } from './forces-edge-central.js';
import { applyEndpointBBoxRepulsion } from './forces-endpoint-bbox.js';
import { projectManhattanEdge, pinAnchors, pinAnchorsOnPerimeter } from './constraints.js';
import {
  tickCooldown,
  updateSplitCounter,
  shouldSplit,
  splitSegment,
  splitSegmentShelf,
  shouldMerge,
  mergeColinear,
  SPLIT_THRESHOLD_DEFAULT,
  SPLIT_TICKS_DEFAULT,
  COOLDOWN_DEFAULT,
  FUSION_MANHATTAN_K_DEFAULT,
} from './topology.js';

const DAMPING = 0.5;
const VELOCITY_CAP = 16;  // px/tick — protege contra explosão numérica
// Phase G — max shelf splits an edge may take to detour around foreign nodes.
// Bounds cascade when an endpoint leg keeps a pinned sub-leg after splitting.
const HARD_SPLIT_CAP_DEFAULT = 3;

export function step(world, opts = {}) {
  if (!world || !world.bodies || !world.bodies.length) return;
  const dt = opts.dt ?? 1;

  // 1. zera acumuladores de força (no-op para segments).
  for (const b of world.bodies) clearForces(b);

  // 2. forças.
  applyOriginSprings(world);
  // Força central por aresta: anchors pinados no perímetro são puxados
  // pro `info.edgeCenter` (midpoint dos centros dos nós) ou pro
  // `info.snapTarget[side]` quando snap está atribuído. Componente
  // perpendicular ao trilho é absorvida pelo clamp pós-step; tangencial
  // faz o anchor deslizar pela interseção mais próxima.
  applyEdgeCentralForce(world, opts);
  if (opts.routingRects) applyNodeRepulsion(world, opts.routingRects, opts);
  applyParallelRepulsion(world, opts);
  // BBox de endpoint vs BBox de endpoint + BBox vs segmento alheio
  // (P5/P6). No-op quando nenhum CornerBody pinado tem `rect` (testes
  // anteriores que constroem mundos sem warm-start).
  applyEndpointBBoxRepulsion(world, opts);
  // Fase 3c: separa cruzamentos entre edges que compartilham edgeLayer.
  // No-op sem opts.edgePair (step() direto nos testes das fases 2–5).
  applyPerpRepulsion(world, opts);
  // applyChainSpring atua só em curves; opt-in pra não alterar
  // tolerâncias de testes existentes que esperam curva sem perturbação
  // preservada por spring de origem isolada. Habilitada via
  // opts.chainSpringEnabled ou world.chainSpringEnabled — futuras
  // sub-fases podem ligar por default quando fusão curved automática
  // estiver calibrada.
  if (opts.chainSpringEnabled || world.chainSpringEnabled) {
    applyChainSpring(world, opts);
  }

  // 3. fissão: atualiza contadores de força residual; dispara splits
  // dos segmentos qualificados. Roda ANTES da integração para que os
  // novos corners participem do mesmo tick.
  //
  // Phase G — hard case: even when global fission is OFF, a segment speared
  // through a foreign node body (seg.foreignObstacle, set by
  // applyNodeRepulsion) must still detour. Run fission in `hardOnly` mode so
  // ONLY those segments split — no cascade on regular crossings/overlaps.
  const globalFission = opts.fissionEnabled || world.fissionEnabled;
  // hardFissionEnabled cascade: explicit opts → world flag → physics opt-in
  // (`hardObstacleEscalation`, defaults true to preserve current behavior).
  const hardFissionFlag = opts.hardFissionEnabled
    ?? world.hardFissionEnabled
    ?? opts.physicsHardObstacleEscalation
    ?? true;
  const hardFission = hardFissionFlag && hasForeignObstacle(world);
  if (globalFission || hardFission) {
    runFission(world, { ...opts, hardOnly: !globalFission });
  }

  // 4. integração Euler explícita com damping + clamp de velocidade.
  // Segments não são integrados — sem DOF próprio. Anchors com `rect`
  // (perimeter anchors) SÃO integrados — têm DOF tangencial que o
  // clampAnchorToPerimeter projeta de volta no trilho. Anchors sem rect
  // (legacy pin total) ficam fixos.
  for (const b of world.bodies) {
    if (b.kind === 'segment') continue;
    if (b.pinned && !b.rect) continue;  // legacy total-pin
    b.vx = clamp((b.vx + b.fx * dt) * DAMPING, VELOCITY_CAP);
    b.vy = clamp((b.vy + b.fy * dt) * DAMPING, VELOCITY_CAP);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }

  // 5. constraints — projeção hard.
  // Anchors com `rect` configurado (warm-start moderno) usam o trilho do
  // perímetro: deslizam tangencialmente, projeção hard mantém na borda.
  // Free corner adjacente herda Δ tangencial. Anchors sem rect (testes
  // de fases anteriores que constroem mundos sem warm-start) caem no
  // pin total legado (pinAnchors).
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (info.kind === 'curve') {
      pinAnchors(info.points);
    } else {
      pinAnchors(info.corners);          // legacy total-pin (no-op p/ rect anchors)
      pinAnchorsOnPerimeter(info);       // perímetro + slide free corner
      projectManhattanEdge(info.corners, info.segments);
    }
  }

  // 6. fusão: detecta segmentos curtos (< K * stroke) e funde,
  // removendo o corner do meio. Roda APÓS a projeção pra que
  // `segmentLength` reflita a coordenada estável do tick. Critério
  // simétrico assimétrico em relação à fissão (split=4px de força,
  // merge=4*stroke≈8px de geometria) cria a zona morta que evita
  // loops fissão↔fusão.
  if (opts.fusionEnabled || world.fusionEnabled) {
    runFusion(world, opts);
    // Re-projeta após fusão: mergeColinear cria o novo corner Cm no
    // midpoint dos 2 antigos (topology.js), o que não respeita a
    // coord Manhattan dos segmentos adjacentes. Sem este passe, o
    // commit final emite o Cm em posição diagonal e o renderer pinta
    // polyline com segmento não-ortogonal. Custo: re-iterar edgeIndex
    // (mesmo loop do passo 5) — barato comparado às forças.
    for (const info of world.edgeIndex.values()) {
      if (info.skipped) continue;
      if (info.kind === 'curve') continue;
      pinAnchors(info.corners);
      pinAnchorsOnPerimeter(info);
      projectManhattanEdge(info.corners, info.segments);
    }
  }

  // 7. cooldown topológico decrementa pra todos os bodies — corners e
  // segments recém-criados/fundidos ficam imunes a nova mudança até
  // zerar.
  for (const b of world.bodies) tickCooldown(b);
}

function runFusion(world, opts) {
  const k = opts.fusionManhattanK ?? FUSION_MANHATTAN_K_DEFAULT;
  const cooldown = opts.cooldown ?? COOLDOWN_DEFAULT;
  const queue = [];
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (!info.segments) continue;
    for (const seg of info.segments) {
      if (shouldMerge(seg, world, k)) queue.push(seg);
    }
  }
  for (const seg of queue) {
    mergeColinear(seg, world, { cooldown });
  }
}

function runFission(world, opts) {
  const threshold = opts.fissionThreshold ?? SPLIT_THRESHOLD_DEFAULT;
  const ticks = opts.fissionTicks ?? SPLIT_TICKS_DEFAULT;
  const cooldown = opts.cooldown ?? COOLDOWN_DEFAULT;
  // Coleta primeiro pra evitar mutação durante iteração — splitSegment
  // mexe em world.bodies e info.segments.
  // hardOnly (Phase G): consider ONLY segments flagged as crossing a foreign
  // node body (seg.foreignObstacle). Keeps the local obstacle-detour from
  // enabling fission on every regular crossing when global fission is off.
  const hardOnly = !!opts.hardOnly;
  // Per-edge cap on hard splits — an endpoint leg keeps a pinned sub-leg after
  // a shelf split, which could re-trigger and cascade. Bound the detour depth.
  const hardCap = opts.hardSplitCap ?? HARD_SPLIT_CAP_DEFAULT;
  const queue = [];
  for (const info of world.edgeIndex.values()) {
    if (info.skipped) continue;
    if (!info.segments) continue;
    for (const seg of info.segments) {
      if (hardOnly) {
        if (!seg.foreignObstacle) continue;
        if ((info.hardSplits || 0) >= hardCap) continue;
      }
      updateSplitCounter(seg, threshold);
      if (shouldSplit(seg, threshold, ticks)) {
        queue.push(seg);
        if (hardOnly) info.hardSplits = (info.hardSplits || 0) + 1;
      }
    }
  }
  for (const seg of queue) {
    // Shelf-shape (5.x) quando o seg tem anchor pinado num endpoint:
    // split simples (1 corner colinear) seria projetado de volta pra
    // coord do anchor pela Manhattan estrita, sem desvio real. Shelf
    // cria 4 corners + 5 segs alternando H-V-H-V-H, introduzindo um
    // seg perpendicular com DOF livre que permite afastamento.
    // Sub-splits subsequentes (no interior do shelf) usam o caminho
    // simple — basta 1 corner colinear porque o run nesse ponto já
    // está livre de pin.
    if (seg.prevCorner.pinned || seg.nextCorner.pinned) {
      splitSegmentShelf(seg, world, { cooldown });
    } else {
      splitSegment(seg, world, { cooldown });
    }
  }
}

function clamp(v, cap) {
  if (v > cap) return cap;
  if (v < -cap) return -cap;
  return v;
}

export function converged(world, eps = 0.05) {
  if (!world || !world.bodies) return true;
  for (const b of world.bodies) {
    if (b.kind === 'segment') continue;
    if (b.pinned) continue;
    if (Math.abs(b.vx) > eps || Math.abs(b.vy) > eps) return false;
  }
  return true;
}

// Any segment currently flagged as speared through a foreign node body.
// Drives the Phase G hard-fission gate in step().
function hasForeignObstacle(world) {
  if (!world || !world.edgeIndex) return false;
  for (const info of world.edgeIndex.values()) {
    if (!info.segments) continue;
    for (const seg of info.segments) {
      if (seg.foreignObstacle) return true;
    }
  }
  return false;
}

// Estabilidade topológica: nenhum segmento tem contador de força
// residual ativo. Distinto de `converged` (que olha velocidades): num
// cenário pinned-pinned com obstáculo, todos os corners estão imóveis
// (pinados) mas a força residual nos endpoints ainda está crescendo;
// `converged` retorna true imediatamente, mas a fissão ainda não
// disparou. `runUntilStable` exige AMBOS pra sair.
export function topologyStable(world) {
  if (!world || !world.edgeIndex) return true;
  for (const info of world.edgeIndex.values()) {
    if (!info.segments) continue;
    for (const seg of info.segments) {
      if ((seg.residualTicks || 0) > 0) return false;
    }
  }
  return true;
}

export function runUntilStable(world, opts = {}) {
  const maxIter = opts.maxIter ?? 200;
  const eps = opts.eps ?? 0.05;
  const checkTopology = opts.fissionEnabled || world.fissionEnabled;
  for (let i = 0; i < maxIter; i++) {
    step(world, opts);
    if (converged(world, eps) && (!checkTopology || topologyStable(world))) {
      return { iterations: i + 1, converged: true };
    }
  }
  return { iterations: maxIter, converged: false };
}
