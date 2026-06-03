---
id: ADR-0009
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0017]
related: [ADR-0005]
tags: [routing]
---

# ADR-0009 · Solver físico de routing é opt-in; algébrico permanece default

## Contexto

O roteamento algébrico (orthogonal/straight/curved + pathfinding obstacle-aware)
é determinístico, rápido e maduro. O solver físico
([src/routing/physics/](src/routing/physics/)) — relaxamento força-dirigido com
snap de portas, seleção de face anti-cruzamento e fissão/fusão de feixes —
produz roteamentos de qualidade superior em casos densos, mas é mais novo, mais
caro e ainda em amadurecimento.

## Decisão

O solver físico é **opt-in** via `routing.engine: physics` na config. O roteador
**algébrico permanece o default** em produção. Ambos vivem como plugins sob a
mesma arquitetura de routing (ADR-0005) e usam as mesmas collision tags (F-0005).
Ver F-0017.

## Consequências

Usuários ganham o roteamento físico quando o pedem explicitamente, sem regressão
de performance/estabilidade no caminho default. A suíte cobre os dois caminhos.
O custo é manter dois engines de routing em paralelo enquanto o físico amadurece.

**Direção conhecida (futuro):** há intenção de tornar o solver físico o **padrão**
— ele é visto como a feature de ouro do projeto. Quando isso for implementado
(requer amadurecimento e validação de performance), será registrado num **ADR
novo que supersede este**, com `superseded_by` apontando para ele. Até lá, esta
decisão descreve o estado vigente em produção.

## Alternativas rejeitadas

Tornar o físico o default agora foi rejeitado por prematuro — exige mais
maturação e validação de performance antes de virar o caminho de todos. Remover
o algébrico foi rejeitado: ele é o baseline determinístico e rápido, valioso
mesmo após o físico amadurecer.
