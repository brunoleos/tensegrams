// Plain textarea wrapper with debounced change notification, tab-to-
// indent, and an optional YAML syntax-highlighting overlay.
//
// Highlight mode wraps the original textarea in a `.editor-host` div
// alongside a `<pre class="editor-highlight"><code>` that mirrors the
// textarea's content with `<span class="yh-…">` markers. The textarea
// itself goes transparent (text-color: transparent, caret-color visible)
// so the user sees the colored overlay while still typing into the
// real input. Scroll positions are kept in sync.
//
// The overlay is purely cosmetic — selection, IME, accessibility, and
// `oninput` continue to work on the textarea exactly as before.

import { highlight as yamlHighlight } from './controls/yaml-highlight.js';

export function createEditor(textarea, { onChange, debounceMs = 150, highlight = false }) {
  let timer = null;
  const overlay = highlight ? wrapWithOverlay(textarea) : null;

  function refreshOverlay() {
    if (!overlay) return;
    // Always render a trailing newline-padded code so the highlight
    // box matches the textarea height when the document ends with a
    // newline (browsers shrink trailing-empty <pre> lines otherwise).
    const text = textarea.value;
    overlay.innerHTML = yamlHighlight(text) + '\n';
  }
  function syncScroll() {
    if (!overlay) return;
    overlay.parentElement.scrollTop = textarea.scrollTop;
    overlay.parentElement.scrollLeft = textarea.scrollLeft;
  }

  textarea.addEventListener('input', () => {
    refreshOverlay();
    clearTimeout(timer);
    timer = setTimeout(() => onChange(textarea.value), debounceMs);
  });
  textarea.addEventListener('scroll', syncScroll);

  // Tab inserts indentation rather than blurring.
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key === 'Tab') {
      ev.preventDefault();
      const { selectionStart, selectionEnd, value } = textarea;
      const pre = value.slice(0, selectionStart);
      const post = value.slice(selectionEnd);
      textarea.value = pre + '  ' + post;
      textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
      textarea.dispatchEvent(new Event('input'));
    }
  });

  refreshOverlay();

  return {
    setValue(text) {
      textarea.value = text;
      refreshOverlay();
      syncScroll();
    },
    getValue() {
      return textarea.value;
    },
    flush() {
      clearTimeout(timer);
      onChange(textarea.value);
    },
  };
}

// Wrap the textarea in a flex container with an overlay <pre>. Returns
// the inner <code> element where highlighted HTML lives. The wrapper
// inherits its visibility from the textarea via CSS (`:has`) so callers
// can keep toggling `textarea.hidden` exactly as before.
function wrapWithOverlay(textarea) {
  const host = document.createElement('div');
  host.className = 'editor-host';
  const pre = document.createElement('pre');
  pre.className = 'editor-highlight';
  pre.setAttribute('aria-hidden', 'true');
  const code = document.createElement('code');
  pre.appendChild(code);

  const parent = textarea.parentNode;
  parent.insertBefore(host, textarea);
  host.appendChild(pre);
  host.appendChild(textarea);
  textarea.classList.add('editor-input');
  return code;
}
