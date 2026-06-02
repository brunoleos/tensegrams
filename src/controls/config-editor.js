// Structured config editor.
//
// Renders the parsed config as pretty-printed JSON where every editable
// LEAF is a clickable chip. Clicking opens a popover with a controlled
// editor matching the schema entry (number input, toggle, dropdown,
// …). The text view stays familiar — what changes is HOW you
// edit values: no free-form typing of invalid JSON, no out-of-range
// numbers, no typos in enum keys.
//
// Unknown paths (no schema entry) render as plain text — readable but
// not interactive — so unknown future keys don't disappear.

import { stringify as stringifyYaml } from 'yaml';
import { schemaAt, knownChildrenAt, defaultForChild, helpForChild } from './config-schema.js';

const INDENT = '  ';

export function createStructuredConfigEditor(root, { onChange }) {
  let current = {};
  let popover = null;

  function setValue(obj) {
    current = obj && typeof obj === 'object' ? clone(obj) : {};
    render();
  }

  function notify() {
    // Emit YAML — same shape as the textarea, structured editor stays
    // the source of truth for the parsed object form.
    onChange(stringifyYaml(current, { lineWidth: 0 }));
  }

  function render() {
    root.innerHTML = '';
    const pre = document.createElement('div');
    pre.className = 'cfg-pre';
    pre.setAttribute('role', 'tree');
    renderNode(pre, current, [], 0, /* isRoot */ true);
    root.appendChild(pre);
  }

  function renderNode(parent, value, path, indent, isRoot) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      renderLeaf(parent, value, path);
      return;
    }
    const keys = Object.keys(value);
    parent.appendChild(text(isRoot ? '{' : '{'));
    parent.appendChild(br());
    keys.forEach((k, i) => {
      parent.appendChild(text(repeat(INDENT, indent + 1)));
      parent.appendChild(text(`"${k}": `));
      renderNode(parent, value[k], [...path, k], indent + 1, false);
      const isLast = i === keys.length - 1;
      if (!isLast) parent.appendChild(text(','));
      // Remove button per key (except for root layout-id keys we want stable).
      parent.appendChild(removeBtn(path, k));
      parent.appendChild(br());
    });

    // Discoverability: list "+ keyName" chips for every schema-known child
    // that ISN'T present yet. Without this, an empty `{}` left the user with
    // no idea what could go inside (e.g. "what are the valid keys of
    // collision?").
    const missing = knownChildrenAt(path).filter(k => !(k in value));
    if (missing.length) {
      parent.appendChild(text(repeat(INDENT, indent + 1)));
      const row = document.createElement('span');
      row.className = 'cfg-add-row';
      for (const k of missing) row.appendChild(addChildBtn(path, k));
      parent.appendChild(row);
      parent.appendChild(br());
    }

    parent.appendChild(text(repeat(INDENT, indent) + '}'));
  }

  function addChildBtn(parentPath, key) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cfg-add cfg-add-inline';
    b.textContent = `+ ${key}`;
    b.title = helpForChild(parentPath, key);
    b.addEventListener('click', () => {
      setAtPath(current, [...parentPath, key], defaultForChild(parentPath, key));
      notify();
      render();
    });
    return b;
  }

  function renderLeaf(parent, value, path) {
    const schema = lookupSchema(path);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cfg-chip ' + (schema ? `cfg-chip-${schema.type}` : 'cfg-chip-readonly');
    chip.textContent = formatValue(value);
    chip.title = schema ? schema.help : 'campo livre (sem esquema)';
    if (schema) {
      chip.addEventListener('click', (ev) => openPopover(ev.currentTarget, schema, value, (next) => {
        setAtPath(current, path, next);
        notify();
        render();
      }));
    } else {
      chip.disabled = true;
    }
    parent.appendChild(chip);
  }

  function lookupSchema(path) {
    return schemaAt(path);
  }

  function removeBtn(parentPath, key) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cfg-remove';
    b.title = 'remover este campo';
    b.textContent = '×';
    b.addEventListener('click', () => {
      removeAtPath(current, [...parentPath, key]);
      notify();
      render();
    });
    return b;
  }

  // ---------- popover editor ----------

  function openPopover(anchor, schema, value, commit) {
    closePopover();
    const pop = document.createElement('div');
    pop.className = 'cfg-popover';
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = '';
    pop.appendChild(textNode(schema.help, 'cfg-popover-help'));

    let getValue;
    switch (schema.type) {
      case 'number':    getValue = numberEditor(pop, schema, value); break;
      case 'boolean':   getValue = boolEditor(pop, value, false);    break;
      case 'enum':      getValue = enumEditor(pop, schema, value);   break;
      case 'text':      getValue = textEditor(pop, value);           break;
      default:          getValue = () => value;
    }

    const actions = document.createElement('div');
    actions.className = 'cfg-popover-actions';
    const ok = btn('aplicar', () => { commit(getValue()); closePopover(); });
    ok.classList.add('primary');
    const cancel = btn('cancelar', closePopover);
    const reset = btn('default', () => { commit(schema.default); closePopover(); });
    actions.append(reset, cancel, ok);
    pop.appendChild(actions);

    document.body.appendChild(pop);
    placePopover(pop, anchor);
    popover = pop;
    setTimeout(() => document.addEventListener('mousedown', outside, { capture: true }), 0);
  }

  function placePopover(pop, anchor) {
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(window.innerWidth - 240, r.left) + 'px';
    pop.style.top  = (r.bottom + 6) + 'px';
  }

  function closePopover() {
    if (!popover) return;
    popover.remove();
    popover = null;
    document.removeEventListener('mousedown', outside, { capture: true });
  }
  function outside(ev) {
    if (popover && !popover.contains(ev.target)) closePopover();
  }

  return { setValue, render, dispose: closePopover };
}

