---
id: ADR-0005
date: 2026-06-02
status: superseded
supersedes: null
superseded_by: [ADR-0010, ADR-0011, ADR-0012, ADR-0013]
affects_features: [F-0002, F-0003, F-0005]
related: []
tags: [architecture, layout, routing]
---

# ADR-0005 · Plugins de layout/routing + modelo de força atrator-central

> **Superseded (2026-06-18).** Este ADR juntava duas decisões; foi superado e
> dividido (split parcial):
>
> - **arquitetura de plugins layout/routing** (parcialidade mantida) →
>   **ADR-0013**, que a mantém vigente;
> - **modelo de força** ("atrator central único / arestas passivas / separação
>   só por collision layers") (novidade) → **ADR-0010** (repulsão entre corpos,
>   atração só por atratores), **ADR-0011** (zona de força linear zona×zona) e
>   **ADR-0012** (arestas movidas por força — derruba "arestas passivas").
>
> O texto abaixo é preservado como registro histórico.

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
