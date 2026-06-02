// Curved router: emits a "C" hint with control points on the points array.
// Renderer recognizes the 'curve' kind and draws a cubic Bezier.

import { clipToRect, centerOf } from '../router.js';

export const router = {
  id: 'curved',
  label: 'Curvo (Bezier)',
  caps: { obstacleAware: false, orthogonal: false, bundling: false },
  async load() {},
  route(ir, positions) {
    const out = new Map();
    for (const e of ir.edges) {
      const s = positions.get(e.source);
      const t = positions.get(e.target);
      if (!s || !t) continue;
      const sC = centerOf(s);
      const tC = centerOf(t);
      const sourceAnchor = clipToRect(s, tC.x, tC.y);
      const targetAnchor = clipToRect(t, sC.x, sC.y);
      // Two control points pulled along the source→target axis.
      const dx = targetAnchor.x - sourceAnchor.x;
      const dy = targetAnchor.y - sourceAnchor.y;
      const tang = Math.hypot(dx, dy) * 0.4;
      const ux = dx / (Math.hypot(dx, dy) || 1);
      const uy = dy / (Math.hypot(dx, dy) || 1);
      const c1 = { x: sourceAnchor.x + ux * tang, y: sourceAnchor.y + uy * tang };
      const c2 = { x: targetAnchor.x - ux * tang, y: targetAnchor.y - uy * tang };
      out.set(e.id, {
        points: [sourceAnchor, c1, c2, targetAnchor],
        sourceAnchor,
        targetAnchor,
        kind: 'curve',
      });
    }
    return out;
  },
};
