// Tabela markdown (cenário × variante).
export function toMarkdown(rows) {
  const cols = [
    ['scenario', 'cenário'], ['variant', 'variante'],
    ['nLeaves', 'folhas'], ['nEdges', 'arestas'],
    ['ticks', 'ticks'], ['ended', 'end?'], ['ticksKinetic', 'ticks assent.'],
    ['timeMs', 'tempo ms'], ['msPerTick', 'ms/tick'],
    ['colViol', 'viol. colisão'], ['ovColArea', 'área ov.folhas colid.'],
    ['ovAll', 'overlap folhas (total)'], ['ovCont', 'cont×cont'], ['intrusion', 'folha×cont alheio'],
    ['contain', 'contenção'],
    ['bboxArea', 'área bbox'], ['aspect', 'aspecto'], ['density', 'densid.'],
    ['edgeLen', 'aresta média'], ['edgeLenNorm', 'aresta/diag'],
    ['crossings', 'cruzam.'], ['edgeThruNode', 'aresta×nó'],
    ['deterministic', 'determ.'],
    ['reheatDrift', 'reaquec. final px'], ['reheatTransient', 'reaquec. pico px'],
    ['pertCold', 'Δ cold px'], ['pertWarm', 'Δ warm final px'], ['pertWarmTransient', 'Δ warm pico px'], ['pertWarmPctDiag', 'Δ warm %diag'],
  ];
  const head = `| ${cols.map((c) => c[1]).join(' | ')} |\n|${cols.map(() => '---').join('|')}|`;
  const fmt = (v) => v === undefined || v === null ? '–' : (typeof v === 'boolean' ? (v ? 'sim' : 'NÃO') : String(v));
  return head + '\n' + rows.map((r) => `| ${cols.map(([k]) => fmt(r[k])).join(' | ')} |`).join('\n') + '\n';
}
