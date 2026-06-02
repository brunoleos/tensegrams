// Display label for the synthetic UNTAGGED sentinel (keep in sync with
// layer-filter.js — exported there). Storage uses the sentinel; the chip
// label that the user sees is friendlier.
const UNTAGGED = '__untagged__';
const UNTAGGED_LABEL = '(sem camada)';

export function createLayerControl(container, onChange) {
  const root = document.createElement('div');
  root.className = 'layers-control';
  container.appendChild(root);

  let visible = new Set();
  let allLayers = [];

  function render() {
    root.innerHTML = '';
    if (!allLayers.length) {
      const empty = document.createElement('span');
      empty.className = 'muted';
      empty.textContent = 'sem camadas';
      root.appendChild(empty);
      return;
    }
    for (const tag of allLayers) {
      const chip = document.createElement('button');
      const isUntagged = tag === UNTAGGED;
      chip.className = 'chip' + (visible.has(tag) ? ' on' : '') + (isUntagged ? ' chip-untagged' : '');
      chip.textContent = isUntagged ? UNTAGGED_LABEL : tag;
      chip.dataset.layer = tag;
      chip.addEventListener('click', () => {
        if (visible.has(tag)) visible.delete(tag);
        else visible.add(tag);
        render();
        // Pass BOTH the visible set and the derived hidden set. The hidden
        // set is the source of truth for the store (it's what gets persisted
        // and what the layer-filter applies). Computing it here keeps the
        // synthetic UNTAGGED sentinel reachable to the store.
        const hidden = new Set(allLayers.filter(l => !visible.has(l)));
        onChange(visible, hidden);
      });
      root.appendChild(chip);
    }
  }

  return {
    // Re-bind the available layer set and seed visibility from `hiddenSet`.
    // Tags absent from `hiddenSet` (including newly-discovered ones) default
    // to visible. We DO NOT call onChange here — the caller is the source of
    // truth for `hiddenSet`, so emitting would be a no-op or, worse, race
    // against an ongoing rerender and clobber the store.
    setLayers(layers, hiddenSet = new Set()) {
      allLayers = layers.slice();
      visible = new Set(allLayers.filter(l => !hiddenSet.has(l)));
      render();
    },
    visible() { return new Set(visible); },
  };
}
