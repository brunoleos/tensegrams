// Debug pack — bundles current state (DSL, config, IR, layout, page HTML,
// SVG canvas as PNG, console buffer) into a single .json file for download.
// Goal: hand off a reproducible snapshot of what the user is seeing.

import { VERSION } from '../version.js';
import { snapshotConsole } from './console-buffer.js';
import { downloadTextFile, fileTimestamp } from './download.js';

// Mark Map/Set values for round-trippable serialisation. Plain objects pass
// through unchanged.
function serialise(value) {
  return JSON.parse(JSON.stringify(value, (_k, v) => {
    if (v instanceof Map) return { __type: 'Map', entries: [...v.entries()] };
    if (v instanceof Set) return { __type: 'Set', values: [...v.values()] };
    return v;
  }));
}

// Renders the live SVG canvas to a PNG data URL. Resolves to null when the
// canvas isn't available (paint hasn't happened yet) or the rasterisation
// fails — caller falls back to omitting the screenshot.
async function svgCanvasToPng() {
  const svg = document.getElementById('canvas');
  if (!svg) return null;
  try {
    const w = svg.clientWidth || svg.viewBox?.baseVal?.width || 1280;
    const h = svg.clientHeight || svg.viewBox?.baseVal?.height || 800;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    const xml = new XMLSerializer().serializeToString(clone);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // Fill with the page background so transparent SVG comes out readable.
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function buildDebugPack(store) {
  const state = store.state;
  const ir = window.__currentIR__ || null;
  const layout = window.__currentLayout__ || null;
  return {
    schema: 'tensegrams-debug-pack/1',
    capturedAt: new Date().toISOString(),
    build: { version: VERSION, url: location.href, viewport: { w: innerWidth, h: innerHeight }, ua: navigator.userAgent },
    inputs: { dsl: state.dsl, config: state.config ?? null, parsedOptions: state.options ?? null },
    selection: { layoutId: state.layoutId, routerId: state.routerId },
    ir: ir ? serialise(ir) : null,
    layout: layout ? serialise(layout) : null,
    diagnostics: {
      warnings: ir?.warnings || [],
      errors: ir?.errors || [],
    },
    console: snapshotConsole(),
    screenshotPng: await svgCanvasToPng(),
    html: document.documentElement.outerHTML,
  };
}

export async function exportDebugPack(store) {
  const pack = await buildDebugPack(store);
  downloadTextFile(`tensegrams-debug-${fileTimestamp()}.json`,
                   JSON.stringify(pack, null, 2), 'application/json');
}
