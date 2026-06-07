---
id: F-0019
name: mobile-layout
status: shipped
introduced: 2026-06-02
user_value: >
  Usar o app em telas pequenas: o editor empilha abaixo do preview, um drawer
  esconde o textarea, e o canvas responde a toque (pan de um dedo, pinch zoom).
contracts:
  api: src/app/wiring.js
  schemas:
    gestures: src/app/gestures.js
  tests:
    - e2e/07-mobile.spec.js
acceptance:
  - id: A1
    pattern: state
    state: "o viewport é de tamanho mobile"
    response: "o editor é empilhado abaixo do preview"
  - id: A2
    pattern: event
    trigger: "o usuário aciona o toggle do drawer"
    response: "o textarea do editor é escondido"
  - id: A3
    pattern: event
    trigger: "um toque de um dedo no fundo do canvas"
    response: "o viewport é deslocado (pan)"
  - id: A4
    pattern: event
    trigger: "um pinch de dois dedos"
    response: "o canvas dá zoom"
depends_on: [F-0008, F-0010]
decisions: []
---

# F-0019 · Layout mobile responsivo

## Comportamento

No viewport mobile (Pixel 7 nos testes), o layout empilha o editor abaixo do
preview e um drawer esconde/mostra o textarea (reconciliado por `applyUI` em
[src/app/wiring.js](src/app/wiring.js)). Gestos de toque em
[src/app/gestures.js](src/app/gestures.js): um dedo arrasta (pan), dois dedos
dão pinch zoom.

## Limites conhecidos

Sem splitter no mobile (F-0014 é desktop). A suíte E2E roda os dois projetos
(`chromium` 1280×800 e `mobile-chromium` Pixel 7) para cobrir ambos os layouts.

## Operações relacionadas

Compartilha o viewport/culling/LOD de F-0008 e o editor de F-0010; o drawer é
parte do estado persistido (F-0013).
