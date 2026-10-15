# Tensegrams — DSL e visualizador de diagramas

SPA standalone para desenhar diagramas via DSL em YAML, com auto-layout e auto-routing pluggáveis. ES modules vanilla, sem bundler; única dep de runtime é `yaml` (npm), carregada no navegador via importmap.

## Rodar localmente

```bash
npm install        # instala yaml (browser usa importmap, Node usa exports.node)
python3 -m http.server 5173 --bind 127.0.0.1
```

Abre `http://127.0.0.1:5173/`. ES modules não funcionam via `file://` — é preciso servir por HTTP.

Em dev **não há passo de build**: o navegador carrega `src/` e o `yaml` (via importmap) direto da raiz do repo.

## Build (deploy)

Como não há bundler, "build" é só montar o **conjunto deployável** em `dist/` — `index.html`, `style.css`, `src/` e a subárvore `node_modules/yaml/browser` (o que o importmap resolve), preservando os caminhos relativos. Fica de fora tudo que não é servido: `tests/`, `e2e/`, `.git/`, o resto de `node_modules/`.

```bash
npm run build        # gera dist/ (~0,7 MB) via scripts/build-dist.js
npm run serve:dist   # build + serve dist/ em http://127.0.0.1:5180/ (preview do que vai pro Pages)
```

O workflow [.github/workflows/deploy-tensegrams.yml](.github/workflows/deploy-tensegrams.yml) roda exatamente isso no deploy: `npm ci --omit=dev` → carimba o SHA em `src/version.js` → `npm run build` → publica **`dist/`** no Pages. `dist/` é gitignored (artefato).

## Como usar

1. Escreva o diagrama em YAML (painel esquerdo).
2. O preview (painel direito) atualiza automaticamente conforme você digita.
3. Troque o **Layout** (algoritmo de posicionamento) e o **Roteamento** (formato das arestas) nos seletores do header.
4. **Gestos por nó**:
   - **Tap simples** num leaf ou no corpo de um container → seleciona o nó. O FAB no canto inferior mostra as ações disponíveis.
   - **Tap na barra superior** de um container → colapsa/expande.
   - **Double-tap** num container → drill-in. Use o breadcrumb ou `Esc` para sair.
   - **Tap no fundo** → limpa seleção.
   - **Botão direito** (desktop) → menu de contexto.
5. **Toggle as camadas** clicando nos chips para esconder/mostrar nós e arestas.
6. **Pan/zoom**: scroll para zoom; arrastar para pan.
7. **Importar / Exportar**: ao lado das abas **DSL/Config** há dois botões (`⤒` exportar, `⤓` importar) que agem na **aba ativa**. Exportar baixa a DSL ou a config como arquivo `.yaml`; importar carrega um `.yaml` de volta (substitui o conteúdo da aba e re-renderiza). YAML inválido aparece na barra de erros, sem quebrar a cena.

## DSL (YAML)

O documento tem três famílias de chave no topo:

- `options:` — config global (`title`, `snapContainerAnchor`).
- `connections:` — lista de pares `[from, to]` (ou `[from, to, N]` para paralelas). **Declara a topologia e implicitamente os nós que aparecem nela.**
- Top-level string keys — bloco de atributos por nó.
- Top-level composite keys `? [a, b]` seguidas de `:` em linha própria — decoração da aresta correspondente.

Exemplo mínimo:

```yaml
options:
  title: Sistema simples

connections:
  - [api, db]
  - [api, cache]

api:
  label: API
  viewLayers: [public]
  nodeLayers: [svc]

db:
  label: Database
  viewLayers: [data]
  nodeLayers: [svc]

cache:
  label: Redis
  viewLayers: [infra]
  nodeLayers: [svc]

? [api, db]
: { label: queries }

? [api, cache]
: { label: hot reads }
```

> **Sintaxe da chave composta.** YAML 1.2 exige `?` e `:` em linhas separadas (`? [a, b]\n: { ... }`). A forma compacta `? [a, b]: …` parece intuitiva mas o spec a interpreta como uma chave-mapa única — não funciona como decoração.

