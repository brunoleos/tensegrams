---
id: ADR-0018
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0017]
related: [ADR-0008, ADR-0009]
tags: [routing, deprecation]
---

# ADR-0018 · Remover o routing físico anterior sem acoplá-lo à Fase 4

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: routing, motor, testes, dsl, governanca; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

src/routing/physics tem 1.952 linhas e 19 arquivos de teste (158 testes), e carrega 80 KB em toda visita. É o pior em continuidade (89 de 89 frames com salto, máximo de 802,7 px) e apaga sementes. É opt-in e não contamina as medições das hipóteses. A Fase 4 não tem data.

## Decisão

Extrair snap-resolver, trilho de perímetro e espalhamento de portas para um módulo neutro. Inventariar as regras de domínio (~35 testes em 13 arquivos comportamentais) e portá-las como contrato engine-agnóstico. Descartar a mecânica de fissão, fusão e cooldown, portando só a regra de não penetração. Reescrever os E2E 14/18/19 como cenários do harness e gravar a baseline do legado. Então remover o código e as chaves órfãs da DSL em hard cut, como no ADR-0008. A remoção não bloqueia o M4 nem espera o M10, mas precisa estar concluída antes do cutover.

## Alternativas rejeitadas

- Remover antes do M4: põe ~2 M no caminho do veredito sem medir nenhuma hipótese.
- Remover só no M10: mantém 67% do src/routing congelado sem prazo.
- Remover sem portar testes: perde regras de domínio (âncora no perímetro, layers, não penetração).
