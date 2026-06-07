---
id: F-0017
name: physics-routing
status: shipped
introduced: 2026-06-02
user_value: >
  Optar (via config `routing.engine: physics`) por um roteamento força-dirigido
  com snap de portas, seleção de face anti-cruzamento e fissão/fusão de feixes.
contracts:
  api: src/routing/physics/index.js
  schemas:
    solver: src/routing/physics/solver.js
    forces: src/routing/physics/forces.js
    topology: src/routing/physics/topology.js
  tests:
    - tests/routing/physics/phase2.test.js
    - tests/routing/physics/snap-selection.test.js
    - tests/routing/physics/phase5-fission.test.js
    - tests/routing/physics/phase5-fusion.test.js
    - e2e/14-edge-crossings.spec.js
    - e2e/18-foreign-node-detour.spec.js
    - e2e/19-perimeter-rail-redesign.spec.js
acceptance:
  - id: A1
    pattern: optional
    feature: "a config define `routing.engine: physics`"
    response: >
      o caminho algébrico é substituído por um relaxamento força-dirigido das
      arestas (snap discreto de portas, seleção de face, fissão/fusão de feixes)
  - id: A2
    pattern: state
    state: "duas arestas compartilham um collision layer"
    response: "o solver descruza as arestas; arestas sem layer em comum não fazem fissão"
  - id: A3
    pattern: ubiquitous
    requirement: >
      nenhum segmento roteado atravessa o corpo de um nó estranho depois que a
      simulação assenta
  - id: A4
    pattern: ubiquitous
    requirement: "o default permanece o roteador algébrico; physics é opt-in"
depends_on: [F-0003, F-0005]
decisions: [ADR-0009]
---

# F-0017 · Solver físico de routing (opt-in)

## Comportamento

Engine alternativo em [src/routing/physics/](src/routing/physics/), opt-in via
`routing.engine: physics` na config. Substitui o caminho algébrico por um
relaxamento força-dirigido das arestas: snap discreto de portas, seleção de face
anti-cruzamento, fissão/fusão de feixes
([src/routing/physics/solver.js](src/routing/physics/solver.js)). Usa as mesmas
collision tags (F-0005) para decidir o que descruzar.

## Limites conhecidos

É opt-in: o roteador algébrico (F-0003) permanece o default em produção
(ADR-0009). **Direção conhecida:** há intenção de tornar o solver físico o
padrão; quando acontecer, será um ADR novo que supersede o ADR-0009.

## Operações relacionadas

`algebraic.legacy: false` ativa o modo "engine puro físico" (sem clips/snaps
algébricos); o sub-objeto `endpoints` permite override de face por aresta (e2e
19). Estilos de ponta (F-0016) aplicam normalmente.
