---
schema_version: 1
---

# Não-lançado

## Em andamento

- Foco herdado do STATE: ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013
- Avaliação multiagente do projeto (docs/audits/2026-09-30/README.md): roadmap R01–R23, 15 propostas de ADR em decisions/proposals/ (0014–0028) e 24 sugestões no backlog, aguardando revisão. Próximo passo: decidir a carta de pesquisa (proposta 0014) e o desenho da Fase 4 (proposta 0016) (ADR-0012)

## Corrigido

- Motor v2 emite 'end' e para o rAF com corpos livres: o critério de assentamento é alpha <= alphaMin, o piso em que o solver prende alpha; o helper de teste passa a esperar o 'end' do produto (R03 da avaliação; ADR-0011)

## Mudado

- Motor v2 (R04/M0): 'end' por repouso cinético (alpha só teto) com KE e maxSpeed na sessão; warm start honra seedPositions/seedAlpha (nó novo em lugar livre junto aos vizinhos); semente de cold start em BFS, independente da ordem do YAML; damping como taxa por tick (deslize igual com 1–8 sub-passos); velocityCap 32 (8 com mola); contato P puro com Kp 0,9 e 2 sub-passos (Ki 0, medido na bancada); colisão descarta estado de slot removido. v1 ganha warmKick 0,05 separado do alphaKick (ADR-0011, ADR-0012)
- Motor v2 (R10/M2): container com filhos vira corpo composto. Rect derivado bottom-up numa função só (colisão e sessão usam a mesma geometria), colisão container×peer com força dividida entre os descendentes, atrator-região por container e gating por cobertura das unidades sob o LCA (proposta 0022). A mola de conectividade age no grupo quando a ponta está dentro de um container que não contém a outra. Violações no syn:100: 120 → 0 (sem mola) e 117 → 0 (com mola); sondas allcollide e misaligned na bancada (ADR-0010)

## Adicionado

- Bancada de layout em bench/layout (npm run bench:layout): cenários do app e sintéticos com --seeds, métricas de colisão, contenção, cruzamentos, determinismo, assentamento cinético e mapa mental, e layouts externos plugáveis; teste de fumaça em tests/bench (R06 parcial da avaliação; ADR-0013)
