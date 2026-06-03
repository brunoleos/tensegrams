---
id: ADR-0001
date: 2026-06-03
status: accepted
supersedes: null
superseded_by: null
affects_features: []
related: []
tags: [meta, methodology]
---

# ADR-0001 · Adotar a metodologia agent-memory

## Contexto

Tensegrams é uma SPA com base de código madura (~80 módulos ES, 751 testes
unit, 240 specs E2E) mas histórico Git raso (commit inicial squashado). O
projeto é desenvolvido com assistência de agentes (Claude Code e outros). Sem um
registro estruturado de capacidades e decisões, cada sessão de agente
re-derivava o contexto do zero a partir do código, e o "porquê" das escolhas
arquiteturais vivia só na cabeça do mantenedor e em prosa dispersa no README.

## Decisão

Adotar a metodologia agent-memory (v0.13.0) como camada de memória persistente
do projeto: `AGENTS.md` com frontmatter estruturado (project/stack/constraints)
como constituição, um Manifest de features em `.agent-memory/manifest/`, ADRs em
`.agent-memory/decisions/`, e `STATE.md` como foco volátil de sessão. A adoção
foi feita por `agent-memory deploy` seguido de gênese retroativa por engenharia
reversa multi-fonte (triangulando testes, README, telas e código).

## Consequências

Agentes retomam trabalho lendo `STATE.md` + Manifest enxuto, sem varrer a base
inteira. As constraints de processo (gate de push, verificação de deploy) viram
campo de primeira classe e auditável. O custo é a disciplina de manter os
artefatos atualizados via `/memory-debrief` a cada sessão relevante, e o gate de
re-deploy quando a CLI sobe de versão (ADR-0022 do agent-memory).

## Alternativas rejeitadas

Manter só o README + comentários foi rejeitado porque não distingue capacidade
de implementação nem registra alternativas rejeitadas, e não é carregável de
forma orçada por agentes. Um CHANGELOG livre não estrutura decisões nem
contratos. Não registrar nada perpetua a re-derivação cara a cada sessão.