### Edges são não-direcionadas

`[a, b]` e `[b, a]` referenciam a mesma aresta. A ordem do par só posiciona o desenho das pontas:

- `startStyle` decora o endpoint **`a`** (primeiro do par)
- `endStyle` decora o endpoint **`b`** (segundo)

Presets aceitos: `none`, `filledArrow`, `outlineArrow`, `crowfoot`, `diamond`, `circle`. Defaults: `startStyle=none, endStyle=filledArrow` (preserva a intuição "seta no destino").

### Atributos de nó

| Chave | Significado |
|---|---|
| `label` | Texto exibido (default = id) |
| `parent` | Id de outro nó — esse nó passa a ser container desse |
| `viewLayers` | Lista de tags pra filtro de visibilidade (chip por tag) |
| `nodeLayers` | Lista `[tag]` (peso 0 default) **ou** mapa `{tag: peso}` — colisão contra outros nós |
| `size` | `[w, h]` — tamanho explícito |
| `pin` | `[x, y]` — posição fixa em coordenadas de mundo |
| `padding` | Folga interna do container (px) |
| `attractTo`, `repelFrom` | Mapas `{tag: força}` — atração/repulsão por tag (efeito visível no layout `live`) |
| `constraint` | Mapa `{type: axis-x\|axis-y\|rect\|circle\|parent-bounds, ...}` — restrição de movimento |

### Atributos de aresta

| Chave | Significado |
|---|---|
| `label` | Texto exibido sobre a aresta |
| `viewLayers` | Lista de tags pra filtro de visibilidade |
| `nodeLayers` | Lista ou mapa — nós dos quais a aresta desvia (roteamento obstacle-aware) |
| `edgeLayers` | Lista ou mapa — outras arestas das quais esta desvia (bundling) |
| `snap` | `on\|off\|inherit` — override por aresta de `snapContainerAnchor` |
| `onHidden` | `omit\|promote` — comportamento quando um endpoint é filtrado |
| `startStyle`, `endStyle` | Preset de ponta (ver lista acima) |

### Paralelas

Para mais de uma aresta entre o mesmo par, todas precisam de discriminador no 3º elemento:

```yaml
connections:
  - [a, b, 1]
  - [a, b, 2]

? [a, b, 1]
: { label: primária }

? [a, b, 2]
: { label: backup, endStyle: outlineArrow }
```

Misturar `[a, b]` (sem N) com `[a, b, M]` no mesmo par é erro.

### Hierarquia por referência

Containers não são declarados por aninhamento. Um nó vira container quando alguém o referencia em `parent:`:

```yaml
backend:
  label: Backend
  padding: 28

auth:
  parent: backend
  label: Auth

worker:
  parent: backend
  label: Worker
```

`backend` automaticamente passa a renderizar como frame (`hasChildren = true`).

### Options globais

```yaml
options:
  title: Meu sistema
  snapContainerAnchor: on   # default; arestas que terminam em container são forçadas à face externa
```

### Editor + syntax highlight

O textarea da DSL (e o da Config) tem um overlay caseiro de highlight YAML:
chaves, números, strings, comentários, `?` da chave composta e palavras-chave
(`true`/`false`/`on`/`off`/`null`) ganham cor própria por tema. O overlay é
um `<pre>` posicionado atrás do textarea — selection, IME e atalhos
continuam funcionando no input real, só a tinta dos caracteres muda.

A paleta vive em variáveis CSS (`--syntax-key`, `--syntax-string`, …) e cada
tema (dark / light / sepia / contrast) redefine os tons. Sem dependência de
runtime adicional — tokenizer em ~110 LOC (`src/controls/yaml-highlight.js`).

## Modelo abstrato

Existem apenas **dois conceitos**:

- **Nó (Node)** — qualquer elemento posicionado. Pode ter filhos (renderiza como container/frame) ou não (renderiza como caixa).
- **Aresta (Edge)** — liga dois Nós; não tem direção semântica, só posicional pra desenho das pontas.

