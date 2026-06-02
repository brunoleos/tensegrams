import { test, expect } from '@playwright/test';
import { gotoFresh } from './helpers.js';

test.describe('app bootstrap', () => {
  test('loads, applies dark theme, renders default diagram', async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveAttribute('data-editor-state', 'expanded');
    // Default DSL is EXAMPLES.quad — 4 leaf nodes (a/b/c/d).
    await expect(page.locator('svg#canvas g.node')).toHaveCount(4, { timeout: 5000 });
    await expect(page.locator('#zoom-label')).toBeVisible();
  });

  test('controls populate from the registries', async ({ page }) => {
    await gotoFresh(page);
    const layoutOpts = await page.locator('#layout-select option').allTextContents();
    expect(layoutOpts).toEqual(expect.arrayContaining([
      expect.stringMatching(/Custom/),
      expect.stringMatching(/Live/),
      expect.stringMatching(/Off/),
    ]));
    const routerOpts = await page.locator('#router-select option').allTextContents();
    expect(routerOpts.length).toBeGreaterThanOrEqual(3);
    const themeOpts = await page.locator('#theme-select option').allTextContents();
    expect(themeOpts).toEqual(expect.arrayContaining([
      expect.stringMatching(/Escuro/),
      expect.stringMatching(/Claro/),
      expect.stringMatching(/S[eé]pia/),
      expect.stringMatching(/contraste/i),
    ]));
  });

  test('hides errors region when DSL is valid', async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator('#errors')).not.toHaveClass(/has-errors/);
  });

  test('HUD shows a version label (dev locally; commit hash on prod)', async ({ page }) => {
    await gotoFresh(page);
    const label = page.locator('#version-label');
    await expect(label).toBeVisible();
    const txt = (await label.textContent())?.trim();
    expect(txt).toMatch(/^v\s+\S+/);
  });
});
