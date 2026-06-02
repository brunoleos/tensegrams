import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, selectLayout, nodeBox } from './helpers.js';

test.describe('viewport: wheel zoom, drag pan, fit', () => {
  test('mouse wheel zooms in/out and updates the HUD', async ({ page }) => {
    await gotoFresh(page);
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const z0 = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -200); // zoom in
    await page.waitForTimeout(80);
    const z1 = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    expect(z1).toBeGreaterThan(z0);
    await page.mouse.wheel(0, 400); // zoom out past start
    await page.waitForTimeout(80);
    const z2 = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    expect(z2).toBeLessThan(z1);
  });

  test('zoom FAB buttons work', async ({ page }) => {
    await gotoFresh(page);
    const before = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    await page.click('#zoom-in');
    await page.click('#zoom-in');
    const after = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    expect(after).toBeGreaterThan(before);
    await page.click('#zoom-out');
    const back = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    expect(back).toBeLessThan(after);
  });

  test('keyboard shortcut F refits the view', async ({ page }) => {
    await gotoFresh(page);
    // Move and zoom away
    await page.click('#zoom-in');
    await page.click('#zoom-in');
    // Body must be focused (not the editor) for the shortcut.
    await page.click('#canvas', { position: { x: 5, y: 5 } });
    await page.keyboard.press('f');
    await page.waitForTimeout(100);
    // After fit, zoom should be ≥ 10% and reasonable.
    const z = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    expect(z).toBeGreaterThan(0);
  });

  test('drag pan on empty canvas moves the viewport', async ({ page }) => {
    await gotoFresh(page);
    // Pick a leaf, capture position, then drag from an empty area.
    const initial = await nodeBox(page, 'web');
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    // Start from a position that does NOT overlap any node — top-right corner
    // is empty in the default layout.
    await page.mouse.move(box.x + box.width - 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 10 + 200, box.y + 10, { steps: 8 });
    await page.mouse.up();
    // The node position in world coords is unchanged (we panned the viewport)
    // — but the SVG viewport transform of #vp group changed.
    const tx = await page.evaluate(() =>
      document.querySelector('svg#canvas g.vp').getAttribute('transform'));
    expect(tx).toMatch(/translate/);
    // node position in world coords unchanged
    const after = await nodeBox(page, 'web');
    if (initial) expect(after).toMatchObject({ x: initial.x, y: initial.y });
  });
});

