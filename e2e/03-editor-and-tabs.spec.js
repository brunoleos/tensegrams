import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, setConfig } from './helpers.js';

test.describe('editor pane: tabs, drawer toggle, errors', () => {
  test('DSL tab is active by default; switching toggles to the Config pane', async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator('#tab-dsl')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tab-config')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#editor')).toBeVisible();
    await expect(page.locator('#config-pane')).toBeHidden();

    await page.click('#tab-config');
    await expect(page.locator('#tab-config')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#editor')).toBeHidden();
    await expect(page.locator('#config-pane')).toBeVisible();
    // Default sub-mode is the structured form.
    await expect(page.locator('#config-form')).toBeVisible();

    await page.click('#tab-dsl');
    await expect(page.locator('#editor')).toBeVisible();
  });

  test('editing the DSL updates the canvas', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]

a: { label: A }
b: { label: B }
`);
    await expect(page.locator('g.node')).toHaveCount(2);
    const labels = await page.locator('g.node .node-label').allTextContents();
    expect(labels.sort()).toEqual(['A', 'B']);
  });

  test('invalid config surfaces an error in the errors region', async ({ page }) => {
    await gotoFresh(page);
    await setConfig(page, `live: { broken: [unclosed`);
    await expect(page.locator('#errors')).toHaveClass(/has-errors/);
    await expect(page.locator('#errors')).toContainText(/config inválido/);
  });

  test('valid config applied to live layout changes collision spacing', async ({ page }) => {
    await gotoFresh(page);
    // Two nodes sharing a collision layer — the only thing that spreads
    // them; collision.nodePad governs the gap.
    await setDSL(page, `
a: { label: A, nodeLayers: [g] }
b: { label: B, nodeLayers: [g] }
`);
    await page.locator('#layout-select').selectOption('live');
    // Settle.
    await page.waitForTimeout(1500);
    const gap = () => {
      const a = document.querySelector('g.node[data-id="a"]').getAttribute('transform');
      const b = document.querySelector('g.node[data-id="b"]').getAttribute('transform');
      const num = (t) => t.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/).slice(1, 3).map(Number);
      const [ax, ay] = num(a); const [bx, by] = num(b);
      return Math.hypot(ax - bx, ay - by);
    };
    const baseline = await page.evaluate(gap);
    await setConfig(page, `collision:\n  nodePad: 90\n`);
    await page.waitForTimeout(1500);
    const widened = await page.evaluate(gap);
    expect(widened).toBeGreaterThan(baseline + 30);
  });

  test('toggle button collapses and expands the editor', async ({ page, viewport }) => {
    await gotoFresh(page);
    // The button is in the topbar regardless of viewport.
    await page.click('#editor-toggle');
    await expect(page.locator('body')).toHaveAttribute('data-editor-state', 'collapsed');
    await page.click('#editor-toggle');
    await expect(page.locator('body')).toHaveAttribute('data-editor-state', 'expanded');
  });
});
