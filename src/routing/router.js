// Edge Router contract. Plugin layer independent from layout.
//
// @typedef {Object} EdgeRouter
// @property {string} id
// @property {string} label
// @property {EdgeRouterCapabilities} caps
// @property {() => Promise<void>} load
// @property {(ir: GraphIR, positions: Map, opts?: RoutingOptions) => Map<string, RoutedEdge>} route
//
// @typedef {Object} RoutedEdge
// @property {Array<{x:number,y:number}>} points
// @property {{x:number,y:number}} sourceAnchor
// @property {{x:number,y:number}} targetAnchor

// Common util: clip a line from a node's center towards (tx, ty) to the
// intersection with the node's bounding rect.
export function clipToRect(rect, tx, ty) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hx = rect.width / 2;
  const hy = rect.height / 2;
  const scale = Math.min(
    hx / Math.abs(dx || 1e-9),
    hy / Math.abs(dy || 1e-9),
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function centerOf(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
