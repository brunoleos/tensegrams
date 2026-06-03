---
id: ADR-0005
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0002, F-0003, F-0005]
related: []
tags: [architecture, layout, routing]
---

# ADR-0005 · Plugins de layout/routing + modelo de força atrator-central

## Contexto

Posicionamento de nós e formato de arestas são preocupações que evoluem em ritmos
diferentes e admitem múltiplas estratégias (estático, força-dirigido; Manhattan,
reto, curvo). Acoplá-las ao núcleo tornaria caro adicionar ou trocar algoritmos,
e um modelo de força onde arestas puxam nós (mola clássica) produz layouts
imprevisíveis e difíceis de controlar declarativamente.

## Decisão

Duas camadas de plugins independentes atrás de contratos únicos: **layout
adapters** ([src/layout/adapter.js](src/layout/adapter.js), registry em
[src/layout/registry.js](src/layout/registry.js)) e **edge routers**
([src/routing/router.js](src/routing/router.js), registry em
[src/routing/registry.js](src/routing/registry.js)). Todos os adapters
compartilham **um único modelo de força base**: um atrator central que puxa todo
nó ao centro; **arestas são passivas** (nunca exercem força); e a separação entre
nós vem **só** das collision layers (ADR/feature F-0005). Ver F-0002, F-0003.

## Consequências

Adicionar um layout ou router é registrar um plugin que cumpre o contrato, sem
tocar o núcleo. O modelo de força é previsível: sem collision declarada, os nós
se empilham no centro (comportamento determinístico, não "explosão" de mola).
Layout e routing são ortogonais — qualquer combinação layout×router funciona. O
custo é que separação útil exige declarar collision layers explicitamente
(F-0005); não há repulsão "mágica" embutida.

## Alternativas rejeitadas

Um modelo força-dirigido clássico (arestas como molas) foi rejeitado pela
imprevisibilidade e pela dificuldade de controle declarativo. Layout/routing
acoplados ao núcleo foram rejeitados por engessar a evolução dos algoritmos. O
solver físico de routing (F-0017) é um plugin opt-in dentro dessa arquitetura,
não uma exceção a ela (ADR-0009).
