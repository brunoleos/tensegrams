---
id: ADR-0028
date: 2026-09-30
status: proposed
supersedes: ADR-0001
superseded_by: null
affects_features: []
related: []
tags: [process, governance]
---

# ADR-0028 · feat-memory 2.1.0 com escopo reduzido para projeto solo de pesquisa

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: governanca, testes, motor; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O ADR-0001 descreve agent-memory e STATE.md, que não existem mais. Houve três migrações em 23 dias. Tags, telemetria e merge=ours nunca foram usados, e o deploy real é o SHA carimbado. Mesmo assim, o audit não detectou o motor fora do Manifest.

## Decisão

Registrar a migração para o 2.1.0 e congelar a versão até o fim da Fase 4. Release = SHA do deploy, sem tags. Telemetria desligada, e merge=ours só em INDEX gerados. As checagens de memória viram teste automatizado. O AGENTS.md ganha no máximo 3 regras novas: evidência reproduzível, gate de engine e feature planned antes do código.

## Alternativas rejeitadas

- Fluxo completo de time: custo sem uso observado.
- AGENTS.md simples, sem metodologia: perde ADRs e retomada, que funcionaram nesta avaliação.
