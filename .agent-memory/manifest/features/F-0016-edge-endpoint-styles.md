---
id: F-0016
name: edge-endpoint-styles
status: shipped
introduced: 2026-06-02
user_value: >
  Decorar as pontas de uma aresta com presets (none, filledArrow,
  outlineArrow, crowfoot, diamond, circle) por endpoint, via `startStyle`/`endStyle`.
contracts:
  api: src/renderer/edge-end-styles.js
  schemas:
    presets: src/dsl/attr-set.js
    endpoints: src/dsl/ir.js
  tests:
    - tests/renderer/edge-end-styles.test.js
    - tests/dsl/endpoints-attr.test.js
acceptance:
  - id: A1
    pattern: ubiquitous
    requirement: >
      `[a, b]` e `[b, a]` referenciam a mesma aresta; a ordem só posiciona as
      pontas — `startStyle` decora o endpoint `a`, `endStyle` decora o `b`
  - id: A2
    pattern: state
    state: "uma aresta não declara estilos de ponta"
    response: "usa os defaults startStyle=none, endStyle=filledArrow (seta no destino)"
  - id: A3
    pattern: optional
    feature: "uma aresta declara um preset de ponta"
    response: >
      a ponta correspondente é desenhada como none/filledArrow/outlineArrow/
      crowfoot/diamond/circle
depends_on: [F-0001, F-0003]
decisions: [ADR-0003]
---

# F-0016 · Estilos de ponta de aresta

## Comportamento

Presets de ponta renderizados por
[src/renderer/edge-end-styles.js](src/renderer/edge-end-styles.js); o conjunto
aceito (`EDGE_STYLE_PRESETS`) vive em
[src/dsl/attr-set.js](src/dsl/attr-set.js) e a resolução do sub-objeto `endpoints` da aresta no IR builder
([src/dsl/ir.js](src/dsl/ir.js)). Como arestas são
não-direcionadas (ADR-0003), a direção é só posicional: `startStyle` decora o
primeiro do par, `endStyle` o segundo. Defaults `none`/`filledArrow` preservam a
intuição de seta no destino.

## Limites conhecidos

O conjunto de presets é fixo; novos presets entram sob demanda (próximo passo
aberto no README). O sub-objeto `endpoints` na DSL permite override de face por
aresta (ver F-0017 / e2e 19).

## Operações relacionadas

O estilo é aplicado sobre o path produzido por qualquer router (F-0003) e pelo
solver físico (F-0017).
