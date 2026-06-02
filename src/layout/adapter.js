// Layout Adapter contract (JSDoc — no TypeScript).
//
// Every adapter implements the same session-based contract. Static adapters
// (off, custom, dagre, elk) emit one 'tick' then 'end'. Streaming adapters
// (live) emit ticks continuously until stop() or alpha-decay.
//
// @typedef {Object} LayoutAdapter
// @property {string} id
// @property {string} label
// @property {LayoutCapabilities} caps
// @property {() => Promise<void>} load
// @property {(ir: GraphIR, opts: LayoutOptions, signal?: AbortSignal) => LayoutSession} start
//
// @typedef {Object} LayoutCapabilities
// @property {boolean} containers
// @property {boolean} ports
// @property {boolean} layered
// @property {boolean} interactive
// @property {boolean} providesRouting
//
// @typedef {Object} LayoutOptions
// @property {Set<string>=} scope    // engine selective-loading hint: if provided,
//                                   // adapter may compute positions only for these
//                                   // ids and leave others at last known positions.
//                                   // Used by live mode for incremental re-layout.
// @property {{x,y,width,height}=} viewportWorld  // optional viewport rect in world
//                                                // coords; offline adapters ignore it,
//                                                // live/streaming may down-prioritize
//                                                // off-screen forces.
//
// @typedef {Object} LayoutSession
// @property {Map<string, {x:number,y:number,width:number,height:number}>} positions
// @property {Map<string, {x:number,y:number,width:number,height:number,padding:number}>} containers
// @property {Map<string, RoutedEdge>=} routedEdges
// @property {{x:number,y:number,width:number,height:number}} bounds
// @property {(event: 'tick'|'end'|'error', cb: Function) => () => void} on
// @property {(patch: Object) => void} update
// @property {() => void} stop

export function emptySession() {
  const listeners = { tick: new Set(), end: new Set(), error: new Set() };
  let stopped = false;
  return {
    positions: new Map(),
    containers: new Map(),
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    on(event, cb) {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    emit(event, payload) {
      for (const cb of listeners[event]) cb(payload);
    },
    update() { /* no-op for static */ },
    stop() { stopped = true; },
    get stopped() { return stopped; },
  };
}

export const DEFAULT_OPTIONS = {};

// Deterministic seed for the static adapters (custom / off): every body
// lands in a tight overlapping cluster around the origin. Positions are
// distinct (never exactly coincident) so edge geometry stays well-defined
// and the collision post-pass gets a non-degenerate starting spread.
// Without a collision layer the bodies simply stay stacked here.
export function centerSeed(index, count, width, height) {
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  const r = 28 + 12 * (index % 3);
  return {
    x: Math.cos(angle) * r - width / 2,
    y: Math.sin(angle) * r - height / 2,
  };
}
