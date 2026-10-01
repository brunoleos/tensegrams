---
id: ADR-0027
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0001, F-0003, F-0016]
related: [ADR-0003]
tags: [dsl, edges]
---

# ADR-0027 · Emenda ao ADR-0003: auto-laço, decoração invertida e chave canônica estruturada

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: dsl; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

[a, a] é aceito sem aviso, e os roteadores produzem geometria degenerada. A decoração em ordem inversa aplica startStyle no primeiro da connection, não no da decoração. A chave canônica concatena ids com '|' (parser.js:141-144): um id com barra vertical faz a decoração vazar para outra aresta, sem aviso (reproduzido pela trilha DSL). Adapters layered futuros precisarão de um sinal de rank.

## Decisão

Chave canônica estruturada (tupla, sem separador textual). Aviso quando a decoração usa a ordem inversa e define start/endStyle. Auto-laço com aviso agora e como corpo de aresta na Fase 4. A ordem em connections fica registrada como sinal de rank para adapters layered.

## Alternativas rejeitadas

- Proibir '|' em ids: mais simples, mas restringe o texto livre.
- Arestas direcionadas: rejeitado no próprio ADR-0003.
