// Shared helpers for E2E specs. Keep this file tiny — most tests should read
// linearly without indirection.

export async function gotoFresh(page) {
  // Each test gets a fresh browser context (Playwright default), so
  // localStorage starts empty — no manual clear needed.
  await page.goto('/');
  // Wait for the first paint pass — main.js calls rerender() then fitToView().
  await page.waitForSelector('svg#canvas g.nodes', { state: 'attached' });
  await page.waitForTimeout(120);
}

export async function setDSL(page, text) {
  // Ensure the DSL tab is active — the textarea is `hidden` otherwise.
  await page.click('#tab-dsl');
  const ta = page.locator('#editor');
  await ta.click();
  await page.keyboard.press('ControlOrMeta+A');
  await ta.fill(text);
  // Editor uses a 150ms debounce; wait a little more.
  await page.waitForTimeout(220);
}

export async function setConfig(page, text) {
  await page.click('#tab-config');
  // The Config tab defaults to the structured editor; switch to raw text
  // so we can paste a full JSON blob in one go.
  await page.click('#cfg-mode-text');
  const ta = page.locator('#config-editor');
  await ta.click();
  await page.keyboard.press('ControlOrMeta+A');
  await ta.fill(text);
  await page.waitForTimeout(220);
}

export async function selectLayout(page, id) {
  await page.locator('#layout-select').selectOption(id);
  await page.waitForTimeout(120);
}

export async function selectRouter(page, id) {
  await page.locator('#router-select').selectOption(id);
  await page.waitForTimeout(120);
}

export async function nodeBox(page, id) {
  return await page.evaluate((nid) => {
    const el = document.querySelector(`g.node[data-id="${nid}"]`);
    if (!el) return null;
    const tr = el.getAttribute('transform') || '';
    const m = tr.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
    const rect = el.querySelector('.node-rect');
    return {
      x: m ? Number(m[1]) : 0,
      y: m ? Number(m[2]) : 0,
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    };
  }, id);
}
