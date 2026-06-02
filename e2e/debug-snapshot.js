#!/usr/bin/env node
// Debug snapshot tool — drives the SPA in headless Chromium, sets DSL/
// config/layout/router, and dumps the rendered SVG. With --assert it
// also checks the geometry invariants and exits non-zero on violation.
//
// Standalone Node script — does NOT run under `playwright test`. Boot
// the dev server yourself first (npm run serve, default port 5173).
//
// Examples:
//   node e2e/debug-snapshot.js --example=containers --layout=live \
//        --router=orthogonal --assert
//   node e2e/debug-snapshot.js --dsl=fixtures/my.dsl --out=my.svg
//   node e2e/debug-snapshot.js --url=http://127.0.0.1:5179 --assert

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assertGeometryInvariants } from './invariants.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function help() {
  console.log(`Usage: node e2e/debug-snapshot.js [options]

  --url=<url>            Base URL (default http://127.0.0.1:5173/)
  --example=<id>         Load a built-in example (intro|containers|forces)
  --dsl=<path>           Set DSL from file (overrides --example)
  --config=<path>        Set config (raw JSON) from file
  --layout=<id>          custom | live | off
  --router=<id>          straight | orthogonal | curved
  --wait=<ms>            Settle time before snapshot (default 2000)
  --out=<path>           Write SVG to file (default stdout)
  --assert               Run geometry invariant checks; exit non-zero on violation
  --headed               Show browser window (debugging the tool itself)
  --help                 Show this help
`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { help(); process.exit(0); }

const url = args.url || 'http://127.0.0.1:5173/';
const wait = Number(args.wait || 2000);
const browser = await chromium.launch({ headless: !args.headed });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

let exit = 0;
try {
  await page.goto(url);
  await page.waitForSelector('svg#canvas g.nodes', { state: 'attached', timeout: 8000 });

  if (args.dsl) {
    const text = readFileSync(resolve(HERE, args.dsl), 'utf-8');
    await page.evaluate((t) => window.__store__.setDSL(t), text);
  } else if (args.example) {
    await page.evaluate((id) => {
      const dsl = window.__examples__?.[id];
      if (!dsl) throw new Error(`unknown example: ${id}`);
      window.__store__.setDSL(dsl);
    }, args.example);
  }

  if (args.config) {
    const text = readFileSync(resolve(HERE, args.config), 'utf-8');
    await page.evaluate((t) => window.__store__.setConfigText?.(t) ?? window.__store__.setConfig?.(JSON.parse(t)), text);
  }
  if (args.layout) {
    await page.locator('#layout-select').selectOption(args.layout);
  }
  if (args.router) {
    await page.locator('#router-select').selectOption(args.router);
  }

  await page.waitForTimeout(wait);

  const svg = await page.locator('#canvas').evaluate(el => el.outerHTML);
  if (args.out) {
    writeFileSync(resolve(process.cwd(), args.out), svg);
    console.error(`SVG → ${args.out} (${svg.length} bytes)`);
  } else {
    process.stdout.write(svg + '\n');
  }

  if (args.assert) {
    const geo = await page.evaluate(() => {
      const layout = window.__currentLayout__;
      const ir = window.__currentIR__;
      if (!layout || !ir) return null;
      const positions = {};
      for (const [id, r] of layout.positions) {
        positions[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
      }
      if (layout.containers) {
        for (const [id, r] of layout.containers) {
          positions[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
        }
      }
      const edges = [];
      for (const e of ir.edges) {
        const re = layout.routedEdges.get(e.id);
        if (!re) continue;
        edges.push({ id: e.id, source: e.source, target: e.target, points: re.points });
      }
      return { positions, edges };
    });
    if (!geo) {
      console.error('ASSERT FAILED — window.__currentLayout__ / __currentIR__ not exposed');
      exit = 2;
    } else {
      const issues = assertGeometryInvariants(geo);
      if (issues.length) {
        console.error(`ASSERT FAILED — ${issues.length} invariant violations:`);
        for (const i of issues) console.error('  -', i);
        exit = 1;
      } else {
        console.error(`ASSERT OK — ${geo.edges.length} edges, 0 violations.`);
      }
    }
  }
} finally {
  await browser.close();
}
process.exit(exit);
