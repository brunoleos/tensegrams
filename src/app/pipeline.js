// Render pipeline: DSL → IR → projection → layout adapter → router →
// anchor clip → renderer. Owns the small set of "current X" handles
// that downstream listeners (gestures, etc.) need to read.
//
// State is owned by the closure — the only externally-visible state is
// exposed via `pipeline.state` getter (read-only snapshot of refs).
// Mutation happens through `rerender()` and `paint()`.

import { parse as parseYaml } from 'yaml';
import { parse } from '../dsl/parser.js';
import { buildIR } from '../dsl/ir.js';
import { parseConfig, placeholderFor } from '../dsl/config.js';
import { getLayoutAdapter } from '../layout/registry.js';
import { getRouter } from '../routing/registry.js';
import { buildCollisionResolver } from '../layout/collision.js';
import { applyLayerFilter, chipLayers } from '../layout/layer-filter.js';
import { applyCollapseFilter } from '../layout/collapse-filter.js';
import { projectIR, createBreadcrumb } from '../controls/abstraction.js';
import { topLevelContainers } from '../controls/drill.js';
import { applyObstacleRouting } from '../routing/obstacle-route.js';
import { clipAnchorsToContainerFaces } from '../routing/clip-anchors.js';
import { snapContainerEndpointsExternal } from '../routing/snap-container-anchors.js';
import { runPhysicsRouter } from '../routing/physics/index.js';

// DEPRECATED: o engine de routing físico ANTERIOR (src/routing/physics, F-0017)
// está deprecated (ADR-0009, atualização 2026-06). Será substituído pelo routing
// do motor físico unificado (src/physics, ADR-0012, Fase 4). Guard para avisar
// uma única vez por sessão (o branch roda a cada tick).
let _physicsRoutingDeprecationWarned = false;

