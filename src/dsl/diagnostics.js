// Shared diagnostics helpers — Levenshtein-based key suggestions and
// pretty messages for the YAML parser/IR.

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let cur  = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// Return the closest match (within maxDist) or null if no candidate
// is close enough. Candidates that share a prefix are preferred when
// distances tie.
export function suggest(input, candidates, maxDist = 2) {
  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(input, c);
    if (d < bestDist || (d === bestDist && c.startsWith(input[0] || ''))) {
      best = c;
      bestDist = d;
    }
  }
  return bestDist <= maxDist ? best : null;
}

// Build a "did you mean?" suffix, or empty string when no candidate
// is close enough. Centralized so messages stay consistent.
export function didYouMean(input, candidates, maxDist = 2) {
  const s = suggest(input, candidates, maxDist);
  return s ? ` (você quis dizer "${s}"?)` : '';
}
