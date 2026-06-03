---
id: ADR-0002
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0001, F-0004]
related: [ADR-0004]
tags: [model, dsl]
---

# ADR-0002 · Modelo abstrato de dois conceitos (Node / Edge)

## Contexto

Editores de diagrama costumam acumular tipos de elemento (caixa, grupo,
container, ator, nota…), cada um com regras próprias de render e layout. Isso
multiplica casos especiais no parser, no layout e no renderer, e força o usuário
a escolher o "tipo" de cada elemento antecipadamente.

## Decisão

O modelo abstrato tem **apenas dois conceitos**: **Node** (qualquer elemento
posicionado) e **Edge** (liga dois Nodes). Um Node renderiza como container/frame
quando tem filhos e como caixa quando não tem. A propriedade `hasChildren` é
**derivada da topologia** (existe outro Node cujo `parent` é este) — não há campo
`kind` no IR. Ver [src/dsl/ir.js](src/dsl/ir.js).

## Consequências

O parser, o layout e o renderer tratam tudo uniformemente; "virar container" é
uma consequência da topologia, não uma declaração. Menos casos especiais, DSL
mais enxuta. O renderer expõe `data-kind` derivado de `hasChildren` apenas para
estilo, não como tipo no modelo. O custo é que comportamentos específicos de
"container" (colapso, drill) precisam ser computados a partir da relação de
parentesco, não lidos de um campo.

## Alternativas rejeitadas

Um campo `kind` explícito por nó foi rejeitado porque duplica informação já
contida na topologia e abre espaço para estados inconsistentes (um nó marcado
`leaf` mas com filhos). Uma hierarquia de tipos de elemento foi rejeitada por
inflar a superfície da DSL e do código sem ganho expressivo.
