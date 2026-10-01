---
id: ADR-0025
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0001, F-0002, F-0010, F-0013]
related: [ADR-0008, ADR-0012]
tags: [dsl, robustness]
---

# ADR-0025 · Erro de DSL nunca apaga a cena e todo diagnóstico é visível

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: dsl, governanca; confiança: alta). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

Um erro YAML transitório zera a IR (parser.js:37) e reinicia a física. Os warnings nunca chegam à UI (pipeline.js:80). Alias, {toString:1} e U+2028 lançam exceção, e um pin fora do Float32 trava o grid. Um id com quebra de linha lança SyntaxError a cada paint, porque ensure-el.js:24-26 só escapa aspas. Isso contraria o critério A5 da F-0001 e a identidade de diagrama vivo.

## Decisão

Invariantes:
- parse e buildIR nunca lançam;
- com erro sintático, a última IR válida e a sessão permanecem;
- errors e warnings aparecem por severidade e com linha;
- nenhum valor não finito ou fora do Float32 cruza IR→layout;
- ids chegam escapados ao DOM.
O oráculo do fuzzer vira teste de propriedade.

## Alternativas rejeitadas

- Tratar caso a caso: é o estado atual, com 22 crashes gerados pelo fuzzer.
