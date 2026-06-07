---
id: F-0014
name: splitter
status: shipped
introduced: 2026-06-02
user_value: >
  Ajustar a largura do painel do editor arrastando o splitter (ou pelas setas
  do teclado quando focado), com a largura preservada entre reloads.
contracts:
  api: src/app/wiring.js
  tests:
    - e2e/04-splitter.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário arrasta o splitter no desktop"
    response: "a largura do editor muda acompanhando o ponteiro"
  - id: A2
    pattern: event
    trigger: "o splitter está focado e o usuário usa as setas do teclado"
    response: "a largura do editor é ajustada por incrementos"
  - id: A3
    pattern: state
    state: "a página é recarregada"
    response: "a largura do editor é restaurada"
depends_on: [F-0010, F-0013]
decisions: []
---

# F-0014 · Splitter redimensionável

## Comportamento

O splitter entre editor e preview é cabeado em
[src/app/wiring.js](src/app/wiring.js) via pointer events (pointerdown →
pointermove → pointerup/cancel, com pointer capture) e suporta teclado (setas
quando focado, para acessibilidade). A largura resultante é persistida no blob
do store (F-0013).

## Limites conhecidos

Aplica-se ao layout desktop; no mobile o editor empilha abaixo do preview com
drawer (F-0019), sem splitter.

## Operações relacionadas

Opera sobre o painel do editor (F-0010); a largura entra na persistência
(F-0013).