// ---------- editor flavors ----------

function numberEditor(pop, schema, value) {
  const inp = document.createElement('input');
  inp.type = 'number';
  if (schema.min  != null) inp.min  = schema.min;
  if (schema.max  != null) inp.max  = schema.max;
  if (schema.step != null) inp.step = schema.step;
  inp.value = value ?? schema.default ?? 0;
  pop.appendChild(inp);
  setTimeout(() => inp.focus(), 0);
  return () => {
    const n = Number(inp.value);
    return Number.isFinite(n) ? n : schema.default;
  };
}

function boolEditor(pop, value) {
  return choiceEditor(pop, value, [
    { label: 'true',  value: true  },
    { label: 'false', value: false },
  ]);
}

function enumEditor(pop, schema, value) {
  const sel = document.createElement('select');
  for (const v of schema.values) {
    const o = document.createElement('option');
    o.value = String(v); o.textContent = String(v);
    if (v === value) o.selected = true;
    sel.appendChild(o);
  }
  pop.appendChild(sel);
  return () => sel.value;
}

function textEditor(pop, value) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = value ?? '';
  pop.appendChild(inp);
  setTimeout(() => inp.focus(), 0);
  return () => inp.value;
}

function choiceEditor(pop, current, options) {
  const wrap = document.createElement('div');
  wrap.className = 'cfg-choices';
  let chosen = current;
  for (const opt of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cfg-choice' + (eqValue(opt.value, current) ? ' on' : '');
    b.textContent = opt.label;
    b.addEventListener('click', () => {
      chosen = opt.value;
      for (const x of wrap.children) x.classList.remove('on');
      b.classList.add('on');
    });
    wrap.appendChild(b);
  }
  pop.appendChild(wrap);
  return () => chosen;
}

// ---------- helpers ----------

function eqValue(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return false;
}

function formatValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

function setAtPath(obj, path, value) {
  if (path.length === 0) return;
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
}

function removeAtPath(obj, path) {
  if (path.length === 0) return;
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    cur = cur?.[path[i]];
    if (cur === undefined) return;
  }
  delete cur[path[path.length - 1]];
  // Clean up now-empty parent objects.
  for (let i = path.length - 1; i > 0; i--) {
    let parent = obj;
    for (let j = 0; j < i - 1; j++) parent = parent[path[j]];
    const k = path[i - 1];
    if (parent[k] && typeof parent[k] === 'object' && !Array.isArray(parent[k])
        && Object.keys(parent[k]).length === 0) {
      delete parent[k];
    } else {
      break;
    }
  }
}

function clone(o) {
  if (o == null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(clone);
  const out = {};
  for (const k of Object.keys(o)) out[k] = clone(o[k]);
  return out;
}

function text(s) { const t = document.createTextNode(s); return t; }
function br()    { const e = document.createElement('br'); return e; }
function textNode(s, cls) {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = s;
  return d;
}
function btn(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
function repeat(s, n) { return s.repeat(Math.max(0, n)); }
