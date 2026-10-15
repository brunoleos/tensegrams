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

## Evidência da implementação (R10, 2026-10-15)

Implementado no v2 em `src/layout/container-bodies.js` (geometria bottom-up única, colisão composta, atrator-região, cobertura). Bancada (ex: + syn:30 + syn:100 × 3 seeds + sondas allcollide e misaligned), violações de colisão antes → depois:

| cena | v2 | v2 + mola | v1 (referência) |
|---|---|---|---|
| syn:100 | 120 → 0 | 117 → 0 | 2,3 |
| syn:30 | 20 → 0 | 20 → 0 | 1,3 |
| allcollide | 289 → 0 | 281 → 0 | 2 |
| misaligned | 0 → 0 | 0 → 0 | 0 |

Densidade no syn:100 do v2: 1,53 (empilhado) → 0,11 (v1: 0,10); cruzamentos 697 contra 738 do v1. Todas as execuções emitem 'end'.

Um ponto que a proposta não previa: a força EXTERNA a um container precisa agir no grupo inteiro também na mola de conectividade. Com a mola puxando só o membro ligado, ele saía do grupo esticando o rect, que empurrava os vizinhos, sem fim (bbox ~100× no syn:100). Distribuir a força ao "membro de suporte" da face (o gradiente exato) foi medido e descartado: empilha o layout numa coluna. Um atrator-região sem alpha segura a mola mas comprime os grupos (7 violações no syn:100, 28 no misaligned); com piso de alpha, o meio-termo não estabiliza a mola.

