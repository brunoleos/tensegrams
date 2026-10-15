// Collision resolver. Derived directly from the GraphIR — the model
// lives in the DSL (`nodeLayers` on nodes/edges and `edgeLayers` on
// edges), not in the YAML config blob.
//
// Two elements collide when their collision-label sets intersect (share
// at least one label). No shared label → no collision → free overlap.
//   - node.nodeCollision × node.nodeCollision → node-node
//   - edge.nodeCollision × node.nodeCollision → edge avoids node
//   - edge.edgeCollision × edge.edgeCollision → edge avoids edge
// (IR field names kept stable for downstream code; DSL attribute names
//  are `nodeLayers` and `edgeLayers`.)
//
// Weights (float in [0,1]) determine how the displacement is split via
// the linear DIFFERENCE between the two sides:
//   diff  = wX - wY
//   fracX = 0.5 - diff/2     // X's share of the push
//   fracY = 0.5 + diff/2     // Y's share of the push
// Equal weights → 0.5/0.5 regardless of magnitude (both 0 and both 1
// behave the same: pure 50/50 split). The gap between weights skews the
// split: (1, 0) → (0, 1) — the weight-0 side absorbs everything. With
// several shared labels, each side's weight is averaged over them
// (equivalent, by linearity, to averaging the per-layer diffs).
//
// The total displacement magnitude (push beyond the just-touching
// minimum) is the layout algorithm's concern (collision.* knobs / force
// constants), never the DSL.
//
// Exclusions: a node never collides with its own ancestor container; an
// edge never collides with its source/target nodes nor their ancestors;
// two edges sharing an endpoint never collide (the common point jitters).
//
// Princípio da necessidade geométrica — camadas NUNCA bloqueiam:
// a) uma aresta cujo endpoint está dentro de um container atravessar a
//    borda desse container (o conjunto `endpointAllowedSet` exclui o
//    container do par de colisão, independentemente da layer compartilhada);
// b) a âncora ir para o face externo da perimetria do endpoint
//    (clip-anchors e snap-container-anchors operam sem consultar pesos).
// Layers só modulam roteamento e separação durante a simulação — nunca
// previnem geometria correta. Declarar `nodeLayers` numa aresta cujo
// endpoint (ou ancestral) também declare aquela layer é silenciosamente
// neutralizado por este princípio; um warning de DSL avisa o autor.

import { buildAncestors, endpointAllowedSet } from '../dsl/ancestry.js';

const EMPTY = new Map();

// Average weight of `spec` (Map<label,weight>) over the given labels.
function avgWeight(spec, labels) {
  if (!labels.length) return 0;
  let sum = 0;
  for (const l of labels) sum += spec.get(l) || 0;
  return sum / labels.length;
}

// Split a colliding pair into displacement fractions {a, b} summing 1.
// Linear-difference model: equal weights → 50/50 regardless of magnitude;
// the gap between weights skews the split so the heavier side cedes less.
// Since each weight is clamped to [0,1] by the DSL, the diff is in [-1,1]
// and the resulting fractions land in [0,1] without further clamping.
// Partial weights let both sides yield, which prevents the multi-body
// trap where a low-weight node gets squeezed between two heavy anchors
// whose equal opposite impulses cancel.
export function computeSplit(specA, specB, shared) {
  const wa = avgWeight(specA, shared);
  const wb = avgWeight(specB, shared);
  const diff = wa - wb;
  return { a: 0.5 - diff / 2, b: 0.5 + diff / 2 };
}

// Split of a pair straight from the two weight maps: {a, b}, or null when
// they share no label (no collision). Same rule in v1 and v2 (ADR-0021).
export function splitFor(specA, specB) {
  const shared = sharedLabels(specA, specB);
  return shared.length ? computeSplit(specA, specB, shared) : null;
}

// Labels present in BOTH specs (iterating the smaller one).
function sharedLabels(specA, specB) {
  if (!specA || !specB || specA.size === 0 || specB.size === 0) return [];
  const [small, big] = specA.size <= specB.size ? [specA, specB] : [specB, specA];
  const out = [];
  for (const l of small.keys()) if (big.has(l)) out.push(l);
  return out;
}

