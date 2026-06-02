// Container geometry derived from simulated positions.
//
// Each container's visible rect is the bounding box of its transitive
// leaf descendants, expanded by padding and a header strip. EMPTY
// containers (no descendant in the projected IR — typical when
// collapse-filter removed everything below) sit in `leaves[]` as their
// own body and contribute a default-sized rect anchored on their px/py.
//
// Same expansion used both for routing (so anchors land on the visible
// edge) and for the renderer (so the frame matches).
//
// All functions act on a shared `state` object — see `pins.js` for the
// shape (the engine in `index.js` owns the typed arrays).

// Header strip height in world units. Shared with the renderer's
// `placeContainer` and with `applyConstraint('parent-bounds')`.
export const HEADER = 22;

export function computeContainerRects(state, header = HEADER) {
  const { containers, leaves, px, py, idToIndex, ancestors } = state;
  const N = leaves.length;
  const out = new Map();
  for (const c of containers) {
    // Empty container path: it is its own body in `leaves`.
    const ownIdx = idToIndex.get(c.id);
    if (ownIdx !== undefined) {
      const w = Math.max(120, c.width);
      const h = Math.max(60, c.height);
      out.set(c.id, {
        x: px[ownIdx] - w / 2,
        y: py[ownIdx] - h / 2,
        width: w,
        height: h,
      });
      continue;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hits = 0;
    for (let i = 0; i < N; i++) {
      if (!ancestors.get(leaves[i].id)?.has(c.id)) continue;
      const hw = leaves[i].width / 2, hh = leaves[i].height / 2;
      if (px[i] - hw < minX) minX = px[i] - hw;
      if (py[i] - hh < minY) minY = py[i] - hh;
      if (px[i] + hw > maxX) maxX = px[i] + hw;
      if (py[i] + hh > maxY) maxY = py[i] + hh;
      hits++;
    }
    if (hits === 0) continue;
    const pad = c.padding || 24;
    out.set(c.id, {
      x: minX - pad,
      y: minY - pad - header,
      width:  (maxX - minX) + pad * 2,
      height: (maxY - minY) + pad * 2 + header,
    });
  }
  return out;
}
