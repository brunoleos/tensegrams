---
id: F-0004
name: containers-hierarchy
status: shipped
introduced: 2026-06-02
user_value: >
  Agrupar nós em containers declarando `parent:`, colapsar/expandir o
  conteúdo e dar drill-in para navegar a hierarquia, com breadcrumb de volta.
contracts:
  api: src/dsl/ancestry.js
  schemas:
    drill: src/controls/drill.js
    collapse: src/layout/collapse-filter.js
  tests:
    - tests/dsl/unified-model.test.js
    - tests/controls/drill.test.js
    - tests/layout/collapse-filter.test.js
    - e2e/11-unified-model.spec.js
    - e2e/12-container-collapse.spec.js
    - e2e/06-interaction.spec.js
acceptance:
  - id: A1
    pattern: ubiquitous
    requirement: >
      um nó vira container (renderiza como frame, `hasChildren=true`) quando
      outro nó o referencia em `parent:` — não há aninhamento nem campo `kind`
  - id: A2
    pattern: state
    state: "um container tem `label` explícito"
    response: "renderiza com esse label; sem label, cai para o próprio id"
  - id: A3
    pattern: event
    trigger: "tap na barra superior de um container"
    response: "colapsa ou expande o conteúdo"
  - id: A4
    pattern: event
    trigger: "double-tap no corpo de um container"
    response: "dá drill-in; o breadcrumb (ou Esc) retorna ao nível anterior"
  - id: A5
    pattern: event
    trigger: "tap simples no corpo de um container"
    response: "seleciona o nó (não dá drill)"
depends_on: [F-0001]
decisions: [ADR-0002, ADR-0004]
---

# F-0004 · Containers, hierarquia por referência, colapso e drill-in

## Comportamento

Containers não são declarados por aninhamento: um nó vira container quando
alguém o referencia em `parent:`. A resolução de subtree fica em
[src/dsl/ancestry.js](src/dsl/ancestry.js); `hasChildren` é derivado da
topologia (não há campo `kind` no IR — F-0002 do modelo abstrato, ADR-0002).

Gestos: tap na barra colapsa/expande; double-tap no corpo dá drill-in
(navegação por [src/controls/drill.js](src/controls/drill.js), com breadcrumb e
`Esc`); tap simples seleciona. Colapso filtra a subtree antes do layout
([src/layout/collapse-filter.js](src/layout/collapse-filter.js)).

## Limites conhecidos

O estado de colapso é efêmero — não sobrevive a reload (ao contrário das
escolhas persistidas em F-0013). Um container cujos filhos foram todos
filtrados ainda renderiza como frame.

## Operações relacionadas

Drill-in e colapso interagem com o filtro de camadas (F-0006), que estreita as
linhas de chips ao nível em foco.
