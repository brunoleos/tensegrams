import { test, expect } from '@playwright/test';
import { gotoFresh } from './helpers.js';

test.describe('splitter — resize editor panel', () => {
  test.beforeEach(async ({ }, testInfo) => {
    // Desktop interaction model — mobile uses row resize covered in 07-mobile.
    test.skip(testInfo.project.name === 'mobile-chromium', 'desktop-only');
  });
  test('drag changes the editor width on desktop', async ({ page }) => {
    await gotoFresh(page);
    const before = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w').trim());
    expect(before).toBe('360px');

    const splitter = page.locator('#splitter');
    const box = await splitter.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    const after = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w').trim());
    expect(parseFloat(after)).toBeGreaterThan(450);
  });

  test('keyboard arrows resize when splitter is focused', async ({ page }) => {
    await gotoFresh(page);
    await page.locator('#splitter').focus();
    const w0 = await page.evaluate(() => parseFloat(
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w')));
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    const w1 = await page.evaluate(() => parseFloat(
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w')));
    expect(w1).toBeGreaterThan(w0);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
    const w2 = await page.evaluate(() => parseFloat(
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w')));
    expect(w2).toBeLessThan(w1);
  });

  test('persists the editor width across reload', async ({ page }) => {
    await gotoFresh(page);
    const splitter = page.locator('#splitter');
    const box = await splitter.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 240, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const w1 = await page.evaluate(() => parseFloat(
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w')));
    await page.reload();
    await page.waitForSelector('svg#canvas g.nodes');
    const w2 = await page.evaluate(() => parseFloat(
      getComputedStyle(document.querySelector('.split')).getPropertyValue('--editor-w')));
    expect(Math.abs(w2 - w1)).toBeLessThan(2);
  });
});
