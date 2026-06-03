---
id: F-0012
name: themes
status: shipped
introduced: 2026-06-02
user_value: >
  Trocar o tema visual (dark, light, sepia, contrast) pelo seletor do header,
  com a escolha preservada entre reloads.
contracts:
  api: src/app/wiring.js::applyUI
  schemas:
    store: src/store.js
  tests:
    - e2e/02-themes.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário escolhe um tema no seletor"
    response: "a UI passa a usar a paleta do tema (via data-theme no documento)"
  - id: A2
    pattern: state
    state: "a página é recarregada"
    response: "o tema escolhido é restaurado"
depends_on: []
decisions: []
---

# F-0012 · Temas (dark / light / sepia / contrast)

## Comportamento

O seletor de tema no header dispara `store.setTheme`; o reconciler `applyUI`
([src/app/wiring.js](src/app/wiring.js)) projeta `state.ui.theme` em
`document.documentElement.dataset.theme`, e o CSS redefine as variáveis de
paleta por tema. A escolha é parte do estado persistido em
[src/store.js](src/store.js).

## Limites conhecidos

Os quatro temas são fixos (dark padrão); não há tema customizável pelo usuário.
A paleta de syntax highlight (F-0010) acompanha o tema via as mesmas variáveis
CSS.

## Operações relacionadas

A persistência do tema faz parte de F-0013 (mesmo blob de localStorage).
