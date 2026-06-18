---
id: ADR-0012
date: 2026-06-10
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0017]
related: [ADR-0009, ADR-0010]
tags: [physics, routing, edges]
---

# ADR-0012 · Arestas movidas por tendências de força

## Contexto

Revisão adversarial (architecture-critic) recomendou rotear arestas por
planner algébrico (A*, garantias duras) e abandonar arestas como corpos
físicos. O mantenedor fixou como **requisito**: arestas devem ser movidas por
tendências de força — o movimento orgânico/vivo é central à identidade do
projeto (tensegridade), não um nice-to-have.

## Decisão

Arestas são objetos físicos movidos por forças no motor unificado: cadeia de
corners (partículas 2-DOF, sem DOF angular), comprimento emergente, endpoints
atraídos ao perímetro do nó, desvio de obstáculos e anti-cruzamento por
repulsão dos segmentos (cápsulas derivadas dos corners, força redistribuída),
coesão por molas de cadeia/midline. Não-cruzamento é **tendência** ajustável
por rigidez, não garantia combinatória — aceito por design. As preocupações do
critic (custo do narrow-phase, instabilidade de fissão/fusão) viram desafios
de engenharia dentro do modelo de forças (sub-stepping; topologia de
subdivisão fixa ou semeada), não motivo para abandoná-lo.

## Alternativas rejeitadas

- Planner A* como substituto das forças: atende requisitos duros com garantia,
  mas viola o requisito de tendências (movimento contínuo no live).
- Híbrido A* + suavização de waypoints: idem — a rota continuaria prescrita,
  não emergente.