export function buildCollisionResolver(ir) {
  const ancestors = buildAncestors(ir);
  const nodeById = new Map(ir.nodes.map(n => [n.id, n]));
  const edgeById = new Map(ir.edges.map(e => [e.id, e]));

  const nodeSpec = (id) => nodeById.get(id)?.nodeCollision || EMPTY;

  // Per-edge allowed-id set (endpoints + their ancestors) — precomputed
  // so the hot edge-node loop never re-allocates.
  const edgeAllowed = new Map();
  for (const e of ir.edges) {
    edgeAllowed.set(e.id, endpointAllowedSet(e.source, e.target, ancestors));
  }

  // Edges that declare any collision label — only these need obstacle
  // routing; every other edge short-circuits the whole pathfinding step.
  const edgesWithObstacles = new Set();
  for (const e of ir.edges) {
    if ((e.nodeCollision && e.nodeCollision.size) ||
        (e.edgeCollision && e.edgeCollision.size)) {
      edgesWithObstacles.add(e.id);
    }
  }

  function nodeNodePair(idA, idB) {
    if (idA === idB) return null;
    if (ancestors.get(idA)?.has(idB)) return null;
    if (ancestors.get(idB)?.has(idA)) return null;
    const sa = nodeSpec(idA), sb = nodeSpec(idB);
    const shared = sharedLabels(sa, sb);
    if (!shared.length) return null;
    return { shared, frac: computeSplit(sa, sb, shared) };
  }

  function edgeNodePair(edge, nodeId) {
    const e = typeof edge === 'string' ? edgeById.get(edge) : edge;
    if (!e) return null;
    if (edgeAllowed.get(e.id)?.has(nodeId)) return null;
    const shared = sharedLabels(e.nodeCollision, nodeSpec(nodeId));
    if (!shared.length) return null;
    const f = computeSplit(e.nodeCollision, nodeSpec(nodeId), shared);
    return { shared, frac: { edge: f.a, node: f.b } };
  }

  function edgeEdgePair(edgeA, edgeB) {
    const a = typeof edgeA === 'string' ? edgeById.get(edgeA) : edgeA;
    const b = typeof edgeB === 'string' ? edgeById.get(edgeB) : edgeB;
    if (!a || !b || a.id === b.id) return null;
    // Edges sharing an endpoint are excluded — the common point jitters.
    if (a.source === b.source || a.source === b.target ||
        a.target === b.source || a.target === b.target) return null;
    const shared = sharedLabels(a.edgeCollision, b.edgeCollision);
    if (!shared.length) return null;
    return { shared, frac: computeSplit(a.edgeCollision, b.edgeCollision, shared) };
  }

  // Like edgeEdgePair, but WITHOUT the shared-endpoint exclusion. Used by
  // the physics perpendicular-repulsion (Fase 3c): two edges leaving a
  // common node still shouldn't cross each other ELSEWHERE. Gating is
  // purely the user's rule: intersecting edgeLayers ⇒ avoid crossing.
  // `sharedNodes` lists the endpoint nodes the two edges have in common;
  // callers use it to spare crossings NEAR the shared node (where the
  // edges legitimately converge on a pinned anchor and pushing jitters).
  function edgeLayerPair(edgeA, edgeB) {
    const a = typeof edgeA === 'string' ? edgeById.get(edgeA) : edgeA;
    const b = typeof edgeB === 'string' ? edgeById.get(edgeB) : edgeB;
    if (!a || !b || a.id === b.id) return null;
    const shared = sharedLabels(a.edgeCollision, b.edgeCollision);
    if (!shared.length) return null;
    const sharedNodes = [];
    for (const n of [a.source, a.target]) {
      if (n === b.source || n === b.target) sharedNodes.push(n);
    }
    return { shared, frac: computeSplit(a.edgeCollision, b.edgeCollision, shared), sharedNodes };
  }

  return {
    ancestors,
    edgeAllowed,
    edgesWithObstacles,
    nodeNodePair,
    edgeNodePair,
    edgeEdgePair,
    edgeLayerPair,
  };
}
