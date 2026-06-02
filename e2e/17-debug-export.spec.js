// Debug-pack download — clicking the button should produce a single
// .json file with DSL/Config/IR/layout/HTML/PNG/console buffer.

import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, setConfig } from './helpers.js';

test.describe('debug export button', () => {
  test('emits a JSON pack with the captured inputs and a PNG screenshot', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, 'connections:\n  - [a, b]\n');
    await setConfig(page, 'routing:\n  engine: physics\n');
    // Sanity-check: button is visible.
    await expect(page.locator('#debug-export-btn')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#debug-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tensegrams-debug-.*\.json$/);

    const path = await download.path();
    const fs = await import('node:fs');
    const pack = JSON.parse(fs.readFileSync(path, 'utf8'));

    expect(pack.schema).toBe('tensegrams-debug-pack/1');
    expect(pack.inputs.dsl).toContain('[a, b]');
    expect(pack.inputs.config).toContain('engine: physics');
    expect(pack.selection.layoutId).toBeTruthy();
    expect(pack.ir).toBeTruthy();
    expect(pack.layout).toBeTruthy();
    expect(pack.layout.positions.__type).toBe('Map'); // Map round-trip envelope
    expect(typeof pack.html).toBe('string');
    expect(pack.html.length).toBeGreaterThan(100);
    // Screenshot is best-effort but on a healthy page it should render.
    expect(pack.screenshotPng).toMatch(/^data:image\/png;base64,/);
  });

  test('captures IR warnings produced by a bad attribute', async ({ page }) => {
    await gotoFresh(page);
    // `bogusAttr` triggers a buildIR warning so we exercise diagnostics.
    await setDSL(page, 'a:\n  bogusAttr: oops\n');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#debug-export-btn').click(),
    ]);
    const path = await download.path();
    const fs = await import('node:fs');
    const pack = JSON.parse(fs.readFileSync(path, 'utf8'));
    expect(pack.diagnostics.warnings.length).toBeGreaterThan(0);
    expect(pack.diagnostics.warnings.some(w => /bogus/i.test(w.msg))).toBe(true);
  });
});
