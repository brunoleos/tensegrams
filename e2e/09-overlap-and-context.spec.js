import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, selectLayout } from './helpers.js';

test.describe('config placeholder reflects the selected layout', () => {
  test('switching layout updates the Config placeholder', async ({ page }) => {
    await gotoFresh(page);
    await page.click('#tab-config');
    // Default layout is 'custom' — static, no live force block.
    const customPh = await page.locator('#config-editor').getAttribute('placeholder');
    expect(customPh).not.toContain('live:');

    await selectLayout(page, 'live');
    const livePh = await page.locator('#config-editor').getAttribute('placeholder');
    expect(livePh).toContain('live:');
    expect(livePh).toContain('damping');

    await selectLayout(page, 'off');
    const offPh = await page.locator('#config-editor').getAttribute('placeholder');
    expect(offPh).not.toContain('live:');
  });

  test('every placeholder includes the collision pad block', async ({ page }) => {
    // Collision layers themselves are declared in the DSL; the YAML
    // config only carries the two global pad knobs.
    await gotoFresh(page);
    await page.click('#tab-config');
    for (const id of ['custom', 'live', 'off']) {
      await selectLayout(page, id);
      const ph = await page.locator('#config-editor').getAttribute('placeholder');
      expect(ph, `placeholder for ${id} missing collision block`).toContain('collision:');
      expect(ph, `placeholder for ${id} missing nodePad`).toContain('nodePad');
      expect(ph, `placeholder for ${id} missing edgePad`).toContain('edgePad');
    }
  });
});

test.describe('collision layers in live mode', () => {
  test('foreign leaf is pushed out of a container sharing its layer', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [inner1, inner2]
  - [outside, inner1]

box:
  label: box
  nodeLayers: [g]
inner1: { parent: box, label: I1 }
inner2: { parent: box, label: I2 }
outside: { label: Outside, nodeLayers: [g] }
`);
    await selectLayout(page, 'live');
    // Let the sim settle.
    await page.waitForTimeout(2500);

    const result = await page.evaluate(() => {
      const leaf = document.querySelector('g.node[data-id="outside"]');
      const cont = document.querySelector('g.node[data-id="box"]');
      const tr = (el) => {
        const m = (el.getAttribute('transform') || '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
        return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
      };
      const rect = (el) => {
        const r = el.querySelector('.node-rect');
        const p = tr(el);
        return { x: p.x, y: p.y, w: Number(r.getAttribute('width')), h: Number(r.getAttribute('height')) };
      };
      const a = rect(leaf), b = rect(cont);
      const overlaps = !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
                         a.y + a.h <= b.y || b.y + b.h <= a.y);
      return { overlaps, a, b };
    });
    expect(result.overlaps, `outside ${JSON.stringify(result.a)} should not overlap box ${JSON.stringify(result.b)}`).toBe(false);
  });

  test('two sibling containers sharing a layer separate', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a1, b1]
  - [a2, b2]

box1: { label: box1, nodeLayers: [g] }
a1: { parent: box1, label: A1 }
b1: { parent: box1, label: B1 }
box2: { label: box2, nodeLayers: [g] }
a2: { parent: box2, label: A2 }
b2: { parent: box2, label: B2 }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      const rect = (id) => {
        const el = document.querySelector(`g.node[data-id="${id}"]`);
        const tr = (el.getAttribute('transform') || '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
        const r = el.querySelector('.node-rect');
        return {
          x: Number(tr[1]), y: Number(tr[2]),
          w: Number(r.getAttribute('width')), h: Number(r.getAttribute('height')),
        };
      };
      const a = rect('box1'), b = rect('box2');
      return {
        a, b,
        overlap: !(a.x + a.w <= b.x || b.x + b.w <= a.x ||
                   a.y + a.h <= b.y || b.y + b.h <= a.y),
      };
    });
    expect(result.overlap, `box1 ${JSON.stringify(result.a)} overlaps box2 ${JSON.stringify(result.b)}`).toBe(false);
  });

  test('without collision labels, foreign overlap is tolerated (no error)', async ({ page }) => {
    await gotoFresh(page);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await setDSL(page, `
box: { label: box }
inner1: { parent: box, label: I1 }
inner2: { parent: box, label: I2 }
outside: { label: Outside }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(2500);
    // No collision labels → resolver never forces separation; we only
    // assert the simulation completed without throwing.
    expect(errs).toEqual([]);
  });

  test('an edge with nodeLayers routes without error', async ({ page }) => {
    await gotoFresh(page);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await setDSL(page, `
connections:
  - [a, b]

a: { label: A }
b: { label: B }
blocker: { label: Block, nodeLayers: [wire] }

? [a, b]
: { nodeLayers: [wire] }
`);
    await selectLayout(page, 'live');
    await page.waitForTimeout(2500);
    expect(errs).toEqual([]);
    // The edge must still render.
    await expect(page.locator('g.edges .edge-path')).toHaveCount(1);
  });
});

