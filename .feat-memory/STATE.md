---
schema_version: 2
updated_at: '2026-06-18T00:00:00+00:00'
updated_by: claude-opus-4.8
active_features: []
active_decisions:
- ADR-0009
- ADR-0010
- ADR-0011
- ADR-0012
- ADR-0013
blocked_on: null
---

# Estado

## Current

Reconciliação ADR↔código do motor físico: ADR-0005 superseded e dividido (split) em ADR-0013 (arquitetura de plugins, mantida) + ADR-0010/0011/0012 (modelo de força, novidade). ADR-0009 atualizado (sem default privilegiado; algébrico é fallback transitório) e o routing físico anterior (src/routing/physics, F-0017) marcado deprecated — será substituído pelo routing do motor unificado na Fase 4.

## Next

Fase 4: implementar routing no motor físico unificado (src/physics) sob ADR-0010..0012 — arestas como corpos capsule no mesmo World dos nós. Ao entregar: remover src/routing/physics + testes, e ADR-0012 supersede o ADR-0009. Decisão pendente: flipar o default de layout para v2 (live.engine) junto com a virada.

## Recent

| ts | agent | features touched | summary |
|---|---|---|---|
| 2026-06-18 | claude-opus-4.8 | F-0002,F-0003,F-0005,F-0017 | Reconciliação ADR↔código: split/supersede do ADR-0005 (→0013+0010-0012), update do ADR-0009, deprecação do routing físico anterior (F-0017) |
