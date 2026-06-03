---
id: F-0007
name: selection-gestures
status: shipped
introduced: 2026-06-02
user_value: >
  Selecionar nós por tap, agir sobre a seleção pelo FAB no canto, e usar
  o menu de contexto (botão direito no desktop) para entrar/ocultar.
contracts:
  api: src/app/gestures.js
  schemas:
    fab: src/ui/action-fab.js
    context_menu: src/ui/context-menu.js
    menu_button: src/ui/menu-button.js
  tests:
    - e2e/12-container-collapse.spec.js
    - e2e/06-interaction.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "tap simples em um leaf ou no corpo de um container"
    response: "seleciona o nó; o FAB expande mostrando as ações disponíveis"
  - id: A2
    pattern: event
    trigger: "tap no fundo do canvas"
    response: "limpa a seleção"
  - id: A3
    pattern: state
    state: "o nó selecionado é um container"
    response: >
      o FAB e o menu de contexto oferecem Entrar (drill), Ocultar conteúdo
      (colapsar) e Limpar seleção
  - id: A4
    pattern: state
    state: "o nó selecionado é um leaf"
    response: "o FAB oferece apenas Limpar seleção"
  - id: A5
    pattern: unwanted
    trigger: "botão direito em um leaf"
    response: "nenhum menu de contexto é mostrado"
depends_on: [F-0004]
decisions: []
---

# F-0007 · Seleção, gestos e ações (FAB + menu de contexto)

## Comportamento

O roteamento de gestos fica em [src/app/gestures.js](src/app/gestures.js). Tap
seleciona; o FAB ([src/ui/action-fab.js](src/ui/action-fab.js)) no canto
inferior é compacto quando ocioso e expande com as ações da seleção. O menu de
contexto ([src/ui/context-menu.js](src/ui/context-menu.js)) abre no botão
direito (desktop) sobre o corpo de um container.

Ações de container: Entrar (drill, F-0004), Ocultar/Mostrar conteúdo (colapso,
F-0004), Limpar seleção. Leaf só tem Limpar.

## Limites conhecidos

Leaf não tem menu de contexto. O chevron do FAB colapsa/expande o próprio menu.

## Operações relacionadas

As ações de drill e colapso são as de F-0004; o drag dos nós selecionados é
F-0009.
