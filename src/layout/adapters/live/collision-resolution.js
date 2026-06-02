// Collision resolution — adds a spring impulse on velocity for every
// overlapping collidable pair. The impulse is proportional to penetration
// depth; the integrator's velocity damping then smooths the motion, so
// bodies separate with an elastic, damped feel rather than snapping apart.
//
// Container = node: a container WITH children isn't a simulation body —
// its rect is derived from descendants, so "moving" it means translating
// those descendant leaves. A leaf (or empty container) IS a body and
// moves its own px/py. Both reduce to the same `resolveBodyPair`: a
// centre + half-size + a list of body indices to impulse.
//
// Pins (fx/fy) are honoured: a side with no movable body on the
// resolution axis hands its whole fraction to the other side; if neither
// side can move, the pair is left overlapping.
//
// `cfg.collision === false` is the kill-switch (handled by the caller).
// `cfg.collisionK` is the spring stiffness.

import { computeContainerRects } from './container-geometry.js';

export function resolveCollisions(state, cfg, collision) {
  const { leaves, containersWithChildren } = state;
  const N = leaves.length;
  const pad = cfg.collisionPadding;
  const k = cfg.collisionK;

  // Only nodes that declare collision labels can ever collide.
  const collidableLeaves = [];
  for (let i = 0; i < N; i++) {
    const cl = leaves[i].nodeCollision;
    if (cl && cl.size) collidableLeaves.push(i);
  }
  const collidableContainers = (containersWithChildren || []).filter(
    c => c.nodeCollision && c.nodeCollision.size,
  );
  if (!collidableLeaves.length && !collidableContainers.length) return;

  // 1) leaf vs leaf (covers leaf-leaf and empty-container pairs).
  for (let a = 0; a < collidableLeaves.length; a++) {
    const i = collidableLeaves[a];
    for (let b = a + 1; b < collidableLeaves.length; b++) {
      const j = collidableLeaves[b];
      const pair = collision.nodeNodePair(leaves[i].id, leaves[j].id);
      if (!pair) continue;
      const A = leafBody(state, i, pair.frac.a);
      const B = leafBody(state, j, pair.frac.b);
      resolveBodyPair(state, A, B, pad, k);
    }
  }

  if (collidableContainers.length) {
    const rects = computeContainerRects(state);

    // 2) leaf vs child-bearing container.
    for (const i of collidableLeaves) {
      for (const c of collidableContainers) {
        const pair = collision.nodeNodePair(leaves[i].id, c.id);
        if (!pair) continue;
        const r = rects.get(c.id);
        if (!r) continue;
        const A = leafBody(state, i, pair.frac.a);
        const B = containerBody(state, c.id, r, pair.frac.b);
        resolveBodyPair(state, A, B, pad, k);
      }
    }

    // 3) container vs container.
    for (let a = 0; a < collidableContainers.length; a++) {
      for (let b = a + 1; b < collidableContainers.length; b++) {
        const ca = collidableContainers[a], cb = collidableContainers[b];
        const pair = collision.nodeNodePair(ca.id, cb.id);
        if (!pair) continue;
        const ra = rects.get(ca.id), rb = rects.get(cb.id);
        if (!ra || !rb) continue;
        const A = containerBody(state, ca.id, ra, pair.frac.a);
        const B = containerBody(state, cb.id, rb, pair.frac.b);
        resolveBodyPair(state, A, B, pad, k);
      }
    }
  }
}

// A side of a collision: centre, half-size, the leaf indices to translate
// when this side yields, and its displacement fraction.
function leafBody(state, i, frac) {
  const n = state.leaves[i];
  return {
    cx: state.px[i], cy: state.py[i],
    hw: n.width / 2, hh: n.height / 2,
    bodies: [i], frac,
  };
}

function containerBody(state, id, rect, frac) {
  return {
    cx: rect.x + rect.width / 2,
    cy: rect.y + rect.height / 2,
    hw: rect.width / 2, hh: rect.height / 2,
    bodies: leafIndicesUnder(state, id), frac,
  };
}

function leafIndicesUnder(state, containerId) {
  const { leaves, ancestors } = state;
  const out = [];
  for (let i = 0; i < leaves.length; i++) {
    if (ancestors.get(leaves[i].id)?.has(containerId)) out.push(i);
  }
  return out;
}

function resolveBodyPair(state, A, B, pad, k) {
  const minDX = A.hw + B.hw + pad;
  const minDY = A.hh + B.hh + pad;
  const dx = B.cx - A.cx;
  const dy = B.cy - A.cy;
  const overlapX = minDX - Math.abs(dx);
  const overlapY = minDY - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return;
  const axisX = overlapX < overlapY;
  const axis = axisX ? 'x' : 'y';
  const overlap = axisX ? overlapX : overlapY;
  const sign = (axisX ? dx : dy) >= 0 ? 1 : -1;

  const movA = movableBodies(state, A.bodies, axis);
  const movB = movableBodies(state, B.bodies, axis);
  if (!movA.length && !movB.length) return;
  let fa = A.frac, fb = B.frac;
  if (!movA.length) { fa = 0; fb = 1; }
  else if (!movB.length) { fa = 1; fb = 0; }

  // Spring impulse on velocity: dv = k * overlap * fraction. The next
  // integrator step applies damping and moves positions — separation is
  // elastic and damped, never instantaneous.
  if (fa > 0) impulseBodies(state, movA, axis, -sign * overlap * fa * k);
  if (fb > 0) impulseBodies(state, movB, axis, sign * overlap * fb * k);
}

