import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, setConfig, selectLayout, selectRouter } from './helpers.js';

const DSL = `
connections:
  - [a, b]

a: { label: A }
b: { label: B }
`;

const CFG = `live:\n  damping: 0.5\n`;

test.describe('persistence — full state round-trip', () => {
  test('DSL, config, layout, router, theme, tab persist after reload', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, DSL);
    await setConfig(page, CFG);
    await selectLayout(page, 'live');
    await selectRouter(page, 'straight');
    await page.locator('#theme-select').selectOption('sepia');
    // Switch to config tab — should persist.
    await page.click('#tab-config');
    await page.reload();
    await page.waitForSelector('svg#canvas g.nodes');

    await expect(page.locator('#layout-select')).toHaveValue('live');
    await expect(page.locator('#router-select')).toHaveValue('straight');
    await expect(page.locator('#theme-select')).toHaveValue('sepia');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
    await expect(page.locator('#tab-config')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#editor')).toHaveValue(DSL);
    await expect(page.locator('#config-editor')).toHaveValue(CFG);
  });
});
