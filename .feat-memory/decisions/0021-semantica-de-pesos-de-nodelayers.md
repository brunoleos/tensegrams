---
id: ADR-0021
date: 2026-10-15
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0005, F-0001]
related: [ADR-0011]
tags: [dsl, layers, physics]
---

# ADR-0021 · Semântica dos pesos de nodeLayers, igual em v1 e v2

> Proposta pela avaliação multiagente de 2026-09-30 (`docs/audits/2026-09-30/05-layout.md`, L1-08); aceita pelo mantenedor em 2026-10-15.

## Contexto

O v1 divide o deslocamento por par, pelas layers compartilhadas (`computeSplit` em `src/layout/collision.js`). O v2 usava massa global, `1 − maxWeight` de todas as layers do nó, e a massa escalava todas as forças, não só a colisão. O mesmo YAML movia um nó 120,9 px no v1 e 36,9 px no v2. README e F-0005 descreviam uma terceira fórmula (razão dos pesos), e pesos > 1 eram grampeados sem aviso.

## Decisão

Peso é massa efetiva por contato, calculada por par no contributor de colisão, como no v1: `fracX = 0,5 − (pesoX − pesoY)/2`, com os pesos médios das layers que o par compartilha. No v2 o compilador passa esse split à colisão (`split` em `src/physics/collision.js`) e à colisão composta; a massa do corpo é 1 (infinita para pin e arrasto) e não depende do peso. A faixa é [0,1], grampeada com aviso fora dela. README e F-0005 descrevem a fórmula do código. A paridade de pesos (`tests/layout/weights-parity.test.js`) é gate do flip do v2.

## Consequências

- Com um lado imóvel (pin ou arrasto), o v2 mantém força igual e oposta: a massa infinita decide.
- O split preserva a taxa de separação do par (cada lado recebe 2·f·fração), mas um chute forte no lado leve pode ser cortado pelo `velocityCap`, o que aproxima a divisão de 50/50; o teste de paridade roda sem cap.
- Nos exemplos do app o v2 assenta mais rápido ('end' em 111 ticks contra 199) e reaquece menos (0,6 px contra 13,6): o nó de peso 1 do exemplo forces deixou de ter massa 20.

## Alternativas rejeitadas

- Massa global: mais barata, mas muda a semântica documentada e faz uma layer não compartilhada pesar no contato.
- Divergência silenciosa entre engines: era o estado anterior.
