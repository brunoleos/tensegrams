// E2E for the unified Node + Edge abstract model.
//
//   Every Node may have children (rendering as a container/frame).
//   Any Node may be source or target of edges — including container-shaped
//   ones. This spec exercises both the new YAML schema and the visual
//   pipeline (parser → IR → layout → router → renderer).

import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL } from './helpers.js';

test.describe('unified model — YAML syntax', () => {
  test('container with explicit label renders with that label', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
backend: { label: Camada de aplicação }
api: { parent: backend, label: API }
`);
    const labelText = await page.locator('g.node[data-id="backend"] .node-label').textContent();
    expect(labelText).toBe('Camada de aplicação');
  });

  test('container falls back to its id when no label is given', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
backend: { }
api: { parent: backend, label: API }
`);
    const labelText = await page.locator('g.node[data-id="backend"] .node-label').textContent();
    expect(labelText).toBe('backend');
  });
});

test.describe('unified model — edges may target containers', () => {
  test('edge connecting a leaf to a container renders a visible path', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [out, box]

out: { label: Out }
box: { label: Box }
inner: { parent: box, label: I }
`);
    // One edge in the IR → one path in the SVG.
    await expect(page.locator('g.edges .edge-path')).toHaveCount(1);
    // The edge's target attribute matches the container id.
    const targetId = await page.locator('g.edges .edge').first().getAttribute('data-target');
    expect(targetId).toBe('box');
  });

  test('edge between two containers renders', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]

a: { label: Alpha }
ca: { parent: a, label: child A }
b: { label: Bravo }
cb: { parent: b, label: child B }
`);
    await expect(page.locator('g.edges .edge-path')).toHaveCount(1);
    const e = page.locator('g.edges .edge').first();
    expect(await e.getAttribute('data-source')).toBe('a');
    expect(await e.getAttribute('data-target')).toBe('b');
  });

  test('container endpoints survive every router', async ({ page }) => {
    for (const id of ['straight', 'orthogonal', 'curved']) {
      await gotoFresh(page);
      await setDSL(page, `
connections:
  - [out, box]

out: { label: Out }
box: { label: Box }
inner: { parent: box, label: I }
`);
      await page.locator('#router-select').selectOption(id);
      await page.waitForTimeout(120);
      await expect(page.locator('g.edges .edge-path'),
        `router ${id} must render the edge to container`).toHaveCount(1);
    }
  });
});

test.describe('unified model — IR cleanup (no kind field exposed)', () => {
  test('renderer data-kind attr is derived from hasChildren', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
a: { label: A }
box: { label: B }
ch: { parent: box, label: C }
`);
    const leafKind = await page.locator('g.node[data-id="a"]').getAttribute('data-kind');
    const contKind = await page.locator('g.node[data-id="box"]').getAttribute('data-kind');
    expect(leafKind).toBe('leaf');
    expect(contKind).toBe('container');
  });
});

test.describe('unified model — custom adapter handles edges to containers', () => {
  test('custom layout renders an edge from a leaf to a container', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [out, box]

out: { label: Out }
box: { label: Box }
inner: { parent: box, label: I }
`);
    // Custom layout (default) + orthogonal routing (default).
    await expect(page.locator('g.edges .edge-path')).toHaveCount(1);
    // Both endpoints — and the container's child — are positioned.
    const positioned = await page.evaluate(() =>
      ['out', 'box', 'inner'].every(id => !!document.querySelector(`g.node[data-id="${id}"]`)));
    expect(positioned).toBe(true);
  });
});
