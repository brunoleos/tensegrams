// Shape registry — dispatcher por nome.
//
// Cada shape exporta a mesma API:
//   bbox, boundaryHitFromAngle, boundaryHitFromPath,
//   namedAnchors, vertices, midpoints, intersections.
//
// `getShape(name)` devolve o módulo correspondente, ou rect como
// fallback se o nome for desconhecido. Renderer continua só rect na 5.2;
// os outros são stubs com a mesma assinatura pra que o resolver de snap
// (5.3) possa consultar uniformemente.

import * as rect from './rect.js';
import * as circle from './circle.js';
import * as diamond from './diamond.js';
import * as polygon from './polygon.js';
import * as star from './star.js';

const REGISTRY = new Map([
  ['rect', rect],
  ['circle', circle],
  ['diamond', diamond],
  ['polygon', polygon],
  ['star', star],
]);

export function getShape(name) {
  return REGISTRY.get(name) ?? rect;
}

export function shapeNames() {
  return [...REGISTRY.keys()];
}

export { rect, circle, diamond, polygon, star };
