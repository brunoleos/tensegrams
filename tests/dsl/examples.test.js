import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../../src/dsl/examples.js';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';

describe('built-in DSL examples', () => {
  for (const [name, src] of Object.entries(EXAMPLES)) {
    test(`${name} parses without YAML errors`, () => {
      const parsed = parse(src);
      assert.deepEqual(parsed.errors, [], `parser errors: ${JSON.stringify(parsed.errors)}`);
    });

    test(`${name} produces at least one node`, () => {
      const ir = buildIR(parse(src));
      assert.ok(ir.nodes.length > 0);
    });

    test(`${name} produces no IR errors`, () => {
      const ir = buildIR(parse(src));
      assert.deepEqual(ir.errors, [], `IR errors: ${JSON.stringify(ir.errors)}`);
    });
  }
});
