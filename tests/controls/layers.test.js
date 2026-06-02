import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installDOM } from '../dom-mock.js';

installDOM();
const { createLayerControl } = await import('../../src/controls/layers.js');

describe('createLayerControl', () => {
  test('renders one chip per layer when set', () => {
    const root = document.createElement('div');
    const ctl = createLayerControl(root, () => {});
    ctl.setLayers(['a', 'b', 'c']);
    const chips = root.querySelectorAll('.chip');
    assert.equal(chips.length, 3);
  });

  test('newly-discovered layers default to visible (chip has .on)', () => {
    const root = document.createElement('div');
    const ctl = createLayerControl(root, () => {});
    ctl.setLayers(['a', 'b']);
    const chips = Array.from(root.querySelectorAll('.chip'));
    assert.equal(chips.length, 2);
    assert.ok(chips[0].classList.contains('on'));
    assert.ok(chips[1].classList.contains('on'));
    assert.equal(ctl.visible().size, 2);
  });

  test('hidden set passed in is honored — those chips render without .on', () => {
    const root = document.createElement('div');
    const ctl = createLayerControl(root, () => {});
    ctl.setLayers(['a', 'b', 'c'], new Set(['b']));
    const chips = Array.from(root.querySelectorAll('.chip'));
    const onState = chips.map(c => c.classList.contains('on'));
    assert.deepEqual(onState, [true, false, true]);
    assert.equal(ctl.visible().has('b'), false);
  });

  test('setLayers does NOT call onChange (caller owns hidden state)', () => {
    const root = document.createElement('div');
    let calls = 0;
    const ctl = createLayerControl(root, () => { calls++; });
    ctl.setLayers(['a', 'b']);
    assert.equal(calls, 0);
  });

  test('shows "sem camadas" when empty', () => {
    const root = document.createElement('div');
    const ctl = createLayerControl(root, () => {});
    ctl.setLayers([]);
    assert.match(root.textContent, /sem camadas/);
  });
});
