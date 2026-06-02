// Container collapse & node selection model:
//   - tap on container header  → toggle collapse/expand
//   - double-tap on container  → drill in
//   - tap on container body or leaf → select node (action FAB updates)
//   - tap on background        → clear selection
//   - right-click anywhere on a container (desktop) → context menu with
//     "Entrar" + "Ocultar/Mostrar conteúdo"
//   - FAB action "Ocultar conteúdo" mirrors the menu

import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, selectLayout } from './helpers.js';

const DSL = `
connections:
  - [client, api]
  - [api, db]

backend: { label: backend, nodeLayers: [g] }
api: { parent: backend, label: API }
db:  { parent: backend, label: Database }
client: { label: Client, nodeLayers: [g] }
`;

async function setup(page) {
  await gotoFresh(page);
  await setDSL(page, DSL);
  // 'off' layout: positions are deterministic, no live simulation.
  await selectLayout(page, 'off');
  await page.waitForTimeout(200);
}

// `g.node`'s boundingBox can be wider than the visible frame (label
// glyphs bleed past the rect). Anchor clicks to `.node-rect` instead.
async function rectBox(page, id) {
  return await page.locator(`g.node[data-id="${id}"] .node-rect`).boundingBox();
}
// Bottom-left of the container body — past the leaf row in the 'off'
// grid (which stacks children at the TOP of the container).
async function tapBody(page, id, button) {
  const r = await rectBox(page, id);
  const opts = button ? { button } : undefined;
  await page.mouse.click(r.x + r.width * 0.05, r.y + r.height - 6, opts);
}
async function dblTapBody(page, id) {
  const r = await rectBox(page, id);
  const x = r.x + r.width * 0.05;
  const y = r.y + r.height - 6;
  // Em viewport com touch (Pixel 7 etc.), page.mouse.dblclick não emite
  // o `dblclick` nativo que touch devices não geram — a app trata
  // double-tap via `lastTap` + DOUBLE_TAP_MS no `pointerup`, então
  // basta 2 toques rápidos. `page.touchscreen.tap()` emite pointer-
  // events touch que entram exatamente nesse caminho.
  const hasTouch = await page.evaluate(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
  if (hasTouch) {
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.dblclick(x, y);
  }
}
async function tapHeader(page, id) {
  const r = await rectBox(page, id);
  await page.mouse.click(r.x + 30, r.y + 4);
}

test.describe('container collapse / selection — context menu (desktop)', () => {
  test('right-click on container body opens menu with Entrar + Ocultar conteúdo', async ({ page }) => {
    await setup(page);
    await tapBody(page, 'backend', 'right');
    const items = page.locator('#context-menu .menu-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveText('Entrar');
    await expect(items.nth(1)).toHaveText('Ocultar conteúdo');

    await items.nth(1).click();
    await expect(page.locator('#context-menu')).toBeHidden();
    await expect(page.locator('g.node[data-id="api"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="db"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="backend"]')).toBeVisible();
    const label = await page.locator('g.node[data-id="backend"] .node-label').textContent();
    expect(label.startsWith('▸')).toBe(true);
  });

  test('after collapse, the menu offers "Mostrar conteúdo"', async ({ page }) => {
    await setup(page);
    await tapBody(page, 'backend', 'right');
    await page.locator('#context-menu .menu-item').filter({ hasText: 'Ocultar' }).click();
    await page.waitForTimeout(200);
    // After collapse the container is smaller; right-click anywhere on it.
    await tapBody(page, 'backend', 'right');
    await expect(page.locator('#context-menu .menu-item').nth(1)).toHaveText('Mostrar conteúdo');
    await page.locator('#context-menu .menu-item').filter({ hasText: 'Mostrar' }).click();
    await expect(page.locator('g.node[data-id="api"]')).toBeVisible();
  });

  test('right-click on a leaf shows no menu', async ({ page }) => {
    await setup(page);
    const client = page.locator('g.node[data-id="client"]');
    const box = await client.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await expect(page.locator('#context-menu')).toBeHidden();
  });
});

test.describe('container collapse — touch / mouse gestures', () => {
  test('tap on container header toggles collapse/expand', async ({ page }) => {
    await setup(page);
    await tapHeader(page, 'backend');
    await expect(page.locator('g.node[data-id="api"]')).toHaveCount(0);
    const label = await page.locator('g.node[data-id="backend"] .node-label').textContent();
    expect(label.startsWith('▸')).toBe(true);
    await tapHeader(page, 'backend');
    await expect(page.locator('g.node[data-id="api"]')).toBeVisible();
  });

  test('tap on container body selects (not drill)', async ({ page }) => {
    await setup(page);
    await tapBody(page, 'backend');
    await expect(page.locator('g.node[data-id="backend"]')).toHaveClass(/selected/);
    await expect(page.locator('#breadcrumb .crumb-sep')).toHaveCount(0);
  });

  test('double-tap on container body drills in', async ({ page }) => {
    await setup(page);
    await dblTapBody(page, 'backend');
    await expect(page.locator('#breadcrumb')).toContainText('backend');
  });

  test('tap on leaf selects', async ({ page }) => {
    await setup(page);
    const r = await rectBox(page, 'client');
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await expect(page.locator('g.node[data-id="client"]')).toHaveClass(/selected/);
  });

  test('tap on background clears selection', async ({ page }) => {
    await setup(page);
    const r = await rectBox(page, 'client');
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await expect(page.locator('g.node[data-id="client"]')).toHaveClass(/selected/);
    // Aim for an empty stretch of canvas — to the right of all nodes, in
    // the upper half (no FAB overlays there).
    const svgBox = await page.locator('#canvas').boundingBox();
    await page.mouse.click(svgBox.x + svgBox.width - 40, svgBox.y + 80);
    await expect(page.locator('g.node[data-id="client"]')).not.toHaveClass(/selected/);
  });
});

test.describe('floating action FAB', () => {
  test('idle FAB is visible but compact; selection expands it', async ({ page }) => {
    await setup(page);
    const fab = page.locator('#action-fab');
    await expect(fab).toBeVisible();
    await expect(fab).not.toHaveClass(/has-selection/);
    const r = await rectBox(page, 'client');
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await expect(fab).toHaveClass(/has-selection/);
    await expect(fab.locator('.fab-name')).toHaveText('Client');
  });

  test('FAB shows Entrar + Ocultar + Limpar for a container; Entrar drills', async ({ page }) => {
    await setup(page);
    await tapBody(page, 'backend');
    const items = page.locator('#action-fab .fab-item');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText('Entrar');
    await expect(items.nth(1)).toHaveText('Ocultar conteúdo');
    await expect(items.nth(2)).toHaveText('Limpar seleção');

    await items.nth(0).click();
    await expect(page.locator('#breadcrumb')).toContainText('backend');
  });

  test('FAB Ocultar conteúdo collapses the container', async ({ page }) => {
    await setup(page);
    await tapBody(page, 'backend');
    await page.locator('#action-fab .fab-item').filter({ hasText: 'Ocultar' }).click();
    await expect(page.locator('g.node[data-id="api"]')).toHaveCount(0);
  });

  test('FAB for a leaf shows only Limpar seleção', async ({ page }) => {
    await setup(page);
    const r = await rectBox(page, 'client');
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    const items = page.locator('#action-fab .fab-item');
    await expect(items).toHaveCount(1);
    await expect(items.nth(0)).toHaveText('Limpar seleção');
  });

  test('FAB chevron collapses/expands the menu', async ({ page }) => {
    await setup(page);
    const r = await rectBox(page, 'client');
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    const fab = page.locator('#action-fab');
    await expect(fab.locator('.fab-items')).toBeVisible();
    await fab.locator('.fab-toggle').click();
    await expect(fab.locator('.fab-items')).toHaveCount(0);
    await expect(fab.locator('.fab-name')).toHaveText('Client');
  });
});

test('collapse state is ephemeral (does not survive reload)', async ({ page }) => {
  await setup(page);
  await tapHeader(page, 'backend');
  await expect(page.locator('g.node[data-id="api"]')).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('svg#canvas g.nodes', { state: 'attached' });
  await page.waitForTimeout(300);
  await expect(page.locator('g.node[data-id="api"]')).toBeVisible();
  await expect(page.locator('g.node[data-id="db"]')).toBeVisible();
});