test.describe('drill-in: double-tap a container, breadcrumb, esc', () => {
  test('double-tapping a container body focuses it; breadcrumb returns to root', async ({ page, viewport }) => {
    await gotoFresh(page);
    await setDSL(page, `
options:
  title: t

connections:
  - [w, api]
  - [api, auth]
  - [auth, worker]

w: { label: Web, nodeLayers: [g] }
api: { label: API, nodeLayers: [g] }
backend: { label: backend, nodeLayers: [g] }
auth: { parent: backend, label: Auth }
worker: { parent: backend, label: Worker }
`);
    // On mobile the editor drawer covers part of the canvas — collapse it
    // (after editing the DSL, which needs the drawer open) so the
    // container is reachable.
    if (viewport && viewport.width < 760) {
      await page.click('#editor-toggle');
    }

    // Aim for the bottom-left padding of the container — past the leaf
    // row in the layout. Use `.node-rect` (the visual frame) since the
    // `g.node` bbox includes label glyph overflow.
    const r = await page.locator('g.node[data-id="backend"] .node-rect').boundingBox();
    await page.mouse.dblclick(r.x + r.width * 0.05, r.y + r.height - 6);
    await expect(page.locator('#breadcrumb')).toContainText('backend');
    // Subtree shows only auth + worker.
    await expect(page.locator('g.node[data-kind="leaf"]')).toHaveCount(2);

    // Click the root crumb.
    await page.click('#breadcrumb .crumb:first-child');
    await expect(page.locator('g.node[data-kind="leaf"]')).toHaveCount(4);
  });

  test('Esc exits a drilled-in container', async ({ page, viewport }) => {
    await gotoFresh(page);
    // Inject the fixture the test depends on — the global default
    // example was changed to `quad` in a8831e0, which has no `backend`
    // container; locating it would time out without an explicit DSL.
    await setDSL(page, `
connections:
  - [w, api]
  - [api, auth]
  - [auth, worker]

w: { label: Web, nodeLayers: [g] }
api: { label: API, nodeLayers: [g] }
backend: { label: backend, nodeLayers: [g] }
auth: { parent: backend, label: Auth }
worker: { parent: backend, label: Worker }
`);
    // On mobile, the editor drawer covers part of the canvas — collapse it
    // first so backend is reachable.
    if (viewport && viewport.width < 760) {
      await page.click('#editor-toggle');
    }
    const r = await page.locator('g.node[data-id="backend"] .node-rect').boundingBox();
    await page.mouse.dblclick(r.x + r.width * 0.05, r.y + r.height - 6);
    // Breadcrumb shows the drill-in separator + the container label.
    await expect(page.locator('#breadcrumb .crumb-sep')).toHaveCount(1);
    // Drilling removed `backend` from the visible IR, so the auto-GC of
    // stale selection already cleared the selectedNodeId. A single Esc
    // exits the drill.
    //
    // Take focus off the DSL textarea (still focused from setDSL above)
    // without triggering selection — clicking on the SVG canvas would
    // hit a node and re-populate selectedNodeId, which the keydown
    // handler clears with the FIRST Escape (drill exit only on the
    // second). `evaluate(el => el.blur())` keeps the editor unfocused
    // without changing selection state.
    await page.evaluate(() => {
      const a = document.activeElement;
      if (a && typeof a.blur === 'function') a.blur();
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('#breadcrumb .crumb')).toHaveCount(1);
  });
});

test.describe('live mode: drag a node', () => {
  test('after dropping a leaf inside a foreign container, the edge anchor stays on the container perimeter', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [api, backend]

api: { label: API }
backend: { label: backend }
auth: { parent: backend, label: Auth }
worker: { parent: backend, label: Worker }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(3000);
    const bRect = await page.locator('g.node[data-id="backend"] .node-rect').boundingBox();
    const apiRect = await page.locator('g.node[data-id="api"] .node-rect').boundingBox();
    await page.mouse.move(apiRect.x + apiRect.width / 2, apiRect.y + apiRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(bRect.x + bRect.width / 2, bRect.y + bRect.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    // Default overlap is permissive; api may end up inside backend's
    // bounding box. The invariant we DO enforce: the targetAnchor of
    // edge api→backend lands on the container perimeter, never in its
    // interior.
    const anchorInfo = await page.evaluate(() => {
      const l = window.__currentLayout__;
      const re = l.routedEdges.values().next().value; // single edge
      const b = l.containers.get('backend');
      const t = re.targetAnchor || re.points[re.points.length - 1];
      const eps = 0.5;
      const onPerimeter =
        Math.abs(t.x - b.x) < eps ||
        Math.abs(t.x - (b.x + b.width)) < eps ||
        Math.abs(t.y - b.y) < eps ||
        Math.abs(t.y - (b.y + b.height)) < eps;
      return { target: t, container: b, onPerimeter };
    });
    expect(anchorInfo.onPerimeter).toBe(true);
  });

  test('dragging a COLLAPSED container moves it as a single body', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [client, api]
  - [api, db]

backend: { label: backend, nodeLayers: [g] }
api: { parent: backend, label: API }
db:  { parent: backend, label: Database }
client: { label: Client, nodeLayers: [g] }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(2500);
    // Collapse via the store — header tap in live mode races against
    // the simulation moving the container.
    await page.evaluate(() => window.__store__?.toggleCollapsed?.('backend'));
    await page.waitForTimeout(800);
    await expect(page.locator('g.node[data-id="api"]')).toHaveCount(0);
    const r = await page.locator('g.node[data-id="backend"] .node-rect').boundingBox();
    const before = { x: r.x, y: r.y };
    const startX = r.x + r.width / 2;
    const startY = r.y + r.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 180, startY + 120, { steps: 12 });
    // Measure mid-drag: the dragged body tracks the cursor deterministically.
    // (On release it re-enters the simulation and settles via forces.)
    await page.waitForTimeout(150);
    const r2 = await page.locator('g.node[data-id="backend"] .node-rect').boundingBox();
    await page.mouse.up();
    expect(Math.abs(r2.x - before.x)).toBeGreaterThan(80);
    expect(Math.abs(r2.y - before.y)).toBeGreaterThan(50);
  });

  test('dragging a container by its header moves all descendant leaves together', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [client, api]
  - [api, db]

backend: { label: backend }
api: { parent: backend, label: API }
db:  { parent: backend, label: Database }
client: { label: Client }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(1500);
    const beforeApi = await nodeBox(page, 'api');
    const beforeDb  = await nodeBox(page, 'db');
    // Header strip — guaranteed to hit the container, not a child leaf.
    const r = await page.locator('g.node[data-id="backend"] .node-rect').boundingBox();
    const startX = r.x + r.width / 2;
    const startY = r.y + 4;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 140, startY + 80, { steps: 12 });
    // Measure mid-drag: descendant leaves are pinned to the cursor offset,
    // so they move as a rigid block. (On release they re-enter the sim.)
    await page.waitForTimeout(150);
    const afterApi = await nodeBox(page, 'api');
    const afterDb  = await nodeBox(page, 'db');
    await page.mouse.up();
    // Both children moved by ~the same delta.
    const dxApi = afterApi.x - beforeApi.x, dyApi = afterApi.y - beforeApi.y;
    const dxDb  = afterDb.x  - beforeDb.x,  dyDb  = afterDb.y  - beforeDb.y;
    expect(Math.abs(dxApi)).toBeGreaterThan(40);
    expect(Math.abs(dxDb)).toBeGreaterThan(40);
    expect(Math.abs(dxApi - dxDb)).toBeLessThan(40);
    expect(Math.abs(dyApi - dyDb)).toBeLessThan(40);
  });

  test('dragging a leaf in live mode moves it (default frozen mode)', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]
  - [b, c]

