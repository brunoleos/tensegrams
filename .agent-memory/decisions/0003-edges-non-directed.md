---
id: ADR-0003
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0001, F-0016]
related: [ADR-0002]
tags: [model, dsl]
---

# ADR-0003 · Arestas não-direcionadas (direção só posicional)

## Contexto

Em muitos formatos de diagrama a aresta carrega direção semântica (`a → b` ≠
`b → a`), o que obriga o usuário a pensar em sentido mesmo quando o desenho não
precisa, e duplica a lógica de roteamento por orientação.

## Decisão

Edges **não têm direção semântica**. `[a, b]` e `[b, a]` referenciam a **mesma**
aresta. A ordem do par só posiciona o desenho das pontas: `startStyle` decora o
endpoint `a` (primeiro), `endStyle` decora o `b` (segundo). Os defaults
(`startStyle=none`, `endStyle=filledArrow`) preservam a intuição visual de "seta
no destino" sem introduzir direção no modelo. Ver F-0016.

## Consequências

A topologia é um grafo não-direcionado simples; roteamento e collision tratam a
aresta sem orientação. A semântica visual de seta fica inteiramente nos presets
de ponta (F-0016), desacoplada do modelo. O custo é que casos que realmente
precisam de direção semântica (ex.: fluxo) precisam expressá-la via decoração de
ponta, não via um atributo de direção.

## Alternativas rejeitadas

Arestas direcionadas por padrão foram rejeitadas porque forçariam sentido em
todo diagrama, mesmo nos puramente estruturais, e dobrariam o tratamento de
`[a,b]` vs `[b,a]`. Um campo `directed: true/false` por aresta foi considerado
desnecessário: a decoração de ponta já cobre a necessidade visual.
