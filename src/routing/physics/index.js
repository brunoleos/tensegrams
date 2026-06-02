// Entry point do solver físico de routing.
//
// `runPhysicsRouter` substitui (quando `cfg.routing.engine = 'physics'`)
// o caminho algébrico `applyObstacleRouting` no pipeline.
//
// Fase 2: build → step (origem + Manhattan + pin) → commit.
// Fase 3: também acopla repulsões node + paralela; cada tick faz
// até `stepsPerTick` iterações. Estado anterior é ignorado por
// padrão (rebuild a cada tick) — fases futuras podem reaproveitar
// pra preservar momentum.

import { buildWorld, commitWorld } from './warm-start.js';
import { step } from './solver.js';
import { snapEndpointsToDiscretePorts } from '../snap-endpoints.js';
import { reassignFacesToReduceCrossings } from '../face-select.js';
import { hananRoute } from '../obstacle-route.js';

const STEPS_PER_TICK_DEFAULT = 30;

export function runPhysicsRouter(ir, routingRects, resolver, opts = {}, prevState = null) {
  const inputEdges = opts._inputRoutedEdges || new Map();
  const stepsPerTick = opts.routing?.stepsPerTick ?? STEPS_PER_TICK_DEFAULT;
  // Opt-in `cfg.routing.warmStart.aStar`: false | true | 'on-stuck'.
  // Mantido como hook legado; trigger primário de A* na 5.6 é
  // `meta.routing.fission.trigger ∈ {residual,astar,hybrid}`.
  const warmStartAStar = opts.routing?.warmStart?.aStar ?? false;
  void warmStartAStar;
  void prevState;

  // Snap discreto (5.4): reescreve endpoints das edges cujos nodes
  // declararam `snap`/`snapGroups`. Nodes sem declaração ficam
  // intocados — endpoint contínuo (comportamento atual).
  snapEndpointsToDiscretePorts(ir, inputEdges, routingRects, ir?.meta);

  // Seleção de face consciente de cruzamento: migra a face de endpoints
  // envolvidos em cruzamentos shared-layer para descruzar antes do solver
  // (o roteador base escolhe face só pelo eixo dominante, sem olhar
  // cruzamentos). Respeita snap discreto e no-op sem edgeLayerPair.
  reassignFacesToReduceCrossings(ir, inputEdges, routingRects, resolver, {
    nodeSkipRadius: opts.routing?.nodeSkipRadius,
  });

  // A* warm-start (5.6) + fissão (5.5) conforme `meta.routing.fission.trigger`:
  //   - ausente / 'off' (DEFAULT): solver puro, SEM fissão. A fissão por
  //     resíduo explode em grafos densos (pernas terminais presas ao pin
  //     não aliviam a força → shelves em cascata) e nunca reduz cruzamentos
  //     no caso medido — por isso é opt-in. Recalibração fica p/ item futuro.
  //   - 'residual': solver puro + fissão ativa (split residual).
  //   - 'astar': hananRoute semeia topologia; fissão desligada (A* já
  //     resolveu o contorno).
  //   - 'hybrid': hananRoute semeia + fissão ativa pra splits residuais.
  const trigger = ir?.meta?.routing?.fission?.trigger ?? 'off';
  if (trigger === 'astar' || trigger === 'hybrid') {
    seedWithAStar(ir, inputEdges, routingRects, resolver, opts);
  }

  const world = buildWorld(ir, inputEdges, resolver, { ...opts, routingRects });
  // Configura habilitação dinâmica de fissão/fusão por trigger. Fissão
  // é OPT-IN: só liga quando `trigger` é explicitamente 'residual' ou
  // 'hybrid'. Default (ausente/'off') deixa fissão desligada — evita a
  // cascata de shelves que corrompia o engine physics.
  //
  // Fusão Manhattan (5.7) também liga por default no engine physics —
  // sem ela, o passe 1 do router base pode deixar mini-steps (B14) que
  // o solver não absorveria sozinho. Critério length < K*stroke é
  // conservador (sem cooldown ativo, length ≥ 8px sobrevive). Testes
  // do solver que chamam `step` direto não passam por aqui e seguem
  // com fusão desligada — preservam tolerâncias atuais.
  world.fissionEnabled = trigger === 'residual' || trigger === 'hybrid';
  world.fusionEnabled = true;

  const stepOpts = {
    routingRects,
    nodePad: opts.routing?.nodePad ?? opts.collision?.nodePad,
    parallelGap: opts.routing?.parallelGap,
    // Fase 3c: predicado de cruzamento. `edgeLayerPair` retorna não nulo
    // só quando os dois edges compartilham edgeLayer (regra do usuário).
    // Resolvers legados sem o método → undefined → repulsão perp é no-op.
    edgePair: resolver?.edgeLayerPair,
    // Layer-aware node-vs-edge filter for applyNodeRepulsion — mirrors A*
    // (obstacle-route). An edge with no shared collision layer with a node
    // doesn't see it as an obstacle.
    resolver,
    // Constante da força central por aresta (P3). Default 0.04 em
    // forces-edge-central.js; override via meta.routing.central.k.
    kEdgeCentral: opts.routing?.central?.k,
    // Default global do lado do BBox de endpoint (P5). Override por
    // edge.endpoints.{source|target}.side ou edge.style.endpointBBox.side.
    endpointBBoxSide: opts.routing?.endpointBBox?.side,
    // Sink pra warnings de auto-clamp do BBox (Q11).
    warningsSink: opts._warningsSink,
    // P8: gate da hard-fission (Fase G). Padrão true preserva o detour
    // local em torno de nós alheios; opt-out via `routing.physics.hardObstacleEscalation: false`.
    physicsHardObstacleEscalation: opts.routing?.physics?.hardObstacleEscalation,
  };
  for (let i = 0; i < stepsPerTick; i++) step(world, stepOpts);

  const routedEdges = commitWorld(world);
  return { routedEdges, state: { world } };
}

// Roda hananRoute pra cada edge ortogonal — substitui pontos
// intermediários se A* encontrar caminho válido. Endpoints (S, T)
// preservados (ficam pinned como anchors no buildWorld). Obstáculos
// são todos os rects exceto source/target/ancestors.
//
// Usado no modo `meta.routing.fission.trigger ∈ {astar, hybrid}`.
// Em 'astar' fissionEnabled fica false (A* já resolve contorno);
// em 'hybrid' fissão permanece ativa pra refinar topologia.
function seedWithAStar(ir, routedEdges, rects, resolver, opts) {
  if (!ir || !ir.edges || !rects || !rects.size) return;
  const nodePad = opts.routing?.nodePad ?? opts.collision?.nodePad ?? 12;
  const ancestorsMap = resolver?.ancestors || new Map();

  for (const e of ir.edges) {
    const re = routedEdges.get(e.id);
    if (!re || !re.points || re.points.length < 2) continue;
    if (re.kind === 'curve' || re.kind === 'spline') continue;

    const S = re.points[0];
    const T = re.points[re.points.length - 1];

    const allowed = new Set([e.source, e.target]);
    for (const id of [e.source, e.target]) {
      const anc = ancestorsMap.get(id);
      if (anc) for (const a of anc) allowed.add(a);
    }
    const obstacles = [];
    for (const [nodeId, rect] of rects) {
      if (allowed.has(nodeId)) continue;
      obstacles.push(expandRect(rect, nodePad));
    }
    if (!obstacles.length) continue;

    const path = hananRoute(S, T, obstacles);
    if (!path || path.length < 2) continue;
    routedEdges.set(e.id, { ...re, points: path });
  }
}

function expandRect(r, pad) {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export { buildWorld, commitWorld, step };
