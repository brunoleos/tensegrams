import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, selectLayout, selectRouter, nodeBox } from './helpers.js';

test.describe('layouts × routers', () => {
  test('custom + orthogonal renders an edge path for every edge', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]
  - [b, c]

a: { label: A }
b: { label: B }
c: { label: C }
`);
    await expect(page.locator('g.edges .edge-path')).toHaveCount(2);
    const d = await page.locator('g.edges .edge-path').first().getAttribute('d');
    expect(d).toMatch(/^M/);
    expect(d.length).toBeGreaterThan(8);
  });

  test('off layout respects pinned positions', async ({ page }) => {
    await gotoFresh(page);
    await selectLayout(page, 'off');
    await setDSL(page, `
a:
  label: A
  pin: [20, 30]
b:
  label: B
  pin: [400, 200]
`);
    // Refit so both far-apart pins are inside the viewport (off-screen
    // nodes are culled from the DOM).
    await page.click('#fit');
    await page.waitForTimeout(120);
    const a = await nodeBox(page, 'a');
    const b = await nodeBox(page, 'b');
    expect(a).toMatchObject({ x: 20, y: 30 });
    expect(b).toMatchObject({ x: 400, y: 200 });
  });

  test('live layout settles without rectangle overlap when nodes share a collision layer', async ({ page }) => {
    await gotoFresh(page);
    await selectLayout(page, 'live');
    await setDSL(page, `
connections:
  - [hub, client1]
  - [hub, client2]
  - [hub, client3]
  - [hub, worker]
  - [worker, service]
  - [service, queue]

hub:
  label: Hub
  pin: [0, 0]
  nodeLayers: [g]
client1: { label: Client A, nodeLayers: [g] }
client2: { label: Client B, nodeLayers: [g] }
client3: { label: Client C, nodeLayers: [g] }
worker:  { label: Worker,   nodeLayers: [g] }
service: { label: Service,  nodeLayers: [g] }
queue:   { label: Queue,    nodeLayers: [g] }
`);
    // Wait for alpha decay.
    await page.waitForTimeout(2500);
    const overlap = await page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('g.node[data-kind="leaf"]')).map(el => {
        const tr = el.getAttribute('transform') || '';
        const m = tr.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
        const r = el.querySelector('.node-rect');
        return {
          id: el.dataset.id,
          x: m ? Number(m[1]) : 0,
          y: m ? Number(m[2]) : 0,
          w: Number(r.getAttribute('width')),
          h: Number(r.getAttribute('height')),
        };
      });
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (!(a.x + a.w <= b.x || b.x + b.w <= a.x ||
                a.y + a.h <= b.y || b.y + b.h <= a.y)) {
            return [a.id, b.id];
          }
        }
      }
      return null;
    });
    expect(overlap).toBeNull();
  });

  for (const routerId of ['straight', 'orthogonal', 'curved']) {
    test(`router ${routerId} produces a path for every edge`, async ({ page }) => {
      await gotoFresh(page);
      await selectRouter(page, routerId);
      await setDSL(page, `
connections:
  - [a, b]
  - [b, c]
  - [a, c]

a: { label: A }
b: { label: B }
c: { label: C }
`);
      await expect(page.locator('g.edges .edge-path')).toHaveCount(3);
      const ds = await page.locator('g.edges .edge-path').evaluateAll(els =>
        els.map(e => e.getAttribute('d')));
      for (const d of ds) {
        expect(d, `router ${routerId} should produce non-empty d`).toBeTruthy();
        expect(d.length).toBeGreaterThan(8);
      }
    });
  }
});
