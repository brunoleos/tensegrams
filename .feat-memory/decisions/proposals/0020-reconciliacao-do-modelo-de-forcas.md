---
id: ADR-0020
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0005]
related: [ADR-0010, ADR-0011]
tags: [physics, forces]
---

# ADR-0020 · Modelo de forças vigente: P puro condicionado à medição, zona por elemento e acoplamentos declarados

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: governanca, motor, estrategia, layout, testes; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

Os ADR-0010/0011 contradizem o código: Ki 0,04 ligado (compile-world.js:42), pad global (collision.js:37) e attractTo corpo→corpo (tag-forces.js:23-38). O commit 113ef70 afirmou uma colisão cápsula que não existe. METHODOLOGY:86 proíbe editar ADR aceito. O P puro deixa um resíduo analítico PULL/Kp (6,667 px em tests/physics/collision.test.js:63,76), e ninguém mediu a sobreposição com Ki = 0 e o composite.

## Decisão

O código converge ao ADR-0011.
- Ki = 0 por default, condicionado a medir no harness contenção 0 e sobreposição ≤ v1 + 0,5 px, com composite e mola ou cabo puxando. A favor: KE 3,7 perpétuo com Ki, contra 3,8e-12 com P puro.
- Pad por elemento, com gate padA+padB.
- O ADR-0010 ganha uma lista fechada de acoplamentos declarados: attractTo por tag, tensão de aresta e reação do endpoint (ρEnd).
- Projeção e XPBD seguem fora do default, e o PI fica como knob de experimento.

## Alternativas rejeitadas

- Editar 0010/0011 no lugar: proibido pela metodologia.
- Adotar o código como verdade (PI no default): ciclo-limite medido de 20,48–24,98 px.
- Deixar três fontes divergentes: a Fase 4 nasce sobre premissa falsa.
