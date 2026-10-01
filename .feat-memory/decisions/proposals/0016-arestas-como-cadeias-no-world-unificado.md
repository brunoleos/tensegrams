---
id: ADR-0016
date: 2026-09-30
status: proposed
supersedes: null
superseded_by: null
affects_features: [F-0003, F-0017]
related: [ADR-0010, ADR-0011, ADR-0012]
tags: [physics, routing, edges, fase-4]
---

# ADR-0016 · Fase 4: arestas como cadeias persistentes de forças no World unificado

> Proposta gerada pela avaliação multiagente de 2026-09-30 (trilhas: motor, routing, governanca, layout; confiança: alta). Evidência em `docs/audits/2026-09-30/`. Rascunho editável: só vira ADR após revisão do mantenedor.

## Contexto

O ADR-0012 fixa arestas como corpos, mas não há plano versionado. Três propostas foram prototipadas, e a fiel venceu nas duas lentes (42×35×35; 6,7×6,2×4,0). Em modo pinned (nós fixos), ela tem 0 penetração em nó alheio até 500/1.000. Isso valida o routing, não a reciprocidade. Em modo native, ela ainda não assenta: no grid500 são 80 ms/tick e 13 px de sobreposição entre nós (cross.jsonl). A trilha routing mediu que a continuidade vem da persistência da cadeia (0 de 89 frames com salto > 20 px), não do planejador.

## Decisão

Aresta = cadeia de corners 2-DOF no mesmo World dos nós, persistente entre frames.
- Forças lineares: tensão de repouso 0, endpoint atraído ao perímetro, cápsula×nó por SDF amostrada, cápsula×cápsula por manifold de 4 pontos e nó×nó P puro.
- 2 sub-passos, cap de 8 px/tick e damping como taxa por dt.
- Semente reta entre as portas do perímetro.
- A reação do endpoint no nó (ρEnd) é knob (0, α, fixo), e o default sai da ablação de H1.
- Planejador obstacle-aware só como semente por evento, nunca por frame (pendente de confirmação do mantenedor).
- A força de aresta é dominada pela coesão do container.

## Alternativas rejeitadas

- XPBD no contato: saltos de 54–59 px no drag e não assenta com nós fixos.
- Reescrita SoA performance-first: compatibilidade 3/10, raspa quinas e colapsa paralelas.
- Atrator-path com replano K=20: E×N 29,4 contra 6,9 e ~4× o custo por frame.
- A* como rota prescrita: rejeitado pelo ADR-0012.
