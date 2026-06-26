---
id: F-0005
name: collision-layers
status: shipped
introduced: 2026-06-02
user_value: >
  Declarar inline na DSL (`nodeLayers`/`edgeLayers`) quais elementos não se
  sobrepõem e de quais obstáculos as arestas desviam, com peso por elemento.
contracts:
  api: src/layout/collision.js
  schemas:
    postpass: src/layout/collision-postpass.js
    attrs: src/dsl/attr-set.js
    obstacle_route: src/routing/obstacle-route.js
  tests:
    - tests/dsl/collision-attrs.test.js
    - tests/layout/collision.test.js
    - tests/layout/collision-postpass.test.js
    - tests/routing/obstacle-route.test.js
    - e2e/09-overlap-and-context.spec.js
    - e2e/18-foreign-node-detour.spec.js
acceptance:
  - id: A1
    pattern: ubiquitous
    requirement: >
      dois elementos colidem quando seus conjuntos de tags têm interseção
      não-vazia; sem tag em comum, não há colisão
  - id: A2
    pattern: state
    state: "dois nós compartilham um collision layer"
    response: >
      o pós-passo os separa até não haver sobreposição, absorvendo o
      deslocamento na razão dos pesos do oponente
  - id: A3
    pattern: optional
    feature: "uma aresta tem `nodeLayers`"
    response: >
      a aresta é roteada desviando dos nós no(s) grupo(s), sem erro, em todos
      os layouts
  - id: A4
    pattern: unwanted
    trigger: "dois elementos se sobrepõem mas não compartilham nenhum layer"
    response: "a sobreposição é tolerada sem erro (não há colisão declarada)"
depends_on: [F-0001, F-0002]
decisions: [ADR-0011]
---

# F-0005 · Collision layers

## Comportamento

Colisão é declarada inline na DSL, por nó/aresta:

- `nodeLayers` em **nó** — participa do(s) grupo(s) e separa de outros nós nos
  mesmos grupos.
- `nodeLayers` em **aresta** — a aresta desvia de nós no(s) grupo(s).
- `edgeLayers` em **aresta** — outras arestas das quais esta desvia (bundling).

Forma lista (peso 0, "yielding") ou mapa (peso explícito em [0,1]). Para um par
(X,Y), a fração que cada lado absorve é a razão dos pesos do oponente
(`fracX = pesoY/(pesoX+pesoY)`). Separação em
[src/layout/collision.js](src/layout/collision.js) +
[src/layout/collision-postpass.js](src/layout/collision-postpass.js).

Roteamento obstacle-aware: no `live` por waypoints, no `custom`/`off` por A*
([src/routing/obstacle-route.js](src/routing/obstacle-route.js)).

## Limites conhecidos

Sem tag em comum, dois elementos nunca colidem — sobreposição é tolerada de
propósito. Os knobs globais de folga (`collision.nodePad`/`edgePad`) ficam na
config (F-0011).

## Operações relacionadas

É a única fonte de separação no modelo de força (F-0002); o solver físico
(F-0017) usa as mesmas tags para anti-cruzamento e fissão/fusão de feixes.
