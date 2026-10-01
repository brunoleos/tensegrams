---
id: ADR-0017
date: 2026-09-30
status: proposed
supersedes: ADR-0009
superseded_by: null
affects_features: [F-0002, F-0003]
related: [ADR-0012, ADR-0013]
tags: [architecture, routing, plugins]
---

# ADR-0017 · Contrato de routing: adapter pode fornecer rotas; routers com estado e carga assíncrona

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: routing, motor, governanca; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O ADR-0013 trata layout e routing como ortogonais, mas a reciprocidade aresta→nó exige o mesmo World. route() é síncrono (router.js:8), load() nunca é chamado, e o routing físico é um if em pipeline.js:187-208. O slot routedEdges já existe (adapter.js:19,34).

## Decisão

Um layout adapter pode declarar providesRouting e entregar routedEdges. Nesse caso, o pipeline pula obstacle-routing, clip e snap. Os demais routers seguem route(ir, rects, ctx, prevState) → {routedEdges, state, diagnostics}, com load() assíncrono e caps declaradas. O algébrico vira oráculo permanente e fallback de custom/off. Supera o ADR-0009 quando o legado sair e emenda o ADR-0013:34.

## Alternativas rejeitadas

- Ortogonalidade estrita, com o routing físico como router separado: dois mundos por tick, sem reciprocidade.
- Manter o ADR-0009 até o M10: o texto diverge do código por meses.
