---
id: ADR-0011
date: 2026-06-10
status: accepted
supersedes: null
superseded_by: null
affects_features: []
related: [ADR-0010]
tags: [physics, collision]
---

# ADR-0011 · Zona de força por-elemento, gate zona×zona, perfil linear

## Contexto

A repulsão precisa de três definições: onde atua, entre quem dispara, e com
que perfil. Comparações no sandbox (`playground/physics-playground.html`,
cenários C1–C5) mediram constante (chatter), barreira 1/d (instável/
incontrolável), potência xⁿ (precisa de 2 parâmetros extras) e linear.

## Decisão

1. **Zona de força (pad) por-elemento**: cada corpo tem uma região soft além
   da sua borda onde a repulsão atua; o tamanho visual do elemento não muda.
   O pad é parâmetro de força, não setpoint — a distância de repouso **emerge**
   do balanço com as demais forças e pode ceder sob carga (tendência, não
   garantia).
2. **Gate zona×zona**: a força dispara quando as **zonas** dos dois corpos se
   sobrepõem (`gap < padA + padB`) — consistente com a visualização das áreas
   e permite pads assimétricos com semântica aditiva.
3. **Perfil linear** sobre o overlap de zonas (`f = k·pen`): contínuo (sem
   chatter), força máxima limitada (estável no integrador explícito com pouco
   sub-stepping), um único parâmetro de significado intuitivo. Aceita-se
   overlap residual sob carga (erro de regime do P); antídotos conhecidos
   (termo integral, projeção) ficam fora do default.

## Alternativas rejeitadas

- Gate zona×corpo (`max(padA,padB)`): inconsistente com a visualização.
- Constante: descontínua → chatter perpétuo (medido).
- Barreira 1/d: garante não-overlap mas explode no explícito sem sub-stepping
  pesado; crescimento incontrolável.
- Potência xⁿ com ganho K: controlável, mas 2 parâmetros a mais sem payoff
  sobre o linear.
