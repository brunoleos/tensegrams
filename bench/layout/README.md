# Bancada de layout

Bancada headless (Node ≥ 20, ESM puro, zero dependências) que roda os layouts do
Tensegrams **e qualquer layout externo** sobre o mesmo conjunto de cenários e mede
qualidade, custo, determinismo e estabilidade do mapa mental. Veio da avaliação
de 2026-09-30 (`docs/audits/2026-09-30/05-layout.md`) e é o item R06 do roadmap:
a régua comum para as hipóteses de pesquisa e para o flip do v2.

Ela só lê o repositório (os módulos de `src/` são importados como estão). Para
medir outra árvore — um worktree, um commit antigo —, use
`TENSEGRAMS_REPO=/caminho`.

```
bench/layout/
  run.mjs                 CLI: cenários × variantes → results/*.json + *.md
  summarize.mjs           junta vários results/*.json numa tabela compacta
  example-external.mjs    exemplo de layout externo (grid-pack recursivo)
  lib/repo.mjs            ponte para src/ (parser, IR, adapters, router straight)
  lib/graph.mjs           grafo NEUTRO (interface com layouts externos) + deriveContainers
  lib/scenarios.mjs       exemplos do app + sintéticos (30/100/300) + sondas + perturbações
  lib/variants.mjs        variantes internas (live-v1, live-v2, live-v2+spring, custom, off)
                          e externalVariant(); runner que dirige session.tick()
  lib/metrics.mjs         métricas puras (graph, layout) → números
  lib/evaluate.mjs        orquestra uma (cenário, variante): métricas + determinismo + perturbação
  lib/report.mjs          tabela markdown completa
  results/                saídas (ignoradas pelo git)
```

## Rodar

```bash
npm run bench:layout                                  # tudo (syn:300 com live-v1 leva ~1 min POR execução)
node bench/layout/run.mjs --scenarios ex:,syn:30 --variants live-v1,live-v2
node bench/layout/run.mjs --scenarios syn:100 --variants live-v2 --seeds 1,2,3,4,5
node bench/layout/run.mjs --scenarios syn:300 --no-stability-big --no-determinism-big
node bench/layout/run.mjs --external bench/layout/example-external.mjs --only-external
```

Flags:

- `--scenarios`: nomes ou prefixos separados por vírgula (`ex:`, `syn:30`, `probe:`).
- `--variants`: nomes das variantes.
- `--seeds 1,2,3`: gera cada sintético em cada seed (`syn:N@sK`). Sem a flag, usa
  uma seed fixa por tamanho, comparável com as medições da avaliação.
- `--max-ticks N` (default 1500), `--no-stability`, `--no-determinism`.
- `--no-stability-big` / `--no-determinism-big`: pula só em cenários com mais de 150 nós.
- `--external arquivo.mjs`, `--only-external`.
- `--out x.json`: o `.md` sai ao lado (default `bench/layout/results/results.json`).

Tabela compacta a partir de vários JSONs:

```bash
node bench/layout/summarize.mjs bench/layout/results/*.json > bench/layout/results/summary.md
```

Tempo é wall-clock: compare razões entre variantes da mesma execução, não valores
absolutos entre máquinas. Para afirmar uma diferença, rode várias seeds.

## Plugar um layout externo (ELK, dagre, WebCoLa, d3-force, …)

Bibliotecas de baseline entram só como dependência de desenvolvimento desta
bancada, nunca no importmap nem em `dist/` (ADR-0006).

1. Crie um módulo que exporte `default` (ou `variants: []`) com `externalVariant`:

```js
import { externalVariant } from './lib/variants.mjs';

export default externalVariant('ext:elk', async (graph, { ir, prev }) => {
  // graph.nodes: [{ id, width, height, parent, isContainer, collisionLayers, pinned, padding }]
  // graph.edges: [{ id, source, target }]
  // prev: layout anterior {positions, containers} quando a bancada mede warm start
  //       (null no cold start) — use-o se a lib aceita posições iniciais.
  const positions = new Map();   // id -> {x, y}  (top-left; ou {anchor:'center'})
  // ... rode a lib ...
  return { positions /*, containers (opcional) */, ticks: 0 };
}, { anchor: 'topleft' });
```

