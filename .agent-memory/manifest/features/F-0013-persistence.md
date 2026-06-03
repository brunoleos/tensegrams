---
id: F-0013
name: persistence
status: shipped
introduced: 2026-06-02
user_value: >
  Ter o trabalho preservado entre reloads: DSL, config, layout, router, tema,
  estado do drawer, camadas escondidas, foco e largura do painel.
contracts:
  api: src/store.js
  tests:
    - tests/store.test.js
    - e2e/08-persistence.spec.js
    - e2e/04-splitter.spec.js
acceptance:
  - id: A1
    pattern: state
    state: "a página é recarregada"
    response: >
      DSL, config, escolha de layout/router, tema e aba ativa são restaurados
      do localStorage
  - id: A2
    pattern: ubiquitous
    requirement: >
      o estado é gravado na chave `tensegrams:dsl-v2`; o IR e o posicionamento
      são recomputados no load (não persistidos)
  - id: A3
    pattern: event
    trigger: "o app dá boot"
    response: >
      blobs legados (`tensegrams:dsl-v1` e os antigos `whiteboard:dsl-*`) são
      purgados
depends_on: [F-0001]
decisions: [ADR-0008]
---

# F-0013 · Persistência (localStorage)

## Comportamento

[src/store.js](src/store.js) persiste DSL + config + escolhas de layout/router +
tema + estado do drawer + camadas escondidas + container em foco + largura do
painel na chave `tensegrams:dsl-v2`. IR e posicionamento são recomputados no
load. No boot, blobs legados (`tensegrams:dsl-v1`, `whiteboard:dsl-*` da marca
anterior) são purgados.

## Limites conhecidos

O estado de colapso de container é efêmero de propósito (F-0004) e **não** entra
no blob persistido. Persistência é local ao navegador — não há sync remoto.

## Operações relacionadas

Tema (F-0012) e largura do splitter (F-0014) entram no mesmo blob. Import/Export
(F-0015) é o caminho explícito de portabilidade entre máquinas.
