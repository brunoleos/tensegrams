---
schema_version: 1
---

# Não-lançado

## Em andamento

- Foco herdado do STATE: ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013
- Avaliação multiagente do projeto (docs/audits/2026-09-30/README.md): roadmap R01–R23, 15 propostas de ADR em decisions/proposals/ (0014–0028) e 24 sugestões no backlog, aguardando revisão. Próximo passo: decidir a carta de pesquisa (proposta 0014) e o desenho da Fase 4 (proposta 0016) (ADR-0012)

## Corrigido

- Motor v2 emite 'end' e para o rAF com corpos livres: o critério de assentamento é alpha <= alphaMin, o piso em que o solver prende alpha; o helper de teste passa a esperar o 'end' do produto (R03 da avaliação; ADR-0011)

## Adicionado

- Bancada de layout em bench/layout (npm run bench:layout): cenários do app e sintéticos com --seeds, métricas de colisão, contenção, cruzamentos, determinismo, assentamento cinético e mapa mental, e layouts externos plugáveis; teste de fumaça em tests/bench (R06 parcial da avaliação; ADR-0013)