2. `node bench/layout/run.mjs --external meu-layout.mjs [--only-external]`.

Contrato:

- **Entrada**: grafo neutro (`lib/graph.mjs`). Só folhas e containers VAZIOS têm
  tamanho próprio; `isContainer: true` = container com filhos (rect derivado).
  Hierarquia é por `parent` (ADR-0004). `collisionLayers` = chaves de `nodeLayers`
  (o contrato do app: só pares que compartilham layer NÃO podem se sobrepor).
  A IR original vem em `ctx.ir` para quem precisar de mais campos.
- **Saída**: posições das folhas (`Map` ou objeto; `width/height` opcionais —
  default = tamanho do grafo). Sem `containers`, a bancada deriva bottom-up
  (bbox dos filhos + `padding` + header 22 px), a convenção do `live`/`v2`.
  Libs que já posicionam containers (ELK com hierarquia) devem devolvê-los.
- Métricas avulsas: `computeMetrics(graph, {positions, containers})` e
  `displacement(layoutA, layoutB)` em `lib/metrics.mjs`.

## Métricas (colunas da tabela)

| coluna | definição |
|---|---|
| ticks / end? | ticks até o adapter emitir `end`; `end?=NÃO` = não terminou em `--max-ticks`. No `live` (v1 e v2) o `end` marca o fim do cronograma de alpha (~482 ticks com os defaults), não repouso |
| ticks assent. | primeiro tick após o qual nenhum corpo anda >0,1 px/tick por 20 ticks seguidos (critério cinético, independente do alpha) |
| tempo ms, ms/tick | wall-clock do runner (inclui snapshot por tick, ~desprezível) |
| viol. colisão | pares que COMPARTILHAM nodeLayer e se sobrepõem: folha×folha + container×container + folha×container alheio. Contrato do app = 0 |
| overlap folhas (total) | qualquer par de folhas sobreposto (inclui pares sem layer comum, que o app permite por design) |
| cont×cont / folha×cont alheio | sobreposição visual entre containers não-aparentados / folha invadindo container do qual não descende |
| contenção | filho (folha ou container) fora do rect do pai (>0,5 px) |
| área bbox, aspecto, densid. | bbox de tudo; aspecto = lado maior/menor; densidade = Σárea folhas / área bbox (>1 ⇒ empilhamento) |
| aresta média, aresta/diag | âncora→âncora do router `straight`; e centro→centro em diagonais médias de nó |
| cruzam. / aresta×nó | cruzamentos entre arestas sem endpoint comum (router straight); aresta atravessando folha que não é endpoint |
| determ. | duas execuções idênticas → posições bit-idênticas |
| reaquec. final / pico | warm restart da MESMA IR (o pipeline faz isso a cada edição): deslocamento médio no estado final / pior deslocamento médio em qualquer frame. Ideal 0/0 |
| Δ cold / Δ warm final / pico | média sobre 4 perturbações (−aresta, +aresta, +nó, −nó) do deslocamento médio dos nós comuns; cold = do zero; warm = semeado com o layout anterior, como o `src/app/pipeline.js` faz |

Deslocamento baixo num layout degenerado (tudo empilhado, densidade > 1) não é
mérito: leia sempre junto com `viol. colisão` e `densid.`.

Warm start replica o pipeline: `live.seedPositions` = positions ∪ containers
anteriores, `live.seedAlpha` = alpha final anterior. Adapters estáticos (e o v2,
que hoje ignora seeds) têm warm = cold.

## Limitações conhecidas

- Mede layout, não routing: cruzamentos usam só o router `straight` (sem obstacle
  routing nem waypoints).
- Ainda não separa nós fixos de layout vivo nem traz baselines externos prontos;
  ambos fazem parte do R06 completo (ver `docs/audits/2026-09-30/README.md`).
- Perturbações são em nível de IR (não re-parse do YAML); o nó novo é anexado ao
  fim de `ir.nodes`, como um bloco novo no fim do YAML.
