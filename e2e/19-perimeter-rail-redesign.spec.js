// E2E demonstrativo do redesenho do engine físico:
//
//   - Anchor é vagão num trilho (perímetro do nó), não pin total.
//   - Força central por aresta puxa o anchor pro midpoint dos centros.
//   - Snap selection greedy + compartilhamento permitido.
//   - BBox de endpoint vs BBox separa endpoints no mesmo nó.
//
// Cada teste tira screenshot do estado final pra inspecção visual; o
// usuário pode comparar com os baselines previstos.

import { test, expect } from '@playwright/test';
import { gotoFresh, setDSL, setConfig } from './helpers.js';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCREENSHOTS_DIR = resolve(import.meta.dirname, '..', 'screenshots-redesign');

async function snap(page, name) {
  const path = resolve(SCREENSHOTS_DIR, `${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.locator('svg#canvas').screenshot({ path });
  return path;
}

test.describe('Perimeter rail redesign — screenshots', () => {
  test('quad com 4 arestas: anchors deslizam pelos perímetros sob força central', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, [
      'connections:',
      '  - [a, b]',
      '  - [b, c]',
      '  - [c, d]',
      '  - [d, a]',
      'a: { nodeLayers: [g] }',
      'b: { nodeLayers: [g] }',
      'c: { nodeLayers: [g] }',
      'd: { nodeLayers: [g] }',
    ].join('\n'));
    await setConfig(page, 'routing:\n  engine: physics\n');
    await page.waitForTimeout(1500);
    await snap(page, 'quad-4-edges');
    const edges = await page.evaluate(() => window.__currentIR__.edges.length);
    expect(edges).toBe(4);
  });

  test('hub com 5 spokes: anchors compartilham face mas separam via BBox', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, [
      'connections:',
      '  - [hub, a]',
      '  - [hub, b]',
      '  - [hub, c]',
      '  - [hub, d]',
      '  - [hub, e]',
      'hub: { nodeLayers: [g] }',
      'a: { nodeLayers: [g] }',
      'b: { nodeLayers: [g] }',
      'c: { nodeLayers: [g] }',
      'd: { nodeLayers: [g] }',
      'e: { nodeLayers: [g] }',
    ].join('\n'));
    await setConfig(page, [
      'routing:',
      '  engine: physics',
      'collision:',
      '  edgePad: 6',
    ].join('\n'));
    await page.waitForTimeout(1500);
    await snap(page, 'hub-5-spokes');
    const edges = await page.evaluate(() => window.__currentIR__.edges.length);
    expect(edges).toBe(5);
  });

  test('hub com snap cardinais: 5 spokes acabam nos snap points (compartilhamento permitido)', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, [
      'connections:',
      '  - [hub, a]',
      '  - [hub, b]',
      '  - [hub, c]',
      '  - [hub, d]',
      '  - [hub, e]',
      'hub: { snap: [top, right, bottom, left] }',
      'a: {}',
      'b: {}',
      'c: {}',
      'd: {}',
      'e: {}',
    ].join('\n'));
    await setConfig(page, 'routing:\n  engine: physics\n');
    await page.waitForTimeout(1500);
    await snap(page, 'hub-snap-cardinals');
    const edges = await page.evaluate(() => window.__currentIR__.edges.length);
    expect(edges).toBe(5);
  });

  test('algebraic.legacy: false → modo "engine puro físico" (sem clips/snaps algébricos)', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, [
      'connections:',
      '  - [a, b]',
      '  - [b, c]',
      '  - [c, a]',
      'a: { nodeLayers: [g] }',
      'b: { nodeLayers: [g] }',
      'c: { nodeLayers: [g] }',
    ].join('\n'));
    await setConfig(page, [
      'routing:',
      '  engine: physics',
      '  algebraic:',
      '    legacy: false',
    ].join('\n'));
    await page.waitForTimeout(1500);
    await snap(page, 'algebraic-legacy-off');
    const edges = await page.evaluate(() => window.__currentIR__.edges.length);
    expect(edges).toBe(3);
  });

  test('endpoints sub-objeto na DSL: per-edge side override', async ({ page }) => {
    await gotoFresh(page);
    await setDSL(page, [
      'connections:',
      '  - [a, b]',
      '  - [a, c]',
      'a: { nodeLayers: [g] }',
      'b: { nodeLayers: [g] }',
      'c: { nodeLayers: [g] }',
      '? [a, b]',
      ': { endpoints: { source: { side: 24 } } }',
    ].join('\n'));
    await setConfig(page, 'routing:\n  engine: physics\n  endpointBBox: { side: 12 }\n');
    await page.waitForTimeout(1500);
    await snap(page, 'endpoints-dsl-side');
    const ab = await page.evaluate(() => {
      const e = window.__currentIR__.edges.find(x => x.source === 'a' && x.target === 'b');
      return e?.endpoints || null;
    });
    expect(ab).toEqual({ source: { side: 24 } });
  });
});
