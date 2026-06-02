import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from '../../src/controls/yaml-highlight.js';

const tag = (kind, txt) => `<span class="yh-${kind}">${txt}</span>`;

describe('yaml-highlight — basic constructs', () => {
  test('empty input returns empty string', () => {
    assert.equal(highlight(''), '');
    assert.equal(highlight(null), '');
    assert.equal(highlight(undefined), '');
  });

  test('plain key: value', () => {
    const out = highlight('label: Web');
    assert.match(out, new RegExp(tag('key', 'label')));
    assert.match(out, new RegExp(tag('punct', ':')));
  });

  test('quoted string scalar', () => {
    const out = highlight('label: "Hello world"');
    assert.match(out, new RegExp(tag('string', '&quot;Hello world&quot;')));
  });

  test('number scalar', () => {
    const out = highlight('size: 42');
    assert.match(out, new RegExp(tag('number', '42')));
  });

  test('decimal number', () => {
    const out = highlight('damping: 0.82');
    assert.match(out, new RegExp(tag('number', '0.82')));
  });

  test('boolean keyword', () => {
    const out = highlight('snap: on');
    assert.match(out, new RegExp(tag('keyword', 'on')));
  });

  test('comment-only line', () => {
    const out = highlight('# just a comment');
    assert.match(out, new RegExp(tag('comment', '# just a comment')));
  });

  test('trailing comment after value', () => {
    const out = highlight('label: X  # note');
    assert.match(out, new RegExp(tag('comment', '# note')));
    assert.match(out, new RegExp(tag('key', 'label')));
  });

  test('hash inside value is NOT a comment', () => {
    const out = highlight('label: color#123');
    assert.equal(out.includes(tag('comment', '#123')), false);
  });
});

describe('yaml-highlight — flow + composite', () => {
  test('flow sequence with multiple items', () => {
    const out = highlight('viewLayers: [public, security]');
    assert.match(out, new RegExp(tag('punct', '\\[')));
    assert.match(out, new RegExp(tag('punct', '\\]')));
    assert.match(out, new RegExp(tag('punct', ',')));
  });

  test('flow mapping with weights', () => {
    const out = highlight('nodeLayers: { svc: 0.5 }');
    assert.match(out, new RegExp(tag('punct', '{')));
    assert.match(out, new RegExp(tag('punct', '}')));
    assert.match(out, new RegExp(tag('key', 'svc')));
    assert.match(out, new RegExp(tag('number', '0.5')));
  });

  test('composite key indicator highlights the ?', () => {
    const out = highlight('? [a, b]');
    assert.match(out, new RegExp(tag('punct', '\\? ')));
  });

  test('connection entry under a list', () => {
    const out = highlight('  - [api, db]');
    assert.match(out, new RegExp(tag('punct', '- ')));
    assert.match(out, new RegExp(tag('punct', '\\[')));
  });

  test('multiline preserves newlines', () => {
    const out = highlight('a: 1\nb: 2');
    assert.equal(out.split('\n').length, 2);
  });
});

describe('yaml-highlight — html safety', () => {
  test('escapes &, <, >, " in values', () => {
    const out = highlight('label: <b>"a" & b</b>');
    assert.equal(out.includes('<b>'), false);
    assert.equal(out.includes('&amp;'), true);
    assert.equal(out.includes('&lt;'), true);
  });
});
