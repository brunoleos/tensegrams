import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, selectLayout } from './helpers.js';

// The collision-debug overlay draws node/edge BBoxes in WORLD coordinates,
// so it must live inside the pan/zoom viewport group (`g.vp`) — exactly like
// the nodes/edges groups. Rendered anywhere else it draws in raw coords:
// visually displaced and frozen under pan/zoom. No earlier spec enabled the
// "Debug" checkbox, so that whole path was uncovered; this locks it down.
test.describe('debug collision overlay', () => {
  async function enableDebug(page) {
    await page.locator('#debug-bbox-checkbox').check();
    await page.waitForSelector('svg#canvas g.collision-debug');
  }

  // getScreenCTM() folds in every ancestor transform up to the SVG. If the
  // overlay shares the viewport group with the nodes, their matrices are
  // identical; if it sits outside `g.vp`, the viewport's translate/scale is
  // missing and they diverge.
  const ctmMatchesNodes = (page) => page.evaluate(() => {
    const ov = document.querySelector('svg#canvas g.collision-debug');
    const nodes = document.querySelector('svg#canvas g.nodes');
    const a = ov.getScreenCTM();
    const b = nodes.getScreenCTM();
    const close = (x, y) => Math.abs(x - y) < 0.01;
    return close(a.a, b.a) && close(a.d, b.d) && close(a.e, b.e) && close(a.f, b.f);
  });

  test('renders inside the pan/zoom viewport group', async ({ page }) => {
    await gotoFresh(page);
    await enableDebug(page);

    // Must be a direct child of `g.vp`, not a sibling of it.
    await expect(page.locator('svg#canvas g.vp > g.collision-debug')).toBeAttached();
    // And carry no transform of its own (it inherits the viewport's).
    expect(await page.locator('svg#canvas g.collision-debug').getAttribute('transform')).toBeNull();
  });

  test('tracks pan/zoom — stays aligned with the diagram content', async ({ page }) => {
    await gotoFresh(page);
    await enableDebug(page);

    // Aligned at the initial (already non-identity) viewport transform...
    expect(await ctmMatchesNodes(page)).toBe(true);

    // ...and still aligned after a zoom. A frozen overlay would diverge here.
    await page.locator('#zoom-in').click();
    await page.waitForTimeout(150);
    expect(await ctmMatchesNodes(page)).toBe(true);
  });
});

