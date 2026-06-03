---
id: F-0003
name: edge-routers
status: shipped
introduced: 2026-06-02
user_value: >
  Escolher no header o formato das arestas: ortogonal (Manhattan), reta
  ou curva (Bezier) — independente do layout escolhido.
contracts:
  api: src/routing/registry.js
  schemas:
    contract: src/routing/router.js
  tests:
    - tests/routing/registry.test.js
    - tests/routing/router.test.js
    - tests/routing/routers/orthogonal.test.js
    - tests/routing/routers/straight.test.js
    - tests/routing/routers/curved.test.js
    - e2e/05-layouts-and-routers.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "a aplicação carrega"
    response: >
      o seletor de Roteamento é populado a partir da registry com orthogonal
      como padrão
  - id: A2
    pattern: ubiquitous
    requirement: >
      para qualquer router selecionado, toda aresta da cena produz um path
      desenhado
  - id: A3
    pattern: optional
    feature: "o router selecionado é curved"
    response: "as arestas são desenhadas como curvas Bezier"
depends_on: [F-0001]
decisions: [ADR-0005]
---

# F-0003 · Edge routers pluggáveis

## Comportamento

Três routers em [src/routing/routers/](src/routing/routers/), registrados em
[src/routing/registry.js](src/routing/registry.js) e selecionáveis no header,
ortogonais ao layout:

- **orthogonal** (padrão) — Manhattan.
- **straight** — linha reta.
- **curved** — Bezier.

Todos implementam o contrato de [src/routing/router.js](src/routing/router.js).

## Limites conhecidos

O roteamento obstacle-aware (desvio de nós/arestas) só atua quando há collision
layers declarados (F-0005). O solver físico de routing (F-0017) é um caminho
alternativo opt-in via config; o router algébrico permanece o default.

## Operações relacionadas

Estilos de ponta de aresta (F-0016) e snap a faces de container são aplicados
sobre o path produzido por qualquer router.
