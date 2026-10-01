---
id: ADR-0014
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: []
related: [ADR-0012, ADR-0009]
tags: [research, strategy]
---

# ADR-0014 · Tensegrams é um experimento de pesquisa: pergunta, hipóteses H1–H4 e critério de conclusão

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: estrategia, governanca, layout, motor; confiança: media). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O mantenedor declarou em 2026-09-30 que o valor do projeto é pesquisa, não produto. Nenhum artefato registra isso: o grep de pesquisa/experimento/hipótese devolve 0 linhas. As notas da trilha estratégia são pesquisa 2/5, produto 1/5 e objetivo 1,5/5. Há prior art direto não citado. O vis-network põe um nó de suporte invisível por aresta na física. Dwyer, Marriott e Wybrow (2008) fazem layout interativo com restrições e preservação de topologia. A Fase 4 e a virada do default não têm critério de saída.

## Decisão

Pergunta: um mundo físico único, com nós-escora e arestas-cabo, gera diagramas legíveis e estáveis em tempo real?
- H1: a reciprocidade aresta→nó reduz cruzamentos. É medida como diferença pareada entre ρEnd = α e ρEnd = 0, com a mesma semente, várias seeds, N=60 e N=120, em modo native. O limiar absoluto contra o d3-force vale por escala.
- H2: até 8 ms/tick com 100 nós e 150 arestas, em native, no Chromium.
- H3: deriva de até 5 px após editar e desfazer; até 20% dos nós movidos mais de 50 px por +1 nó.
- H4: resíduo de até 10 px após arrasto; repouso cinético (max|v| < ε por N ticks) em até 5 s.
O delta de novidade a demonstrar é DSL textual, mundo único e reciprocidade medida. Concluído = GO/NO-GO por hipótese, com script e seed versionados, antes de qualquer default e do cutover. O timebox de 2026-12-31 foi sugerido pelo avaliador e depende de aprovação do mantenedor. Não-objetivos: adoção, paridade com Mermaid/D2, export/CLI/embed e garantia combinatória de não-cruzamento.

## Alternativas rejeitadas

- Manter o enquadramento de ferramenta (README.md:3): contradiz a ambição e deixa a Fase 4 sem critério.
- Híbrido produto+pesquisa sem prioridade: é o estado atual, com 96 dias parado.
- H1 só contra baselines externos: não isola a reciprocidade, porque a semente domina (427 contra 685 cruzamentos).
- Estudo com usuários antes das métricas: caro e prematuro.
