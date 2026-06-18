---
id: ADR-0010
date: 2026-06-10
status: accepted
supersedes: null
superseded_by: null
affects_features: []
related: [ADR-0005, ADR-0009]
tags: [physics, architecture, layout]
---

# ADR-0010 · Repulsão só entre corpos; atração só por atratores

## Contexto

Na exploração de design do motor físico unificado (sandbox
`playground/physics-playground.html`), a atração corpo-corpo todos-com-todos
mostrou-se degenerada: equilíbrios assimétricos/frustrados, sem conserto por
ganho ou termo integral. Era também a fonte do caso problemático "camada
interna × externa" de containers.

## Decisão

O modelo de forças do motor é assimétrico por construção: **corpos apenas se
repelem** (não-overlap, gated por camadas de colisão); **toda atração vem de
atratores** — fontes de campo ponto/path/região, invisíveis ao layout (um
container é um corpo que repele peers E hospeda um atrator-região para os
filhos). Agrupar = corpos puxados ao mesmo atrator; alinhar = atrator-path;
conter = atrator-região. Aceita-se perder atração par-a-par nativa entre nós
(estilo force-directed); quando necessária (arestas, conectividade), entra como
acoplamento estrutural declarado, não como campo global.

## Alternativas rejeitadas

- Atração corpo-corpo todos-com-todos: degenerada (provado em sandbox).
- Perfil Lennard-Jones (atrai longe/repele perto): reintroduz atração
  corpo-corpo pela porta dos fundos; removido do playground.