test.describe('layer chips actually filter the canvas', () => {
  test('clicking a layer chip removes matching nodes from the SVG', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
options:
  title: F

connections:
  - [a, b]

a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
`);
    // Both nodes present initially.
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(1);

    // Click the "infra" chip → node `a` removed (not just CSS hidden).
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(1);

    // Toggle back on.
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
  });

  test('dangling edges (default onHidden=omit) are removed too', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]
  - [b, c]

a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
c: { label: C, viewLayers: [data] }
`);
    // 2 edges initially.
    await expect(page.locator('g.edges .edge-path')).toHaveCount(2);
    // Hide `infra` → drops node `a` and edge `a->b`. Edge `b->c` survives.
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(0);
    await expect(page.locator('g.edges .edge-path')).toHaveCount(1);
  });

  test('onHidden=promote reroutes edge to nearest visible ancestor', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [out, inner, omit]
  - [out, inner, promote]

box: { label: box }
inner: { parent: box, label: I, viewLayers: [infra] }
out:   { label: Out }

? [out, inner, promote]
: { onHidden: promote }

? [out, inner, omit]
: { label: omitir, onHidden: omit }
`);
    // Hide `infra` → `inner` vanishes; one edge (promoted) survives, going
    // to `box`. The omit-edge is dropped.
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="inner"]')).toHaveCount(0);
    await expect(page.locator('g.edges .edge-path')).toHaveCount(1);
    // The surviving edge's target must be `box`. Confirm via the IR-derived
    // data-* attributes the renderer attaches.
    const targetId = await page.evaluate(() => {
      const e = document.querySelector('g.edges .edge');
      return e?.getAttribute('data-target');
    });
    expect(targetId).toBe('box');
  });

  test('live mode redistributes nodes after layer toggle', async ({ page }) => {
    await gotoFresh(page);
    // A shared collision layer packs the nodes; dropping one repacks the rest.
    await setDSL(page, `
connections:
  - [a, b]
  - [a, c]
  - [b, c]

a: { label: A, viewLayers: [infra], nodeLayers: [g] }
b: { label: B, viewLayers: [data],  nodeLayers: [g] }
c: { label: C, viewLayers: [data],  nodeLayers: [g] }
`);
    // Select live and let it settle around the 3-node configuration.
    await page.locator('#layout-select').selectOption('live');
    await page.waitForTimeout(2500);
    const before = await page.evaluate(() => {
      const b = document.querySelector('g.node[data-id="b"]');
      const m = (b.getAttribute('transform') || '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      return { x: Number(m[1]), y: Number(m[2]) };
    });
    // Hide `infra` → `a` disappears, edges adjust, sim restarts.
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      const b = document.querySelector('g.node[data-id="b"]');
      const m = (b.getAttribute('transform') || '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      return { x: Number(m[1]), y: Number(m[2]) };
    });
    // Position should change measurably as the sim reflows with fewer nodes.
    const drift = Math.hypot(before.x - after.x, before.y - after.y);
    expect(drift).toBeGreaterThan(5);
  });

  test('hidden state survives an unrelated graph mutation', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
connections:
  - [a, b]

a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
`);
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toBeHidden();

    // Mutate the DSL — adding a new line shouldn't bring `infra` back.
    await setDSL(page, `
connections:
  - [a, b]
  - [b, c]

a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
c: { label: C, viewLayers: [data] }
`);
    await expect(page.locator('g.node[data-id="a"]')).toBeHidden();
    await expect(page.locator('g.node[data-id="c"]')).toBeVisible();
    // Chip for 'infra' must still be OFF (no .on class).
    const infraChip = page.locator('#layer-chips .chip', { hasText: 'infra' });
    await expect(infraChip).not.toHaveClass(/(^|\s)on(\s|$)/);
  });
});

