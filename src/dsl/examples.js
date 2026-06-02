// Built-in DSL examples. The new YAML schema declares edges in
// `connections:` (each item is `[from, to]` or `[from, to, N]`) and
// uses top-level string keys for node configs + composite keys
// (`? [a, b]` + `:` on its own line) for edge decorations.
//
// Why the `?`/`:` are on separate lines: that's the canonical YAML
// composite-key syntax. Same-line `? [a, b]:` parses as a different
// (and useless) thing per the YAML 1.2 spec.

export const EXAMPLES = {
  quad: `# 4 nós + 4 arestas (triângulo c-a-b-c + perna c→d). Todos os
# nós competem na mesma layer ([top]); todas as arestas também
# ([edges]). Cenário canônico pra observar: contorno de nós alheios,
# arestas paralelas, e legibilidade de labels sobrepostos a arestas.

options:
  title: Quad

connections:
  - [a, b]
  - [b, c]
  - [c, a]
  - [c, d]

a:
  label: A
  nodeLayers: [top]

b:
  label: B
  nodeLayers: [top]

c:
  label: C
  nodeLayers: [top]

d:
  label: D
  nodeLayers: [top]

? [a, b]
: { label: AB, edgeLayers: [edges] }

? [b, c]
: { label: BC, edgeLayers: [edges] }

? [c, a]
: { label: CA, edgeLayers: [edges] }

? [c, d]
: { label: CD, edgeLayers: [edges] }
`,

  intro: `# Esqueleto de diagrama. "connections" declara a topologia;
# blocos por id apenas adicionam configuração ao nó.

options:
  title: Sistema simples

connections:
  - [api, db]
  - [api, cache]

# nodeLayers agrupa nós que não podem se sobrepor. A diferença de peso
# decide quem cede: pesos iguais → 50/50; (1, 0) → o lado de peso 0 cede
# tudo. Sem layer de colisão declarada, os nós empilham no centro — a
# separação é sempre explícita.

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
`,

  containers: `# Edite à esquerda — o canvas atualiza sozinho.
# Troque Layout (Custom / Live / Off) e Roteamento no topo.
# O painel Layers oculta camadas inteiras.

options:
  title: Showcase de arquitetura
  snapContainerAnchor: on

connections:
  - [web, api]
  - [api, backend]
  - [backend, web]
  - [web, worker]
  - [auth, queue]
  - [worker, queue]
  - [worker, store]
  - [auth, db]
  - [queue, cache]
  - [worker, api]

# Folhas no nível raiz.

web:
  label: Web
  viewLayers: [client]
  size: [150, 52]
  nodeLayers: [topo]

api:
  label: API Gateway
  viewLayers: [public]
  nodeLayers: [topo]

# Containers via "parent": hierarquia por referência, não por
# aninhamento. Um nó vira container quando é referenciado como
# parent por algum outro nó.

backend:
  label: Backend
  viewLayers: [infra]
  padding: 28
  nodeLayers: [topo]

auth:
  parent: backend
  label: Auth
  viewLayers: [public, security]
  nodeLayers: [mod]

worker:
  parent: backend
  label: Worker
  viewLayers: [app]
  nodeLayers: [mod]

queue:
  parent: backend
  label: Queue
  viewLayers: [app, data]
  nodeLayers: [mod]

store:
  parent: backend
  label: Persistência
  viewLayers: [data]
  nodeLayers: [mod]

db:
  parent: store
  label: Postgres
  viewLayers: [data]
  size: [150, 56]
  nodeLayers: [dado]

cache:
  parent: store
  label: Redis
  viewLayers: [data, infra]
  nodeLayers: [dado]

# Decorações de arestas. Pesos via mapa {tag: peso}; lista [tag]
# equivale a peso 0 (cede totalmente). Use {tag: 1} pra resistência máxima.

? [web, api]
: { label: HTTPS }

? [api, backend]
: { label: requests, snap: off }

? [backend, web]
: { label: callbacks }

? [web, worker]
: { label: tarefa, onHidden: promote }

? [worker, api]
: { label: callback, nodeLayers: [topo] }

? [auth, db]
: { label: sessão, edgeLayers: { feixe: 0.5 } }

? [queue, cache]
: { label: drena, edgeLayers: { feixe: 0.5 } }

? [worker, store]
: { label: grava }

# startStyle / endStyle escolhem o desenho de cada ponta. Edges são
# não-direcionadas — a ordem do par [a, b] em connections só define
# qual endpoint recebe startStyle (a) e qual recebe endStyle (b).

? [auth, queue]
: { startStyle: none, endStyle: filledArrow }

? [worker, queue]
: { startStyle: none, endStyle: filledArrow }
`,

  forces: `# Demo de forças. Troque o Layout para "Live (forças)" e
# ARRASTE os nós. Em nodeLayers, a diferença de pesos decide quem cede:
# pesos iguais → 50/50; (1, 0) → o lado com peso 0 absorve tudo.

options:
  title: Demo de forças

connections:
  - [hub, orbit1]
  - [hub, orbit2]
  - [hub, orbit3]
  - [hub, anchor]
  - [anchor, drifter]
  - [hub, rail]

hub:
  label: Hub
  pin: [0, 0]

orbit1:
  label: Órbita A
  viewLayers: [anel]
  constraint: { type: circle, x: 0, y: 0, r: 240 }

orbit2:
  label: Órbita B
  viewLayers: [anel]
  constraint: { type: circle, x: 0, y: 0, r: 240 }

orbit3:
  label: Órbita C
  viewLayers: [anel]
  constraint: { type: circle, x: 0, y: 0, r: 240 }

anchor:
  label: Âncora
  nodeLayers: { zona: 1 }
  repelFrom: { anel: 3 }

drifter:
  label: Flutuante
  nodeLayers: { zona: 0 }
  attractTo: { anel: 2 }

rail:
  label: No trilho
  constraint: { type: axis-y, value: 300 }

? [hub, anchor]
: { label: tração }
`,
};