function movableBodies(state, indices, axis) {
  const { fx, fy } = state;
  const out = [];
  for (const i of indices) {
    if (axis === 'x' ? fx[i] == null : fy[i] == null) out.push(i);
  }
  return out;
}

function impulseBodies(state, indices, axis, dv) {
  const { vx, vy } = state;
  for (const i of indices) {
    if (axis === 'x') vx[i] += dv;
    else              vy[i] += dv;
  }
}

// HARD positional separation pass — guarantees same-layer padded BBoxes do not
// overlap at rest. Runs AFTER the integrator+constraint loop (positions are
// final for the tick), iterates a bounded inner loop to convergence, and
// breaks early once no body moves. Mirrors `resolveCollisions` for pair
// enumeration but writes directly to `px/py` (and zeroes `vx/vy` on the
// resolution axis so the next integrator step doesn't re-introduce overlap).
// Pins (fx/fy) are honoured exactly like in `resolveBodyPair`: a side with no
// movable body cedes its whole fraction; two pinned bodies are left as-is.
export function separateBodiesHard(state, cfg, collision, maxPasses = 8) {
  const { leaves, containersWithChildren } = state;
  const N = leaves.length;
  const pad = cfg.collisionPadding;

  const collidableLeaves = [];
  for (let i = 0; i < N; i++) {
    const cl = leaves[i].nodeCollision;
    if (cl && cl.size) collidableLeaves.push(i);
  }
  const collidableContainers = (containersWithChildren || []).filter(
    c => c.nodeCollision && c.nodeCollision.size,
  );
  if (!collidableLeaves.length && !collidableContainers.length) return;

  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false;

    // leaf vs leaf
    for (let a = 0; a < collidableLeaves.length; a++) {
      const i = collidableLeaves[a];
      for (let b = a + 1; b < collidableLeaves.length; b++) {
        const j = collidableLeaves[b];
        const pair = collision.nodeNodePair(leaves[i].id, leaves[j].id);
        if (!pair) continue;
        const A = leafBody(state, i, pair.frac.a);
        const B = leafBody(state, j, pair.frac.b);
        if (hardSeparatePair(state, A, B, pad)) moved = true;
      }
    }

    if (collidableContainers.length) {
      const rects = computeContainerRects(state);

      // leaf vs child-bearing container
      for (const i of collidableLeaves) {
        for (const c of collidableContainers) {
          const pair = collision.nodeNodePair(leaves[i].id, c.id);
          if (!pair) continue;
          const r = rects.get(c.id);
          if (!r) continue;
          const A = leafBody(state, i, pair.frac.a);
          const B = containerBody(state, c.id, r, pair.frac.b);
          if (hardSeparatePair(state, A, B, pad)) moved = true;
        }
      }

      // container vs container
      for (let a = 0; a < collidableContainers.length; a++) {
        for (let b = a + 1; b < collidableContainers.length; b++) {
          const ca = collidableContainers[a], cb = collidableContainers[b];
          const pair = collision.nodeNodePair(ca.id, cb.id);
          if (!pair) continue;
          const ra = rects.get(ca.id), rb = rects.get(cb.id);
          if (!ra || !rb) continue;
          const A = containerBody(state, ca.id, ra, pair.frac.a);
          const B = containerBody(state, cb.id, rb, pair.frac.b);
          if (hardSeparatePair(state, A, B, pad)) moved = true;
        }
      }
    }

    if (!moved) break;
  }
}

function hardSeparatePair(state, A, B, pad) {
  // The collision contract is the PADDED BBox (rect inflated by `pad` on every
  // side). Two padded BBoxes don't overlap iff centres are at least
  // hw_a + hw_b + 2*pad apart (each side contributes its own `pad`).
  // resolveBodyPair uses `pad` once because there it means "raw gap between
  // shapes", which is the elastic settling target — not the hard contract.
  const minDX = A.hw + B.hw + 2 * pad;
  const minDY = A.hh + B.hh + 2 * pad;
  const dx = B.cx - A.cx;
  const dy = B.cy - A.cy;
  const overlapX = minDX - Math.abs(dx);
  const overlapY = minDY - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return false;
  const axisX = overlapX < overlapY;
  const axis = axisX ? 'x' : 'y';
  const overlap = axisX ? overlapX : overlapY;
  const sign = (axisX ? dx : dy) >= 0 ? 1 : -1;

  const movA = movableBodies(state, A.bodies, axis);
  const movB = movableBodies(state, B.bodies, axis);
  if (!movA.length && !movB.length) return false;
  let fa = A.frac, fb = B.frac;
  if (!movA.length) { fa = 0; fb = 1; }
  else if (!movB.length) { fa = 1; fb = 0; }

  if (fa > 0) hardShiftBodies(state, movA, axis, -sign * overlap * fa);
  if (fb > 0) hardShiftBodies(state, movB, axis, sign * overlap * fb);
  return true;
}

function hardShiftBodies(state, indices, axis, delta) {
  const { px, py, vx, vy } = state;
  for (const i of indices) {
    if (axis === 'x') { px[i] += delta; vx[i] = 0; }
    else              { py[i] += delta; vy[i] = 0; }
  }
}
