# Backlog de sugestões

Propostas de **evolução do sistema de agentes** capturadas durante o trabalho —
skills novas, regras de `AGENTS.md`, ADRs, refactors, heurísticas, gaps de doc.
É o funil pré-feature: uma sugestão amadurece em Feature/ADR, ou é descartada.
Commitado e compartilhado entre agentes (ADR-0046) — merge normal (acumula
entradas de todos); **não** é `merge=ours`.

Quando o `changelog/UNRELEASED.md` está vazio (nada em voo), a `memory-bootstrap`
oferece candidatos daqui como próximo foco.

Formato por entrada (uma seção `##` por sugestão):

```
## <id-kebab>

- **tipo:** new-skill | refactor-skill | new-rule | new-adr | heuristic-fix | doc-gap
- **contexto:** 1–2 frases do que motivou
- **alvo:** onde aplicar se promovida (skill X / AGENTS.md / ADR / doc)
- **occ:** quantas vezes reapareceu (bump silencioso em duplicata)
```

<!-- Entradas abaixo. Backlog vazio = sem pendências de evolução. -->
