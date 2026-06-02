// Fase 3c — repulsão perpendicular no engine físico de routing.
//
// Regra de design do usuário: dois edges que compartilham edgeLayer não
// devem se cruzar; edges em edgeLayers DISJUNTOS podem cruzar livremente.
// O predicado é `resolver.edgeLayerPair` (interseção de edgeLayer pura,
// SEM exclusão de endpoint compartilhado) e a métrica é
// `countSharedLayerCrossings` — ambos código de produção, importados aqui
// direto do servidor para não reimplementar a lógica no teste.
//
// stepsPerTick fica modesto de propósito: o solver físico com fissão tem
// custo super-linear por tick em grafos densos (comportamento
// pré-existente, independente da 3c), então valores altos não refletem
// uso real (default de produção = 30).

import { test, expect } from '@playwright/test';
import { gotoFresh, setConfig } from './helpers.js';

const PHYSICS_CFG = 'routing:\n  engine: physics\n  stepsPerTick: 30\n';

const QUAD_DISJOINT = [
  'connections:',
  '  - [a, b]',
  '  - [c, d]',
  '',
  'a: { nodeLayers: [top] }',
  'b: { nodeLayers: [top] }',
  'c: { nodeLayers: [top] }',
  'd: { nodeLayers: [top] }',
  '',
  '? [a, b]',
  ': { edgeLayers: [x] }',
  '',
  '? [c, d]',
  ': { edgeLayers: [y] }',
].join('\n');

test.describe('edge crossings — repulsão perpendicular (Fase 3c)', () => {
  test('app + engine physics: layers compartilhados são marcados, disjuntos não', async ({ page }) => {
    await gotoFresh(page);

    // (a) quad canônico: todas as 4 arestas em [edges]. Pares que NÃO
    //     compartilham endpoint (AB×CD) e pares que COMPARTILHAM endpoint
    //     (AB×BC) devem AMBOS ser marcados — `edgeLayerPair` ignora o
    //     compartilhamento de endpoint (decisão da 3c: a âncora comum é
    //     pinada, não há jitter).
    await page.evaluate(() => { window.__store__.setDSL(window.__examples__.quad); });
    await setConfig(page, PHYSICS_CFG);
    await page.waitForTimeout(300);

    const quad = await page.evaluate(async () => {
      const { buildCollisionResolver } = await import('/src/layout/collision.js');
      const ir = window.__currentIR__;
      const r = buildCollisionResolver(ir);
      const id = (a, b) => `e:${a}|${b}`;
      return {
        nonAdjacent: r.edgeLayerPair(id('a', 'b'), id('c', 'd')) != null,
        adjacent: r.edgeLayerPair(id('a', 'b'), id('b', 'c')) != null,
      };
    });
    expect(quad.nonAdjacent, 'AB×CD (mesma layer, sem endpoint comum) → colidem').toBe(true);
    expect(quad.adjacent, 'AB×BC (mesma layer, endpoint comum) → colidem (sem exclusão)').toBe(true);

    // (b) layers disjuntos: as duas arestas NÃO são marcadas como
    //     colidentes; a métrica de mesma-layer é zero mesmo que a
    //     geometria venha a cruzar.
    await page.evaluate((dsl) => { window.__store__.setDSL(dsl); }, QUAD_DISJOINT);
    await page.waitForTimeout(300);

    const disjoint = await page.evaluate(async () => {
      const { buildCollisionResolver } = await import('/src/layout/collision.js');
      const { countSharedLayerCrossings } = await import('/src/routing/crossings.js');
      const ir = window.__currentIR__;
      const layout = window.__currentLayout__;
      const r = buildCollisionResolver(ir);
      const [a, b] = ir.edges.map((e) => e.id);
      return {
        pair: r.edgeLayerPair(a, b) != null,
        crossings: countSharedLayerCrossings(layout.routedEdges, r),
      };
    });
    expect(disjoint.pair, 'layers x ≠ y → não colidem').toBe(false);
    expect(disjoint.crossings, 'cruzamentos de mesma-layer = 0').toBe(0);
  });

  test('router físico (in-browser) descruza edges que compartilham layer', async ({ page }) => {
    await gotoFresh(page);
    // Exercita o caminho de produção COMPLETO no browser real:
    // runPhysicsRouter + resolver.edgeLayerPair (Fase 3c). Cenário
    // controlado: A (U deitado, horizontal livre) cruza B (poste
    // vertical fixo) em (100,-50); ambos em edgeLayer [L]. A desliza pra
    // fora; o cruzamento deve desaparecer.
    const result = await page.evaluate(async () => {
      const { runPhysicsRouter } = await import('/src/routing/physics/index.js');
      const { buildCollisionResolver } = await import('/src/layout/collision.js');
      const { countSharedLayerCrossings } = await import('/src/routing/crossings.js');

      const ir = {
        nodes: [{ id: 'sA' }, { id: 'tA' }, { id: 'sB' }, { id: 'tB' }],
        edges: [
          { id: 'A', source: 'sA', target: 'tA', nodeCollision: new Map(), edgeCollision: new Map([['L', 0.5]]) },
          { id: 'B', source: 'sB', target: 'tB', nodeCollision: new Map(), edgeCollision: new Map([['L', 0.5]]) },
        ],
      };
      const resolver = buildCollisionResolver(ir);
      const input = new Map([
        ['A', { points: [{ x: 0, y: 0 }, { x: 0, y: -50 }, { x: 200, y: -50 }, { x: 200, y: 0 }] }],
        ['B', { points: [{ x: 100, y: -100 }, { x: 100, y: 50 }] }],
      ]);
      const before = countSharedLayerCrossings(input, resolver);
      const { routedEdges } = runPhysicsRouter(ir, new Map(), resolver, {
        _inputRoutedEdges: input,
        routing: { stepsPerTick: 800 },
      });
      const after = countSharedLayerCrossings(routedEdges, resolver);
      return { before, after };
    });

    expect(result.before, 'cenário inicial cruza').toBe(1);
    expect(result.after, 'cruzamento resolvido pelo solver físico').toBe(0);
  });
});
