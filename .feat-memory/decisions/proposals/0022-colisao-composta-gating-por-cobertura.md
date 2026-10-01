---
id: ADR-0022
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0002, F-0005]
related: [ADR-0010, ADR-0011]
tags: [layout, containers, collision]
---

# ADR-0022 · Container como corpo composto, com gating por cobertura das unidades do LCA

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: layout, motor; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O ADR-0010 diz que o container repele peers, mas não define o gating por layers de um corpo composto. No v2, os containers colapsam: 154 violações em syn:100. O gating direto diverge em 5 de 5 cenários allcollide, e o 'só irmãos' quebra com layers desalinhadas (70/577 violações).

## Decisão

Um par container×peer ou folha×folha só colide se não for coberto pelas unidades-filhas do LCA que compartilham layer. A força do composto é distribuída aos descendentes. Os cenários allcollide e desalinhado viram gate do harness.

## Alternativas rejeitadas

- Gating direto por layer: diverge, sem 'end' em 1.500 ticks e com bbox até 9.001 M px².
- Gating só entre irmãos: quebra com layers desalinhadas.
- Containers fora da colisão: é o colapso atual.
