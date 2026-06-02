const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

export function createViewport() {
  return { x: 0, y: 0, zoom: 1 };
}

export function screenToWorld(vp, sx, sy) {
  return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
}

export function worldToScreen(vp, wx, wy) {
  return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y };
}

export function zoomAt(vp, sx, sy, factor) {
  const w = screenToWorld(vp, sx, sy);
  vp.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.zoom * factor));
  vp.x = sx - w.x * vp.zoom;
  vp.y = sy - w.y * vp.zoom;
}

export function pan(vp, dx, dy) {
  vp.x += dx;
  vp.y += dy;
}
