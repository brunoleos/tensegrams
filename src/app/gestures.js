// Pointer + keyboard handling for the canvas: pan, pinch-zoom, node
// drag (single or multi for containers), tap resolution, and zoom
// shortcuts. Owns the pointer state machine; everything else (paint,
// store mutations, layout reads) is delegated.
//
// State machine driven by a Map of active pointers:
//   0  pointers → idle
//   1  pointer  → single mode: starts as 'tap', promotes to 'pan' or
//                 'drag' on first meaningful movement, otherwise
//                 resolves to a tap action at pointerup
//   2+ pointers → pinch (always supersedes single mode)
//
// TAP RESOLUTION (pointerup, no movement):
//   - container header → toggle collapse/expand
//   - container body   → first tap: select; second tap within 300ms
//                        on the SAME container: drill in (replaces select)
//   - leaf             → select
//   - background       → clear selection
//
// 5px is the movement threshold to distinguish tap from drag/pan —
// generous enough to forgive small touch jitter, tight enough that
// real drags promote within a few millimeters.

import { pan, zoomAt, screenToWorld } from '../viewport.js';
import { descendantLeaves } from '../dsl/ancestry.js';

const TAP_MOVE_THRESHOLD = 5;
const DOUBLE_TAP_MS = 300;

export function createGestures(deps) {
  const { svg, viewport, store, pipeline, zoomLabelEl, isEditorFocused } = deps;

  const pointers = new Map();           // pointerId → { x, y }
  let single = null;                    // see TAP_* / DRAG / PAN modes below
  let pinch = null;                     // { startDist, startZoom, midX, midY }
  let spaceDown = false;
  let lastTap = null;                   // { id, time } — for double-tap detection

  function svgCoords(ev) {
    const r = svg.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function bind() {
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const { x: sx, y: sy } = svgCoords(ev);
      const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(viewport, sx, sy, factor);
      pipeline.paint();
      updateZoomLabel();
    }, { passive: false });

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('lostpointercapture', endPointer);
    // Right-click is owned by createContextMenu() (which preventDefaults).

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
  }

  function onPointerDown(ev) {
    // Right-click (button 2) is reserved for the context menu — let
    // the browser raise `contextmenu` without capturing for pan.
    if (ev.button === 2) return;
    if (ev.button !== 0 && ev.pointerType !== 'touch' && ev.button !== 1) return;
    try { svg.setPointerCapture(ev.pointerId); } catch { /* capture unsupported */ }
    pointers.set(ev.pointerId, svgCoords(ev));

    if (pointers.size === 2) {
      endSingleQuietly();
      startPinch();
      return;
    }
    if (pointers.size > 2) return;

    // Pan-modifiers (middle-click, shift, space) skip tap resolution.
    const wantsPan = ev.button === 1 || ev.shiftKey || spaceDown;
    const { x: sx, y: sy } = svgCoords(ev);
    if (wantsPan) {
      single = { mode: 'pan', lastX: sx, lastY: sy, startX: sx, startY: sy };
      svg.classList.add('panning');
      ev.preventDefault();
      return;
    }

    const containerTarget = ev.target.closest && ev.target.closest('g.node[data-kind="container"]');
    const leafTarget      = ev.target.closest && ev.target.closest('g.node[data-kind="leaf"]');
    const isHeader        = !!(containerTarget && ev.target.closest('.container-header'));

    if (containerTarget) {
      setupContainerTap(ev, containerTarget.dataset.id, isHeader, sx, sy);
      return;
    }
    if (leafTarget) {
      setupLeafTap(ev, leafTarget.dataset.id, sx, sy);
      return;
    }

    // Background: provisional tap (resolves to clear-selection).
    single = { mode: 'tap', kind: 'bg', startX: sx, startY: sy, lastX: sx, lastY: sy };
    ev.preventDefault();
  }

  function setupContainerTap(ev, containerId, isHeader, sx, sy) {
    single = {
      mode: 'tap', kind: 'container', nodeId: containerId,
      isHeader, startX: sx, startY: sy, lastX: sx, lastY: sy,
    };
    const { currentAdapter, currentSession, currentLayout, currentIR } = pipeline.state;
    if (currentAdapter?.caps?.interactive && currentSession && currentLayout) {
      const w = screenToWorld(viewport, sx, sy);
      const leaves = descendantLeaves(currentIR, containerId);
      if (leaves.length) {
        // Expanded container: move every descendant by the same delta.
        // Anchors snapshotted now so sim drift during drag doesn't
        // accumulate.
        const anchors = {};
        for (const id of leaves) {
          const p = currentLayout.positions.get(id);
          if (p) anchors[id] = { x: p.x, y: p.y };
        }
        single.dragLeafIds = leaves;
        single.dragAnchors = anchors;
        single.startWorldX = w.x;
        single.startWorldY = w.y;
      } else {
        // Collapsed/childless in the projected IR — the sim treats it
        // as a single body, so drag it like a leaf using its container
        // rect as the anchor.
        const rect = currentLayout.containers.get(containerId);
        if (rect) {
          single.dragId = containerId;
          single.grabOffsetX = w.x - rect.x;
          single.grabOffsetY = w.y - rect.y;
        }
      }
    }
    ev.preventDefault();
  }

  function setupLeafTap(ev, leafId, sx, sy) {
    single = {
      mode: 'tap', kind: 'leaf', nodeId: leafId,
      startX: sx, startY: sy, lastX: sx, lastY: sy,
    };
    const { currentAdapter, currentSession, currentLayout } = pipeline.state;
    if (currentAdapter?.caps?.interactive && currentSession && currentLayout) {
      const pos = currentLayout.positions.get(leafId);
      if (pos) {
        const w = screenToWorld(viewport, sx, sy);
        single.dragId = leafId;
        single.grabOffsetX = w.x - pos.x;
        single.grabOffsetY = w.y - pos.y;
      }
    }
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, svgCoords(ev));

    if (pinch) { tickPinch(); return; }
    if (!single) return;

    if (single.mode === 'tap') {
      promoteTap(ev);
      return;
    }
    if (single.mode === 'drag') {
      tickDrag(ev);
      return;
    }
    if (single.mode === 'pan') {
      tickPan(ev);
    }
  }

  function promoteTap(ev) {
    const { x: sx, y: sy } = svgCoords(ev);
    const dx = sx - single.startX, dy = sy - single.startY;
    if (Math.abs(dx) < TAP_MOVE_THRESHOLD && Math.abs(dy) < TAP_MOVE_THRESHOLD) return;
    if ((single.kind === 'leaf' || single.kind === 'container') && (single.dragLeafIds || single.dragId)) {
      single.mode = 'drag';
      svg.classList.add('dragging-node');
    } else {
      single.mode = 'pan';
      svg.classList.add('panning');
    }
    single.lastX = sx; single.lastY = sy;
  }

  function tickDrag(ev) {
    const { currentSession } = pipeline.state;
    if (!currentSession) return;
    const { x: sx, y: sy } = svgCoords(ev);
    const w = screenToWorld(viewport, sx, sy);
    if (single.dragLeafIds) {
      const dx = w.x - single.startWorldX;
      const dy = w.y - single.startWorldY;
      const drags = [];
      for (const id of single.dragLeafIds) {
        const a = single.dragAnchors[id];
        if (a) drags.push({ id, x: a.x + dx, y: a.y + dy });
      }
      if (drags.length) currentSession.update({ drag: drags });
    } else {
      currentSession.update({
        drag: {
          id: single.dragId,
          x: w.x - single.grabOffsetX,
          y: w.y - single.grabOffsetY,
        },
      });
    }
    single.lastX = sx; single.lastY = sy;
  }

  function tickPan(ev) {
    const { x: sx, y: sy } = svgCoords(ev);
    pan(viewport, sx - single.lastX, sy - single.lastY);
    single.lastX = sx; single.lastY = sy;
    pipeline.paint();
  }

  function endPointer(ev) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.delete(ev.pointerId);
    try { svg.releasePointerCapture(ev.pointerId); } catch { /* capture unsupported */ }

    if (pinch && pointers.size < 2) {
      pinch = null;
      // If a pointer remains, transition to pan from where it is.
      if (pointers.size === 1) {
        const remaining = pointers.values().next().value;
        single = { mode: 'pan', lastX: remaining.x, lastY: remaining.y };
        svg.classList.add('panning');
      }
      return;
    }
    if (single && pointers.size === 0) endSingle();
  }

  function endSingle() {
    if (!single) return;
    const { currentSession } = pipeline.state;
    if (single.mode === 'drag' && currentSession) {
      releaseDrag(currentSession);
    } else if (single.mode === 'tap') {
      resolveTap(single);
    }
    svg.classList.remove('panning');
    svg.classList.remove('dragging-node');
    single = null;
  }

  function endSingleQuietly() {
    if (!single) return;
    const { currentSession } = pipeline.state;
    if (single.mode === 'drag' && currentSession) releaseDrag(currentSession);
    svg.classList.remove('panning');
    svg.classList.remove('dragging-node');
    single = null;
  }

  function releaseDrag(currentSession) {
    if (single.dragLeafIds) {
      currentSession.update({ release: single.dragLeafIds });
    } else if (single.dragId) {
      currentSession.update({ release: single.dragId });
    }
  }

  function resolveTap(s) {
    if (s.kind === 'container') {
      if (s.isHeader) {
        store.toggleCollapsed(s.nodeId);
        lastTap = null;
        return;
      }
      // Container body — double-tap window decides between drill and
      // select. Select immediately on the first tap (snappy single
      // action); a second tap replaces it with drill.
      const now = performance.now();
      if (lastTap && lastTap.id === s.nodeId && now - lastTap.time < DOUBLE_TAP_MS) {
        store.setFocusedContainer(s.nodeId);
        lastTap = null;
      } else {
        store.setSelected(s.nodeId);
        lastTap = { id: s.nodeId, time: now };
      }
      return;
    }
    if (s.kind === 'leaf') {
      store.setSelected(s.nodeId);
      lastTap = null;
      return;
    }
    // Background tap → clear selection.
    if (store.state.selectedNodeId) store.setSelected(null);
    lastTap = null;
  }

  function startPinch() {
    const pts = Array.from(pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    pinch = {
      startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      startZoom: viewport.zoom,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      startVpX: viewport.x,
      startVpY: viewport.y,
    };
  }

  function tickPinch() {
    const pts = Array.from(pointers.values()).slice(0, 2);
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;

    const desired = pinch.startZoom * (dist / pinch.startDist);
    const factor = desired / viewport.zoom;
    zoomAt(viewport, midX, midY, factor);

    // Two-finger pan: translate by midpoint delta.
    pan(viewport, midX - pinch.midX, midY - pinch.midY);
    pinch.midX = midX;
    pinch.midY = midY;

    pipeline.paint();
    updateZoomLabel();
  }

  function onKeyDown(ev) {
    if (isEditorFocused()) return;
    if (ev.code === 'Space') {
      spaceDown = true;
      svg.classList.add('pan-ready');
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Escape') {
      // Selection first (newer, more local), then drill.
      if (store.state.selectedNodeId) { store.setSelected(null); return; }
      if (store.state.viewState.focusedContainer) {
        store.setFocusedContainer(null);
      }
    }
    if (ev.key === 'f' || ev.key === 'F') { fitToView(); return; }
    if (ev.key === '+' || ev.key === '=') { centerZoom(1.2); return; }
    if (ev.key === '-' || ev.key === '_') { centerZoom(1 / 1.2); return; }
    if (ev.key === '0') { resetZoom(); return; }
  }

  function onKeyUp(ev) {
    if (ev.code === 'Space') {
      spaceDown = false;
      svg.classList.remove('pan-ready');
    }
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      pipeline.paint();
      updateZoomLabel();
    }, 100);
  }

  function centerZoom(factor) {
    const r = svg.getBoundingClientRect();
    zoomAt(viewport, r.width / 2, r.height / 2, factor);
    pipeline.paint();
    updateZoomLabel();
  }

  function resetZoom() {
    viewport.zoom = 1;
    viewport.x = 0;
    viewport.y = 0;
    pipeline.paint();
    updateZoomLabel();
  }

  function updateZoomLabel() {
    if (zoomLabelEl) zoomLabelEl.textContent = `${Math.round(viewport.zoom * 100)}%`;
  }

  function fitToView() {
    const layout = pipeline.state.currentLayout;
    if (!layout) return;
    const b = layout.bounds;
    if (!b || !b.width || !b.height) return;
    const r = svg.getBoundingClientRect();
    const padding = 40;
    const scaleX = (r.width - padding * 2) / b.width;
    const scaleY = (r.height - padding * 2) / b.height;
    const zoom = Math.min(2, Math.max(0.1, Math.min(scaleX, scaleY)));
    viewport.zoom = zoom;
    viewport.x = padding - b.x * zoom + (r.width - padding * 2 - b.width * zoom) / 2;
    viewport.y = padding - b.y * zoom + (r.height - padding * 2 - b.height * zoom) / 2;
    pipeline.paint();
    updateZoomLabel();
  }

  return { bind, centerZoom, resetZoom, fitToView, updateZoomLabel };
}
