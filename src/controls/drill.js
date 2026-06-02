// Drill-down chips: one chip per immediate child container of the current
// (projected) view. Clicking a chip drills into that container. The set
// is dynamic — drilling deeper narrows the chips to whatever is visible
// at the new level; reaching a level with no child containers hides the
// row entirely.

export function createDrillControl(container, onDrill) {
  const root = document.createElement('div');
  root.className = 'drill-control';
  container.appendChild(root);

  return {
    setContainers(items) {
      root.innerHTML = '';
      if (!items.length) {
        root.classList.add('empty');
        return;
      }
      root.classList.remove('empty');
      for (const c of items) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip drill-chip';
        chip.title = `entrar em ${c.label}`;
        chip.textContent = c.label;
        chip.dataset.id = c.id;
        chip.addEventListener('click', () => onDrill(c.id));
        root.appendChild(chip);
      }
    },
  };
}

// Walks the projected IR and returns the containers that the user can
// drill into FROM HERE: the top-level containers in the current view
// (i.e. those whose parent is null after projection, regardless of how
// they were nested in the source).
export function topLevelContainers(ir) {
  return ir.nodes.filter(n => n.hasChildren && !n.parent);
}
