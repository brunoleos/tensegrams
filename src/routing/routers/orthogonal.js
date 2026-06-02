// Manhattan routing: anchor on facing edge, route via a midline. The
// midline sits at the midpoint of the two ANCHORS (not the centers),
// which keeps it in the gap between the rects even when one endpoint
// is a wide container — averaging centers can drag the midline back
// across the anchor and create an inside-container U-turn.
//
// No obstacle avoidance. Anchor correctness against foreign containers
// is enforced downstream by `clipAnchorsToContainerFaces`.

import { centerOf } from '../router.js';

export const router = {
  id: 'orthogonal',
  label: 'Ortogonal (Manhattan)',
  caps: { obstacleAware: false, orthogonal: true, bundling: false },
  async load() {},
  route(ir, positions) {
    const out = new Map();
    for (const e of ir.edges) {
      const s = positions.get(e.source);
      const t = positions.get(e.target);
      if (!s || !t) continue;

      const sC = centerOf(s);
      const tC = centerOf(t);
      const dx = tC.x - sC.x;
      const dy = tC.y - sC.y;
      const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
      let sourceAnchor, targetAnchor, mid;

      if (horizontalFirst) {
        sourceAnchor = { x: dx >= 0 ? s.x + s.width : s.x, y: sC.y };
        targetAnchor = { x: dx >= 0 ? t.x : t.x + t.width, y: tC.y };
        const midX = (sourceAnchor.x + targetAnchor.x) / 2;
        mid = [{ x: midX, y: sourceAnchor.y }, { x: midX, y: targetAnchor.y }];
      } else {
        sourceAnchor = { x: sC.x, y: dy >= 0 ? s.y + s.height : s.y };
        targetAnchor = { x: tC.x, y: dy >= 0 ? t.y : t.y + t.height };
        const midY = (sourceAnchor.y + targetAnchor.y) / 2;
        mid = [{ x: sourceAnchor.x, y: midY }, { x: targetAnchor.x, y: midY }];
      }

      out.set(e.id, {
        points: [sourceAnchor, ...mid, targetAnchor],
        sourceAnchor,
        targetAnchor,
      });
    }
    return out;
  },
};
