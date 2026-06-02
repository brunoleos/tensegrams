// Frozen-mode pin bookkeeping.
//
// During a drag, every body OTHER than the one(s) under the cursor is
// temporarily pinned at its current position (via fx/fy). On release,
// the pin inverts: the released body becomes the new non-DSL pin and
// every other body (including previously-released ones) is unfrozen.
//
// DSL pins (`leaves[i].pinned`) are immovable regardless of state and
// are explicitly skipped here.
//
// All functions act on a shared `state` object carrying the typed
// position arrays (fx/fy/px/py) and the leaves[] list. The state is
// owned by `runSession` in `index.js`; this module is just a pure
// view onto it. No closures, no module-level state.
//
// Contract: `state.fx`, `state.fy`, `state.px`, `state.py` and
// `state.leaves` are stable references for the lifetime of a session.
// The engine never reassigns them — it mutates elements in place —
// so the destructured locals below are safe across calls.

export function setsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function freezeOthersForDrag(state, activeSet) {
  const { fx, fy, px, py, leaves } = state;
  const N = leaves.length;
  for (let i = 0; i < N; i++) {
    if (activeSet.has(i)) continue;
    if (leaves[i].pinned) continue;
    if (fx[i] == null) fx[i] = px[i];
    if (fy[i] == null) fy[i] = py[i];
  }
}

export function unfreezeOthersAfterRelease(state, activeSet) {
  const { fx, fy, leaves } = state;
  const N = leaves.length;
  for (let i = 0; i < N; i++) {
    if (activeSet.has(i)) continue;
    if (leaves[i].pinned) continue;
    fx[i] = null;
    fy[i] = null;
  }
}
