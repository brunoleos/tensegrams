// Assembles the deployable static bundle into dist/.
//
// There's no bundler: the SPA loads ES modules straight from src/ and
// resolves the bare `yaml` import through the <importmap> in index.html.
// So "building" is just copying the deployable set into dist/ with the
// exact same relative layout, and nothing else (no tests/, no e2e/, no
// .git/). dist/ then serves byte-identically to how the repo root serves
// in dev — what you test locally is what Pages publishes.
//
// Deployable set:
//   - index.html, style.css      the SPA shell
//   - src/                       the ES-module source tree (incl. version.js,
//                                which CI stamps with the commit SHA *before*
//                                this runs, so the stamp lands in the bundle)
//   - node_modules/yaml/browser  the only runtime dep, as the importmap
//                                points `yaml` → ./node_modules/yaml/browser/index.js
//
// Run: `npm run build` (CI does this in the deploy job; see
// .github/workflows/deploy-tensegrams.yml). Requires deps installed
// (`npm ci` / `npm ci --omit=dev`) so yaml/browser exists.

import { rmSync, mkdirSync, cpSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Path of the yaml browser build, relative to root — kept as a path
// fragment so it lands at the *same* location under dist/ (the importmap
// resolves exactly this).
const YAML_BROWSER = join('node_modules', 'yaml', 'browser');

const ASSETS = ['index.html', 'style.css', 'src', YAML_BROWSER];

// Fail loudly if deps aren't installed — otherwise the bundle would ship
// without `yaml` and the app would blank-screen on load.
if (!existsSync(join(root, YAML_BROWSER))) {
  console.error(`[build] missing ${YAML_BROWSER} — run \`npm ci\` first.`);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const asset of ASSETS) {
  const from = join(root, asset);
  if (!existsSync(from)) {
    console.error(`[build] missing deployable asset: ${asset}`);
    process.exit(1);
  }
  cpSync(from, join(dist, asset), { recursive: true });
}

const mb = (dirSize(dist) / 1024 / 1024).toFixed(2);
console.log(`[build] dist/ assembled (${mb} MB): ${ASSETS.join(', ')}`);

function dirSize(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}
