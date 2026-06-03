---
id: F-0018
name: debug-overlay-export
status: shipped
introduced: 2026-06-02
user_value: >
  Diagnosticar layout/colisão com um overlay de debug que acompanha pan/zoom,
  e exportar um pacote (JSON + PNG) reproduzível de um estado problemático.
contracts:
  api: src/app/debug-export.js
  schemas:
    overlay: src/renderer/collision-debug.js
  tests:
    - tests/app/debug-export.test.js
    - e2e/15-debug-overlay.spec.js
    - e2e/17-debug-export.spec.js
acceptance:
  - id: A1
    pattern: ubiquitous
    requirement: >
      o overlay de debug renderiza dentro do grupo de pan/zoom do viewport e
      permanece alinhado ao conteúdo do diagrama ao navegar
  - id: A2
    pattern: ubiquitous
    requirement: >
      marcas por node layer são diagonais ascendentes em slots globais fixos;
      por edge layer, descendentes; cores distintas por layer, compartilhadas
      quando o layer é compartilhado
  - id: A3
    pattern: event
    trigger: "o usuário exporta o pacote de debug"
    response: "emite um JSON com os inputs capturados mais um screenshot PNG"
  - id: A4
    pattern: event
    trigger: "um atributo inválido produz warning no IR"
    response: "o warning é capturado no pacote de debug"
depends_on: [F-0005, F-0008]
decisions: []
---

# F-0018 · Debug overlay + export pack

## Comportamento

Ferramenta de diagnóstico. O overlay
([src/renderer/collision-debug.js](src/renderer/collision-debug.js)) desenha as
marcas de collision layer dentro do grupo de pan/zoom (acompanha o viewport,
F-0008): diagonais ascendentes "/" para node layers em slots globais fixos,
descendentes "\\" para edge layers, cores por layer. O export
([src/app/debug-export.js](src/app/debug-export.js)) emite um pacote JSON com os
inputs capturados + PNG, incluindo warnings de IR.

## Limites conhecidos

É instrumentação de desenvolvimento/diagnóstico, não uma feature de uso final.
Os slots de node layer são independentes da contagem de edge layers.

## Operações relacionadas

Visualiza as collision tags de F-0005; o pacote exportado é a matéria-prima dos
specs de regressão (ex.: e2e 18 usa um "user debug pack").