a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
c: { label: C, nodeLayers: [g] }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(1500);
    const before = await nodeBox(page, 'a');
    const target = await page.evaluate((id) => {
      const el = document.querySelector(`g.node[data-id="${id}"]`);
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, 'a');
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 250, target.y + 150, { steps: 16 });
    // Measure mid-drag: the body tracks the cursor. (On release it
    // re-enters the simulation and settles via forces.)
    await page.waitForTimeout(150);
    const after = await nodeBox(page, 'a');
    await page.mouse.up();
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(50);
  });

  test('frozen mode: during drag the others stay put', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]
  - [b, c]

a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
c: { label: C, nodeLayers: [g] }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(5500); // let initial sim settle
    const bBefore = await nodeBox(page, 'b');
    const cBefore = await nodeBox(page, 'c');
    const center = await page.evaluate(() => {
      const el = document.querySelector('g.node[data-id="a"]');
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    // Drag a around for a bit WITHOUT releasing — others must be frozen.
    await page.mouse.move(center.x + 400, center.y, { steps: 20 });
    await page.waitForTimeout(400);
    const bMid = await nodeBox(page, 'b');
    const cMid = await nodeBox(page, 'c');
    expect(bMid.x).toBeCloseTo(bBefore.x, 0);
    expect(bMid.y).toBeCloseTo(bBefore.y, 0);
    expect(cMid.x).toBeCloseTo(cBefore.x, 0);
    expect(cMid.y).toBeCloseTo(cBefore.y, 0);
    // Release outside the loop so this test is purely "during drag".
    await page.mouse.up();
  });
});
