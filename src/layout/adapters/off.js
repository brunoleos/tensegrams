// 'off' adapter: respect explicit pins from DSL; unpinned nodes cluster
// at the board centre. Separation is the collision post-pass's job —
// without a shared collision layer, unpinned nodes stay stacked.

import { emptySession, centerSeed } from '../adapter.js';
import { buildCollisionResolver } from '../collision.js';
import { applyCollisionPostPass } from '../collision-postpass.js';

export const adapter = {
  id: 'off',
  label: 'Off (manual pins)',
  caps: { containers: true, ports: false, layered: false, interactive: false, providesRouting: false },
  async load() { /* nothing to load */ },
  start(ir, opts = {}) {
    const session = emptySession();

    const containers = ir.nodes.filter(n => n.hasChildren);
    const leaves = ir.nodes.filter(n => !n.hasChildren);

    // Place leaves: pinned at their pin, the rest in a tight cluster at
    // the origin (deterministic seed — see centerSeed).
    const unpinnedCount = leaves.filter(n => !n.pinned).length;
    let seedIdx = 0;
    for (const n of leaves) {
      let x, y;
      if (n.pinned) {
        x = n.pinned.x;
        y = n.pinned.y;
      } else {
        const s = centerSeed(seedIdx++, unpinnedCount, n.width, n.height);
        x = s.x;
        y = s.y;
      }
      session.positions.set(n.id, { x, y, width: n.width, height: n.height });
    }

    // Containers: bounding box of children (or fallback to pin / centre for
    // containers with no surviving children — typically collapsed or
    // layer-filtered down to empty).
    for (const c of containers) {
      const children = ir.nodes.filter(n => n.parent === c.id);
      if (children.length) {
        const bbox = bboxOf(children, session.positions);
        const pad = c.padding || 24;
        session.containers.set(c.id, {
          x: bbox.minX - pad,
          y: bbox.minY - pad - 16, // header bar
          width: (bbox.maxX - bbox.minX) + pad * 2,
          height: (bbox.maxY - bbox.minY) + pad * 2 + 16,
          padding: pad,
        });
      } else {
        const x = c.pinned ? c.pinned.x : -100;
        const y = c.pinned ? c.pinned.y : -30;
        session.containers.set(c.id, {
          x, y, width: 200, height: 60, padding: c.padding || 24,
        });
      }
    }

    // Collision post-pass: nudge nodes sharing a collision layer apart.
    applyCollisionPostPass(ir, session.positions, session.containers,
      buildCollisionResolver(ir), { ...(opts.collision || {}), header: 16 });
    session.bounds = computeBounds(session.positions, session.containers);

    // Emit asynchronously so callers can subscribe first.
    queueMicrotask(() => {
      if (session.stopped) return;
      session.emit('tick', session);
      session.emit('end', session);
    });

    return session;
  },
};

function bboxOf(nodes, positions) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const p = positions.get(n.id);
    if (!p) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + p.width > maxX) maxX = p.x + p.width;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function computeBounds(positions, containers) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const merge = (x, y, w, h) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  };
  for (const p of positions.values()) merge(p.x, p.y, p.width, p.height);
  for (const c of containers.values()) merge(c.x, c.y, c.width, c.height);
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
