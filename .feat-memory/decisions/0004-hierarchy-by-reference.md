---
id: ADR-0004
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0001, F-0004]
related: [ADR-0002]
tags: [model, dsl]
---

# ADR-0004 · Hierarquia por referência, não por aninhamento

## Contexto

A forma natural de expressar containers em YAML seria aninhar os filhos dentro
do nó pai. Mas aninhamento acopla a declaração de atributos de um nó à sua
posição na árvore, dificulta mover um nó entre containers (exige recortar/colar
blocos) e mistura duas preocupações — atributos do nó e estrutura hierárquica.

## Decisão

Containers **não são declarados por aninhamento**. Cada nó é declarado num bloco
de atributos top-level plano; um nó vira filho de outro ao apontar `parent: <id>`.
O nó referenciado automaticamente passa a renderizar como frame
(`hasChildren=true`, ADR-0002). A resolução de subtree fica em
[src/dsl/ancestry.js](src/dsl/ancestry.js). Ver F-0004.

## Consequências

Reparentar é trivial (muda um campo `parent`), os atributos de cada nó ficam num
só lugar plano, e a estrutura emerge das referências — coerente com o modelo de
dois conceitos (ADR-0002). O custo é que a hierarquia não é visível "de relance"
no texto da DSL; é preciso seguir as referências `parent:` (mitigado pela
visualização e pelo drill-in).

## Alternativas rejeitadas

Aninhamento YAML dos filhos sob o pai foi rejeitado pelo acoplamento
declaração-posição e pela dificuldade de reparent. Uma lista `children:` no pai
foi rejeitada por duplicar a relação (risco de `parent`/`children`
divergirem) — a referência única `parent:` é a fonte de verdade.
