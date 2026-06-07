---
id: ADR-0008
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0013]
related: [ADR-0007]
tags: [dsl, config]
---

# ADR-0008 · DSL e config em YAML, com hard cut v1→v2

## Contexto

A DSL e a config evoluíram de um formato anterior (v1, da marca "whiteboard").
Manter suporte a dois formatos em paralelo (migração suave) significaria carregar
dois parsers, regras de coerção bidirecionais e blobs de persistência legados
indefinidamente — custo permanente para um projeto de uso interno/inicial.

## Decisão

DSL e config são expressas em **YAML** (parser `yaml` via importmap). A migração
do formato v1 para v2 foi um **hard cut** (sem camada de compat): a persistência
usa a chave `tensegrams:dsl-v2` e, no boot, os blobs legados (`tensegrams:dsl-v1`
e os antigos `whiteboard:dsl-*`) são **purgados** em vez de migrados. Ver F-0013
e [src/store.js](src/store.js).

## Consequências

Um só formato, um só parser, sem dívida de compat acumulada. YAML dá comentários,
âncoras e legibilidade humana. O custo é que blobs v1 são descartados no boot —
aceitável porque o projeto estava em fase inicial e o conteúdo é facilmente
recriável; um usuário com diagrama v1 salvo o perderia silenciosamente no
upgrade.

## Alternativas rejeitadas

Migração suave v1→v2 (detectar e converter blobs antigos) foi rejeitada pelo
custo de manter conversores e dois schemas vivos sem demanda real. JSON foi
rejeitado por ser menos legível/editável à mão (sem comentários) para um formato
cuja edição manual é o caso de uso central.
