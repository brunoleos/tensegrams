---
id: F-0001
name: dsl-to-diagram
status: shipped
introduced: 2026-06-02
user_value: >
  Escrever um diagrama em YAML no painel esquerdo e ver o SVG renderizar
  ao vivo no painel direito conforme digita — sem passo de build.
contracts:
  api: src/app/pipeline.js::runPipeline
  schemas:
    parser: src/dsl/parser.js
    ir: src/dsl/ir.js
  tests:
    - tests/dsl/parser.test.js
    - tests/dsl/ir.test.js
    - tests/integration.test.js
    - e2e/01-bootstrap.spec.js
    - e2e/03-editor-and-tabs.spec.js
    - e2e/11-unified-model.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "a aplicação carrega"
    response: >
      renderiza o diagrama de exemplo padrão no canvas com o tema dark
      aplicado
  - id: A2
    pattern: event
    trigger: "o usuário edita o texto da DSL"
    response: "o canvas re-renderiza refletindo a nova topologia"
  - id: A3
    pattern: ubiquitous
    requirement: >
      a lista `connections:` declara a topologia e implicitamente os nós
      que aparecem nela; chaves string de topo são blocos de atributo por nó
  - id: A4
    pattern: state
    state: "a DSL é YAML válido"
    response: "a região de erros fica escondida"
  - id: A5
    pattern: unwanted
    trigger: "a DSL contém YAML inválido"
    response: >
      o erro aparece na barra de erros sem quebrar a cena já renderizada
depends_on: []
decisions: [ADR-0002, ADR-0003, ADR-0004]
---

# F-0001 · DSL→diagrama

## Comportamento

Pipeline `DSL (YAML) → parser → GraphIR → layout → routing → renderer SVG`,
orquestrado em [src/app/pipeline.js](src/app/pipeline.js). O parser
([src/dsl/parser.js](src/dsl/parser.js)) lê o documento YAML em três famílias
de chave (`options:`, `connections:`, blocos de atributo por nó, e chaves
compostas `? [a, b]` para decoração de aresta) e o IR builder
([src/dsl/ir.js](src/dsl/ir.js)) o normaliza no GraphIR consumido por layout e
routing.

Em dev não há passo de build: o navegador carrega `src/` e o `yaml` (via
importmap) direto da raiz. O preview atualiza a cada edição.

## Limites conhecidos

YAML inválido nunca derruba a cena — o erro vai para a barra de erros e o
último render válido permanece. A sintaxe da chave composta exige `?` e `:` em
linhas separadas (YAML 1.2); a forma compacta não funciona como decoração.

## Operações relacionadas

A topologia é declarada em `connections:`; nós são implícitos. A hierarquia
(F-0004), as collision layers (F-0005) e o filtro de camadas (F-0006) operam
sobre o mesmo IR.
