---
id: ADR-0021
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0005, F-0001]
related: [ADR-0011]
tags: [dsl, layers, physics]
---

# ADR-0021 · Semântica dos pesos de nodeLayers, igual em v1 e v2

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: layout, motor, governanca, dsl; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O v1 divide o deslocamento por par, pelas layers compartilhadas (collision.js:63-68). O v2 usa massa global, 1 − maxWeight (compile-world.js:92). O mesmo YAML move um nó 120,9 px no v1 e 36,9 px no v2. README e F-0005 descrevem uma terceira fórmula, e pesos > 1 são grampeados sem aviso.

## Decisão

Peso é massa efetiva por contato, calculada por par no contributor de colisão, como no v1. A faixa é [0,1], com aviso fora dela. README, F-0005 e o exemplo forces são corrigidos a partir do código. A paridade de pesos é gate do flip do v2.

## Alternativas rejeitadas

- Massa global: mais barata, mas muda a semântica documentada.
- Divergência silenciosa entre engines: é o estado atual.
