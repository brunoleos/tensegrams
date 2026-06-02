// Right-click context menu over diagram nodes. Today the only action is
// "Ocultar/Mostrar conteúdo" for containers — keeping the surface tiny
// avoids competing with browser-native menus everywhere else.
//
// The menu is a plain DOM overlay (not SVG) anchored to the preview
// pane's stacking context. It auto-closes on outside click, Escape, or
// any scroll/zoom of the canvas.

import { createMenuButton } from './menu-button.js';

export function createContextMenu(root, svg, getNode, callbacks) {
  let openFor = null; // node id the menu is currently bound to, or null

  function close() {
    if (!openFor) return;
    openFor = null;
    root.hidden = true;
    root.innerHTML = '';
  }

  function item(label, onClick) {
    return createMenuButton(label, onClick, {
      className: 'menu-item',
      role: 'menuitem',
      onAfter: close,
    });
  }

  function openAt(clientX, clientY, node) {
    root.innerHTML = '';
    if (!node.hasChildren) return;
    const isCollapsed = !!node.collapsed;
    root.appendChild(item('Entrar', () => callbacks.onDrill(node.id)));
    root.appendChild(item(
      isCollapsed ? 'Mostrar conteúdo' : 'Ocultar conteúdo',
      () => callbacks.onToggleCollapse(node.id),
    ));

    // Reveal BEFORE measuring — a hidden element has no offsetParent.
    root.hidden = false;
    openFor = node.id;
    // Position relative to the menu's offsetParent (preview-pane). The
    // event clientX/Y is viewport-relative; subtract the parent's rect.
    const parentRect = (root.offsetParent || document.body).getBoundingClientRect();
    root.style.left = `${clientX - parentRect.left}px`;
    root.style.top  = `${clientY - parentRect.top}px`;
    // Focus first item for keyboard users.
    root.querySelector('.menu-item')?.focus();
  }

  // Right-click handler — bound to the SVG so it covers every node.
  // Replaces the previous "preventDefault only" handler from main.js.
  svg.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const g = ev.target.closest('g.node');
    if (!g) { close(); return; }
    const node = getNode(g.dataset.id);
    if (!node || !node.hasChildren) { close(); return; }
    openAt(ev.clientX, ev.clientY, node);
  });

  // Click outside / scroll / zoom / Escape closes.
  document.addEventListener('pointerdown', (ev) => {
    if (!openFor) return;
    if (root.contains(ev.target)) return;
    close();
  }, true);
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && openFor) { close(); ev.stopPropagation(); }
  });
  svg.addEventListener('wheel', close, { passive: true });

  return { close };
}