export function createPipeline(deps) {
  const {
    store, viewport, renderer,
    structuredConfig,
    layerControl, drillControl,
    errorsEl, breadcrumbEl, configEditorEl,
  } = deps;

  // Engine state. Updated by `rerender()`; read by gestures via the
  // `state` getter. No outside writer.
  let currentFullIR = null;
  let currentIR = null;
  let currentSession = null;
  let currentLayout = null;
  let currentAdapter = null;
  let currentRouter = null;
  let currentMergedOpts = null;

  // Subscriber bookkeeping.
  let lastGraphSig = '';
  let lastSelected = null;

  function refreshConfigPlaceholder() {
    configEditorEl.setAttribute('placeholder', placeholderFor(store.state.layoutId));
  }

  function refreshStructuredConfig() {
    let parsed = {};
    try { parsed = parseYaml(store.state.config || '', { schema: 'core' }) || {}; }
    catch { /* config still being typed */ }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};
    structuredConfig.setValue(parsed);
  }

  function showErrors(errors) {
    if (!errors || !errors.length) {
      errorsEl.textContent = '';
      errorsEl.classList.remove('has-errors');
      return;
    }
    errorsEl.classList.add('has-errors');
    errorsEl.textContent = errors.map(e => (e.line ? `L${e.line}: ` : '') + e.msg).join(' · ');
  }

  async function rerender() {
    const ast = parse(store.state.dsl);
    const fullIR = buildIR(ast);
    currentFullIR = fullIR;
    const configResult = parseConfig(store.state.config);
    showErrors([...fullIR.errors, ...configResult.errors]);

    const focused = store.state.viewState.focusedContainer;
    const projected = projectIR(fullIR, focused);

    // Drill-down chips: containers visible at the current focus, BEFORE
    // layer filtering — toggling a layer off shouldn't remove the chip
    // (otherwise users couldn't toggle it back on).
    drillControl.setContainers(topLevelContainers(projected));

    // Layer chips: from the projected (unfiltered) view so a layer
    // toggle doesn't make its own chip vanish. chipLayers appends a
    // synthetic UNTAGGED chip when the view mixes tagged and untagged
    // nodes (lets the user isolate tagged stuff without DSL edits).
    const hiddenSet = new Set(store.state.viewState.hiddenLayers);
    layerControl.setLayers(chipLayers(projected), hiddenSet);

    const layered = applyLayerFilter(projected, hiddenSet);
    const collapsedSet = new Set(store.state.collapsedContainers);
    const ir = applyCollapseFilter(layered, collapsedSet);
    currentIR = ir;

    // Garbage-collect a stale selection: if the selected node vanished
    // (drilled out of view, hidden, collapsed), clear it so the FAB
    // doesn't anchor to a ghost. Defer to next tick — `setSelected`
    // synchronously here would re-trigger the subscriber mid-render.
    const sel = store.state.selectedNodeId;
    if (sel && !ir.nodes.some(n => n.id === sel)) {
      queueMicrotask(() => store.setSelected(null));
    }

    refreshConfigPlaceholder();
    createBreadcrumb(breadcrumbEl, fullIR, focused, (id) => {
      store.setFocusedContainer(id);
    });

    // Snapshot the current frame so the next session can resume from
    // these positions instead of the default seed. DSL/config edits
    // then look like a smooth readjustment, not a re-explosion.
    // Both maps merge into one — empty containers live in `containers`,
    // every other body lives in `positions`; same id, never both.
    let seedPositions = null;
    let seedAlpha = 0;
    let seedLabelBBoxes = null;
    if (currentSession) {
      seedPositions = new Map();
      for (const [id, rect] of currentSession.positions) seedPositions.set(id, rect);
      for (const [id, rect] of currentSession.containers) {
        if (!seedPositions.has(id)) seedPositions.set(id, rect);
      }
      seedAlpha = currentSession.alpha ?? 0;
      if (currentSession.labelBBoxes && currentSession.labelBBoxes.size) {
        seedLabelBBoxes = new Map(currentSession.labelBBoxes);
      }
      currentSession.stop();
    }

    let adapter, router;
    try {
      [adapter, router] = await Promise.all([
        getLayoutAdapter(store.state.layoutId),
        getRouter(store.state.routerId),
      ]);
    } catch (err) {
      showErrors([{ msg: String(err.message || err) }]);
      return;
    }

    const mergedOpts = { ...store.state.options, ...configResult.options };
    if (seedPositions && seedPositions.size) {
      mergedOpts.live = { ...(mergedOpts.live || {}), seedPositions, seedAlpha };
    }
    if (seedLabelBBoxes && seedLabelBBoxes.size) {
      mergedOpts.live = { ...(mergedOpts.live || {}), seedLabelBBoxes };
    }
    const session = adapter.start(ir, mergedOpts);
    currentSession = session;
    currentAdapter = adapter;
    currentRouter = router;
    currentMergedOpts = mergedOpts;

    // Collision resolver + ancestry — computed once per session, reused
    // on every tick by obstacle routing and anchor-clipping.
    const collisionResolver = buildCollisionResolver(ir);
    const ancestors = collisionResolver.ancestors;

    // Estado persistente do solver físico entre ticks (warm-start
    // incremental no LIVE). null quando engine='algebraic'.
    let physicsState = null;

    session.on('tick', () => {
      if (session !== currentSession) return;
      // Edges may legitimately point at CONTAINERS after layer-filter
      // promotion (onHidden=promote). Routers treat each entry of
      // `positions` as a rect, so we merge containers into the map.
      const routingRects = new Map(session.positions);
      if (session.containers) {
        for (const [id, rect] of session.containers) routingRects.set(id, rect);
      }
      const rawEdges = session.routedEdges
        || router.route(ir, routingRects, mergedOpts.router || {});
      // Branch de engine de routing. Sem default privilegiado por design
      // (ADR-0009): algébrico e físico são plugins co-iguais. Enquanto o
      // algébrico é o único engine maduro, ele é o fallback PRAGMÁTICO
      // TRANSITÓRIO quando `routing.engine` vem vazio — não "o default"
      // conceitual. O routing físico definitivo virá do motor unificado
      // (src/physics, ADR-0012, Fase 4).
      const engine = mergedOpts.routing?.engine || 'algebraic';
      let detoured;
      if (engine === 'physics') {
        // DEPRECATED (ADR-0009/F-0017): src/routing/physics é a impl. anterior,
        // substituída pelo routing do motor unificado na Fase 4. Funciona como
        // opt-in legado; avisa uma vez.
        if (!_physicsRoutingDeprecationWarned) {
          _physicsRoutingDeprecationWarned = true;
          console.warn(
            "[tensegrams] routing.engine: 'physics' (src/routing/physics) está "
            + 'DEPRECATED e será removido na Fase 4 (substituído pelo routing do '
            + 'motor físico unificado, ADR-0012). Use o algébrico até lá.',
          );
        }
        const result = runPhysicsRouter(ir, routingRects, collisionResolver, {
          ...mergedOpts,
          _inputRoutedEdges: rawEdges,
        }, physicsState);
        detoured = result.routedEdges;
        physicsState = result.state;
      } else {
        // Obstacle-aware detour for edges that declare collision labels.
        // Runs before clipping so anchors pushed into foreign containers
        // get corrected downstream.
        detoured = applyObstacleRouting(ir, rawEdges, routingRects, collisionResolver, {
          nodePad: mergedOpts.collision?.nodePad,
          edgePad: mergedOpts.collision?.edgePad,
          orthogonal: store.state.routerId === 'orthogonal',
          edgeWaypoints: session.edgeWaypoints,
        });
      }
      // P8 gates: cada opt-in algébrico vira opcional. Default TRUE pra
      // preservar baselines existentes; `options.routing.algebraic.legacy`
      // = false desliga todos de uma vez (modo "engine puro físico");
      // flags individuais sobrescrevem o legacy default.
      const alg = mergedOpts.routing?.algebraic ?? {};
      const legacy = alg.legacy ?? true;
      const useClip = alg.clipAnchors ?? legacy;
      const useSnapContainer = alg.snapContainerExternal ?? legacy;
      // Single invariant: anchors never end inside a foreign container.
      const clipped = useClip
        ? clipAnchorsToContainerFaces(ir, detoured, routingRects, ancestors)
        : detoured;
      // For edges that end on a container, force the anchor onto the
      // external face facing the other endpoint. High-level behavior
      // configured in the DSL (ir.meta.snapContainerAnchor + per-edge
      // `snap=` attr); see src/routing/snap-container-anchors.js.
      const routedEdges = useSnapContainer
        ? snapContainerEndpointsExternal(ir, clipped, routingRects, ancestors)
        : clipped;
      currentLayout = {
        positions: session.positions,
        containers: session.containers,
        routedEdges,
        bounds: session.bounds,
      };
      paint();
    });
  }

  function paint() {
    if (!currentIR || !currentLayout) return;
    renderer.render(currentIR, currentLayout, viewport, {
      selectedId: store.state.selectedNodeId,
      collapsedIds: new Set(store.state.collapsedContainers),
      // Callback do renderer para reportar tamanho real do label após paint.
      // Só faz sentido no live (`reportLabelBBox` exists na session).
      reportLabelBBox: currentSession && currentSession.reportLabelBBox
        ? (id, bbox) => currentSession.reportLabelBBox(id, bbox)
        : undefined,
      // Debug overlay: collision BBoxes
      debugBBoxes: store.state.debugBBoxes,
      mergedOpts: currentMergedOpts,
      session: currentSession,
    });
  }

  // Only re-run the (expensive) graph pipeline when graph-affecting
  // state changes. UI-only changes update the DOM but skip rerender.
  //
  // hiddenLayers IS in graphSig: layer toggle removes nodes from the
  // IR, rebuilds edges, and re-runs the layout. In live mode that's
  // a reflow animation for the remaining nodes.
  function graphSig(s) {
    return s.dsl + '' + s.config + '' + s.layoutId + '' + s.routerId + ''
         + JSON.stringify(s.options) + '' + JSON.stringify(s.viewState)
         + '' + JSON.stringify(s.collapsedContainers) + '' + (s.debugBBoxes ? '1' : '0');
  }

  function bindStoreSubscriber({ applyUI, onSelectionChange }) {
    lastGraphSig = graphSig(store.state);
    store.subscribe((s) => {
      applyUI(s);
      const sig = graphSig(s);
      if (sig !== lastGraphSig) {
        lastGraphSig = sig;
        rerender();
        onSelectionChange(s);
      } else if (s.selectedNodeId !== lastSelected) {
        paint();
        onSelectionChange(s);
      }
      lastSelected = s.selectedNodeId;
    });
  }

  return {
    rerender,
    paint,
    refreshConfigPlaceholder,
    refreshStructuredConfig,
    bindStoreSubscriber,
    // Read-only snapshot of the engine refs. Returns a NEW object on
    // each access — refs inside are stable (mutated by rerender), but
    // the wrapper isn't memoized. Cheap to allocate; not in a tight
    // loop today.
    get state() {
      return {
        currentIR, currentFullIR, currentLayout,
        currentSession, currentAdapter, currentRouter,
      };
    },
  };
}