test.describe('container survives even when ALL its children are hidden', () => {
  test('backend with all children filtered out still renders as a frame', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
backend: { label: Camada, viewLayers: [infra] }
auth: { parent: backend, label: Auth Service }
worker: { parent: backend, label: Worker }
`);
    // Both children are untagged → hiding "(sem camada)" removes them.
    // backend (viewLayers=[infra]) should remain visible.
    await page.locator('#layer-chips .chip-untagged').click();
    await expect(page.locator('g.node[data-id="auth"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="worker"]')).toHaveCount(0);
    // The container itself should STILL render.
    await expect(page.locator('g.node[data-id="backend"]')).toHaveCount(1);
  });

  test('container that nobody else references still renders as a container', async ({ page }) => {
    await gotoFresh(page);
    // In the YAML model a node only becomes a container when something
    // declares it as parent. So we set an empty placeholder child.
    await setDSL(page, `
placeholder: { label: placeholder }
ph_inner: { parent: placeholder, label: " " }
`);
    const kind = await page.locator('g.node[data-id="placeholder"]').getAttribute('data-kind');
    expect(kind).toBe('container');
  });
});

test.describe('multi-tag — OR-visibility', () => {
  test('node tagged with two layers survives toggling off one of them', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
a: { label: A, viewLayers: [infra, data] }
b: { label: B, viewLayers: [infra] }
`);
    // Both visible initially.
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(1);
    // Click "infra" off: `b` (only infra) disappears; `a` survives (data).
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
  });

  test('multi-tag node is hidden ONLY when ALL its layers are hidden', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
a: { label: A, viewLayers: [infra, data] }
`);
    // With only "infra" off, `a` survives (data still visible).
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
    // Turn off "data" too → now hidden.
    await page.locator('#layer-chips .chip', { hasText: 'data' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(0);
    // Bring "infra" back → visible again (at least one layer on).
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
  });
});

test.describe('untagged synthetic chip — Option B semantics', () => {
  test('appears only when there is a mix of tagged and untagged nodes', async ({ page }) => {
    await gotoFresh(page);
    // All tagged → no untagged chip.
    await setDSL(page, `
a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
`);
    await expect(page.locator('#layer-chips .chip-untagged')).toHaveCount(0);
    // All untagged → still no chip (nothing to isolate against).
    await setDSL(page, `
a: { label: A }
b: { label: B }
`);
    await expect(page.locator('#layer-chips .chip-untagged')).toHaveCount(0);
    // Mix → chip appears and reads "(sem camada)".
    await setDSL(page, `
a: { label: A, viewLayers: [infra] }
b: { label: B }
`);
    const chip = page.locator('#layer-chips .chip-untagged');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText('(sem camada)');
  });

  test('toggling "(sem camada)" hides untagged nodes; real chips unaffected', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
loose: { label: L }
`);
    // All three visible initially.
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="loose"]')).toHaveCount(1);
    // Click the synthetic chip → only `loose` disappears.
    await page.locator('#layer-chips .chip-untagged').click();
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="loose"]')).toHaveCount(0);
    // Click it again to bring loose back.
    await page.locator('#layer-chips .chip-untagged').click();
    await expect(page.locator('g.node[data-id="loose"]')).toHaveCount(1);
  });

  test('combining "(sem camada)" with a real layer hide', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, `
a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
loose: { label: L }
`);
    await page.locator('#layer-chips .chip', { hasText: 'infra' }).click();
    await page.locator('#layer-chips .chip-untagged').click();
    // Only `b` (layer=data) survives.
    await expect(page.locator('g.node[data-id="a"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="loose"]')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="b"]')).toHaveCount(1);
  });
});

test.describe('drill-down and layer chips are dynamic to the current view', () => {
  test('drilling into a container narrows both chip rows', async ({ page }) => {
    await gotoFresh(page);
    // Tag `box` too — otherwise the synthetic UNTAGGED chip pops up.
    await setDSL(page, `
options:
  title: Demo

connections:
  - [a, b]
  - [c, d]

a: { label: A, viewLayers: [infra] }
b: { label: B, viewLayers: [data] }
box: { label: box, viewLayers: [infra] }
c: { parent: box, label: C, viewLayers: [frontend] }
d: { parent: box, label: D, viewLayers: [frontend] }
`);
    // At root: one top-level container ("box") → one drill chip.
    const drillChips = await page.locator('#drill-chips .drill-chip').allTextContents();
    expect(drillChips).toEqual(['box']);
    // Layer chips (secondary row) list all three.
    const rootLayers = await page.locator('#layer-chips .chip').allTextContents();
    expect(rootLayers.sort()).toEqual(['data', 'frontend', 'infra']);

    // Drill into `box` via the drill chip → only `frontend` layer remains.
    await page.click('#drill-chips .drill-chip');
    await page.waitForTimeout(150);
    const drilledLayers = await page.locator('#layer-chips .chip').allTextContents();
    expect(drilledLayers).toEqual(['frontend']);
    // `box` has no nested containers → drill row is empty/hidden.
    await expect(page.locator('#drill-chips .drill-chip')).toHaveCount(0);

    // Back to root → drill row has `box` again.
    await page.click('#breadcrumb .crumb:first-child');
    await page.waitForTimeout(150);
    const back = await page.locator('#layer-chips .chip').allTextContents();
    expect(back.sort()).toEqual(['data', 'frontend', 'infra']);
    await expect(page.locator('#drill-chips .drill-chip')).toHaveCount(1);
  });
});
