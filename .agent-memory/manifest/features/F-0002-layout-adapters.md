---
id: F-0002
name: layout-adapters
status: shipped
introduced: 2026-06-02
user_value: >
  Escolher no header como os nós se posicionam: estático determinístico
  (custom), força-dirigido animado (live) ou apenas pinos da DSL (off).
contracts:
  api: src/layout/registry.js
  schemas:
    contract: src/layout/adapter.js
  tests:
    - tests/layout/registry.test.js
    - tests/layout/adapter.test.js
    - tests/layout/adapters/custom/index.test.js
    - tests/layout/adapters/live.test.js
    - tests/layout/adapters/off.test.js
    - e2e/05-layouts-and-routers.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "a aplicação carrega"
    response: >
      o seletor de Layout é populado a partir da registry com custom como
      padrão
  - id: A2
    pattern: state
    state: "o layout selecionado é off"
    response: "os nós com `pin` respeitam a posição fixa; os sem pino vão ao centro"
  - id: A3
    pattern: state
    state: "o layout selecionado é live e há nós no mesmo collision layer"
    response: >
      a simulação acomoda os nós até não haver sobreposição de retângulos
  - id: A4
    pattern: ubiquitous
    requirement: >
      todo adapter implementa o mesmo contrato (sessão tick/end/update/stop)
      e compartilha o modelo de força base (atrator central + separação só
      por collision layers)
depends_on: [F-0001]
decisions: [ADR-0005]
---

# F-0002 · Layout adapters pluggáveis

## Comportamento

Três adapters em [src/layout/adapters/](src/layout/adapters/), registrados em
[src/layout/registry.js](src/layout/registry.js) e selecionáveis no header:

- **custom** (padrão) — estático/determinístico: posiciona tudo no centro e
  roda o pós-passo de colisão.
- **live** — força-dirigido animado: atrator central como mola amortecida;
  honra `pin`, `constraint` e forças por tag (`attractTo`/`repelFrom`).
- **off** — respeita `pin`; nós sem pino vão ao centro.

Todos implementam o contrato de [src/layout/adapter.js](src/layout/adapter.js)
(sessão com `tick`/`end`/`update`/`stop`).

## Limites conhecidos

A única força/objetivo base é o atrator central; arestas são passivas. Sem
collision layer declarado (F-0005), os nós se empilham no centro.

## Operações relacionadas

O `live` tem modelo de interação próprio durante drag (F-0009). Os knobs de
feel (`center`, `damping`) vivem na config (F-0011).
