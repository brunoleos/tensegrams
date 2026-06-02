// Métrica de cruzamentos (Fase 3c). Conta interseções em X entre
// segmentos PERPENDICULARES de edges que devem se evitar segundo a
// política de routing — `resolver.edgeLayerPair(idA, idB)` retorna não
// nulo quando os dois edges compartilham ao menos uma edgeLayer. Pares
// de layers disjuntos podem se cruzar livremente (regra do usuário) e
// não são contados. Função pura — sem DOM; usada por testes, pelo
// debug-snapshot e pelo spec e2e.

const CROSS_EPS = 0.5;

// Raio de vizinhança do nó compartilhado. Dois edges que partilham um
// endpoint convergem numa âncora pinada; cruzamentos a até este raio de
// QUALQUER endpoint do par são ignorados (a separação ali brigaria com o
// pin → jitter). Decisão de design: agir nesses pares, mas só LONGE do
// nó comum. Aplicado de forma idêntica pela força (Fase 3c) e por esta
// métrica, pra que "força resolveu" ⇔ "métrica zerou".
export const NODE_SKIP_RADIUS = 40;

// Ponto (x,y) está a ≤ r de algum dos anchors {x,y}?
export function nearAnyAnchor(x, y, anchors, r) {
  const r2 = r * r;
  for (const a of anchors) {
    const dx = x - a.x, dy = y - a.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

function segmentsOf(points) {
  const segs = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx === 0 && dy === 0) continue;
    if (dy > dx) {
      segs.push({ o: 'v', c: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) });
    } else {
      segs.push({ o: 'h', c: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) });
    }
  }
  return segs;
}

// h: horizontal (c=y, [lo,hi] em x); v: vertical (c=x, [lo,hi] em y).
// Cruzamento PRÓPRIO (interior), com folga `eps` pra não contar toques
// em T nem grazing sub-pixel (o segmento que escapa pousa na borda).
function perpCross(h, v, eps) {
  return v.c > h.lo + eps && v.c < h.hi - eps &&
         h.c > v.lo + eps && h.c < v.hi - eps;
}

// Núcleo compartilhado: itera todo cruzamento próprio entre segmentos
// perpendiculares de pares de edges que compartilham edgeLayer, chamando
// `cb(idA, idB)` por cruzamento contado. `countSharedLayerCrossings` e
// `sharedLayerCrossingEdges` são views sobre este mesmo percurso, pra que
// a métrica (count) e o conjunto de edges envolvidas nunca divirjam.
function forEachSharedCrossing(routedEdges, resolver, opts, cb) {
  const eps = opts.eps ?? CROSS_EPS;
  const skipR = opts.nodeSkipRadius ?? NODE_SKIP_RADIUS;
  if (!routedEdges || !resolver || typeof resolver.edgeLayerPair !== 'function') return;
  const entries = [];
  for (const [id, re] of routedEdges) {
    if (!re || !re.points || re.points.length < 2) continue;
    if (re.kind === 'curve' || re.kind === 'spline') continue;
    const pts = re.points;
    entries.push([id, segmentsOf(pts), [pts[0], pts[pts.length - 1]]]);
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [idA, segsA, endsA] = entries[i];
      const [idB, segsB, endsB] = entries[j];
      const pair = resolver.edgeLayerPair(idA, idB);
      if (!pair) continue;
      // Pares que compartilham nó: ignorar cruzamentos perto de qualquer
      // endpoint do par (vizinhança do nó comum).
      const anchors = (pair.sharedNodes && pair.sharedNodes.length)
        ? [...endsA, ...endsB] : null;
      for (const sa of segsA) {
        for (const sb of segsB) {
          if (sa.o === sb.o) continue;
          const h = sa.o === 'h' ? sa : sb;
          const v = sa.o === 'h' ? sb : sa;
          if (!perpCross(h, v, eps)) continue;
          // Ponto do cruzamento: x da vertical, y da horizontal.
          if (anchors && nearAnyAnchor(v.c, h.c, anchors, skipR)) continue;
          cb(idA, idB);
        }
      }
    }
  }
}

export function countSharedLayerCrossings(routedEdges, resolver, opts = {}) {
  let count = 0;
  forEachSharedCrossing(routedEdges, resolver, opts, () => { count++; });
  return count;
}

// Conjunto de ids de edges que participam de ≥1 cruzamento shared-layer.
// Usado pela seleção de face (face-select) pra restringir a busca às
// edges efetivamente cruzadas.
export function sharedLayerCrossingEdges(routedEdges, resolver, opts = {}) {
  const out = new Set();
  forEachSharedCrossing(routedEdges, resolver, opts, (a, b) => { out.add(a); out.add(b); });
  return out;
}
