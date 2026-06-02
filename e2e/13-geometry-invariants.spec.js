// Geometry invariants per example × router × layout.
//
// This suite catches a class of visual bugs that pixel snapshots
// can't reliably detect (anti-aliasing, font rendering, timing).
// We assert geometric properties on the live `routedEdges` map
// exposed via `window.__currentLayout__`:
//
//   1. Orthogonal router never emits a diagonal segment — every
//      consecutive pair of points shares either x or y. This catches
//      regressions in clip-anchors / snap-container-anchors that
//      move an endpoint without realigning its waypoint neighbour.
//
//   2. Source/target anchors sit on the perimeter of their endpoint
//      node's bounding rect (not deep inside, not far outside).
//
// The matrix is intentionally narrow (static layouts, all three routers,
// the `intro` example) to keep total runtime short. `intro` declares a
// shared collision layer, so its nodes spread into a clean, non-degenerate
// layout under the static adapters. `live` depends on simulation
// convergence and `forces` is designed for live mode, so both are skipped
// here — their stability is exercised by other specs.

import { test, expect } from '@playwright/test';
import { gotoFresh, selectLayout, selectRouter } from './helpers.js';

const EXAMPLES = ['intro'];
const LAYOUTS  = ['custom', 'off'];
const ROUTERS  = ['straight', 'orthogonal', 'curved'];

const TOL = 1.0;  // px tolerance for "on perimeter" checks

async function loadExample(page, exampleId, layoutId, routerId) {
  await gotoFresh(page);
  await page.evaluate((id) => {
    window.__store__.setDSL(window.__examples__[id]);
  }, exampleId);
  await selectLayout(page, layoutId);
  await selectRouter(page, routerId);
  // Allow one paint pass after the cascade of setDSL → router → layout.
  await page.waitForTimeout(180);
}

async function readGeometry(page) {
  return page.evaluate(() => {
    const layout = window.__currentLayout__;
    const ir = window.__currentIR__;
    if (!layout || !ir) return null;
    const positions = {};
    for (const [id, rect] of layout.positions) {
      positions[id] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    if (layout.containers) {
      for (const [id, rect] of layout.containers) {
        positions[id] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
    }
    const edges = [];
    for (const e of ir.edges) {
      const re = layout.routedEdges.get(e.id);
      if (!re) continue;
      edges.push({ id: e.id, source: e.source, target: e.target, points: re.points });
    }
    return { positions, edges };
  });
}

function onPerimeter(p, rect, tol = TOL) {
  const onX = Math.abs(p.x - rect.x) <= tol || Math.abs(p.x - (rect.x + rect.width)) <= tol;
  const onY = Math.abs(p.y - rect.y) <= tol || Math.abs(p.y - (rect.y + rect.height)) <= tol;
  const insideX = p.x >= rect.x - tol && p.x <= rect.x + rect.width + tol;
  const insideY = p.y >= rect.y - tol && p.y <= rect.y + rect.height + tol;
  return (onX && insideY) || (onY && insideX);
}

function isOrthogonalSegment(a, b, tol = 0.01) {
  const sameX = Math.abs(a.x - b.x) <= tol;
  const sameY = Math.abs(a.y - b.y) <= tol;
  return sameX || sameY;
}

for (const example of EXAMPLES) {
  for (const layout of LAYOUTS) {
    for (const router of ROUTERS) {
      test(`geometry invariants — ${example} × ${layout} × ${router}`, async ({ page }) => {
        await loadExample(page, example, layout, router);
        const geo = await readGeometry(page);
        expect(geo, 'currentLayout/currentIR exposed').not.toBeNull();
        expect(geo.edges.length, 'at least one edge routed').toBeGreaterThan(0);

        const violations = [];

        for (const edge of geo.edges) {
          const pts = edge.points;
          if (pts.length < 2) {
            violations.push(`edge ${edge.id}: only ${pts.length} point(s)`);
            continue;
          }

          // Invariant 1: anchors on the perimeter of source/target rects.
          const srcRect = geo.positions[edge.source];
          const tgtRect = geo.positions[edge.target];
          if (srcRect && !onPerimeter(pts[0], srcRect)) {
            violations.push(
              `edge ${edge.id}: sourceAnchor ${JSON.stringify(pts[0])} not on perimeter of ${edge.source} ${JSON.stringify(srcRect)}`,
            );
          }
          if (tgtRect && !onPerimeter(pts[pts.length - 1], tgtRect)) {
            violations.push(
              `edge ${edge.id}: targetAnchor ${JSON.stringify(pts[pts.length - 1])} not on perimeter of ${edge.target} ${JSON.stringify(tgtRect)}`,
            );
          }

          // Invariant 2: orthogonal router emits only axis-aligned segments.
          if (router === 'orthogonal') {
            for (let i = 0; i < pts.length - 1; i++) {
              if (!isOrthogonalSegment(pts[i], pts[i + 1])) {
                violations.push(
                  `edge ${edge.id}: segment ${i}→${i + 1} is diagonal (${JSON.stringify(pts[i])} → ${JSON.stringify(pts[i + 1])})`,
                );
              }
            }
          }
        }

        expect(violations, `geometry violations:\n  ${violations.join('\n  ')}`).toEqual([]);
      });
    }
  }
}
