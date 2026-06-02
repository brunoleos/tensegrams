import { test, expect } from '@playwright/test';
import { parse as parseYaml } from 'yaml';
import { gotoFresh, setConfig } from './helpers.js';

test.describe('structured config editor', () => {
  test('default mode is structured (form) and shows mode switcher', async ({ page }) => {
    await gotoFresh(page);
    await page.click('#tab-config');
    await expect(page.locator('#config-form')).toBeVisible();
    await expect(page.locator('#config-editor')).toBeHidden();
    await expect(page.locator('#cfg-mode-form')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cfg-mode-text')).toHaveAttribute('aria-pressed', 'false');
  });

  test('toggling mode switches between form and raw text', async ({ page }) => {
    await gotoFresh(page);
    await page.click('#tab-config');
    await page.click('#cfg-mode-text');
    await expect(page.locator('#config-editor')).toBeVisible();
    await expect(page.locator('#config-form')).toBeHidden();
    await page.click('#cfg-mode-form');
    await expect(page.locator('#config-form')).toBeVisible();
  });

  test('clicking an inline "+ live" adds the section without raw editing', async ({ page }) => {
    await gotoFresh(page);
    await page.click('#tab-config');
    const liveAdd = page.getByRole('button', { name: '+ live', exact: true });
    await liveAdd.click();
    // The form should now have a "live" key — go to text mode and check.
    await page.click('#cfg-mode-text');
    const txt = await page.locator('#config-editor').inputValue();
    // YAML key indicator: `live:` at column 0 (top-level mapping).
    expect(txt).toMatch(/(^|\n)live:/);
  });

  test('boolean field opens popover and applies the new value', async ({ page }) => {
    await gotoFresh(page);
    // Pre-seed config with a live block so we have a boolean to click.
    await setConfig(page, `live:\n  collision: true\n`);
    await page.click('#cfg-mode-form');
    // Find the chip showing "true" for live.collision.
    const chip = page.locator('.cfg-chip-boolean', { hasText: 'true' }).first();
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.locator('.cfg-popover')).toBeVisible();
    await page.locator('.cfg-popover .cfg-choice', { hasText: 'false' }).click();
    await page.locator('.cfg-popover button.primary').click();
    await expect(page.locator('.cfg-popover')).toHaveCount(0);
    await expect(page.locator('.cfg-chip-boolean', { hasText: 'false' }).first()).toBeVisible();
    await page.click('#cfg-mode-text');
    const txt = await page.locator('#config-editor').inputValue();
    expect(parseYaml(txt)).toMatchObject({ live: { collision: false } });
  });

  test('number editor enforces min/max via input type=number', async ({ page }) => {
    await gotoFresh(page);
    await setConfig(page, `live:\n  damping: 0.82\n`);
    await page.click('#cfg-mode-form');
    const chip = page.locator('.cfg-chip-number', { hasText: '0.82' }).first();
    await chip.click();
    const inp = page.locator('.cfg-popover input[type="number"]');
    await expect(inp).toBeVisible();
    await expect(inp).toHaveAttribute('min', '0');
    await expect(inp).toHaveAttribute('max', '1');
    await inp.fill('0.5');
    await page.locator('.cfg-popover button.primary').click();
    await page.click('#cfg-mode-text');
    const txt = await page.locator('#config-editor').inputValue();
    expect(parseYaml(txt)).toMatchObject({ live: { damping: 0.5 } });
  });

  test('empty section shows "+ keyName" chips for every known child', async ({ page }) => {
    await gotoFresh(page);
    await setConfig(page, `collision: {}\n`);
    await page.click('#cfg-mode-form');
    const labels = await page.locator('.cfg-add-inline').allTextContents();
    for (const p of ['nodePad', 'edgePad']) {
      expect(labels, `missing "+ ${p}" chip`).toContain(`+ ${p}`);
    }
  });

  test('clicking "+ keyName" adds the key with the schema default', async ({ page }) => {
    await gotoFresh(page);
    await setConfig(page, `collision: {}\n`);
    await page.click('#cfg-mode-form');
    await page.locator('.cfg-add-inline', { hasText: '+ edgePad' }).click();
    await page.click('#cfg-mode-text');
    const txt = await page.locator('#config-editor').inputValue();
    expect(parseYaml(txt).collision.edgePad).toBe(8);
  });

  test('+ chip for intermediate object creates {} ready for further drilling', async ({ page }) => {
    await gotoFresh(page);
    // Start from an empty config: the root + chip row should show "live",
    // "collision", etc.
    await setConfig(page, '');
    await page.click('#cfg-mode-form');
    await page.getByRole('button', { name: '+ live', exact: true }).click();
    // After clicking + live, the live block should appear AND its own + chips
    // should now be visible.
    await expect(page.getByRole('button', { name: '+ damping', exact: true })).toBeVisible();
  });

  test('remove (×) button removes a key', async ({ page }) => {
    await gotoFresh(page);
    await setConfig(page, `live:\n  damping: 0.82\n  collisionK: 0.3\n`);
    await page.click('#cfg-mode-form');
    const damping = page.locator('.cfg-chip-number', { hasText: '0.82' }).first();
    await damping.hover();
    const removeBtn = page.locator('.cfg-remove').first();
    await removeBtn.click();
    await page.click('#cfg-mode-text');
    const txt = await page.locator('#config-editor').inputValue();
    const parsed = parseYaml(txt);
    expect(parsed.live.damping).toBeUndefined();
    expect(parsed.live.collisionK).toBe(0.3);
  });
});
