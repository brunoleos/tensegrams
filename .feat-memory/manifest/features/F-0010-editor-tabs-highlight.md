---
id: F-0010
name: editor-tabs-highlight
status: shipped
introduced: 2026-06-02
user_value: >
  Editar a DSL e a Config em abas separadas, com syntax highlight YAML por
  tema, e colapsar o editor para ver só o preview.
contracts:
  api: src/editor.js
  schemas:
    highlight: src/controls/yaml-highlight.js
  tests:
    - tests/editor.test.js
    - tests/controls/yaml-highlight.test.js
    - e2e/03-editor-and-tabs.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "a aplicação carrega"
    response: "a aba DSL está ativa por default; alternar troca para o painel Config"
  - id: A2
    pattern: ubiquitous
    requirement: >
      um overlay de highlight (um <pre> atrás do textarea) colore chaves,
      números, strings, comentários, o `?` da chave composta e palavras-chave
      (true/false/on/off/null), preservando selection, IME e atalhos no input real
  - id: A3
    pattern: ubiquitous
    requirement: >
      a paleta vem de variáveis CSS (--syntax-*) e cada tema (dark/light/
      sepia/contrast) redefine os tons
  - id: A4
    pattern: event
    trigger: "o usuário aciona o botão de toggle do editor"
    response: "o editor colapsa e expande"
depends_on: [F-0001]
decisions: []
---

# F-0010 · Editor com tabs DSL/Config + syntax highlight

## Comportamento

[src/editor.js](src/editor.js) gerencia o textarea e a troca de abas DSL/Config
(DSL ativa por default). O highlight
([src/controls/yaml-highlight.js](src/controls/yaml-highlight.js), ~110 LOC) é
um `<pre>` posicionado atrás do textarea — só a tinta dos caracteres muda;
selection, IME e atalhos continuam no input real. A paleta vive em variáveis CSS
(`--syntax-key`, `--syntax-string`, …) e cada tema redefine os tons.

## Limites conhecidos

Sem dependência de runtime adicional para o highlight (tokenizer caseiro). O
editor estruturado da Config é uma feature à parte (F-0011); a DSL ainda não tem
equivalente estruturado.

## Operações relacionadas

As abas compartilham o pipeline de render (F-0001); a Config também tem modo
estruturado (F-0011). A largura do painel é ajustável pelo splitter (F-0014).