A propriedade `hasChildren` é derivada da topologia (existe outro nó cujo `parent` é este). Não há campo `kind` no IR.

## Arquitetura — plugins

Duas camadas de plugins independentes:

Os três adapters compartilham o mesmo **modelo de layout**: a única força/objetivo base é um **atrator central** que puxa todo nó ao centro do canvas. As arestas são passivas (nunca exercem força) e a separação entre nós vem **só** das collision layers. Sem colisão declarada, os nós se empilham no centro.

**Layout adapters** (`src/layout/adapters/`)
- `custom` (padrão) — estático/determinístico: posiciona todo nó no centro e roda o pós-passo de colisão.
- `live` — força-dirigido animado: o atrator central é uma mola amortecida; honra `pin`, `constraint` e forças por tag (`attractTo`/`repelFrom`).
- `off` — respeita `pin` da DSL; nós sem pino vão ao centro.

**Edge routers** (`src/routing/routers/`)
- `orthogonal` (padrão) — Manhattan
- `straight` — linha reta
- `curved` — Bezier

Todo adapter implementa o mesmo contrato (`src/layout/adapter.js`) — sessão com `tick`/`end`/`update`/`stop`.

## Carregamento seletivo

O renderer faz **culling por viewport** (só desenha elementos dentro do retângulo visível, com margem) e **LOD por zoom** (esconde labels abaixo de zoom 0.4; representa nós como dots abaixo de 0.18).

## Estrutura

```text
.
├── index.html               # importmap: yaml → node_modules/yaml/browser
├── style.css
├── README.md
├── AGENTS.md                # instruções canônicas para agentes
├── package.json             # deps: yaml; devDeps: @playwright/test, pngjs
├── playwright.config.js     # E2E local (http.server na porta 5179)
├── playwright.config.prod.js # smoke contra deploy externo (GitHub Pages)
├── src/
│   ├── main.js              # loader fino → app/boot
│   ├── editor.js            # textarea + overlay de highlight
│   ├── store.js             # estado da UI + persistência localStorage
│   ├── viewport.js          # pan/zoom/culling
│   ├── version.js           # build metadata (SHA carimbado no deploy)
│   ├── app/{boot,pipeline,wiring,gestures,console-buffer,debug-export,download,dsl-io}.js
│   ├── dsl/
│   │   ├── parser.js        # YAML doc → { options, connections, nodes, edges }
│   │   ├── ir.js            # parsed YAML → GraphIR (consumido por layout/router)
│   │   ├── ancestry.js      # resolução de parent/subtree
│   │   ├── attr-set.js      # NODE_ATTRS, EDGE_ATTRS, OPTION_KEYS, EDGE_STYLE_PRESETS
│   │   ├── diagnostics.js   # Levenshtein "did you mean?" pra warnings
│   │   ├── config.js        # parser do YAML de config
│   │   └── examples.js      # quad / intro / containers / forces
│   ├── layout/
│   │   ├── {adapter,registry,collision,collision-postpass}.js
│   │   ├── {collapse-filter,layer-filter}.js
│   │   └── adapters/{off.js, custom/index.js, live/{index,collision-resolution,collision-waypoints,container-geometry,pins}.js}
│   ├── routing/
│   │   ├── {router,registry,geometry,crossings,face-select}.js
│   │   ├── {anchor-utils,clip-anchors,obstacle-route}.js
│   │   ├── {snap-resolver,snap-endpoints,snap-container-anchors}.js
│   │   ├── routers/{straight,orthogonal,curved}.js
│   │   └── physics/{index,solver,bodies,constraints,topology,warm-start,forces,forces-edge-central,forces-endpoint-bbox}.js
│   ├── renderer/{index,nodes,edges,edge-end-styles,collision-debug,ensure-el}.js
│   ├── shapes/{index,rect,circle,diamond,polygon,star}.js
│   ├── ui/{action-fab,context-menu,menu-button}.js
│   └── controls/{layers,abstraction,drill,config-editor,config-schema,yaml-highlight}.js
├── scripts/build-dist.js   # monta dist/ (cópia do conjunto deployável, sem bundler)
├── tests/                   # node --test (Node 22+) — espelha a árvore de src/
├── e2e/                     # Playwright (19 specs): bootstrap, temas, layouts×routers, import/export, …
├── e2e-prod/                # smoke visual contra o deploy publicado
├── bench/layout/            # bancada headless de layout (métricas, seeds, layouts externos)
└── dist/                    # (gitignored) saída de `npm run build` — é o que vai pro Pages
```

