---
id: ADR-0026
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0001, F-0011, F-0013, F-0015]
related: [ADR-0007, ADR-0008, ADR-0013]
tags: [dsl, schema]
---

# ADR-0026 · DSL lida via AST com schema declarativo único e versão de formato

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: dsl; confiança: alta). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

A validação está espalhada em parser.js, ir.js e attr-set.js: 64 de 96 combinações inválidas passam em silêncio, e 115 diagnósticos saem sem linha. O schema core corrompe labels (1.10 → '1.1'). README e config-schema divergem do código (live.engine ausente).

## Decisão

A DSL segue em YAML (ADR-0008), lida pela AST com schema failsafe e checagem própria de chaves duplicadas. Um objeto SCHEMA único gera a validação com posição, a tabela do README e o autocompletar, para DSL e config. options.format entra antes de qualquer mudança semântica de leitura.

## Alternativas rejeitadas

- ajv/JSON Schema em runtime: mesma detecção (97,9%), mais ruído e CommonJS.
- Sintaxe TGL própria: reintroduz tipagem implícita e fere o 'um só parser'.
- Patch local sem schema: só 80,1% bem diagnosticado.
