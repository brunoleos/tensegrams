// Minimal YAML syntax highlighter for the textarea overlay.
//
// Tokenizes the subset we use in the DSL/config: block mappings, flow
// mappings/sequences, scalars (numbers, quoted strings, booleans),
// comments, and the composite-key indicator (`?`). Wraps each token in
// a `<span class="yh-…">` so style.css can color it per theme.
//
// This is not a full YAML 1.2 lexer — multi-line scalars (|, >, folded)
// fall back to plain text; anchors/aliases/tags are ignored. Good
// enough for our DSL while staying ~100 LOC and dep-free.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escape(s) { return s.replace(/[&<>"]/g, c => ESC[c]); }

export function highlight(text) {
  const lines = String(text ?? '').split('\n');
  return lines.map(highlightLine).join('\n');
}

function highlightLine(line) {
  if (!line) return '';
  const m = line.match(/^(\s*)(.*)$/);
  const indent = m[1];
  let rest = m[2];
  if (!rest) return escape(indent);

  // Detach a trailing `# comment` (only when preceded by whitespace
  // or at the very start of the content — `#` inside a value is fine).
  let trailing = '';
  const ci = findCommentStart(rest);
  if (ci >= 0) {
    trailing = span('comment', rest.slice(ci));
    rest = rest.slice(0, ci);
  }

  // Composite key: `? [a, b]` or `? [a, b, N]` (with optional trailing `:`).
  const ck = rest.match(/^(\?\s*)(\[[^\]]*\])(\s*:?\s*)$/);
  if (ck) {
    return escape(indent)
      + span('punct', ck[1])
      + scanFlow(ck[2])
      + span('punct', ck[3])
      + trailing;
  }

  // Sequence item marker: leading "- " keeps the dash highlighted.
  let bullet = '';
  const sm = rest.match(/^- /);
  if (sm) {
    bullet = span('punct', '- ');
    rest = rest.slice(2);
  }

  // `key: value` block-mapping entry.
  const kv = rest.match(/^([A-Za-z_][\w.-]*)(\s*:)(\s*)(.*)$/);
  if (kv) {
    return escape(indent) + bullet
      + span('key', kv[1])
      + span('punct', kv[2])
      + escape(kv[3])
      + scanFlow(kv[4])
      + trailing;
  }

  return escape(indent) + bullet + scanFlow(rest) + trailing;
}

// Tokenize a flow expression: balanced braces/brackets, scalars (quoted
// strings, numbers, keywords, bare words), and embedded "key: value"
// pairs (flow mappings).
function scanFlow(text) {
  if (!text) return '';
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // Inline comment.
    if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      out += span('comment', text.slice(i));
      break;
    }

    // Quoted string.
    if (ch === '"' || ch === "'") {
      const re = ch === '"' ? /^"(?:\\.|[^"\\])*"?/ : /^'(?:[^']|'')*'?/;
      const m = text.slice(i).match(re);
      const tok = m ? m[0] : text[i];
      out += span('string', tok);
      i += tok.length;
      continue;
    }

    // Flow punctuation.
    if (ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === ',' || ch === ':') {
      out += span('punct', ch);
      i++;
      continue;
    }

    // Number scalar.
    const num = text.slice(i).match(/^-?\d+(?:\.\d+)?(?=[\s,\]\}:#]|$)/);
    if (num) {
      out += span('number', num[0]);
      i += num[0].length;
      continue;
    }

    // Bare word — either a flow-mapping key, a keyword, or a plain scalar.
    const word = text.slice(i).match(/^[A-Za-z_][\w.-]*/);
    if (word) {
      const w = word[0];
      const rest = text.slice(i + w.length);
      if (/^\s*:/.test(rest)) {
        out += span('key', w);
      } else if (KEYWORDS.has(w.toLowerCase())) {
        out += span('keyword', w);
      } else {
        out += escape(w);
      }
      i += w.length;
      continue;
    }

    // Anything else (whitespace, signs, etc.).
    out += escape(ch);
    i++;
  }
  return out;
}

const KEYWORDS = new Set([
  'true', 'false', 'null', 'on', 'off', 'yes', 'no', '~',
]);

// `#` only starts a comment when it's at the start or preceded by ws.
// (A bare `#` inside a value would otherwise eat the rest of the line.)
function findCommentStart(line) {
  let inStr = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\' && inStr === '"') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return i;
  }
  return -1;
}

function span(kind, text) {
  return `<span class="yh-${kind}">${escape(text)}</span>`;
}