## Testes

**Unit (Node test runner):**

```bash
node --test $(find tests -name '*.test.js')
```

Cobertura ampla: parser, IR builder, todos os layouts/routers, solver físico de routing, projeção de abstração, store, renderer (com mock de DOM), LOD/culling, endpoint styles, import/export, integração end-to-end. ~751 casos em ~72 arquivos (espelhando a árvore de `src/`).

**E2E (Playwright):**

```bash
npx playwright install chromium
npx playwright test
```

Dois projetos: `chromium` (1280×800) e `mobile-chromium` (Pixel 7). Cobre bootstrap, temas, tabs DSL/Config, splitter, todos os layouts × routers, drill-in, pan/zoom/drag/pinch, persistência localStorage, geometry invariants.

**Smoke contra produção (`e2e-prod`):** valida o deploy publicado (default `https://brunoleos.github.io/tensegrams/`, sobreescritível via `PLAYWRIGHT_BASE_URL`). Sem `webServer` próprio:

```bash
npx playwright test --config=playwright.config.prod.js
```

**Bancada de layout (`bench/layout`):** roda os layouts do app e layouts externos sobre os mesmos cenários e mede colisão, contenção, cruzamentos, determinismo, assentamento e estabilidade do mapa mental. Não é gate de CI; um teste de fumaça em `tests/bench` garante que ela segue rodando. Detalhes em [bench/layout/README.md](bench/layout/README.md).

```bash
npm run bench:layout -- --scenarios ex:,syn:30 --variants live-v1,live-v2 --seeds 1,2,3
```

## Config

Além da DSL, o painel esquerdo tem uma aba **Config** com dois modos:

- **Estruturado** (default): renderiza o YAML como uma árvore clicável. Cada valor abre um popover com o editor apropriado (toggle, dropdown, número com min/max). Adicionar/remover chaves via botões `+`/`×`.
- **Texto**: textarea com o YAML cru — útil pra colar configs grandes.

Os dois modos compartilham o mesmo estado: editar num atualiza o outro. O placeholder muda conforme o layout selecionado.

### Separação de responsabilidade — DSL vs config

- **DSL — configs de alto nível.** Estrutura do diagrama (nós, arestas, containers, hierarquia) e regras de comportamento que mudam o *significado* da cena: quais elementos colidem entre si, se uma aresta atravessa a parede de um container, em qual face um anchor pousa, layers, constraints físicas.
- **Config — configs de baixo nível.** Knobs algorítmicos do motor que não afetam topologia nem regra visível: feel da animação do `live` (`center`, `damping`), `collision.nodePad`/`edgePad`, `padding` do roteador, thresholds de LOD.

### Collision layers

Colisão é declarada **inline na DSL**, por nó/aresta:

- `nodeLayers` em **nó** — esse nó participa do(s) grupo(s) declarado(s) e separa de outros nós nos mesmos grupos.
- `nodeLayers` em **aresta** — a aresta desvia de nós no(s) grupo(s).
- `edgeLayers` em **aresta** — outras arestas no(s) grupo(s) das quais esta desvia (bundling).

Forma lista (peso default 0 — "yielding"):
```yaml
api: { nodeLayers: [services] }
```

