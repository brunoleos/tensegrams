// Snap warm-start — reescreve os endpoints das polylines de
// `routedEdges` pra os snap points discretos dos nodes que declararam
// `snap`/`snapGroups`. Roda ANTES de `buildWorld`, então o solver vê
// os endpoints já travados na coordenada correta (pinned CornerBody).
//
// Snap é opt-in por node: sem `snap` nem `snapGroups`, o endpoint
// permanece contínuo (clipAnchorsToContainerFaces + snapContainer-
// EndpointsExternal continuam ativos no pipeline upstream).
//
// Após reescrita, chama `enforcePerpendicularLegs` pra que a perna
// terminal volte a ser perpendicular à face do nó — sem isso, snap
// pode introduzir diagonal entre o snap point e o próximo corner.

import { resolveNodeSnapPoints, pickSnapPoint } from './snap-resolver.js';
import { enforcePerpendicularLegs } from './anchor-utils.js';

export function snapEndpointsToDiscretePorts(ir, routedEdges, rects, meta) {
  if (!ir || !ir.edges || !routedEdges) return routedEdges;
  // ir.nodes pode ser ausente em testes que constroem IR mínimo direto.
  // Sem nodes, não há `snap`/`snapGroups` pra ler — early-return.
  if (!Array.isArray(ir.nodes) || !ir.nodes.length) return routedEdges;
  const nodesById = new Map(ir.nodes.map(n => [n.id, n]));
  const criterion = meta?.routing?.snap?.criterion ?? 'nearest';

  for (const e of ir.edges) {
    const re = routedEdges.get(e.id);
    if (!re || !re.points || re.points.length < 2) continue;
    // Curves não passam pela projeção Manhattan — snap discreto não
    // se aplica geometricamente da mesma forma. Fora do escopo da 5.4.
    if (re.kind === 'curve' || re.kind === 'spline') continue;

    const sNode = nodesById.get(e.source);
    const tNode = nodesById.get(e.target);
    const sRect = rects?.get(e.source);
    const tRect = rects?.get(e.target);

    let pts = re.points;
    let mutated = false;

    if (hasSnapDeclared(sNode) && sRect) {
      const candidates = resolveNodeSnapPoints(sNode, sRect, meta);
      if (candidates.length) {
        const snap = pickSnapPoint(candidates, pts[0], criterion,
          { otherEndpoint: pts[pts.length - 1] });
        if (snap) {
          pts = [snap, ...pts.slice(1)];
          mutated = true;
        }
      }
    }
    if (hasSnapDeclared(tNode) && tRect) {
      const candidates = resolveNodeSnapPoints(tNode, tRect, meta);
      if (candidates.length) {
        const snap = pickSnapPoint(candidates, pts[pts.length - 1], criterion,
          { otherEndpoint: pts[0] });
        if (snap) {
          pts = [...pts.slice(0, -1), snap];
          mutated = true;
        }
      }
    }

    if (mutated) {
      // Após snap, refaz a perna terminal pra preservar perpendicularidade
      // à face. enforcePerpendicularLegs aceita kind='line' (não-curve)
      // e devolve uma polyline coerente.
      pts = enforcePerpendicularLegs(pts, re.kind, sRect, tRect);
      routedEdges.set(e.id, { ...re, points: pts });
    }
  }
  return routedEdges;
}

function hasSnapDeclared(node) {
  return !!node && (node.snap != null || node.snapGroups != null);
}
