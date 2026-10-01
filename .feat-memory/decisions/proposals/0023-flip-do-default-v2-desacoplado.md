---
id: ADR-0023
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0002]
related: [ADR-0013]
tags: [layout, default, release]
---

# ADR-0023 · v2 vira default de layout em release própria, depois do veredito e antes do cutover

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: layout, motor, testes, governanca, estrategia; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

Em junho o flip foi adiado por 'calibração provisória'. As trilhas mostram bloqueadores corrigíveis: sem 'end', containers colapsando e warm start ignorado. O v2 falha em 8 de 35 testes do contrato do v1. O flip também troca o routing: o v2 não produz edgeWaypoints nem labelBBoxes (live/index.js:504,185 → pipeline.js:215).

## Decisão

O flip sai em release própria, depois do veredito GO/NO-GO e antes do cutover de routing, com o v1 por flag durante um ciclo. Gates:
- repouso cinético finito;
- violações ≤ v1 e contenção 0 em 16 cenários;
- reaquecimento ≤ v1;
- paridade de tag forces, constraints, update, velocityCap e pesos;
- menos de 16 ms/tick com 300 nós;
- coordenadas limitadas ao Float32;
- contrato v1×v2 e E2E com engine v2 verdes, usando um sinal de convergência;
- decisão sobre edgeWaypoints e labelBBoxes, com snapshot de rotas.
Em NO-GO, o flip é reavaliado só pelos gates de layout.

## Alternativas rejeitadas

- Virar antes do veredito: congela produto antes de H1–H3 sem necessidade, pois os experimentos usam a flag.
- Virar junto com a Fase 4: duas mudanças visíveis num push impedem atribuir regressões.
- Manter o v1 indefinidamente: 123 ms/tick com 300 nós e arestas passivas.
