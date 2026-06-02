// Floating action FAB anchored to the preview-pane (bottom-left).
//
// Why this exists: on touch devices there's no right-click and no
// reliable long-press without conflicting with native gestures. The FAB
// gives every per-node action a tap-sized target that's always within
// thumb reach, without depending on contextual gestures.
//
// States:
//   - no selection → collapsed: a single chip with `▴` (expand cue).
//                    Tapping it does nothing useful (no node selected),
//                    so we just keep it visible as an anchor.
//   - selection    → expanded by default: shows the node name + the
//                    actions valid for it. A chevron in the header
//                    collapses to a compact pill that still shows
//                    the selected name, in case the FAB gets in the way.
//
// Actions surfaced (depend on node kind):
//   - Container expanded:  [Entrar] [Ocultar conteúdo] [Limpar]
//   - Container collapsed: [Entrar] [Mostrar conteúdo] [Limpar]
//   - Leaf:                [Limpar]
//
// Right-click context menu on desktop offers the same actions via
// shared callbacks, so behavior is consistent across input modalities.

import { createMenuButton } from './menu-button.js';

export function createActionFab(root, callbacks) {
  let expanded = true;
  let lastNode = null;
  let lastFocus = null; // node id whose drill-in would actually do something

  function render(node, focus) {
    lastNode = node;
    lastFocus = focus;
    root.innerHTML = '';
    root.classList.toggle('expanded', expanded && !!node);
    root.classList.toggle('has-selection', !!node);

    if (!node) {
      // Idle: a slim hint that the FAB exists. Click expands but stays
      // empty until the user selects something.
      const hint = document.createElement('button');
      hint.type = 'button';
      hint.className = 'fab-toggle';
      hint.textContent = '⋯';
      hint.title = 'Selecione um nó para ver ações';
      hint.setAttribute('aria-label', 'Menu de ações (vazio)');
      root.appendChild(hint);
      return;
    }

    // Header: node name + collapse chevron.
    const header = document.createElement('div');
    header.className = 'fab-header';
    const name = document.createElement('span');
    name.className = 'fab-name';
    name.textContent = node.label || node.id;
    header.appendChild(name);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fab-toggle';
    toggle.textContent = expanded ? '▾' : '▴';
    toggle.setAttribute('aria-label', expanded ? 'Recolher menu' : 'Expandir menu');
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      render(lastNode, lastFocus);
    });
    header.appendChild(toggle);
    root.appendChild(header);

    if (!expanded) return;

    const items = document.createElement('div');
    items.className = 'fab-items';

    if (node.hasChildren) {
      // Drill — only meaningful if the container isn't already the focus.
      const drillable = node.id !== focus;
      items.appendChild(item('Entrar', drillable, () => callbacks.onDrill(node.id)));
      items.appendChild(item(
        node.collapsed ? 'Mostrar conteúdo' : 'Ocultar conteúdo',
        true,
        () => callbacks.onToggleCollapse(node.id),
      ));
    }
    items.appendChild(item('Limpar seleção', true, () => callbacks.onClearSelection()));
    root.appendChild(items);
  }

  function item(label, enabled, onClick) {
    return createMenuButton(label, onClick, { className: 'fab-item', enabled });
  }

  return { render };
}
