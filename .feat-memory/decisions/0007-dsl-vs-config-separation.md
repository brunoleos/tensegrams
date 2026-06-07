---
id: ADR-0007
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: [F-0011]
related: []
tags: [dsl, config]
---

# ADR-0007 · Separação de responsabilidade: DSL vs Config

## Contexto

Um diagrama tem dois tipos de ajuste: os que mudam o **significado** da cena
(quem se conecta a quem, quem colide, em que face a aresta pousa) e os **knobs
algorítmicos** do motor que afetam só o *feel* (rigidez da mola, paddings,
thresholds de LOD). Misturá-los num único documento confunde o que é portável e
semântico com o que é preferência de renderização.

## Decisão

Dois documentos YAML com responsabilidades distintas:

- **DSL** — configs de **alto nível**: estrutura (nós, arestas, containers,
  hierarquia) e regras que mudam o significado (collision, atravessar parede de
  container, face de anchor, layers, constraints físicas).
- **Config** — configs de **baixo nível**: knobs do motor que não afetam
  topologia nem regra visível (`center`/`damping` do live, `collision.nodePad`/
  `edgePad`, `router.padding`, thresholds). Editada por form estruturado (F-0011).

## Consequências

A DSL é o artefato portável e semântico do diagrama; a config é preferência de
motor, com defaults sãos e chaves desconhecidas preservadas (forward-compat). O
editor estruturado (F-0011) é schema-driven justamente porque o espaço de config
é fechado e tipado. O custo é a necessidade de decidir, para cada novo knob, de
que lado da fronteira ele cai — a regra é: muda o *significado* → DSL; muda só o
*feel* → config.

## Alternativas rejeitadas

Um único documento com tudo foi rejeitado por borrar a fronteira
portável/preferência e impedir um editor estruturado tipado. Hard-coding dos
knobs de motor foi rejeitado por tirar do usuário o controle de feel que a
config expõe.
