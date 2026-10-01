---
id: ADR-0019
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: []
related: [ADR-0011, ADR-0012, ADR-0013]
tags: [physics, layout, settling]
---

# ADR-0019 · Motor v2: repouso cinético real, warm start e edição local

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: estrategia, motor, layout, testes, routing; confiança: alta). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O v2 nunca emite 'end' (solver.js:42 × compile-world.js:240), e o rAF não para. Com '<=', o 'end' sai no tick 481, que é o cronograma de alpha (ln 0,003 / ln 0,988 = 481,2), não repouso. O v2 ignora seedPositions: 70,2 px por edição, contra 26,2 do v1 (mm-warm.out). Com alpha global, um restart sem edição move as arestas 30 px em média.

## Decisão

Agora: '<=' para encerrar o rAF, um teste com corpo livre que distinga 'end' do cronograma, e helpers usando o alphaMin do produto.
No M0: 'end' por critério cinético (max|v| < ε por N ticks, alpha só como teto), que é o critério de H4. O v2 honra seedPositions/seedAlpha, e o nó novo nasce no centróide dos vizinhos.
Na Fase 4: alpha por corpo até 0, sono por janela (1 px em 30 ticks), wake adiado, tick() → false e diff por id na edição.
Proposta: 'congelar' como default e 'respirar' como knob, com prefers-reduced-motion pintando o estado final. Fica proposed até o mantenedor confirmar.

## Alternativas rejeitadas

- Loop contínuo com alpha preso: gasta CPU e impede medir H4.
- Repouso pelo cronograma de alpha ('<=' sozinho): mudar o alphaDecay passaria na H4 sem mudar a física.
- Âncora na posição anterior: Δwarm de 0,3 px, mas congela a topologia (razão 1,00).
- Critério global de velocidade sem sono: o N100 ainda deriva após 1.200 ticks.
