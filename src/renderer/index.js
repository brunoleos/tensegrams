import { renderNodes } from './nodes.js';
import { renderEdges } from './edges.js';
import { ensureMarkers } from './edge-end-styles.js';
import { renderCollisionDebugOverlay, clearCollisionDebugOverlay } from './collision-debug.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// LOD thresholds.
const LOD_HIDE_LABELS_BELOW = 0.4;  // zoom factor
const LOD_SIMPLE_BELOW = 0.18;       // render leaves as dots, drop labels entirely

export function createRenderer(svg) {
  ensureMarkers(svg);
  const viewport = ensureGroup(svg, 'vp');
  const containersGroup = ensureGroup(viewport, 'containers');
  const edgesGroup = ensureGroup(viewport, 'edges');
  const nodesGroup = ensureGroup(viewport, 'nodes');

  return {
    /**
     * @param {object} ir
     * @param {{positions:Map, containers:Map, routedEdges:Map, bounds?:object}} layout
     * @param {{x:number,y:number,zoom:number}} vp
     * @param {{selectedId?:string|null, collapsedIds?:Set<string>, debugBBoxes?:boolean, mergedOpts?:object, session?:object}} [view]
     *        View-state read by the renderer: selection outline and
     *        per-container collapse styling. Keeping this explicit
     *        avoids the renderer reaching into the IR for view flags.
     */
    render(ir, layout, vp, view = {}) {
      viewport.setAttribute('transform', `translate(${vp.x} ${vp.y}) scale(${vp.zoom})`);

      // Selective load: cull elements outside the visible viewport.
      const visibleWorld = computeVisibleWorldRect(svg, vp);
      const culled = cullIR(ir, layout, visibleWorld);

      // Level-of-detail flags.
      const lod = lodLevel(vp.zoom);
      svg.classList.toggle('lod-no-labels', lod === 'no-labels' || lod === 'simple');
      svg.classList.toggle('lod-simple', lod === 'simple');

      renderNodes(
        containersGroup,
        { nodes: culled.containerNodes, edges: [] },
        new Map(),
        culled.containers,
        view,
      );
      renderNodes(
        nodesGroup,
        { nodes: culled.leafNodes, edges: [] },
        culled.positions,
        new Map(),
        view,
      );
      renderEdges(edgesGroup, { edges: culled.edges }, culled.routedEdges, view.reportLabelBBox);

      // Debug overlay: collision BBoxes. Rendered INTO the viewport group so
      // it shares the pan/zoom transform and world-coordinate space with the
      // nodes/edges — drawing it on the svg root leaves it displaced and
      // frozen under pan/zoom.
      if (view.debugBBoxes) {
        renderCollisionDebugOverlay(viewport, ir, layout, view.mergedOpts, view.session);
      } else {
        clearCollisionDebugOverlay(viewport);
      }
    },

    setLayerVisibility(visible) {
      const all = Array.from(svg.querySelectorAll('[data-layers]'));
      for (const el of all) {
        const tags = (el.getAttribute('data-layers') || '').split(/\s+/).filter(Boolean);
        if (!tags.length) { el.style.display = ''; continue; }
        const anyVisible = tags.some(t => visible.has(t));
        el.style.display = anyVisible ? '' : 'none';
      }
    },
  };
}

export function lodLevel(zoom) {
  if (zoom < LOD_SIMPLE_BELOW) return 'simple';
  if (zoom < LOD_HIDE_LABELS_BELOW) return 'no-labels';
  return 'full';
}

export function computeVisibleWorldRect(svg, vp) {
  const rect = (svg.getBoundingClientRect && svg.getBoundingClientRect()) || { width: 1000, height: 600 };
  const margin = 200 / Math.max(vp.zoom, 0.05); // 200 screen px buffer in world units
  return {
    x: (-vp.x) / vp.zoom - margin,
    y: (-vp.y) / vp.zoom - margin,
    width: rect.width / vp.zoom + margin * 2,
    height: rect.height / vp.zoom + margin * 2,
  };
}

// Intersection test: rect A vs rect B.
export function rectsIntersect(a, b) {
  return !(a.x + a.width < b.x || b.x + b.width < a.x ||
           a.y + a.height < b.y || b.y + b.height < a.y);
}

export function cullIR(ir, layout, visible) {
  const visibleNodeIds = new Set();
  const leafNodes = [];
  const containerNodes = [];
  const positions = new Map();
  const containers = new Map();

  for (const n of ir.nodes) {
    if (n.hasChildren) {
      const c = layout.containers.get(n.id);
      if (!c) continue;
      if (rectsIntersect(c, visible)) {
        containerNodes.push(n);
        containers.set(n.id, c);
        visibleNodeIds.add(n.id);
      }
    } else {
      const p = layout.positions.get(n.id);
      if (!p) continue;
      if (rectsIntersect(p, visible)) {
        leafNodes.push(n);
        positions.set(n.id, p);
        visibleNodeIds.add(n.id);
      }
    }
  }

  const edges = [];
  const routedEdges = new Map();
  for (const e of ir.edges) {
    if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) continue;
    const re = layout.routedEdges.get(e.id);
    if (!re) continue;
    edges.push(e);
    routedEdges.set(e.id, re);
  }

  return { leafNodes, containerNodes, positions, containers, edges, routedEdges };
}

function ensureGroup(parent, cls) {
  let g = parent.querySelector(`:scope > g.${cls}`);
  if (g) return g;
  g = document.createElementNS(SVG_NS, 'g');
  g.classList.add(cls);
  parent.appendChild(g);
  return g;
}

