---
id: F-0011
name: structured-config
status: shipped
introduced: 2026-06-02
user_value: >
  Editar a config do motor numa árvore clicável (toggles, dropdowns, números
  com min/max) sem mexer em YAML cru — ou alternar para o modo texto.
contracts:
  api: src/controls/config-editor.js
  schemas:
    schema: src/controls/config-schema.js
    parser: src/dsl/config.js
  tests:
    - tests/controls/config-schema.test.js
    - tests/dsl/config.test.js
    - e2e/10-structured-config.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário abre a aba Config"
    response: "o modo estruturado (form) é o default e mostra o switcher de modo"
  - id: A2
    pattern: event
    trigger: "o usuário alterna o switcher de modo"
    response: "troca entre form estruturado e textarea de YAML cru, compartilhando o mesmo estado"
  - id: A3
    pattern: event
    trigger: "o usuário clica um chip `+ keyName` de uma seção vazia"
    response: "a chave é adicionada com o default do schema (objeto intermediário vira {} pronto p/ drill)"
  - id: A4
    pattern: event
    trigger: "o usuário clica o botão × de uma chave"
    response: "a chave é removida"
  - id: A5
    pattern: ubiquitous
    requirement: >
      campos numéricos impõem min/max via input type=number; o placeholder
      do form muda conforme o layout selecionado
depends_on: [F-0010]
decisions: [ADR-0007]
---

# F-0011 · Config estruturado (form schema-driven)

## Comportamento

A aba Config tem dois modos que compartilham estado (editar num atualiza o
outro): **estruturado** (default) renderiza o YAML como árvore clicável
([src/controls/config-editor.js](src/controls/config-editor.js)), cada valor com
o editor apropriado por schema
([src/controls/config-schema.js](src/controls/config-schema.js)); e **texto**
(YAML cru). Adicionar/remover chaves via `+`/`×`. O parser da config vive em
[src/dsl/config.js](src/dsl/config.js).

## Limites conhecidos

A config carrega só knobs de baixo nível (feel da animação, pads de colisão,
padding de router, thresholds) — a estrutura semântica do diagrama é DSL
(ADR-0007). Chaves desconhecidas são preservadas (forward-compat). Não há editor
estruturado equivalente para a DSL ainda.

## Operações relacionadas

O placeholder muda com o layout selecionado (F-0002). O conteúdo da config é
persistido (F-0013) e pode ser importado/exportado (F-0015).
