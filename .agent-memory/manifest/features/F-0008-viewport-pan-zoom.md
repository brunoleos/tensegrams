---
id: F-0008
name: viewport-pan-zoom
status: shipped
introduced: 2026-06-02
user_value: >
  Navegar diagramas grandes com pan e zoom fluidos, com culling por
  viewport e LOD por zoom para manter a performance.
contracts:
  api: src/viewport.js
  tests:
    - tests/viewport.test.js
    - e2e/06-interaction.spec.js
acceptance:
  - id: A1
    pattern: event
    trigger: "o usuário gira o scroll do mouse sobre o canvas"
    response: "a cena dá zoom in/out e o HUD atualiza o nível"
  - id: A2
    pattern: event
    trigger: "o usuário arrasta no fundo vazio do canvas"
    response: "o viewport é deslocado (pan)"
  - id: A3
    pattern: event
    trigger: "o usuário aciona o atalho de teclado F"
    response: "a view dá refit no conteúdo"
  - id: A4
    pattern: ubiquitous
    requirement: >
      o renderer faz culling por viewport (só desenha o que está na área
      visível com margem) e LOD por zoom (esconde labels abaixo de 0.4;
      representa nós como dots abaixo de 0.18)
depends_on: [F-0001]
decisions: []
---

# F-0008 · Pan / zoom / viewport (culling + LOD)

## Comportamento

[src/viewport.js](src/viewport.js) gerencia pan/zoom e o retângulo visível.
Zoom por scroll, por FAB e atalho `F` para refit; pan por drag no fundo. O
renderer faz **culling** (desenha só o que cai no viewport com margem) e **LOD**
(esconde labels abaixo de zoom 0.4; nós viram dots abaixo de 0.18).

## Limites conhecidos

Os thresholds de LOD (0.4 / 0.18) são fixos no renderer, não configuráveis pela
config. Gestos de toque (pinch, pan de um dedo) são cobertos em F-0019 (mobile).

## Operações relacionadas

O overlay de debug (F-0018) acompanha o mesmo grupo de pan/zoom. O HUD também
mostra o label de versão (carimbado no deploy).
