// Import / export of DSL and config as .yaml files. The two topbar buttons
// (#export-btn / #import-btn) act on the active tab. Export uses the
// download event; import drives the hidden #import-file via setInputFiles.

import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, setConfig } from './helpers.js';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp;
test.beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'tsg-io-')); });
test.afterEach(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ } });

test.describe('import / export DSL and config', () => {
  test('exports the active DSL tab as a .yaml file', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tensegrams-dsl-.*\.yaml$/);
    expect(readFileSync(await download.path(), 'utf8')).toContain('[a, b]');
  });

  test('exports the active Config tab as a .yaml file', async ({ page }) => {
    await gotoFresh(page);
    await setConfig(page, 'router:\n  padding: 9\n'); // leaves the Config tab active

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tensegrams-config-.*\.yaml$/);
    expect(readFileSync(await download.path(), 'utf8')).toContain('padding: 9');
  });

  test('imports a DSL .yaml — store, editor and canvas all update', async ({ page }) => {
    await gotoFresh(page);
    const dsl = 'connections:\n  - [imp, target]\n';
    const file = join(tmp, 'my-dsl.yaml');
    writeFileSync(file, dsl);

    await page.click('#tab-dsl');
    await page.setInputFiles('#import-file', file);

    await expect.poll(() => page.evaluate(() => window.__store__.state.dsl)).toBe(dsl);
    await expect(page.locator('#editor')).toHaveValue(dsl);          // textarea synced
    await expect(page.locator('svg#canvas g.node[data-id="imp"]')).toBeAttached(); // re-rendered
  });

  test('imports a config .yaml — store updates and the structured form repopulates', async ({ page }) => {
    await gotoFresh(page);
    const cfg = 'router:\n  padding: 7\n';
    const file = join(tmp, 'my-config.yaml');
    writeFileSync(file, cfg);

    await page.click('#tab-config'); // structured (form) mode is the default
    await page.setInputFiles('#import-file', file);

    await expect.poll(() => page.evaluate(() => window.__store__.state.config)).toBe(cfg);
    await expect(page.locator('#config-form')).toContainText('router'); // form repopulated
  });

  test('importing invalid YAML surfaces an error without crashing', async ({ page }) => {
    await gotoFresh(page);
    const file = join(tmp, 'broken.yaml');
    writeFileSync(file, '- this is not a map\n');

    await page.click('#tab-dsl');
    await page.setInputFiles('#import-file', file);

    await expect(page.locator('#errors')).toContainText(/.+/); // error shown
    await expect(page.locator('svg#canvas')).toBeAttached();    // no crash
  });
});
