// Smoke test contra deploy externo (default: produção GitHub Pages,
// override via PLAYWRIGHT_BASE_URL). Sem webServer.
//
// Cobre regressão de be273b2 (introdução da SVG <mask> em edges):
// quando edge NÃO tem label, sizeMask() não era chamado e o
// <rect.edge-mask-fill> ficava em 0x0 (default) → mask todo preto →
// <path mask="url(...)"> recortado por completo → edge invisível.
//
// Asserção VISUAL (não DOM-only): screenshot + contagem de pixels da
// cor do edge na faixa entre os 2 nodes. DOM-only sempre passou —
// path.getTotalLength() é não-zero mesmo com mask zerada.
//
// Rodar: npx playwright test --config=playwright.config.prod.js

import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://brunoleos.github.io/tensegrams/';

// DSL mínima sem label nas arestas — força o branch problemático em
// renderer/edges.js (else { /* sem label */ }). Layout live com
// center=0 separa os nodes via colisão (gap grande, edge bem visível).
const DSL_TWO_NODES_NO_LABEL = `options:
  title: Repro mobile-edges

connections:
  - [a, b]

a:
  label: A

b:
  label: B
`;

const CONFIG_LIVE_NO_CENTER = JSON.stringify({ live: { center: 0 } });

const PERSISTED_STATE = {
  dsl: DSL_TWO_NODES_NO_LABEL,
  config: CONFIG_LIVE_NO_CENTER,
  layoutId: 'live',
  routerId: 'orthogonal',
  options: {},
  viewState: { hiddenLayers: [], focusedContainer: null },
  ui: {
    theme: 'dark',
    editorState: 'expanded',
    activeTab: 'dsl',
    configMode: 'text',
    editorWidth: 360,
    editorHeight: 280,
  },
};

// Conta pixels "edge-like" (cinza claro rgb(148,163,184) ± tolerância)
// dentro de um rect [x0..x1] × [y0..y1] do PNG (coords device-px).
function countEdgePixelsIn(pngPath, region) {
  const img = PNG.sync.read(readFileSync(pngPath));
  const { x0, y0, x1, y1 } = region;
  let n = 0;
  for (let y = y0; y < y1 && y < img.height; y++) {
    for (let x = x0; x < x1 && x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      if (Math.abs(r - 148) < 35 && Math.abs(g - 163) < 35 && Math.abs(b - 184) < 35) n++;
    }
  }
  return n;
}

test.describe('renderer/edges — regressão be273b2 (mask sem label)', () => {
  test('2 nodes + 1 edge sem label → edge visível entre os nodes', async ({ page }) => {
    await page.addInitScript((state) => {
      localStorage.setItem('tensegrams:dsl-v2', JSON.stringify(state));
    }, PERSISTED_STATE);

    await page.goto(BASE_URL);
    await page.waitForSelector('svg#canvas g.nodes', { state: 'attached' });
    // Live precisa de tempo pra estabilizar (alpha decay).
    await page.waitForTimeout(1500);

    // Sanity DOM — passa mesmo com o bug.
    await expect(page.locator('svg#canvas g.node')).toHaveCount(2);
    await expect(page.locator('svg#canvas g.edges .edge-path')).toHaveCount(1);

    // Geometria: bbox de cada node em coord da tela + dpr.
    const geom = await page.evaluate(() => {
      const ns = Array.from(document.querySelectorAll('svg#canvas g.node'));
      const rs = ns.map(n => n.getBoundingClientRect()).sort((a, b) => a.x - b.x);
      return {
        leftNode: { x: rs[0].x, y: rs[0].y, w: rs[0].width, h: rs[0].height },
        rightNode: { x: rs[1].x, y: rs[1].y, w: rs[1].width, h: rs[1].height },
        dpr: window.devicePixelRatio || 1,
      };
    });

    const shotPath = test.info().outputPath('canvas.png');
    await page.screenshot({ path: shotPath, fullPage: false });

    // Região onde a edge DEVE estar: faixa entre as bordas internas
    // dos dois nodes, alinhada verticalmente com a faixa de altura
    // dos nodes (com folga vertical pra absorver pequenas variações
    // de posição do solver físico).
    const dpr = geom.dpr;
    const leftRight = geom.leftNode.x + geom.leftNode.w;
    const rightLeft = geom.rightNode.x;
    expect(rightLeft - leftRight).toBeGreaterThan(40); // sanity: nodes separados
    const yMin = Math.min(geom.leftNode.y, geom.rightNode.y);
    const yMax = Math.max(geom.leftNode.y + geom.leftNode.h, geom.rightNode.y + geom.rightNode.h);
    const region = {
      x0: Math.round((leftRight + 4) * dpr),
      x1: Math.round((rightLeft - 4) * dpr),
      y0: Math.round((yMin - 8) * dpr),
      y1: Math.round((yMax + 8) * dpr),
    };

    const edgePixels = countEdgePixelsIn(shotPath, region);
    // Com o bug (mask 0x0), edgePixels ~ 0. Com a edge pintada,
    // espera-se dezenas a centenas dependendo do device. Threshold
    // conservador (>= 30) cobre desktop e mobile com folga.
    expect(
      edgePixels,
      `edge invisível entre nodes — esperado >=30 pixels edge-color, achei ${edgePixels} (region=${JSON.stringify(region)})`,
    ).toBeGreaterThanOrEqual(30);
  });
});
