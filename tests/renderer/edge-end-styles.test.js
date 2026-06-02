import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM, makeSVG } from '../dom-mock.js';

installDOM();
const { ensureMarkers, markerUrl, markerIdFor } = await import('../../src/renderer/edge-end-styles.js');

describe('ensureMarkers', () => {
  test('creates one <marker> per preset (except "none")', () => {
    const svg = makeSVG();
    ensureMarkers(svg);
    const defs = svg.querySelector('defs');
    assert.ok(defs, 'defs created');
    const markers = defs.querySelectorAll('marker');
    // Expected presets: filledArrow, outlineArrow, crowfoot, diamond, circle
    assert.equal(markers.length, 5);
  });

  test('every marker has an id, viewBox and at least one path', () => {
    const svg = makeSVG();
    ensureMarkers(svg);
    for (const m of svg.querySelectorAll('marker')) {
      assert.ok(m.getAttribute('id'));
      assert.equal(m.getAttribute('viewBox'), '0 0 10 10');
      assert.ok(m.querySelectorAll('path').length >= 1);
    }
  });

  test('idempotent — calling twice does not duplicate', () => {
    const svg = makeSVG();
    ensureMarkers(svg);
    ensureMarkers(svg);
    assert.equal(svg.querySelector('defs').querySelectorAll('marker').length, 5);
  });
});

describe('markerUrl / markerIdFor', () => {
  test('"none" returns null url', () => {
    assert.equal(markerUrl('none'), null);
    assert.equal(markerUrl(null), null);
    assert.equal(markerUrl(undefined), null);
  });
  test('unknown preset returns null', () => {
    assert.equal(markerUrl('bogus'), null);
  });
  test('known preset returns url(#id)', () => {
    assert.equal(markerUrl('filledArrow'), `url(#${markerIdFor('filledArrow')})`);
    assert.equal(markerUrl('crowfoot'),   `url(#${markerIdFor('crowfoot')})`);
  });
});
