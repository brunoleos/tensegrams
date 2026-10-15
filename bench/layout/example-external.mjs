// Exemplo de layout EXTERNO plugado no harness: "grid-pack" recursivo.
// Cada container empacota seus filhos numa grade ~quadrada; containers são
// dimensionados bottom-up (padding + header). Zero overlap por construção,
// ignora arestas — serve de baseline "burro mas limpo" e de modelo de API.
//
// Uso:  node bench/layout/run.mjs --external bench/layout/example-external.mjs [--only-external]
import { externalVariant } from './lib/variants.mjs';
import { HEADER } from './lib/graph.mjs';

const GAP = 36; // >= 2*nodePad(12) para não violar o contrato de colisão padded

function gridPack(graph) {
  const kids = new Map();
  for (const n of graph.nodes) {
    const k = n.parent || '__root';
    if (!kids.has(k)) kids.set(k, []);
    kids.get(k).push(n);
  }
  const size = new Map();      // id -> {w,h} (container: caixa externa)
  const rel = new Map();       // id -> {x,y} relativo ao conteúdo do pai
  function measure(id) {
    const ch = kids.get(id) || [];
    for (const c of ch) if (c.isContainer) measure(c.id);
    const cols = Math.max(1, Math.ceil(Math.sqrt(ch.length)));
    let x = 0, y = 0, rowH = 0, maxW = 0;
    ch.forEach((c, i) => {
      const s = c.isContainer ? size.get(c.id) : { w: c.width, h: c.height };
      if (i && i % cols === 0) { y += rowH + GAP; x = 0; rowH = 0; }
      rel.set(c.id, { x, y });
      x += s.w + GAP; rowH = Math.max(rowH, s.h); maxW = Math.max(maxW, x - GAP);
    });
    const inner = { w: maxW, h: y + rowH };
    if (id !== '__root') {
      const n = graph.nodes.find((m) => m.id === id);
      size.set(id, { w: inner.w + 2 * n.padding, h: inner.h + 2 * n.padding + HEADER });
    }
    return inner;
  }
  measure('__root');
  const positions = new Map();
  function place(id, ox, oy) {
    for (const c of kids.get(id) || []) {
      const r = rel.get(c.id);
      const ax = ox + r.x, ay = oy + r.y;
      if (c.isContainer) place(c.id, ax + c.padding, ay + c.padding + HEADER);
      else positions.set(c.id, { x: ax, y: ay, width: c.width, height: c.height });
    }
  }
  place('__root', 0, 0);
  return { positions }; // containers: o harness deriva (deriveContainers)
}

export default externalVariant('ext:grid-pack', (graph) => gridPack(graph));