// Rendering contract for the BBox/layer visualization. The overlay must draw
// exactly the geometry the engine treats as collidable: one thin layer line
// per collision layer (in a fixed global slot, so the same layer lands at the
// same offset across every box), the label BBox tracking the actual label,
// and NO BBox for endpoint legs.
test.describe('debug overlay — BBox/layer rendering contract', () => {
  async function enableDebug(page) {
    await page.locator('#debug-bbox-checkbox').check();
    await page.waitForSelector('svg#canvas g.collision-debug', { state: 'attached' });
    await page.waitForTimeout(800); // let the live sim settle
  }

  test('node layer marks: one ascending-diagonal per layer, at a fixed global slot', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\na: { nodeLayers: [top] }\nb: { nodeLayers: [top, nb] }\n');
    await enableDebug(page);

    // ALL layers shown (was: only the first) — a=[top]→1, b=[top,nb]→2.
    await expect(page.locator('line.dbg-layer-line[data-owner="a"]')).toHaveCount(1);
    await expect(page.locator('line.dbg-layer-line[data-owner="b"]')).toHaveCount(2);
    await expect(page.locator('line.dbg-layer-line[data-owner="b"][data-layer="nb"]')).toHaveCount(1);

    const g = await page.evaluate(() => {
      const n = (el, a) => Number(el.getAttribute(a));
      const cx = (el) => (n(el, 'x1') + n(el, 'x2')) / 2;
      const lineA = document.querySelector('line.dbg-layer-line[data-owner="a"][data-layer="top"]');
      const boxA = document.querySelector('rect.dbg-bbox[data-node="a"]');
      const lineB = document.querySelector('line.dbg-layer-line[data-owner="b"][data-layer="top"]');
      const boxB = document.querySelector('rect.dbg-bbox[data-node="b"]');
      const lineBnb = document.querySelector('line.dbg-layer-line[data-owner="b"][data-layer="nb"]');
      const topX = n(lineA, 'y1') < n(lineA, 'y2') ? n(lineA, 'x1') : n(lineA, 'x2');
      const botX = n(lineA, 'y1') < n(lineA, 'y2') ? n(lineA, 'x2') : n(lineA, 'x1');
      return {
        slant: Math.abs(n(lineA, 'x1') - n(lineA, 'x2')),
        topX, botX,
        ymin: Math.min(n(lineA, 'y1'), n(lineA, 'y2')), ymax: Math.max(n(lineA, 'y1'), n(lineA, 'y2')),
        by: n(boxA, 'y'), bh: n(boxA, 'height'),
        offA: cx(lineA) - n(boxA, 'x'),
        offB: cx(lineB) - n(boxB, 'x'),
        cxTop: cx(lineB), cxNb: cx(lineBnb),
      };
    });
    expect(g.slant).toBeGreaterThan(1);                        // diagonal, not vertical
    expect(g.topX).toBeGreaterThan(g.botX);                    // ascending "/"
    expect(Math.abs(g.ymin - g.by)).toBeLessThan(1);           // spans full bbox height
    expect(Math.abs(g.ymax - (g.by + g.bh))).toBeLessThan(1);
    expect(Math.abs(g.offA - g.offB)).toBeLessThan(1);         // fixed global slot (centre)
    expect(Math.abs(g.cxTop - g.cxNb)).toBeGreaterThan(1);     // distinct slots
  });

  test('layer colours are distinct per layer; shared layers share a colour', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n  - [b, c]\na: { nodeLayers: [top] }\nb: { nodeLayers: [top, nb] }\nc: { nodeLayers: [top, nc] }\n');
    await enableDebug(page);
    const c = await page.evaluate(() => {
      const s = (sel) => document.querySelector(sel)?.getAttribute('stroke');
      return {
        bNb: s('line.dbg-layer-line[data-owner="b"][data-layer="nb"]'),
        cNc: s('line.dbg-layer-line[data-owner="c"][data-layer="nc"]'),
        aTop: s('line.dbg-layer-line[data-owner="a"][data-layer="top"]'),
        bTop: s('line.dbg-layer-line[data-owner="b"][data-layer="top"]'),
      };
    });
    const hue = (s) => { const m = /hsl\(\s*([-\d.]+)/.exec(s || ''); return m ? parseFloat(m[1]) : NaN; };
    expect(c.bNb).toBeTruthy();
    expect(c.cNc).toBeTruthy();
    const dh = Math.abs(hue(c.bNb) - hue(c.cNc));
    expect(Math.min(dh, 360 - dh)).toBeGreaterThan(20); // visually distinct, not near-identical
    expect(c.aTop).toBe(c.bTop);     // same layer → same colour
  });

  test('edge layer marks: one descending-diagonal per edge layer', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n? [a, b]\n: { label: AB, edgeLayers: [edges, e1] }\n');
    await enableDebug(page);
    await expect(page.locator('line.dbg-layer-line[data-owner="e:a|b"]')).toHaveCount(2);
    await expect(page.locator('line.dbg-layer-line[data-owner="e:a|b"][data-layer="e1"]')).toHaveCount(1);
    const desc = await page.evaluate(() => {
      const el = document.querySelector('line.dbg-layer-line[data-owner="e:a|b"][data-layer="e1"]');
      const n = (a) => Number(el.getAttribute(a));
      const rightY = n('x1') > n('x2') ? n('y1') : n('y2');
      const leftY = n('x1') > n('x2') ? n('y2') : n('y1');
      return { slant: Math.abs(n('x1') - n('x2')), rightY, leftY };
    });
    expect(desc.slant).toBeGreaterThan(0.5);
    expect(desc.rightY).toBeGreaterThan(desc.leftY); // descending "\" (larger x → larger y)
  });

  test('edge marks: ascending "/" for its node layers, descending "\\" for its edge layers', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n? [a, b]\n: { label: AB, nodeLayers: [top], edgeLayers: [edges, e1] }\n');
    await enableDebug(page);
    const marks = await page.evaluate(() => {
      return [...document.querySelectorAll('line.dbg-layer-line[data-owner="e:a|b"]')].map(el => {
        const n = (a) => Number(el.getAttribute(a));
        return {
          layer: el.getAttribute('data-layer'),
          type: el.getAttribute('data-coltype'),
          asc: (n('x2') - n('x1')) * (n('y2') - n('y1')) < 0, // "/" ⇒ true, "\" ⇒ false
        };
      });
    });
    const nodeMarks = marks.filter(m => m.type === 'node').map(m => m.layer).sort();
    const edgeMarks = marks.filter(m => m.type === 'edge').map(m => m.layer).sort();
    expect(nodeMarks).toEqual(['top']);              // edge's nodeLayers → node-collision marks
    expect(edgeMarks).toEqual(['e1', 'edges']);      // edge's edgeLayers → edge-collision marks
    // direction encodes the collision TYPE, not the owner kind
    expect(marks.filter(m => m.type === 'node').every(m => m.asc)).toBe(true);   // "/"
    expect(marks.filter(m => m.type === 'edge').every(m => !m.asc)).toBe(true);  // "\"
  });

  test('node-layer slots are INDEPENDENT of edge-layer count', async ({ page }) => {
    // Slots for "/" marks live in a node-only space; adding/removing edgeLayers
    // (which nodes never carry) must NOT shift node-layer slot positions.
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\na: { nodeLayers: [top] }\nb: { nodeLayers: [top, nb] }\n? [a, b]\n: { edgeLayers: [edges, e1, e2] }\n');
    await enableDebug(page);
    const ratio = await page.evaluate(() => {
      const n = (el, a) => Number(el.getAttribute(a));
      const line = document.querySelector('line.dbg-layer-line[data-owner="a"][data-layer="top"]');
      const box = document.querySelector('rect.dbg-bbox[data-node="a"]');
      const cx = (n(line, 'x1') + n(line, 'x2')) / 2;
      return (cx - n(box, 'x')) / n(box, 'width');
    });
    // 2 node-layers (top, nb) → slot(top)=0 → centre at (0+0.5)/2 = 0.25 of bbox width.
    // If edgeLayers leaked into the slot space, N would be 5 and ratio ≈ 0.1.
    expect(ratio).toBeCloseTo(0.25, 1);
  });

  test('edge segment BBox stroke reflects the edge-layer, not the node-layer', async ({ page }) => {
    // The edge box is an EDGE thing; its colour should track its edgeLayer
    // ('edges' → amber/red), independent of whether the edge also carries
    // nodeLayers (which would shift it to the nodeLayer colour).
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n? [a, b]\n: { nodeLayers: [top], edgeLayers: [edges] }\n');
    await enableDebug(page);
    const stroke = await page.locator('rect.dbg-bbox[data-kind="edge-seg"]').first().getAttribute('stroke');
    expect(stroke).toBe('#ff6b6b'); // 'edges' default colour
  });

  test('label BBox follows the rendered label, not a polyline vertex', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n? [a, b]\n: { label: AB, edgeLayers: [edges] }\n');
    await selectLayout(page, 'live'); // label BBoxes are measured only in the live session
    await enableDebug(page);
    const overlaps = await page.evaluate(() => {
      const text = document.querySelector('g.edges text.edge-label');
      const box = document.querySelector('rect.dbg-bbox[data-kind="label"]');
      if (!text || !box) return false;
      const lb = text.getBBox();
      const n = (a) => Number(box.getAttribute(a));
      const b = { x: n('x'), y: n('y'), w: n('width'), h: n('height') };
      return !(b.x + b.w <= lb.x || lb.x + lb.width <= b.x || b.y + b.h <= lb.y || lb.y + lb.height <= b.y);
    });
    expect(overlaps).toBe(true);
  });

  test('edge segments keep BBoxes (incl. first/last) but clipped at the connection point', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\na: { nodeLayers: [top] }\nb: { nodeLayers: [top] }\n? [a, b]\n: { label: AB, edgeLayers: [edges] }\n');
    await selectLayout(page, 'live'); // separated nodes ⇒ clean routed anchors
    await enableDebug(page);
    // The endpoint POINT has no BBox, but the first/last SEGMENT still does.
    await expect(page.locator('rect.dbg-bbox[data-kind="edge-seg"][data-seg="0"]')).toHaveCount(1);
    // ...and no segment BBox overlaps its own endpoint nodes (box capped at the connection point).
    const diag = await page.evaluate(() => {
      const n = (el, a) => Number(el.getAttribute(a));
      const rect = (el) => ({ x: n(el, 'x'), y: n(el, 'y'), w: n(el, 'width'), h: n(el, 'height') });
      const nodeRect = (id) => {
        const g = document.querySelector(`g.node[data-id="${id}"]`);
        const m = (g.getAttribute('transform') || '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
        return { x: +m[1], y: +m[2], w: n(g.querySelector('.node-rect'), 'width'), h: n(g.querySelector('.node-rect'), 'height') };
      };
      const inter = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
      const edgeEl = document.querySelector('g.edges g.edge[data-id="e:a|b"]');
      const src = edgeEl.getAttribute('data-source'), tgt = edgeEl.getAttribute('data-target');
      const segs = [...document.querySelectorAll('rect.dbg-bbox[data-kind="edge-seg"][data-edge="e:a|b"]')];
      const maxSeg = Math.max(...segs.map(s => +s.getAttribute('data-seg')));
      const first = segs.find(s => +s.getAttribute('data-seg') === 0);
      const last = segs.find(s => +s.getAttribute('data-seg') === maxSeg);
      // The cap concerns each segment vs ITS OWN endpoint node (item 5);
      // overlap with the opposite node is just node proximity, not the cap.
      return {
        firstOverlapsSource: inter(rect(first), nodeRect(src)),
        lastOverlapsTarget: inter(rect(last), nodeRect(tgt)),
      };
    });
    expect(diag.firstOverlapsSource).toBe(false);
    expect(diag.lastOverlapsTarget).toBe(false);
  });
});
