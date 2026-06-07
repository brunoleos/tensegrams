---
id: F-0006
name: layer-filter
status: shipped
introduced: 2026-06-02
user_value: >
  Esconder e mostrar nós e arestas por tag, clicando nos chips de camada
  no header do preview — incluindo um chip "(sem camada)" para os untagged.
contracts:
  api: src/controls/layers.js
  schemas:
    filter: src/layout/layer-filter.js
  tests:
    - tests/controls/layers.test.js
    - tests/layout/layer-filter.test.js
    - e2e/09-overlap-and-context.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário clica em um chip de camada"
    response: >
      os nós (e arestas pendentes) com aquela tag são removidos do SVG;
      o filtro é aplicado no IR antes do layout, não via CSS
  - id: A2
    pattern: ubiquitous
    requirement: >
      um nó com várias layers é visível se PELO MENOS UMA de suas layers
      estiver visível (OR-exibir); só é escondido quando TODAS estão off
  - id: A3
    pattern: state
    state: "há mistura de nós tagueados e sem tag na mesma view"
    response: >
      um chip extra "(sem camada)" aparece; togglá-lo esconde os untagged sem
      afetar os chips reais
  - id: A4
    pattern: optional
    feature: "uma aresta tem `onHidden: promote`"
    response: "ao filtrar um endpoint, a aresta reconecta no ancestral visível mais próximo"
  - id: A5
    pattern: state
    state: "uma aresta usa o default `onHidden: omit` e um endpoint é filtrado"
    response: "a aresta pendente é removida também"
depends_on: [F-0001]
decisions: []
---

# F-0006 · Filtro de camadas

## Comportamento

Os chips da segunda linha do header do preview toggle a visibilidade por tag
([src/controls/layers.js](src/controls/layers.js)). O filtro é aplicado no IR
([src/layout/layer-filter.js](src/layout/layer-filter.js)), não via CSS: nós
escondidos são removidos antes do layout, então o `live` redistribui os que
sobram. Esconder um container esconde toda a subtree.

Semântica multi-tag: OR-exibir (visível se ≥1 layer visível). Quando há mistura
de tagueados e untagged, surge o chip "(sem camada)". Arestas pendentes seguem
`onHidden` (`omit` default, ou `promote`).

## Limites conhecidos

Sem nenhuma layer, um nó é sempre visível por default. O estado de "escondido"
sobrevive a mutações não-relacionadas do grafo, mas é parte do estado de UI
(não da DSL).

## Operações relacionadas

Drill-in (F-0004) estreita as duas linhas de chips ao nível em foco. As tags
aqui são as mesmas `viewLayers` da DSL; collision usa `nodeLayers` (F-0005),
eixos independentes.
