// 'custom' adapter: deterministic, non-animated layout.
//
// Every leaf node is placed centered on the board origin; container
// rects are derived bottom-up from their children. The collision
// post-pass is then the ONLY thing that spreads nodes apart — without a
// shared collision layer, nodes stay stacked at the centre (intentional:
// separation is explicit, never implicit).

import { emptySession, DEFAULT_OPTIONS, centerSeed } from '../../adapter.js';
import { buildCollisionResolver } from '../../collision.js';
import { applyCollisionPostPass } from '../../collision-postpass.js';

const HEADER = 22;

export const adapter = {
  id: 'custom',
  label: 'Custom (estático)',
  caps: { containers: true, ports: false, layered: false, interactive: false, providesRouting: false },
  async load() { /* nothing */ },
  start(ir, opts = {}) {
    const session = emptySession();
    const merged = { ...DEFAULT_OPTIONS, ...opts };

    // 1. Every leaf starts in a tight overlapping cluster at the origin.
    const leaves = ir.nodes.filter(n => !n.hasChildren);
    leaves.forEach((n, i) => {
      const s = centerSeed(i, leaves.length, n.width, n.height);
      session.positions.set(n.id, { x: s.x, y: s.y, width: n.width, height: n.height });
    });

    // 2. Container rects from children bbox, inner-first. `ir.nodes` lists
    //    a container before its descendants, so reverse order is bottom-up.
    const containers = ir.nodes.filter(n => n.hasChildren);
    for (let i = containers.length - 1; i >= 0; i--) {
      deriveContainerRect(containers[i], ir, session);
    }

    // 3. Collision post-pass: nudge nodes sharing a collision layer apart.
    //    minWidth/minHeight mirror the container size floor so a reflow
    //    after the nudge can't shrink a frame below it.
    applyCollisionPostPass(ir, session.positions, session.containers,
      buildCollisionResolver(ir),
      { ...(merged.collision || {}), header: HEADER, minWidth: 120, minHeight: 60 });
    session.bounds = computeBounds(session.positions, session.containers);

    queueMicrotask(() => {
      if (session.stopped) return;
      session.emit('tick', session);
      session.emit('end', session);
    });

    return session;
  },
};

function deriveContainerRect(c, ir, session) {
  const children = ir.nodes.filter(n => n.parent === c.id);
  const pad = c.padding || 24;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hits = 0;
  for (const ch of children) {
    const r = session.positions.get(ch.id) || session.containers.get(ch.id);
    if (!r) continue;
    hits++;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  if (hits === 0) {
    // Empty container (no surviving children) — a default frame at origin.
    session.containers.set(c.id, { x: -100, y: -30, width: 200, height: 60, padding: pad });
    return;
  }
  session.containers.set(c.id, {
    x: minX - pad,
    y: minY - pad - HEADER,
    width: Math.max(120, (maxX - minX) + pad * 2),
    height: Math.max(60, (maxY - minY) + pad * 2 + HEADER),
    padding: pad,
  });
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
