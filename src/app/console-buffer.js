// Circular buffer for the last N console messages. Installed BEFORE app
// modules import so the debug export can replay what showed up in DevTools.
// One-shot install — no-op on second call.

const MAX = 300;
const buf = [];
let installed = false;

export function installConsoleBuffer() {
  if (installed) return;
  installed = true;
  for (const level of ['log', 'info', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      try {
        const t = new Date().toISOString();
        const msg = args.map(a => {
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');
        buf.push({ t, level, msg });
        if (buf.length > MAX) buf.shift();
      } catch {}
      orig(...args);
    };
  }
}

export function snapshotConsole() {
  return buf.slice();
}
