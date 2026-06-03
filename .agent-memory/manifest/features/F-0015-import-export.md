---
id: F-0015
name: import-export
status: shipped
introduced: 2026-06-02
user_value: >
  Exportar a DSL ou a Config da aba ativa como arquivo .yaml e importar um
  .yaml de volta, substituindo o conteúdo da aba e re-renderizando.
contracts:
  api: src/app/dsl-io.js
  schemas:
    download: src/app/download.js
  tests:
    - tests/app/dsl-io.test.js
    - tests/app/download.test.js
    - e2e/20-import-export.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário aciona Exportar (⤒) com a aba DSL ativa"
    response: "baixa a DSL atual como arquivo .yaml"
  - id: A2
    pattern: event
    trigger: "o usuário aciona Exportar (⤒) com a aba Config ativa"
    response: "baixa a config atual como arquivo .yaml"
  - id: A3
    pattern: event
    trigger: "o usuário importa (⤓) um .yaml de DSL"
    response: "store, editor e canvas atualizam para o conteúdo importado"
  - id: A4
    pattern: event
    trigger: "o usuário importa um .yaml de config"
    response: "o store atualiza e o form estruturado repopula"
  - id: A5
    pattern: unwanted
    trigger: "o arquivo importado é YAML inválido"
    response: "o erro aparece na barra de erros sem quebrar a aplicação"
depends_on: [F-0001, F-0010]
decisions: []
---

# F-0015 · Import / Export YAML

## Comportamento

Ao lado das abas DSL/Config há dois botões que agem na **aba ativa**: `⤒`
exporta, `⤓` importa ([src/app/dsl-io.js](src/app/dsl-io.js), download via
[src/app/download.js](src/app/download.js)). Exportar baixa a DSL ou a config
como `.yaml`; importar carrega um `.yaml`, substitui o conteúdo da aba e
re-renderiza. YAML inválido aparece na barra de erros sem quebrar a cena.

## Limites conhecidos

Exporta/importa uma aba por vez (DSL ou config separadamente), não um pacote
único. Os ícones `⤒`/`⤓` foram ajustados para casar com a intuição de direção
(commit dff963c).

## Operações relacionadas

É o caminho explícito de portabilidade, complementar à persistência automática
em localStorage (F-0013).
