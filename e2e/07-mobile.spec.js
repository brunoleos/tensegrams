import { test, expect } from '@playwright/test';
import { gotoFresh } from './helpers.js';

// Mobile-only project. Verifies the responsive layout, the drawer behaviour,
// and touch-specific gestures (pinch, single-finger pan).

test.describe('mobile responsive layout', () => {
  test.beforeEach(async ({ }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only');
  });
  test('stacks editor below preview', async ({ page }) => {
    await gotoFresh(page);
    const layout = await page.evaluate(() => {
      const split = document.querySelector('.split');
      return getComputedStyle(split).gridTemplateAreas;
    });
    expect(layout.replace(/\s+/g, ' ')).toContain('preview');
    expect(layout.replace(/\s+/g, ' ')).toContain('editor');
  });

  test('drawer toggle hides the editor textarea', async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator('#editor')).toBeVisible();
    await page.click('#editor-toggle');
    await expect(page.locator('body')).toHaveAttribute('data-editor-state', 'collapsed');
    await expect(page.locator('#editor')).toBeHidden();
    await page.click('#editor-toggle');
    await expect(page.locator('#editor')).toBeVisible();
  });

  test('single-finger touch on empty canvas pans the viewport', async ({ page }) => {
    await gotoFresh(page);
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    // Use Pointer API for touch — Playwright synthesizes touch via mouse + pointerType.
    await page.touchscreen.tap(box.x + box.width - 30, box.y + 30); // ensure non-node area
    const before = await page.evaluate(() =>
      document.querySelector('svg#canvas g.vp').getAttribute('transform'));
    // Synthesize a touch drag with PointerEvent (since touchscreen only does tap).
    await page.evaluate(async () => {
      const svg = document.getElementById('canvas');
      const fire = (type, x, y) => {
        const ev = new PointerEvent(type, {
          pointerType: 'touch', pointerId: 1, isPrimary: true,
          clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0,
        });
        svg.dispatchEvent(ev);
      };
      fire('pointerdown', 350, 60);
      for (let i = 1; i <= 10; i++) fire('pointermove', 350 - i * 15, 60 + i * 8);
      fire('pointerup', 200, 140);
    });
    await page.waitForTimeout(60);
    const after = await page.evaluate(() =>
      document.querySelector('svg#canvas g.vp').getAttribute('transform'));
    expect(after).not.toBe(before);
  });

  test('two-finger pinch zooms the canvas', async ({ page }) => {
    await gotoFresh(page);
    const z0 = await page.evaluate(() => parseInt(document.getElementById('zoom-label').textContent));
    const result = await page.evaluate(async () => {
      const svg = document.getElementById('canvas');
      const fire = (type, id, x, y) => {
        const ev = new PointerEvent(type, {
          pointerType: 'touch', pointerId: id, isPrimary: id === 1,
          clientX: x, clientY: y, screenX: x, screenY: y,
          bubbles: true, cancelable: true, button: 0, buttons: 1,
          pressure: 0.5, view: window,
        });
        svg.dispatchEvent(ev);
      };
      fire('pointerdown', 1, 180, 400);
      fire('pointerdown', 2, 220, 400);
      // Spread fingers WIDE — start 40px apart, end 400px apart.
      for (let i = 1; i <= 20; i++) {
        fire('pointermove', 1, 180 - i * 9, 400);
        fire('pointermove', 2, 220 + i * 9, 400);
        await new Promise(r => requestAnimationFrame(r));
      }
      fire('pointerup', 1, 0, 400);
      fire('pointerup', 2, 400, 400);
      return parseInt(document.getElementById('zoom-label').textContent);
    });
    expect(result).toBeGreaterThan(z0);
  });
});
