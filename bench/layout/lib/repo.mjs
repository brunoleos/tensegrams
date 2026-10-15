// Ponte para os módulos do repositório Tensegrams (somente leitura).
// Override com TENSEGRAMS_REPO=/outro/caminho (ex.: um worktree).
import { fileURLToPath, pathToFileURL } from 'node:url';

// Default: a raiz do repositório que contém esta bancada (bench/layout/lib → ../../..).
export const REPO = process.env.TENSEGRAMS_REPO || fileURLToPath(new URL('../../..', import.meta.url)).replace(/\/$/, '');
const u = (p) => pathToFileURL(`${REPO}/${p}`).href;

const [parser, ir, examples, live, custom, off, straight] = await Promise.all([
  import(u('src/dsl/parser.js')),
  import(u('src/dsl/ir.js')),
  import(u('src/dsl/examples.js')),
  import(u('src/layout/adapters/live/index.js')),
  import(u('src/layout/adapters/custom/index.js')),
  import(u('src/layout/adapters/off.js')),
  import(u('src/routing/routers/straight.js')),
]);

export const parse = parser.parse;
export const buildIR = ir.buildIR;
export const EXAMPLES = examples.EXAMPLES;
export const ADAPTERS = { live: live.adapter, custom: custom.adapter, off: off.adapter };
export const straightRouter = straight.router;

export function irFromYaml(src) {
  return buildIR(parse(src));
}
