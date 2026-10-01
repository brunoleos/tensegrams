---
id: ADR-0015
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: []
related: [ADR-0006, ADR-0010, ADR-0013]
tags: [dependencies, evaluation]
---

# ADR-0015 · Bibliotecas externas só como baseline ou oráculo de desenvolvimento; nenhuma nova em runtime

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: estrategia, testes, routing, layout, dsl; confiança: alta). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

Os experimentos precisam comparar com d3-force, WebCoLa, ELK, libavoid e Graphviz, e o PBT pede fast-check. O ADR-0006 restringe o runtime a ESM via importmap. Os spikes mediram cada lib em runtime, e todas perderam em qualidade ou ferem o ADR-0006.

## Decisão

Baselines, oráculos e fast-check entram só como devDependencies de bench/ e tests/, com seeds fixas. Nunca entram no importmap nem em dist/. Rejeitados em runtime, com números registrados: libavoid, Graphviz WASM, ELK, MSAGL, dagre, fcose, d3-force, FDEB, ajv e monaco-yaml. Só se reabre com fato novo.

## Alternativas rejeitadas

- Não comparar com baselines: as decisões 'provadas em sandbox' continuam sem reprodutibilidade.
- Plugin lazy via importmap (libavoid): X pior que o interno (155 contra 125) e +79% de payload.
- Reimplementar os baselines: caro e sujeito a espantalho.
