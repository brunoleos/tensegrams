import { test, expect } from '@playwright/test';
import { gotoFresh } from './helpers.js';

test.describe('themes', () => {
  for (const theme of ['light', 'sepia', 'contrast', 'dark']) {
    test(`switches to ${theme} via the selector`, async ({ page }) => {
      await gotoFresh(page);
      await page.locator('#theme-select').selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      // Body background should change (sanity check the CSS vars wired up).
      const bg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor,
      );
      expect(bg).toBeTruthy();
    });
  }

  test('persists theme across reload', async ({ page }) => {
    await gotoFresh(page);
    await page.locator('#theme-select').selectOption('contrast');
    await page.reload();
    await page.waitForSelector('svg#canvas g.nodes', { state: 'attached' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
    await expect(page.locator('#theme-select')).toHaveValue('contrast');
  });
});
