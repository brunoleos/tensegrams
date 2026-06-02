// Shared button factory for menu surfaces — context menu and action FAB.
//
// Differences absorbed by options:
//   - className: distinguishes visual styling per surface ("menu-item",
//     "fab-item", etc.).
//   - role: context menus need role="menuitem"; the FAB does not (it
//     is not a popup menu in ARIA terms).
//   - onAfter: called AFTER `onClick`. Context menu uses it to close
//     itself; the FAB leaves the panel open (the user may issue
//     multiple actions on the same selection).
//   - enabled: disabled buttons render but don't receive clicks.
//
// All buttons stop propagation so an outer click-outside listener
// doesn't close the surface during the handler.

export function createMenuButton(label, onClick, options = {}) {
  const {
    className = 'menu-item',
    role,
    enabled = true,
    onAfter,
    ariaLabel,
  } = options;

  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  if (role) b.setAttribute('role', role);
  if (ariaLabel) b.setAttribute('aria-label', ariaLabel);

  if (!enabled) {
    b.disabled = true;
    b.classList.add('disabled');
    return b;
  }

  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onClick();
    if (onAfter) onAfter();
  });
  return b;
}
