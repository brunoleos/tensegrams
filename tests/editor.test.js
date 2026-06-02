import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from './dom-mock.js';

installDOM();
const { createEditor } = await import('../src/editor.js');

describe('createEditor', () => {
  test('setValue + getValue roundtrip', () => {
    const ta = document.createElement('textarea');
    const ed = createEditor(ta, { onChange: () => {} });
    ed.setValue('hello');
    assert.equal(ed.getValue(), 'hello');
  });

  test('flush calls onChange immediately', () => {
    const ta = document.createElement('textarea');
    let called = null;
    const ed = createEditor(ta, { onChange: (v) => { called = v; } });
    ta.value = 'manual';
    ed.flush();
    assert.equal(called, 'manual');
  });
});
