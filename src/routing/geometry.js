// Shared geometry helpers used by both the routing pipeline and the
// renderer. Lives here (under routing/) because the routing layer
// already owns polyline math; the renderer is the consumer.
//
// Single source of truth — when the routing layer needs to predict
// where the renderer will paint something (e.g., a label centred at
// the midpoint of a polyline), both sides MUST agree byte-for-byte.

// Midpoint of a polyline:
//   - 2 points → arithmetic mean.
//   - odd length → the middle vertex itself.
//   - even length → arithmetic mean of the two middle vertices.
//
// This is the "by vertex count" midpoint, not the "by arc length"
// midpoint. Cheap and stable; what the renderer uses to place edge
// labels (`src/renderer/edges.js`).
export function midPoint(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y };
  if (points.length === 2) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }
  const mid = Math.floor(points.length / 2);
  if (points.length % 2 === 1) return { x: points[mid].x, y: points[mid].y };
  return {
    x: (points[mid - 1].x + points[mid].x) / 2,
    y: (points[mid - 1].y + points[mid].y) / 2,
  };
}
