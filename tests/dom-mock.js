// Minimal DOM mock for unit tests that touch SVG/HTML.
// Implements only what the source modules actually use; intentionally small —
// jsdom-equivalent behavior is overkill and adds an external dep.

const SVG_NS = 'http://www.w3.org/2000/svg';

class ClassList {
  constructor() { this._set = new Set(); }
  add(...names) { for (const n of names) this._set.add(n); }
  remove(...names) { for (const n of names) this._set.delete(n); }
  toggle(name, force) {
    const has = this._set.has(name);
    const should = typeof force === 'boolean' ? force : !has;
    if (should) this._set.add(name); else this._set.delete(name);
    return should;
  }
  contains(name) { return this._set.has(name); }
  get value() { return Array.from(this._set).join(' '); }
}

class StubElement {
  constructor(tag, ns) {
    this.tagName = tag.toUpperCase();
    this.namespaceURI = ns || null;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new ClassList();
    Object.defineProperty(this, 'className', {
      get: () => this.classList.value,
      set: (v) => {
        this.classList = new ClassList();
        if (v) for (const n of String(v).split(/\s+/).filter(Boolean)) this.classList.add(n);
      },
    });
    this.dataset = new Proxy({}, {
      set: (obj, key, value) => {
        obj[key] = String(value);
        this.attributes.set('data-' + camelToKebab(key), String(value));
        return true;
      },
      get: (obj, key) => obj[key],
    });
    this.style = {};
    this._textContent = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) {
      const key = kebabToCamel(name.slice(5));
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) delete this.dataset[kebabToCamel(name.slice(5))];
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }

  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children.slice(); }

  set textContent(v) {
    this._textContent = v == null ? '' : String(v);
    this.children = [];
  }
  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set innerHTML(v) {
    this.children = [];
    this._textContent = '';
  }
  get innerHTML() { return ''; }

  querySelector(sel) {
    return this._find(sel, true);
  }
  querySelectorAll(sel) {
    return this._find(sel, false);
  }

  _find(sel, first) {
    // Support a small subset: ':scope > tag.class', 'tag.class', 'tag[attr="v"]', '.class', '#id'
    const matchFn = compileSelector(sel.startsWith(':scope >') ? sel.slice(8).trim() : sel);
    const scopeOnly = sel.startsWith(':scope >');
    const results = [];
    const queue = scopeOnly ? [...this.children] : [...this.children];
    if (!scopeOnly) {
      // walk all descendants
      const walk = (el) => {
        for (const c of el.children) {
          if (matchFn(c)) {
            results.push(c);
            if (first) return true;
          }
          if (walk(c)) return true;
        }
        return false;
      };
      walk(this);
    } else {
      for (const c of queue) {
        if (matchFn(c)) {
          results.push(c);
          if (first) break;
        }
      }
    }
    return first ? (results[0] || null) : results;
  }

  closest(sel) {
    const m = compileSelector(sel);
    let el = this;
    while (el) {
      if (m(el)) return el;
      el = el.parentNode;
    }
    return null;
  }

  // SVG-ish stubs
  getBoundingClientRect() {
    return { x: 0, y: 0, left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 };
  }
  // Heurística de tamanho de texto para os testes: width = #chars × 7px,
  // height = 14px. Não bate com o renderer real, mas é determinístico e
  // suficiente para validar o feedback loop label→collision.
  getBBox() {
    const text = this._textContent || '';
    return { x: 0, y: 0, width: text.length * 7, height: 14 };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  addEventListener() {}
}

function camelToKebab(s) { return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase()); }
function kebabToCamel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function compileSelector(sel) {
  // tag[attr="val"]: e.g. g[data-id="foo"]
  let m = sel.match(/^([a-zA-Z]+)\[([\w-]+)="([^"]+)"\]$/);
  if (m) {
    const [, tag, attr, val] = m;
    return (el) => el.tagName === tag.toUpperCase() && el.getAttribute(attr) === val;
  }
  // tag.class
  m = sel.match(/^([a-zA-Z]+)\.([\w-]+)$/);
  if (m) {
    const [, tag, cls] = m;
    return (el) => el.tagName === tag.toUpperCase() && el.classList.contains(cls);
  }
  // .class
  m = sel.match(/^\.([\w-]+)$/);
  if (m) return (el) => el.classList.contains(m[1]);
  // #id
  m = sel.match(/^#([\w-]+)$/);
  if (m) return (el) => el.getAttribute('id') === m[1];
  // tag
  m = sel.match(/^([a-zA-Z]+)$/);
  if (m) return (el) => el.tagName === m[0].toUpperCase();
  // multiple classes: tag.a.b
  m = sel.match(/^([a-zA-Z]+)((\.[\w-]+)+)$/);
  if (m) {
    const tag = m[1];
    const classes = m[2].split('.').filter(Boolean);
    return (el) => el.tagName === tag.toUpperCase() && classes.every(c => el.classList.contains(c));
  }
  // bracket attr (no value): [data-layers]
  m = sel.match(/^\[([\w-]+)\]$/);
  if (m) return (el) => el.hasAttribute(m[1]);
  return () => false;
}

class StubDocument extends StubElement {
  constructor() {
    super('#document', null);
  }
  createElement(tag) { return new StubElement(tag, null); }
  createElementNS(ns, tag) { return new StubElement(tag, ns); }
}

function installDOM() {
  const doc = new StubDocument();
  globalThis.document = doc;
  globalThis.SVGElement = StubElement;
  // Minimal CSS.escape stub for code paths that reference markers via
  // querySelector — tests don't care about escaping, just that the
  // call doesn't throw.
  if (typeof globalThis.CSS === 'undefined') {
    globalThis.CSS = { escape: (s) => String(s) };
  }
  return doc;
}

function makeSVG() {
  return new StubElement('svg', SVG_NS);
}

function installLocalStorage() {
  let map = new Map();
  globalThis.localStorage = {
    getItem: (k) => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

export { installDOM, installLocalStorage, makeSVG, StubElement, SVG_NS };
