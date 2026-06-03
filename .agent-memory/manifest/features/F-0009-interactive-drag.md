---
id: F-0009
name: interactive-drag
status: shipped
introduced: 2026-06-02
user_value: >
  Arrastar nós no canvas; arrastar um container move todos os descendentes
  junto, e no live mode o nó solto vira pin onde caiu (modo frozen).
contracts:
  api: src/layout/adapters/live/index.js
  schemas:
    pins: src/layout/adapters/live/pins.js
  tests:
    - tests/layout/adapters/live.test.js
    - e2e/06-interaction.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário arrasta um leaf no live mode"
    response: "o nó segue o cursor e, no release, vira pin onde caiu"
  - id: A2
    pattern: state
    state: "o live mode usa o default `interactionMode: frozen` e um drag está em curso"
    response: "o nó sob o cursor segue; todos os outros congelam no lugar"
  - id: A3
    pattern: event
    trigger: "o usuário arrasta um container pelo header"
    response: "todos os leaves descendentes se movem junto"
  - id: A4
    pattern: event
    trigger: "o usuário arrasta um container colapsado"
    response: "ele se move como um corpo único"
  - id: A5
    pattern: optional
    feature: "a config define `live.interactionMode: flow`"
    response: "não há pin no release; a simulação segue contínua"
depends_on: [F-0002, F-0007]
decisions: []
---

# F-0009 · Drag interativo (frozen / flow)

## Comportamento

No `live` adapter ([src/layout/adapters/live/index.js](src/layout/adapters/live/index.js)),
o default `interactionMode: frozen`: a simulação settla livre; durante o drag o
nó sob o cursor segue e os outros congelam; no release, só o **último** nó solto
vira pin ([src/layout/adapters/live/pins.js](src/layout/adapters/live/pins.js)).
Arrastar container pelo header move a subtree; container colapsado move como
corpo único.

## Limites conhecidos

Apenas o último nó solto fica fixo (sem pin acumulativo). O modo `flow`
(config) desliga o pin no release.

## Operações relacionadas

A seleção e os gestos que disparam o drag são F-0007; o modelo de força sob o
drag é o do adapter `live` (F-0002).
