---
id: ADR-0024
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: []
related: [ADR-0003, ADR-0006, ADR-0012, ADR-0013]
tags: [testing, physics]
---

# ADR-0024 · Troca de engine e mudança de física exigem contrato por engine, propriedades e bancada

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: testes, layout, routing, motor; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

A mutação mata 53,3% com 93,3% de linhas cobertas, e 6 de 14 sobreviventes são assimetrias de eixo ou sentido. O v2 falha em 8 de 35 testes do v1. A Fase 4 remove 158 testes. As propostas do motor compararam cenas diferentes, e o modo pinned foi lido como evidência de reciprocidade.

## Decisão

Troca de default ou remoção de engine só acontece com a suíte de contrato parametrizada por engine verde, com skips justificados. src/physics e o pós-routing têm propriedades de equivariância, conservação e convergência analítica (fast-check dev, com a seed fixa registrada na falha). Mudança em física passa na bancada comum (mesma cena, mesma métrica, modos pinned e native rotulados), com limiares. O E2E que valida engine usa um sinal de convergência, não sleeps.

## Alternativas rejeitadas

- Inspeção visual no playground: não é reprodutível.
- Suítes separadas por engine: deriva silenciosa, como ocorreu com seedPositions.
- Tabelas manuais nos 4 sentidos: mais baratas, mas não generalizam.