Forma mapa (peso explícito em [0, 1]):
```yaml
api:    { nodeLayers: { services: 1 } }      # immovable
db:     { nodeLayers: { services: 0.5 } }    # cede metade
cache:  { nodeLayers: [services] }            # cede totalmente (peso 0)
```

**Quando dois elementos colidem.** Dois elementos colidem quando seus conjuntos de tags têm interseção não-vazia. Sem tag em comum → sem colisão.

**Pesos.** `peso 0` = totalmente *driven* (absorve todo o movimento); `peso 1` = resistência máxima. Para um par (X, Y), a fração do deslocamento que cada lado absorve é a razão dos pesos do oponente:

```
fracX = pesoY / (pesoX + pesoY)
fracY = pesoX / (pesoX + pesoY)        (ambos 0 → 0.5 / 0.5)
```

Os knobs globais de folga ficam no config:

```yaml
collision:
  nodePad: 12
  edgePad: 8
```

**Roteamento obstacle-aware.** Arestas com tags de colisão desviam de nós e arestas conflitantes em todos os layouts: no `live` por waypoints, no `custom`/`off` por pathfinding A*.

Há ainda um **solver físico de routing** (`src/routing/physics/`) opt-in via `routing.engine: physics` na config: substitui o caminho algébrico por um relaxamento força-dirigido das arestas (snap discreto de portas, seleção de face anti-cruzamento, fissão/fusão de feixes). Default permanece o roteador algébrico.

### Layer filter

Os chips de layer (segunda linha do header do preview) toggle a visibilidade por tag. O filtro é aplicado no IR (não via CSS): nós escondidos são removidos antes do layout, então o live mode redistribui os que sobraram. Esconder um container esconde toda sua subtree.

**Sem layer = sempre visível por default.** Quando há mistura de nós tagueados e sem tag na mesma view, um chip extra **"(sem camada)"** aparece — togglar ele esconde os untagged.

**Multi-tag (OR-exibir):** um nó com várias layers é visível se PELO MENOS UMA das suas layers estiver visível.

**onHidden em aresta**: `omit` (default — aresta some quando endpoint é filtrado) ou `promote` (aresta reconecta no primeiro ancestral visível).

### Adapter / router knobs

```yaml
live:
  center: 0.012
  damping: 0.82
  collision: true
  interactionMode: frozen
collision:
  nodePad: 12
  edgePad: 8
router:
  padding: 12
```

No `live`, `center` (rigidez da mola do atrator central) e `damping` controlam o *feel* da animação. `collision.nodePad`/`edgePad` são globais. Chaves desconhecidas são preservadas (forward-compat).

### Live — interaction model

Por default, o `live` adapter usa `interactionMode: frozen`:

- Inicialmente: simulação roda livre, layout settles naturalmente.
- Durante drag: o nó sob o mouse segue o cursor; todos os outros congelam no lugar.
- No release: o nó solto vira pin onde caiu; os demais voltam às forças.
- Apenas o **último** nó solto fica fixo — sem pin acumulativo.

Pra simulação contínua (sem pin no release):

```yaml
live:
  interactionMode: flow
```

## Persistência

DSL + config + escolhas de layout/router + tema + estado do drawer + camadas escondidas + container em foco + largura do painel vão pra `localStorage` (chave `tensegrams:dsl-v2`; blobs legados `tensegrams:dsl-v1` e os antigos `whiteboard:dsl-*` da marca anterior são purgados no boot). IR e posicionamento são recomputados no load.

## Status

Migração da DSL e do config para YAML concluída (hard cut, v1 → v2). Suítes: **751/751 unit** verdes; **e2e** com 233 specs ativos + 7 skip (240 no total) nos dois projetos — verde sob a política de retry do CI (`retries: 1`). Rodando local sem retry, specs sensíveis a timing/snapshot golden podem precisar de re-run (a suíte roda sequencial de propósito).

Próximos passos abertos:
- Editor estruturado para a DSL (espelho do que existe pra config): chips por nó / por aresta com schema-driven popovers.
- Mais presets de ponta de aresta sob demanda.
