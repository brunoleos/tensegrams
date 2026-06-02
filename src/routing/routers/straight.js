import { clipToRect, centerOf } from '../router.js';

export const router = {
  id: 'straight',
  label: 'Reto',
  caps: { obstacleAware: false, orthogonal: false, bundling: false },
  async load() {},
  route(ir, positions) {
    const out = new Map();
    for (const e of ir.edges) {
      const sRect = positions.get(e.source);
      const tRect = positions.get(e.target);
      if (!sRect || !tRect) continue;
      const sC = centerOf(sRect);
      const tC = centerOf(tRect);
      const sourceAnchor = clipToRect(sRect, tC.x, tC.y);
      const targetAnchor = clipToRect(tRect, sC.x, sC.y);
      out.set(e.id, {
        points: [sourceAnchor, targetAnchor],
        sourceAnchor,
        targetAnchor,
      });
    }
    return out;
  },
};
