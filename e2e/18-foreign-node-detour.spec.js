// Phase G — an edge whose anchors sit on opposite sides of a foreign node
// must DETOUR around the node body, not spear through it (Q3). The fix
// triggers local fission (the existing obstacle-detour) for segments that
// cross a foreign node and can't slide out (a pinned corner fixes their
// perpendicular coordinate). Without it, edges cut straight through
// intervening nodes when global fission is off (the default).

import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, setConfig, selectLayout } from './helpers.js';

// Canonical scene: triangle a-b-c + spur c-d, all on one nodeLayer so they
// pack tightly; live forces stack them so edges must cross intervening nodes.
const SCENE = [
  'connections:',
  '  - [a, b]',
  '  - [b, c]',
  '  - [c, a]',
  '  - [c, d]',
  '',
  'a: { nodeLayers: [top] }',
  'b: { nodeLayers: [top] }',
  'c: { nodeLayers: [top] }',
  'd: { nodeLayers: [top] }',
  '',
  '? [a, b]',
  ': { label: AB, nodeLayers: [top], edgeLayers: [edges] }',
  '? [b, c]',
  ': { label: BC, nodeLayers: [top], edgeLayers: [edges] }',
  '? [c, a]',
  ': { label: CA, nodeLayers: [top], edgeLayers: [edges] }',
  '? [c, d]',
  ': { label: CD, nodeLayers: [top], edgeLayers: [edges] }',
].join('\n');

const CFG = [
  'collision:',
  '  nodePad: 20',
  '  edgePad: 20',
  'live:',
  '  center: 0',
  'routing:',
  '  engine: physics',
].join('\n');

// Count routed-edge segments whose body crosses a NON-endpoint node's core.
async function foreignCoreCrossings(page) {
  return await page.evaluate(() => {
    const ir = window.__currentIR__, layout = window.__currentLayout__;
    const rects = layout.positions;
    let count = 0;
    for (const e of ir.edges) {
      const re = layout.routedEdges.get(e.id);
      if (!re || re.points.length < 2) continue;
      const allowed = new Set([e.source, e.target]);
      for (let i = 0; i < re.points.length - 1; i++) {
        const p0 = re.points[i], p1 = re.points[i + 1];
        const sx0 = Math.min(p0.x, p1.x), sx1 = Math.max(p0.x, p1.x);
        const sy0 = Math.min(p0.y, p1.y), sy1 = Math.max(p0.y, p1.y);
        for (const [nid, r] of rects) {
          if (allowed.has(nid)) continue;
          if (sx1 >= r.x && sx0 <= r.x + r.width && sy1 >= r.y && sy0 <= r.y + r.height) count++;
        }
      }
    }
    return count;
  });
}

test.describe('Phase G — edges detour around foreign nodes', () => {
  test('no routed segment crosses a foreign node body once settled', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, SCENE);
    await setConfig(page, CFG);
    await selectLayout(page, 'live');

    // Live keeps ticking; poll until the detour settles (crossings reach 0).
    let crossings = Infinity;
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      crossings = await foreignCoreCrossings(page);
      if (crossings === 0) break;
    }
    expect(crossings, 'an edge is still speared through a foreign node').toBe(0);

    // And the detour really happened via fission: at least one edge grew
    // extra corners to route around (a straight 2-point edge couldn't avoid
    // the stack).
    const maxPts = await page.evaluate(() => {
      const ir = window.__currentIR__, layout = window.__currentLayout__;
      return Math.max(...ir.edges.map(e => layout.routedEdges.get(e.id)?.points.length || 0));
    });
    expect(maxPts, 'expected at least one detoured (multi-corner) edge').toBeGreaterThan(3);
  });

  // Counter-case: when an edge declares NO collision layers, no foreign node
  // is a collision obstacle for it — fission must NOT fire even when the
  // ideal Manhattan route would graze another node's BBox. Same scenario as
  // above except only edge AB carries an edgeLayer and the other edges are
  // bare; their straight-ish routes should not get shelf-split.
  test('edges with no shared collision layer do not fission (user debug pack)', async ({ page }) => {
    const DSL_NO_LAYERS = [
      'connections:',
      '  - [a, b]',
      '  - [a, c]',
      '  - [b, d]',
      '  - [c, d]',
      '',
      'a: { nodeLayers: [top] }',
      'b: { nodeLayers: [top] }',
      'c: { nodeLayers: [top] }',
      'd: { nodeLayers: [top] }',
      '',
      '? [a, b]',
      ': { label: AB, edgeLayers: [e1] }',
    ].join('\n');
    const CFG = [
      'live:',
      '  center: 0',
      'collision: {}',
      'routing:',
      '  engine: physics',
    ].join('\n');
    await gotoFresh(page);
    await setDSL(page, DSL_NO_LAYERS);
    await setConfig(page, CFG);
    await selectLayout(page, 'live');
    await page.waitForTimeout(3500);
    const counts = await page.evaluate(() => {
      const ir = window.__currentIR__, layout = window.__currentLayout__;
      const out = {};
      for (const e of ir.edges) out[e.id] = layout.routedEdges.get(e.id)?.points.length || 0;
      return out;
    });
    // BD has no edgeLayer / nodeCollision on the edge — it must remain a
    // simple polyline (Z = 4 points max). 8+ points means shelf-split.
    expect(counts['e:b|d'], `BD got shelf-split: ${counts['e:b|d']} points`).toBeLessThanOrEqual(4);
    expect(counts['e:c|d'], `CD got shelf-split: ${counts['e:c|d']} points`).toBeLessThanOrEqual(4);
    expect(counts['e:a|c'], `AC got shelf-split: ${counts['e:a|c']} points`).toBeLessThanOrEqual(4);
  });
});
