# Trilha 7 · Motor físico e Fase 4

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito:** A Fase 4 parte da proposta FIEL, escolhida pelos dois juízes: 42 contra 35 e 35 na engenharia, 6,7 contra 6,2 e 4,0 por pilar na lente visual. Ela vem com seis enxertos da perf e os oráculos de teste da xpbd. Os enxertos da perf são: alpha por corpo com sono/wake e diff por id; semente nas portas do perímetro; manifold de 4 pontos no cápsula×cápsula; grid CSR com laço sem alocação; cone de normais; subdivisão adaptativa. Ficam fora do default o XPBD no contato, a reescrita SoA do World e o Worker. Recomendo tornar o v2 default de layout num marco próprio (M6), depois de M2 e M5 e antes do cutover M10, que remove src/routing/physics.

Vence a proposta **fiel**, unânime nos dois juízes: 42 contra 35 e 35 na engenharia, 6,7 contra 6,2 e 4,0 na lente visual. Ela vira a base da Fase 4, com seis enxertos da perf e os oráculos de teste da xpbd.

### Estado atual medido

O núcleo `src/physics` tem 696 linhas, é determinístico e custa 20–53x menos por tick que o v1. Ainda não comporta arestas: seis achados da auditoria bloqueiam a Fase 4.

| achado | evidência no código | medida hoje | alvo |
|---|---|---|---|
| E1-01 v2 nunca emite 'end' | `solver.js:42` (piso em alphaMin) × `compile-world.js:240` (`<`) | 5000 frames sem 'end' | 'end' em ≤ 600 frames |
| E1-02 termo integral ligado | `compile-world.js:42` (Ki 0.04) | KE 3.7 perpétuo; P puro 3.8e-12 | Ki = 0 |
| E1-04 warm restart ignorado | `compile-world.js:81-91` | 93 px médios por edição | < 1 px |
| E1-05 damping por sub-passo | `integrator.js:41` | planeio 45.6 → 5.7 px (1 → 8 sub-passos) | invariante ±1% |
| E1-06 broad-phase com strings | `spatial-grid.js:14-16, 64-75` | 980 KB/tick em N=500 | ~0 KB/tick |
| E1-07 CAPSULE e RAIL1 só constantes | `world.js:29-33` | falso contato a 99 px | colisores derivados |

A auditoria recomendava um híbrido com XPBD para estrutura e contato (E1-16). Os juízes mediram o XPBD e o rejeitaram no default.

### As três propostas na mesma cena

As três modelam a aresta como cadeia de corners 2-DOF com comprimento emergente. Diferem no integrador do contato e no layout de dados.

| proposta | ideia central | protótipo (linhas) | tick 100/150 pinned (ms) | tick 500/1000 pinned (ms) |
|---|---|---|---|---|
| fiel | forças lineares, 2 sub-passos, endpoint atraído ao perímetro | 399 | 2.14 | 54.4 |
| xpbd | projeção complacente, 4 sub-passos | 380 | 2.58 | 42.6 |
| perf | SoA, grid CSR, 1 passo com limitador de Jacobi, sono por corpo | 361 | 0.17 | 5.68 |

Os tempos vêm de `juiz-eng/out/cross.jsonl`, com mesma cena e mesma métrica. A razão real perf/fiel é ~10x, e não a de 5 contra 27.6 ms que as propostas compararam entre cenas diferentes.

| métrica de qualidade | fiel | perf | xpbd | fonte |
|---|---|---|---|---|
| arestas em nó alheio, 4 cenas pinned (arestas) | 0 | 0–6 | 0–4 | juiz-visual/out/scenes.txt |
| arestas em nó alheio, grid500 pinned (arestas) | 0 | 171 | 6 | cross.jsonl |
| arestas no próprio nó, semente centro→centro (%) | ~25 | 0 | 0 | diag-own.txt |
| ticks até quieto, diag100 pinned (ticks) | 113 | 385 | nunca | cross.jsonl |
| arestas distantes após edição, N40 nativo (px) | 53–63 | 0.25 | 8–11 | edit.txt |
| salto no drag, arestas não incidentes (px/quadro) | 11–15 | 11–12 | 54–59 | diag-drag.txt |
| reversões tardias de movimento (fração) | 0 | 0.01–0.02 | até 0.64 | scenes.txt |

### Como os juízes pontuaram

| lente | fiel (pontos) | perf (pontos) | xpbd (pontos) | desempate |
|---|---|---|---|---|
| identidade e visual (5 critérios, 0–50) | 31 | 31 | 19 | média por pilar 6,7 × 6,2 × 4,0 |
| engenharia (6 critérios, 0–60) | 42 | 35 | 35 | compatibilidade 9 × 3 × 8 |

Com performance em peso 2x, a fiel ainda vence por 46 a 44. A perf só passa à frente com peso ≥3x, e o alvo do playground (120 nós) não justifica isso.

### Por que a fiel vence

É a leitura literal do ADR-0012: só forças `f = k·pen`, endpoint atraído por mola e reciprocidade (nota 9 em fidelidade). Tem a geometria mais limpa, com 0 penetração em nó alheio em todas as cenas pinned até 500/1000. É a mais compatível: corners são corpos do World atual (`world.js:72-97`), e o solver já tem sub-passos (`solver.js:32-41`).

As fraquezas dela não estão na lei de forças. O alpha global move 30 px médios num restart sem edição (`juiz-visual/out/diag-editctl.txt`). O custo é de implementação: `vsSeg` ocupa 42.2% do tick, o broad-phase 10.4% e o GC 5.3% (`juiz-eng/out/fiel-prof.txt`).

A perf perde em fidelidade e compatibilidade. O endpoint é uma projeção RAIL, e os nós são pesados (massa 20) e ancorados (khome 0.5). Com massa 1 ela nunca dorme: 605 de 1000 arestas seguem acordadas (`juiz-eng/out/perf-sens-500.txt`).

A xpbd perde nos três pilares visuais. Tem jitter perpétuo, saltos de 54–59 px no drag e não assenta com nós pinados (vFim 11.4 px/tick em grid500).

### Enxertos adotados

| enxerto | origem | problema da fiel que resolve | evidência |
|---|---|---|---|
| alpha por corpo, sono/wake e diff por id | perf | restart global move 30 px; E1-01; E1-04 | edição local: 0.165 px a >600 px (perf-incr.txt) |
| semente nas portas do perímetro | perf, xpbd | ~25% das arestas cruzam o próprio nó | 15→0 e 41→0 (diag-fielport.txt) |
| manifold de 4 pontos no cápsula×cápsula | perf | `vsSeg` = 42.2% do tick | fiel-prof.txt |
| grid CSR em Int32 e laço sem alocação | perf | 1103 Scavenges em 300 ticks; sort = 10.4% | gc-fiel.txt; paridade 9867/9867 |
| cone de normais na quina | perf | troca de face do endpoint (`edges.mjs:156-157`) | 109 → 4 arestas em movimento |
| subdivisão adaptativa | perf | segmentos de até 176 px furam o contato K=4 | 14 fissões e 18 fusões, sem flip-flop |
| oráculos geométricos e lei constitutiva | xpbd | segRect e segSeg sem oráculo | 4000 casos, 0 falhas (xpbd-geo.txt) |

Três peças da perf ficam fora do default. A reescrita SoA do World tirou nota 3 em compatibilidade. O passo único com Jacobi nunca foi medido dentro da fiel, e o Worker não tem medição em navegador.

### Divergências entre os juízes e resolução

| tema | juiz visual | juiz engenharia | resolução |
|---|---|---|---|
| contato da perf | raspa quinas (até 12.3 px) e colapsa paralelas | enxertar manifold, CSR e Jacobi | manifold só no cápsula×cápsula (`edges.mjs:182-214`); cápsula×nó mantém amostras + guarda aditiva |
| 1 sub-passo com Jacobi | não mediu; atribui a raspagem a esse modelo | experimento para cortar metade do custo | experimento no M7; entra só com 0 penetração pinned e 0 cruzamentos no corredor |
| midline fraca | avaliar (giro 20–61° na fiel) | não trata | opcional no M9, por A/B; a fiel alega que ela prescreve a reta |
| Worker ESM | não trata | opcional, após medir no Chromium | pesquisa no M11; `routedEdges` segue como Map (`adapter.js:34`) |
| XPBD no contato | pops de 54–59 px; nota 5 | ciclo-limite na quina; nota 4 | fora do default, contra a auditoria (E1-16); reservado ao snap Manhattan |

Os dois juízes concordam no essencial: base fiel, com sono e alpha local como requisito. A diferença é de ênfase, visual contra custo, e não de direção.

### Limites da evidência

- Tudo foi medido em Node 22 com CPU compartilhada, com ruído de 10–24% entre execuções.
- Ninguém mediu navegador, DOM ou mobile (F-0019). O laço por aresta do renderer faz 5 `querySelector` e 10 `setAttribute` a cada quadro (`src/renderer/edges.js:1-55`).
- Nenhuma proposta reduz cruzamentos topológicos: a fiel fica em 3798 contra 3793 das retas em grid500.
- Ninguém mediu a localidade da edição com layout vivo, sem a âncora khome.
- Com nós pinados, após o drag, a fiel mantém 2 arestas a 14.4 px dentro de nós (`juiz-visual/out/diag-drag.txt`).
- Nenhuma proposta tratou snap declarado no nó (`src/dsl/attr-set.js:61`) nem multi-arestas `[a,b,k]` (`src/dsl/ir.js:335`).

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Fechar o M0 antes de qualquer código de aresta | alto | P | E1-01/02/04/05/09 são P e bloqueiam medir assentamento e edição: hoje o v2 nunca emite 'end' (5000 frames) e cada edição move 93 px. |
| 2 | Adotar a bancada comum pinned/native como gate de regressão da Fase 4 | alto | P | As propostas compararam cenas diferentes (5 contra 27.6 ms); na mesma cena a razão é ~10x. Sem bancada única, nenhum enxerto pode provar paridade de qualidade. |
| 3 | Portar a fiel como base, com semente nas portas do perímetro | alto | M | É a única com 0 penetração em nó alheio até 500/1000 pinned e a mais compatível (nota 9). A semente nas portas zera os ~25% de arestas que cruzam o próprio nó (15→0, 41→0). |
| 4 | Tratar sono/wake, alpha por corpo e diff por id como requisito | alto | M | Sem isso, um restart sem edição move a fiel 30 px médios (até 204 px em N100) e o diagrama nunca para; com o enxerto, arestas distantes movem 0–0.71 px. |
| 5 | Validar os enxertos da perf com massa real dos nós | medio | P | A estabilidade da perf só vale com massa 20 e khome 0.5; com massa 1 ela nunca dorme (605/1000 arestas acordadas). |
| 6 | Tornar o v2 default de layout num marco próprio, antes do cutover | medio | P | Os motivos do adiamento de junho são defeitos corrigíveis (M0, M2). Separar as duas viradas permite saber qual regrediu. |
| 7 | Enxertar a camada de performance dentro do módulo de arestas, sem reescrever o World | medio | M | vsSeg (42.2%), sort (10.4%) e GC (5.3%) explicam o custo da fiel; manifold, grid CSR e laço sem alocação atacam isso sem a reescrita SoA (compatibilidade 3/10). |
| 8 | Reescrever os 13 testes comportamentais do legado antes de apagá-lo | medio | P | Eles especificam trilho, máscaras de camada, fissão/fusão e espalhamento de portas; os 6 estruturais podem sair no cutover. |
| 9 | Adicionar semente de face, offset por parallelKey e espalhamento de portas | medio | M | Nenhuma proposta reduz cruzamentos topológicos (fiel 3798 contra 3793 retas) e multi-arestas colapsam ou trançam; o offset por parallelKey já separou 11–16 px no harness do juiz. |
| 10 | Deixar Worker e WASM para depois de medir no Chromium | baixo | G | Nenhuma medição em navegador existe; o gargalo provável é o renderer (5 querySelector e 10 setAttribute por aresta por quadro), que o Worker não resolve. |

### ADRs candidatas desta trilha

- **ADR-0014 · Arestas como campo de cadeias de forças no World unificado** (confiança alta). Aresta = cadeia de corners POINT/FREE2 no mesmo World; forças lineares F1–F6 (tensão de repouso 0, endpoint atraído ao perímetro com reação ρEnd=alpha, cápsula×nó por SDF amostrada + guarda aditiva, cápsula×cápsula por manifold de 4 pontos, nó×nó P puro); 2 sub-passos; sem XPBD e sem RAIL1 no default; colisores derivados e handles {slot,gen}.
- **ADR-0015 · Regra de passo das zonas lineares** (confiança media). Velocidade de aproximação abaixo de ~z·√(k/m) (cap 8 px/tick com arestas); carga abaixo de k·z (kCross≈kRep); damping expresso como taxa por dt; drag em passos limitados ao cap.
- **ADR-0016 · Assentamento por sono/wake e alpha local por corpo** (confiança alta). Alpha por corpo decaindo até 0; sono por janela de deslocamento (1 px em 30 ticks); wake adiado; força normal em cache para aresta dormindo; tick() devolve false e o rAF para; diff por id na edição (só o novo nasce quente).
- **ADR-0017 · Layout adapter pode fornecer roteamento (providesRouting)** (confiança media). Um layout adapter pode declarar caps.providesRouting=true e entregar routedEdges; o pipeline então pula applyObstacleRouting, clip e snap. Com live v2 após o cutover, routing.engine 'unified' é o default recomendado; com custom/off, o algébrico continua como fallback.
- **ADR-0018 · Máscaras de colisão em bitset e semântica de massa × peso por camada** (confiança media). Categoria/colisão em bitset por classe de colisor, grupos de exclusão precomputados (endpoints, ancestrais, adjacentes) e pad por elemento com gate padA+padB (E1-11); definir por escrito a regra de massa por camada.
- **ADR-0019 · v2 como default de layout** (confiança media). Tornar live.engine 'v2' o default no M6, depois do núcleo saneado, dos containers como corpos e do assentamento local, em release separada do cutover de routing.
- **ADR-0012 passa a superseder ADR-0009 (remoção do routing físico anterior)** (confiança alta; supersede ADR-0009). No M10, remover src/routing/physics e F-0017; ADR-0009 recebe superseded_by: ADR-0012; o ADR-0012 ganha emenda com os antídotos medidos e a expectativa de cruzamentos topológicos.

### Sugestões de evolução do processo desta trilha

- `bench-mesma-cena-mesma-metrica` (new-rule) → AGENTS.md (seção de avaliação/benchmarks) e bench/fase4/: As propostas do motor compararam números de cenas diferentes (5 contra 27.6 ms); na mesma cena a razão real era ~10x. Só o bench cruzado do juiz revelou isso.
- `teste-de-termino-com-raf-falso` (new-rule) → AGENTS.md (regra para loops de simulação) e tests/layout/compile-world.test.js: O E1-01 (v2 nunca emite 'end') passou pela suíte porque o teste parava em alpha 0.005 e o loop de rAF não tinha cobertura.
- `localidade-por-polilinha-inteira` (heuristic-fix) → estratégia de testes da Fase 4 (bench/fase4/): A métrica de localidade da edição da perf media só endpoints (run.mjs:41); o juiz refez com Hausdorff da polilinha e com controle de restart sem edição.
- `sensibilidade-fora-do-ponto-calibrado` (heuristic-fix) → playground/physics-playground.html e revisão de propostas de física: O protótipo perf só era estável com massa 20 e khome 0.5; com massa 1 nunca dormia. Protótipos de física devem declarar o ponto calibrado e rodar variações.
- `plano-fase-4-no-repo` (doc-gap) → .feat-memory/proposals/ (plano da Fase 4 versionado): O plano escrito da Fase 4 não estava no repo e precisou ser refeito a partir de protótipos externos.
- `reavaliar-evidencia-a2-playground` (doc-gap) → ADR-0012 (seção de antídotos) e playground A2: O cenário A2 do playground, citado como evidência de que sub-stepping doma rigidez, mistura menor dt com damping 0.82^N (E1-05).
- `skill-physics-bench` (new-skill) → skills/physics-bench: Mudanças em src/physics exigem comparar bancada pinned/native com baseline (qualidade e ms/tick) antes do push, fora do node --test padrão.
- `gate-alocacao-opt-in` (new-rule) → AGENTS.md (gate opt-in de alocação com --trace-gc para src/physics): As armadilhas de alocação do V8 (double de phi como argumento, let de módulo com double) voltam com refactors inocentes; a perf caiu de 604 KB/tick para 1 KB/tick só com correções pontuais.

### Fontes

- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dossie.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/cache-parcial.json (auditoria e propostas fiel/xpbd)
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/proposta-fiel/edges.mjs:6-14, 140-227
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-eng/out/cross.jsonl
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-eng/out/fiel-prof.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-eng/out/perf-sens-500.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-visual/out/diag-fielport.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-visual/out/diag-editctl.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-visual/out/edit.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-visual/out/diag-drag.txt
- /home/user/tensegrams/src/physics/solver.js:32-44
- /home/user/tensegrams/src/physics/integrator.js:12-14, 23, 41
- /home/user/tensegrams/src/physics/world.js:1-8, 29-33, 72-74
- /home/user/tensegrams/src/layout/compile-world.js:40-44, 86-92, 160-165, 236-252, 270-284
- /home/user/tensegrams/src/app/pipeline.js:23, 168, 170-215
- /home/user/tensegrams/src/layout/adapter.js:28-40
- /home/user/tensegrams/src/layout/adapters/live/index.js:47
- /home/user/tensegrams/src/renderer/edges.js:1-55
- /home/user/tensegrams/src/dsl/attr-set.js:61
- /home/user/tensegrams/src/dsl/ir.js:335
- /home/user/tensegrams/src/routing/snap-resolver.js:25-40
- /home/user/tensegrams/src/shapes/index.js:1-25
- /home/user/tensegrams/tests/routing/physics/ (19 arquivos, triados por describe/test)
- /home/user/tensegrams/.feat-memory/decisions/0009-physics-routing-opt-in.md
- /home/user/tensegrams/.feat-memory/decisions/0011-force-zone-linear-zone-x-zone.md
- /home/user/tensegrams/.feat-memory/decisions/0012-edges-driven-by-force-tendencies.md
- /home/user/tensegrams/.feat-memory/decisions/0013-plugin-architecture-layout-routing.md:34
- /home/user/tensegrams/.feat-memory/suggestions.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/sintese/report.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/sintese/plano.md

## Apêndice A · Julgamentos

### Lente: Identidade e qualidade visual. Três pilares: (1) fidelidade ao ADR-0012 — arestas movidas por tendências de força, movim

**Vencedor:** fiel — com enxertos OBRIGATÓRIOS do perf: alpha por aresta/corpo + sono/wake + diff por id na edição, e semente da cadeia nas portas do perímetro. Sem eles, o fiel perde o mapa mental a cada edição (30 px médios só pelo restart) e deixa ~25% das arestas atravessando o próprio nó.

## Método (juiz da lente visual)

Pasta de trabalho: `/tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-visual/`. O repo segue intocado (`git status` = 0 linhas).

1. **Reprodução.** Rodei os protótipos com os comandos que as próprias propostas indicam; as saídas estão em `repro/`.
2. **Harness comum.** Montei um harness que importa cada protótipo sem alteração (`adapters.mjs`) e roda os três na mesma cena neutra: grade 210×130 centrada na origem, M=1,5N arestas (`common.mjs:sceneGen`).
   - As métricas são idênticas para os três e calculadas só a partir do que o usuário vê: polilinhas de saída e retângulos dos nós (`common.mjs:quality/createMotion`).
   - Gero PNGs em `png/` para inspeção visual.
3. **Dois modos de rodada:**
   - **nós pinados** — compara só o roteamento, em condições idênticas;
   - **nativo** — cada proposta com a dinâmica de nós que ela mesma define. No perf os nós ficam ancorados por khome=0.5 (`proto.mjs:10,197-198`); no fiel e no xpbd há atrator central 0.012·α.
4. **Experimentos:**
   - `juiz.mjs scenes`: N40 com seeds 1–3 e N100 com seed 1, 1500 ticks;
   - `juiz.mjs micro`: multi-aresta, hub, empate, feixe;
   - `juiz.mjs edit`: +1 nó e +2 arestas sobre o diagrama assentado;
   - `diag-drag.mjs`: nó arrastado 600 px;
   - `diag-editctl.mjs`: controle;
   - `diag-own.mjs`, `diag-fielport.mjs`, `diag-multiseed.mjs`, `diag-crop.mjs`: diagnósticos.

### Evidência-chave (mesma cena, mesmas métricas)

**Nós pinados** — sequência de valores nas cenas N40 s1/s2/s3 e N100 s1 (`out/scenes.txt`):

| métrica | perf | fiel | xpbd |
|---|---|---|---|
| arestas atravessando nó alheio | 0/4/1/6 (até 12,3 px) | **0/0/0/0** | 3/0/1/4 (16–20 px, presas, não saem) |
| arestas atravessando o **próprio** nó | 0 | **15/14/14/41 (~25%)** | 0 |
| pares de arestas cruzados (retas porta→porta: 33/29/17/41) | 40/50/38/70 | 42/57/41/77 | 40/58/40/73 |
| portas coincidentes (<4 px) | 15–27 | 1–7 | 13–20 |
| giro médio por aresta | 5–7° | 20–35° | 6–16° |
| parada (política de cada proposta) | 326–492 ticks (dorme) | 111–249 (v<0,1) | 481 (alpha) |
| reversões tardias (jitter) | 0,01–0,02 | 0 | **até 0,64** (0,44 px/quadro, perpétuo) |

**Modo nativo:**

| métrica | perf | fiel | xpbd |
|---|---|---|---|
| penetração | 0–4 (até 9 px) | 0 | 0 |
| giro médio | 4–6° | 41–61° | **76–95°** (sinuoso; zig até 26 em N100) |
| portas coincidentes | 14–26 | 0–5 | 12–43 |
| pares sobrepostos | 0–1 | 0–1 | até 14 |
| parada | 279–366 | **640–1270** | 481, ainda andando até 2,2 px/quadro |

**Micro-cenas** (`out/micro.txt`):
- **Multi-aresta** — o DSL suporta `[a,b,1]`/`[a,b,2]` (`tests/dsl/ir.test.js:62-74`):
  - perf e xpbd colapsam as 3 arestas numa linha só (spread 0; 891 px sobrepostos);
  - o fiel as separa (24 px), mas elas se trançam.
- **Hub:** perf e xpbd põem 2 arestas por quina (0 px entre portas); fiel fica em 2,4 px.
- **Feixe torcido:** pares sobrepostos — perf 10, fiel 6, xpbd 11.

**Edição (+1 nó +2 arestas)** — deslocamento das arestas distantes / dos nós (`out/edit.txt`, `out/diag-editctl.txt`):
- **Pinado:**
  - perf: 0 px;
  - fiel: 0 px;
  - xpbd: 21,6–30,5 px (α0=0,5), porque o empurrão de cruzamento (crossCap·α) é religado.
- **Nativo N40** (nós médio, arestas distantes máx):
  - perf: nós 0,33 px, arestas 0,25 px;
  - fiel: nós 28–31 px, arestas 53–63 px;
  - xpbd: nós 4–8 px, arestas 8–11 px.
- **Controle:** um restart a quente **sem edição** já move o fiel 30–32 px e o xpbd 3,5–7 px. Quem destrói o mapa mental é o alpha global, não a edição.

**Drag** — nó arrastado 600 px (`out/diag-drag.txt`):
- Salto máximo por quadro das arestas não incidentes:
  - perf: 11–12 px;
  - fiel: 11–15 px;
  - xpbd: **54–59 px**.
- Penetração 400 ticks depois de soltar (nativo): perf 2–4, fiel 0, xpbd 0.
- Movimento residual (nativo): perf 0, fiel 0,3–0,5 px/quadro, xpbd 2,7–5 px/quadro.

## Notas (0–10)

| Critério | perf | fiel | xpbd |
|---|---|---|---|
| **1. Fidelidade ao ADR-0012 / tensegridade** | **6** — Forças lineares recíprocas, midline e comprimento emergente, como no ADR. Mas o endpoint é restrição RAIL (projeção a cada passo, `proto.mjs:232-233`), não "atraído". O sono congela por limiar. Os nós ficam ancorados (khome=0.5): a tração aresta→nó mal aparece (17 px) e não foi testada com layout real. | **9** — Leitura literal do ADR: só forças f=k·pen; endpoint atraído por mola ao perímetro com reação ρEnd=α; sub-stepping; subdivisão fixa; reciprocidade; nenhuma projeção. Só dispensa a midline, com argumento. | **5** — A tese α=1/k confere no equilíbrio, mas o movimento é de projeção: núcleo e trilho com α=1e-3 e passe de velocidade com restituição 0. Os saltos de 55–59 px num quadro no drag mostram isso. O acoplamento recíproco é o mais forte (compacta o layout). |
| **2. Legibilidade estática** | **6** — Formas mais retas e limpas (giro 4–7°, zig 0–1) e menos cruzamentos (−5 a −10%). Mas 0–6 arestas raspam quinas de nós alheios, até 12,3 px (21,5 px persistentes após drag, pinado). | **6** — Único com 0 penetração em nó alheio nas 8 rodadas. Porém 25–27% das arestas atravessam o próprio nó e a seta fica escondida sob o nó em 9/60 e 25/150 (`out/diag-own.txt`); a causa é a semente centro→centro (`edges.mjs:7-13`). Com semente nas portas o problema zera (15→0, 41→0; `out/diag-fielport.txt`). | **4** — Nativo: 0 penetração, mas o layout compacta e as arestas ficam sinuosas (giro 76–95°, até 14 pares sobrepostos). Pinado: 3–4 arestas presas atravessando nós a 16–20 px (`png/crop-N40s1-pen-xpbd-e36-view-*.png`). |
| **3. Paralelas, feixes e portas** | **3** — Multi-arestas viram 1 linha. Portas se acumulam nas quinas (setas sobrepostas). | **6** — Separa multi-arestas (24 px), mas trançadas. Portas distintas. Menor sobreposição no feixe torcido. | **3** — Multi-arestas coincidentes; com obstáculo trançam e dividem a porta. Hub nas quinas. Pior sobreposição no feixe. |
| **4. Movimento vivo** (suavidade, jitter, pops, parada, drag) | **8** — Para rápido e dorme (0 jitter, custo 0); reversões 0,01–0,02; saltos ≤11,3 px. Deslizes rápidos tardios (5,5 px/quadro). Não "respira". | **7** — Movimento mais suave medido (reversões ≈0, sem pops). Parada limpa quando pinado. No nativo leva 11–21 s a 60 fps, e N100 ainda deriva. | **3** — Jitter perpétuo (64% de reversões); N100 não assenta; o término por alpha congela em movimento; pops de 55–59 px no drag; cauda de 3–5 px/quadro. |
| **5. Mapa mental na edição** | **8** — Edição local de verdade: arestas distantes 0–0,7 px, pico de 14–15 arestas acordadas. Ressalva: nós ancorados pelo khome. | **3** — Perfeito com nós pinados. Com layout vivo, o restart com alpha global move tudo (30 px médios só pelo restart; até 204 px em N100). | **4** — O alpha global religa o empurrão de cruzamento: arestas distantes andam 21–30 px mesmo pinadas; no nativo até 142 px. |
| **Soma** | **31** | **31** | **19** |
| **Média por pilar** (fidelidade; legibilidade = média de 2 e 3; vivo = média de 4 e 5) | 6,2 | **6,7** | 4,0 |

**Desempate e decisão.** Perf e fiel empatam na soma. Pela média por pilar vence o **fiel**: o ADR-0012 é requisito do mantenedor, e o fiel produz a geometria mais limpa (zero penetração) com o movimento mais orgânico.

O que falta ao fiel é justamente o que o perf tem de melhor, e isso é ortogonal à lei de forças:
- alpha local e sono/wake;
- diff por id.

Essas peças enxertam de forma direta. O caminho inverso não é simples: o modelo de contato do perf (SAT com kr=0.4, Jacobi, 1 passo) raspa quinas e colapsa paralelas. O xpbd fica atrás nos três pilares.

**Enxertos:**

- [perf → fiel, obrigatório] Alpha POR ARESTA/CORPO decaindo até 0, sono por janela de deslocamento (1 px em 30 ticks), wake adiado para o tick seguinte e força em cache no nó para aresta dormindo (proto.mjs:61-64, 211-244). Mais diff por id na edição, em que só o novo nasce quente. Medido: arestas distantes 0–0,71 px contra 53–204 px do fiel com restart global. O controle mostra que o restart sozinho já move o fiel 30 px (out/diag-editctl.txt). Também dá repouso real (tick→false, 0 jitter).
- [perf/xpbd → fiel, obrigatório] Semear a cadeia reta entre pontos de PERÍMETRO (perim de proto.mjs:46-51, ou port de xpbd-edges.mjs:97-98) em vez de centro→centro (edges.mjs:7-13). Verificado: arestas atravessando o próprio nó 15→0 (N40) e 41→0 (N100); desvio máximo 1,71→1,05; assentamento pinado 249→122 ticks (out/diag-fielport.txt).
- [perf → fiel] Subdivisão adaptativa dentro de bloco fixo: fissão acima de 1,25·Lmax, fusão por segmento curto ou colinear, cooldown de 40 (proto.mjs:171-190). O perf mediu 14 fissões e 18 fusões sem flip-flop. Isso resolve o segMáx de 176 px do fiel, que abre buracos no contato amostrado K=4. Nas minhas medições nenhum pop visual veio da topologia (out/diag-pops.txt: 0 quadros com mudança de topologia após t200).
- [perf → fiel, avaliar] Midline fraca (km) como opção. O ADR-0012 cita 'molas de cadeia/midline', e o perf tem zig 0–1 e giro 4–7° contra zig 2–11 e giro 20–61° do fiel. Calibrar para não prescrever a reta.
- [perf → fiel] Testes de propriedade da lente, levados ao gate: (a) localidade da edição, com arestas a mais de 600 px deslocando menos de 0,5 px medido na POLILINHA INTEIRA, não só nos endpoints como em run.mjs:41; (b) cena termina com tick ocioso abaixo de 50 µs; (c) sem sleep, 0 corners acima de 0,05 px/tick após 1500 ticks.
- [xpbd → fiel] Geometria exata testada por propriedade como oráculo do narrow-phase: segBox (Liang–Barsky + SAT) e segSeg (menor translação que descruza), com 4000 casos (xpbd-edges.mjs:34-89, run.mjs geo).
- [xpbd → fiel] Ideia de zona macia + núcleo firme, implementada como força aditiva rígida e contínua (evolução da guarda aditiva do fiel), não como projeção. Ataca o limite de densidade do fiel (N≥200: 54 segmentos penetrando até 5,8 px) sem trazer os pops de projeção que medi no xpbd (55–59 px por quadro no drag).
- [xpbd/fiel → vencedor] Pré-passo discreto de SEMENTE de lado/face (face-select.js:87 do legado), sem prescrever rota. Nos três, a repulsão local não reduz cruzamentos topológicos; no meu harness os cruzamentos ficaram 20–140% acima das retas porta→porta.
- [xpbd → fiel] Expor ρ como knob de pesquisa: 0 (compatível), α (default) e 'fixo' (modo 'vivo/tensegridade'). É explorar a identidade sem mudar o default.
- [juiz, nenhuma proposta tem] Quebra de simetria das multi-arestas [a,b,k]: offset perpendicular determinístico por parallelKey na semente. Verificado: separação de 11–16 px e 0 cruzamentos entre elas nas 3 propostas (out/diag-multiseed.txt).
- [juiz, legado] Espalhamento de endpoints na face (src/routing/physics/forces-endpoint-bbox.js, clamp Q11). Cadeias com repouso 0 levam as portas às quinas: portas coincidentes 14–43 no perf e no xpbd, 0–7 no fiel. Com setas (endStyle default 'filledArrow'), elas se sobrepõem.

**Alegações verificadas:** ## Reproduzido

**PERF** — métricas idênticas às registradas (código determinístico):
- **bench:** dorme no tick 504; retas 2888 cruzamentos / 483 penetrações contra final 3305 / 154; controle sem sleep 3308 / 156; tick mediano 5,53 ms contra 5,6 declarado (`repro/perf-bench.txt`).
- **incr:** 74 ticks, pico de 56/1002 arestas, 0,165 px nas distantes; caso "longa" 398 ticks e 12,27 px (`repro/perf-incr.txt`).
- **diag-cross:** anti-cruzamento −8% com saturação; sem desvio de nós, −18% de cruzamentos e +21% de penetração (`repro/perf-cross.txt`).

**FIEL:**
- **A:** as 9 cenas batem bit a bit nas métricas; determinismo confirmado (`repro/fiel-A.txt`).
- **F (corredor):** idêntico — 0 cruzamentos com K=4/8/12 e 4 com K=16 (`repro/fiel-F.txt`).

**XPBD:**
- **scene:** idêntico nas métricas — N40 assenta em 353; N100 não assenta; pen=0 contra 23/82 das retas; cruzamentos 42/95/247 (`repro/xpbd-scene.txt`).
- As linhas `dial` que citei vêm da saída registrada (`out/dial.txt`); não rodei `dial` de novo.

## O que não bateu ou foi omitido

1. **XPBD, "pen = 0 contra nós alheios"** — só vale quando os nós podem sair do caminho.
   - Com nós pinados, 3–4 arestas ficam PRESAS atravessando nós a 16–20 px e nunca saem. Crop em `png/crop-N40s1-pen-xpbd-e36-view-xpbd.png`, em que perf e fiel contornam o mesmo nó.
   - O caso é realista: o compile-world congela os outros nós durante o drag.
   - A razão "1,8–2,4x as retas" deu 1,56x em N40, 2,5x em N100 e 1,89x em N200; a métrica é por par de segmentos.
2. **FIEL, "gap do endpoint 2,4–7,8 px"** — a métrica conta a profundidade DENTRO do nó como gap (`run.mjs:88-90`), e a proposta não reporta o efeito disso.
   - 15/120 e 41/300 endpoints ficam >1 px dentro do próprio nó.
   - 25–27% das cadeias atravessam o próprio nó; a seta fica escondida em 9/60 e 25/150 arestas (`out/diag-own.txt`).
   - A causa é a semente centro→centro; confirmei que semear nas portas zera o defeito.
   - "Cruzamentos −10% a +12% das retas" vale na cena deles. Na minha cena neutra deu +27% a +141%, na mesma faixa das outras duas propostas.
3. **PERF, "arestas a >600 px moveram ≤0,165 px"** — `run.mjs:41` mede só os dois endpoints.
   - Refiz com a polilinha inteira (Hausdorff): 0–0,71 px. A alegação se sustenta.
   - Porém os nós estão ancorados por khome=0.5 (`proto.mjs:10,197`). O protótipo não tem layout real, então a parte "nós não se mexem" é premissa, não resultado.
   - O resumo omite que o perf colapsa multi-arestas numa linha só e acumula portas nas quinas.

## Não verificado

- perf: scale, alloc, worker, giant.
- xpbd: tend, sweep, geo, det, recip.
- fiel: B, C, D, E, G.
- Comportamento em navegador ou SVG real. Nos meus PNGs as arestas estão desenhadas sobre os nós; no renderer real os nós ficam por cima (`src/renderer/index.js:16-17`), o que esconde o trecho auto-penetrante do fiel, mas não a seta.

## Viés corrigido

A primeira rodada usou uma cena não centrada: o atrator central de fiel/xpbd puxava tudo para (0,0). Descartei essa rodada (guardada em `out/v1-descentrado/`) e refiz tudo centrado.

### Lente: ENGENHARIA. Critérios: estabilidade numérica demonstrada, performance medida, esforço e risco, testabilidade, incrementa

**Vencedor:** fiel

## Veredito

**Vencedor: FIEL, como base, absorvendo a camada de execução da PERF e os testes da XPBD.**

- A FIEL é a proposta mais compatível com o código atual e a mais incremental.
- Tem a melhor qualidade de desvio demonstrada: 0 penetração em todas as cenas `pinned`, até 500/1000.
- É a que assenta mais rápido com o layout fixo: fica quieta em 113, 116 e 165 ticks.
- A fraqueza dela é o custo por tick, cerca de 10x o da PERF na mesma cena. Mas o perfil mostra que esse custo vem de implementação, não de arquitetura, e é exatamente o que a PERF sabe resolver.
- A PERF é a melhor engenharia de performance. Porém, a estabilidade dela só foi demonstrada num ponto calibrado com nós pesados, ela deixa 6–17% das arestas atravessando nós e exige reescrever o núcleo.
- A XPBD não explode, mas quase nunca assenta e é a mais cara.

## Benchmark cruzado (juiz-eng/out/cross.jsonl; mesma cena e mesma métrica; Node 22; load 1.1–1.8)

| cena (N/E) | modo | motor | ms/tick mediana (p95) | quieto / dorme (tick) | CPU até quieto | arestas furando nó alheio (máx px) | pares cruzados (retas) | vFim |
|---|---|---|---|---|---|---|---|---|
| diag100 (100/150) | pinned | perf | **0.17** (1.9) | 385 / 523 | 189 ms | 9 (19.0) | 81 (95) | 0 |
| diag100 | pinned | fiel | 2.14 (3.7) | **113** | 399 ms | **0** | 95 (95) | 0 |
| diag100 | pinned | xpbd | 2.58 (4.2) | nunca | — | 4 (**46.7**) | 90 (95) | 1.86 |
| diag200 (200/300) | pinned | perf | **0.43** (2.6) | 310 / 436 | 333 ms | 18 (17.4) | 185 (227) | 0 |
| diag200 | pinned | fiel | 5.03 (6.5) | **116** | 869 ms | **0** | 227 (227) | 0 |
| diag200 | pinned | xpbd | 6.47 (11.0) | 333 | 2756 ms | 4 (42.2) | 220 (227) | 0.03 |
| diag100 | native | perf | **0.19** (1.5) | 324 / 414 | 218 ms | 5 (10.2) | 86 (95) | 0 |
| diag100 | native | fiel | 4.17 (5.0) | nunca (1500) | — | **0** | 95 (99) | 0.32 |
| diag100 | native | xpbd | 8.03 (11.9) | nunca | — | **0** | 95 (102) | 0.77 |
| grid500 (500/1000) | pinned | perf | **5.68** (9.3) | 478 / 636 | **2.55 s** | 171 (17.5) | 3374 (3793) | 0 |
| grid500 | pinned | fiel | 54.4 (71.0) | **165** | 11.1 s | **0** | 3798 (3793) | 0.001 |
| grid500 | pinned | xpbd | 42.6 (61.1) | nunca | — | 6 (45.1) | 3794 (3793) | 11.4 |
| grid500 | native | perf | 5.46 (13.5) | 455 / 504 | 2.7 s | 176 (13.0) | 3305 (3662) | 0 |
| grid500 | native | fiel | 80.0 (96.0) | nunca | — | 5 (1.7) | 3784 (3748) | 8.5 |
| grid500 | native | xpbd | 150.6 (237.5) | nunca | — | 61 (21.8) | 3974 (3735) | **58.2** |

**Leitura da tabela:**
- No modo `native` com 500 nós, o atrator central de FIEL e XPBD colapsa o grid: deslocamento médio de 1191 e 2339 px. A PERF segura os nós no "home".
- A comparação justa de routing é a do modo `pinned`.
- Nenhuma das três reduz de forma relevante os cruzamentos topológicos. FIEL e XPBD ficam iguais às retas; a PERF fica 11–18% abaixo, em parte porque atravessa nós.

**Achado extra — PERF fora do ponto calibrado** (out/perf-sens-200.txt, out/perf-sens-500.txt):
- O protótipo usa nós com nInv=0.05 (massa 20) e khome=0.5.
- Com nInv=1, a massa usada por FIEL e XPBD, ele **nunca dorme**: 605 das 1000 arestas continuam acordadas e os nós ficam presos no vcap de 5.66 px/tick.
- A causa: o limitador de Jacobi só vale para corners (proto.mjs:230); os nós integram com nInv fixo (proto.mjs:223).
- Estendi o Jacobi aos nós com ~8 linhas (juiz-eng/proto-jn.mjs). Com isso o sistema dorme no tick 539, mas 2 das 6 variantes de khome ainda não dormem.

**Perfis de CPU:**
- FIEL (out/fiel-prof.txt):
  - 42% do tempo em `vsSeg`: 2×K=8 amostras ponto×segmento com `Math.hypot`, por par e por sub-passo;
  - 10% no sort do broad-phase;
  - 5% em GC; foram 1103 Scavenges em 300 ticks, contra 768 da XPBD e 144 da PERF (este, basicamente o próprio harness).
- XPBD (out/xpbd-prof.txt): o custo fica espalhado pelo passe de restrições, repetido nos 4 sub-passos.

## Notas (0–10)

| critério | FIEL | XPBD | PERF |
|---|---|---|---|
| **Estabilidade numérica demonstrada** | **7** — Cenas A: 9/9 finitas e quietas entre os ticks 554–1155, reproduzidas bit a bit. Corredor: 0 cruzamentos até K=12. `pinned`: quieta em 113/116/165 ticks com 0 penetração, a melhor. Contra: `native` diag100 não fica quieta em 1500 ticks (vFim 0.32), 500/1000 `native` quebra (overlap 13 px), e dependência de 2 sub-passos + cap 8. | **4** — 0/30 explosões e lei α·F exata, reproduzidas. Mas não assenta: N=100 `native` nunca (v@481 = 2.3); `pinned` diag100 e grid500 nunca, com ciclo-limite no endpoint junto à quina do nó (out/xpbd-pinned-diag.txt) e vFim de 11.4 px/tick. Penetração de até 46.7 px com nós fixos. vFim de 58 > cap em grid500 `native`. | **6** — Dorme no tick 504 em 500/1000, reproduzido. Momento 2.7e-15; sleep ≈ sem sleep. Oito defeitos diagnosticados com evidência. Mas só no ponto calibrado: com nós de massa 1 nunca dorme. A correção é barata, mas não foi proposta. Resíduo de 6–17% das arestas atravessando nós. |
| **Performance medida** | **4** — 2.1 / 5.0 / 54 ms por tick (`pinned` 100/200/500); 80 ms em 500/1000 `native`. Cerca de 10x a PERF na mesma cena. Medição honesta, mas implementação cara (closures, 8 `hypot` por par, sort, GC). Teto de ~150 nós a 60 fps. | **3** — 2.6 / 6.5 / 42.6 ms `pinned`; 8.0 ms em diag100 `native`; 150 ms em 500/1000 `native`. Os 4 sub-passos multiplicam o passe inteiro. Teto de ~100/150. | **9** — 0.17 / 0.43 / 5.7 ms `pinned`: 10x a FIEL e 7–15x a XPBD. CPU até assentar 2.5 s, contra 11.1 s da FIEL. 0 GC reproduzido (980 B/tick). Tick ocioso 3–32 µs. Edição local 72 ms contra 2.2 s. Worker a 5.8 ms. Perde 1 ponto por não ter medição em navegador/DOM. |
| **Esforço e risco** (10 = baixo) | **7** — Cerca de 20–30 linhas no núcleo + módulo de ~230 linhas. Reusa World, solver e a lei da collision.js. Riscos: teto de densidade, custo por tick e gap cosmético do endpoint (2.4–7.8 px). | **5** — Nenhuma mudança no solver. Mas precisou de 3 mecanismos descobertos por trace (passe de velocidade, manifold, zona+núcleo) e de SAT heurístico; ciclos-limite abertos; a migração nó×nó PI→XPBD mexe no layout atual. | **4** — Reescrita do núcleo (world.js AoS→SoA, solver, spatial-grid, collision, compile-world e as 646 linhas de teste de física/compile-world), mais Worker e render incremental. Heurísticas sem literatura (κ, rampa, ^4, janela de 1 px), armadilhas de alocação do V8 e a dependência de nós pesados que a proposta não declarou. |
| **Testabilidade** | **7** — P1 1e-8, P2 e P3 20/20 reproduzidos. Corredor como teste-contrato determinístico e barato. Teste metamórfico da regra de barreira. Falta oráculo geométrico para segRect/segSeg e um sinal binário de término. | **8** — Oráculos geométricos (4000 casos, erro ≤ 3.7e-3 px, 0 falhas), lei constitutiva, fuzz sem cap, momento 2.6e-8, determinismo 0/9216: tudo reproduzido. O término depende de alpha, porque o repouso não é garantido. | **8** — Paridade broad × força bruta 9867/9867, momento, determinismo bit a bit, término binário (`tick()` devolve `false`, fácil com rAF falso), equivalência sleep on/off, localidade, alocação opt-in. Contra: limiares presos a heurísticas calibradas; o teste de término só passa com nós pesados. |
| **Incrementalidade do plano** | **8** — M0 (≤ 30 linhas) → M1 módulo isolado sem UI → M2 atrás de flag → M3–M6, cada marco com critério numérico. Senão: M5 apaga o legado antes de M6 portar fissão/fusão. | **7** — Marcos coerentes, mas M2 troca o nó×nó do PI para XPBD antes de haver arestas (risco sem ganho visível) e M3 aceita "N=40 assenta" (barra baixa). | **5** — M0 e M2–M5 são bons. Mas M1 troca o store do World por SoA para nós e contributors existentes antes de qualquer aresta (big-bang), M6 (Worker + renderer) é grande e a flag só aparece no M2. |
| **Compatibilidade (src/physics, compile-world, ADR-0013)** | **9** — Corners como corpos do World (world.js:72-97); sub-passos do solver já existentes (solver.js:32-41); lei nó×nó da collision.js; o pipeline já lê `routedEdges` (pipeline.js:179). Reconhece que a ADR-0013 precisa de emenda (`providesRouting`). | **8** — Contributor + constraint no `createSolver` sem mudança; `dampingOrder:'before'` já existe (integrator.js:12-14, 37-39). Mas as constraints atuais zeram a velocidade (constraints/index.js:19-33) e a fase XPBD precisa de outro contrato de v; substitui o PI da collision.js. | **3** — Núcleo autônomo que não importa src/physics; troca o AoS Float32 (world.js:1-26) por SoA Float64. `routedEdges` como buffer Float32 + `cnt` diverge de `Map<string, RoutedEdge>` (adapter.js:34), e o Worker torna a sessão assíncrona. Ponto positivo: src/physics só usa imports relativos (verificado). |
| **Total (pesos iguais)** | **42** | **35** | **35** |

**Sensibilidade aos pesos:**
- Com performance em peso 2x: FIEL 46, PERF 44, XPBD 38.
- Só com performance ≥ 3x a PERF passa à frente (53 contra 50).
- Não vejo justificativa para esse peso:
  - a ambição é pesquisa;
  - o alvo do playground (I2) é de até 120 nós e 60 arestas, faixa em que a FIEL roda a 2–4 ms;
  - as técnicas que dão a velocidade da PERF (laço sem alocação, manifold de 4 pontos, grid CSR, sleep/alpha local) são enxertáveis dentro do módulo de arestas da FIEL sem reescrever o World.

**Enxertos:**

- PERF → laço quente do campo de arestas sem closures e sem alocação por tick, mais um teste opt-in de alocação (--trace-gc ou HeapProfiler abaixo de 5 KB/tick). Hoje a FIEL cria closures a cada `apply` (edges.mjs:143-186) e soma 1103 Scavenges em 300 ticks, contra 144 da PERF (out/gc-*.txt), com 5% de GC no perfil.
- PERF → cápsula×cápsula por manifold de 4 pontos (ponta×segmento, peso ½ nas juntas) com rejeição por d² antes da raiz (proto.mjs:84-90, 106-108), no lugar das 2×K=8 amostras `vsSeg` com `Math.hypot`. `vsSeg` sozinho responde por 42% do tempo da FIEL (out/fiel-prof.txt).
- PERF → broad-phase grid-hash CSR em Int32: dedupe por célula de referência, lista à parte para corpos grandes e consulta só por corpos acordados (proto.mjs:139-161). Paridade com força bruta: 9867/9867, 0 duplicados (reproduzido). Substitui o `Float64Array.sort` por tick da FIEL (10% do tempo) e resolve o E1-06.
- PERF → sleep/wake por corpo com janela de deslocamento (1 px em 30 ticks), wake adiado para o tick seguinte, força normal em cache para arestas dormindo e alpha por aresta sem piso (proto.mjs:61-64, 211-244). Dá término binário (`tick()` devolve `false`) e resolve o E1-01 por construção. Resolve também o E1-04: numa edição local, as arestas a mais de 600 px movem no máximo 0.165 px, em 72 ms contra 2.2 s re-semeando (reproduzido). Também absorve os ciclos-limite locais que vi na FIEL `native` (vFim 0.32) e na XPBD `pinned`.
- PERF (com correção do juiz) → limitador de rigidez por corpo (Jacobi): a = F·min(1/m, κ/ΣK), com rampa de rigidez de contato, aplicado a TODOS os corpos, inclusive nós. Sem isso, nós com massa 1 não assentam; com a extensão, o sistema dorme no tick 539 (juiz-eng/proto-jn.mjs, out/perf-sens-500.txt). Na FIEL, entra como experimento para cair de 2 para 1 sub-passo (metade do custo); não verificado na FIEL.
- PERF → cone de normais no endpoint quando ele está na quina do nó (proto.mjs:219). O ciclo-limite residual da XPBD com nós fixos é exatamente esse caso: aresta 10, corners 0–2, junto à quina (out/xpbd-pinned-diag.txt). A FIEL projeta o endpoint na face mais próxima (edges.mjs:156-157) e está sujeita ao mesmo chaveamento.
- PERF → diff incremental por id com capacidade reservada e blocos de corners por aresta (fissão/fusão dentro do bloco, sem reuso de slot). Elimina o E1-08 por construção e não depende de todo consumidor validar {slot, gen}.
- PERF → render incremental: referências dos `<path>` cacheadas, dirty list vinda das arestas acordadas e `getBBox` só quando o label muda. Hoje src/renderer/edges.js:1-55 faz 5 querySelector, 10 setAttribute e `getBBox` por aresta por frame (verificado). O Worker de módulo fica como marco opcional, só depois de medir no Chromium, mantendo `routedEdges` como Map (adapter.js:34) por uma view.
- XPBD → testes de propriedade geométricos com oráculo: distância positiva de segBox/segSeg contra amostragem densa, e translação mínima ±ε que descruza ou não (run.mjs geo: 4000 casos, 0 falhas, reproduzido). A FIEL não tem oráculo para segRect/segSeg.
- XPBD → teste da lei constitutiva (resíduo de equilíbrio = F/k sob carga constante, em nó×nó e nó×segmento), fuzz de estabilidade dt×sub×rigidez sem velocityCap e as cenas mínimas de ciclo-limite (corner entre duas zonas inviáveis; segmento paralelo a uma face com nós pinados) como testes de regressão.
- XPBD → baseline A* Hanan (obstacle-route.js:129) no benchmark de qualidade e pré-passo discreto de semeadura de face/lado (face-select.js:87) como semente, sem prescrever rota. As três propostas empatam com as retas em cruzamentos topológicos (cross.jsonl: 95/95, 227/227, 3798/3793 na FIEL).
- XPBD → XPBD complacente reservado para restrições que o penalty não segura: snap Manhattan no repouso, e trilho exato se o gap cosmético do endpoint (2.4–7.8 px na FIEL) deixar de ser aceitável. Como fase pós-integração opt-in, não como default.
- JUIZ → adotar juiz-eng/cross.mjs (mesma cena, mesma métrica, modos `pinned` e `native`) como bench de regressão da Fase 4. Sem ele, as três propostas compararam números de cenas diferentes (por exemplo, 5 contra 27.6 ms, quando a razão real na mesma cena é ~10x).

**Alegações verificadas:** Todos os protótipos rodaram sem erro e o repo continua intocado (`git status` vazio). Pasta das saídas: /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/juiz-eng/out/.

**PERF — tudo reproduziu (perf-*.txt)**
- bench: dorme no tick 504; retas 2888/483 → final 3305/154; controle sem sleep 3308/156; CPU 2846 ms (alegado 2.7 s). Tudo idêntico.
- scale grid/SAP: 0.88/0.79, 2.50/2.59, **5.22**/6.24 (alegado 4.97/6.11) e 11.15/15.39 ms.
- props: momento 2.72e-15, bit a bit, paridade 9867/9867 com 0 faltando e 0 duplicados, seeds 2 e 3 idênticas.
- incr: 74 ticks, pico de 56/1002, 0.165 px, 606 ms na edição com arestas longas, cold 2198 ms.
- giant: 16080 → 36691 pares, tick de 9.55 ms.
- worker: 5.78 ms. alloc: 0 Scavenge na janela, 980 B/tick.

**PERF — o que não bateu ou foi omitido**
1. A estabilidade vale só no ponto calibrado: nInv=0.05 (massa 20) e khome=0.5. Com nInv=1 o sistema **nunca dorme** em N=200 e N=500 (605/1000 arestas acordadas, nós no vcap). O Jacobi só cobre corners (proto.mjs:223 contra :230). Minha correção de ~8 linhas faz dormir no tick 539.
2. A comparação com os 27.6 ms da FIEL usa cenas diferentes. Na mesma cena a razão é ainda maior: 5.7 contra 54 ms (`pinned` 500/1000).
3. A proposta não reporta que a edição com arestas longas move arestas distantes até 12.3 px (o 0.165 px vale só para a edição local).
4. Na mesma métrica, 6–17% das arestas continuam atravessando nós alheios, com até 19 px de profundidade; FIEL fica em 0.
5. O renderer tem 5 querySelector e 10 setAttribute, não 4 e ~8 como alegado (detalhe menor).
6. Citações conferidas: pipeline.js:175, compile-world.js:23, imports relativos em src/physics.

**FIEL — reproduziu**
- A: idêntico bit a bit nas 9 cenas, incluindo o determinismo.
- F (corredor): qualidade idêntica em todas as 28 linhas.
- props P1–P3: idênticas.
- D: qualidade idêntica. Os tempos ficaram 10–17% acima com load de ~1–2: 2.84 / 10.47 / 13.63 / 31.9 ms, contra 2.42 / 8.94 / 12.32 / 27.64.
- O custo de +3.55 ms para usar collision.js no nó×nó também bateu (alegado 3.39).

**FIEL — o que não bateu**
1. "Cabem ~200/300 a 8 ms": medi 10.5 ms (out/fiel-D.txt) e 5.0 ms no `pinned`, então o teto realista é ~150/225.
2. A proposta não mediu alocação. Medi 1103 Scavenges em 300 ticks.
3. Na minha cena diag100 `native` não fica quieta em 1500 ticks (vFim 0.32). No `pinned` fica quieta em 113 ticks.

**XPBD — reproduziu**
- geo: 2.7e-3 e 3.7e-3 px, 0 falhas.
- tend: idêntico. det: 0/9216.
- sweep: 0/30 explosões XPBD contra 12 do penalty; qualidade idêntica.
- recip: 2.6e-8, ρ=0 dá vFim 8.26, ρ=1 esfriado dá 0.16.
- dial: idêntico.
- scene: qualidade idêntica; tempos 10–24% acima (2.3 / 8.9 / 21.6 / 53.8 ms, contra 2.1 / 7.9 / 17.4 / 47.2).

**XPBD — o que não bateu**
1. "pen=0" não vale com nós fixos: 4/150, 4/300 e 6/1000 arestas, com até 46.7 px.
2. Com nós fixos não assenta: ciclo-limite local no endpoint junto à quina e vFim de 11.4 px/tick em grid500.
3. Em grid500 `native` o vFim chega a 58 px/tick, acima do cap de 32/eixo. O risco que a própria proposta apontou (correções que somam velocidade depois do cap) é real.
4. Custo de 150 ms/tick em 500/1000 `native`.
5. Confirmado que pluga no `createSolver` sem mudança: `dampingOrder:'before'` já existe (integrator.js:12-14).

**Não verifiquei**
- Nenhuma das três em navegador, DOM ou mobile.
- O enxerto do Jacobi dentro da FIEL (usar 1 sub-passo).
- Determinismo entre navegadores.

## Apêndice B · As três propostas

### Proposta fiel

**Hipótese central:** forças lineares explícitas mais sub-stepping bastam para K cadeias desviarem de nós, de forma estável e barata. Não precisa XPBD. **Resultado:** a hipótese se confirma até cerca de 100–150 nós e 150–225 arestas, com quatro correções de desenho que só o protótipo mostrou. Todas foram medidas; as saídas estão em proposta-fiel/out/.

**Números do default final (cap 8, kCross 2, ρEnd=α, guarda aditiva-normal, substeps 2):**
- **Cenas A** (9 cenas, N=20–100, 2000 ticks):
  - Penetração em nó alheio: 0 em 8 de 9 cenas. Na nona, 2 segmentos com no máximo 1.5 px. Para comparação, 2–33 retas centro→centro atravessariam nós.
  - Overlap nó×nó: 0. Bolhas: no máximo 1.
  - Cruzamentos entre cadeias ficam entre −10% e +12% dos cruzamentos das retas.
  - Gap do endpoint ao perímetro: 2.4–7.8 px.
  - As cenas ficam quietas (v<0.1) entre os ticks 554 e 1155.
  - Determinismo bit a bit.
- **Corredor F** (vão de 120 px, capacidade nominal de cerca de 9 cadeias):
  - K=4, 8 e 12: 0 cruzamentos, 0 px de penetração no obstáculo, assenta em 116–218 ticks.
  - K=16: cede, com 4 cruzamentos.
- **Custo por tick (D):**

  | nós / arestas | corpos | ms/tick |
  |---|---|---|
  | 100 / 150 | 831 | 2.4 |
  | 200 / 300 | 1796 | 8.9 |
  | 500 / 750 | — | 27.6 |

**As quatro correções:**
1. **Guarda de núcleo aditiva, na normal do segmento** (G).
   - A guarda x/y substitutiva deixa a cadeia presa ao atravessar o nó: 21 px com N=100 e 60 px no corredor.
   - A guarda normal substitutiva gera chatter no teto de velocidade com N=200.
   - Sem guarda, a penetração chega a 57 px.
2. **O perfil linear tem barreira finita.**
   - Com cap 32, o corredor tem 20–48 cruzamentos, mesmo com 8 sub-passos e fat 32.
   - Com cap 8 e kCross=kRep, tem 0 até K=12.
3. **A reação do endpoint no nó precisa esfriar com alpha.**
   - Com ρEnd=1: overlap nó×nó de até 18.5 px.
   - Com ρEnd=α: 0 em 6 de 6 cenas.
4. **A reciprocidade é indispensável.** Com ρ=0: penetração de até 33 px, 5–20 bolhas e o sistema não assenta.

**Limites honestos:**
- A repulsão não desfaz cruzamentos topológicos: o número de cruzamentos das cadeias fica próximo ao das retas. Isso é coerente com o ADR-0012, que trata o não-cruzamento como tendência.
- Com N≥200, a zona linear cede sob carga: 54 segmentos penetram até 5.8 px e há overlap de 7 px.
- Com N=500, quebra: penetração de 16 px e overlap de 38 px.

**Recomendação:**
- Adotar este caminho para M0–M5, com uma camada de colisores derivada de cadeias, um broad-phase único em typed arrays e a subdivisão adaptativa em M6.
- XPBD não é necessário no default.

O repo não foi modificado (git status limpo).

**Protótipo:** **Caminho:** /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/proposta-fiel/
- Arquivos: edges.mjs (227 linhas) e run.mjs (172 linhas), 399 no total.
- Importa world.js, solver.js e collision.js de src/physics por caminho absoluto.

**Como rodar:**
- `cd <caminho> && node run.mjs [A|B|C|D|E|F|G|all]`
- Propriedades: `node diag/props.mjs`
- Varredura de cap: `node diag/cap-sweep.mjs`
- Saídas em out/. Versões anteriores (guarda x/y, guarda normal substitutiva) em out/tentativa*/ e diag/*.bak.

**Números (default: substeps 2, cap 8, kCross = kRep = 2, ρ = 1, ρEnd = α, guarda aditiva-normal):**
- **A** (N = 20/60/100, 3 seeds, 2000 ticks):
  - Penetração em nó alheio 0 em 8/9; na nona, 2 segmentos ≤ 1.5 px. Para comparar, 2–33 retas atravessariam nós.
  - Overlap nó×nó 0. Bolhas ≤ 1.
  - Cruzamentos entre cadeias: 5/4/15, 106/55/48, 55/130/148. Retas: 5/4/16, 110/49/49, 57/129/155.
  - Gap do endpoint 2.4–7.8 px. Quieto aos 554–1155 ticks.
  - Determinismo bit a bit.
- **B:** s=1 assenta com 2 sub-passos; s=4 precisa de 4; s=16 não assenta com 8.
- **C:** ver o campo de forças. Modo máximo, ρ = 0, sem guarda e 1 sub-passo falham.
- **D:** 2.42 / 8.94 / 12.32 / 27.64 ms/tick para 100 / 200 / 300 / 500 nós. collision.js para nó×nó custa +3.39 ms.
- **E:** ρEnd = α sem overlap em 6/6; ρEnd = 1 com overlap de até 18.5 px.
- **F:** default com 0 cruzamentos em K = 4/8/12 e 4 em K=16; cap 32 com 20–48, mesmo com 8 sub-passos e fat 32.
- **G:** tabela no campo de colisão de cápsulas.
- **P:** P1 = 1e-8; P3 em 20/20.

**Hipótese:** confirmada até cerca de 100–150 nós, depois de 4 correções. Com 200 ou mais nós, a tendência cede sob carga (penetração rasa ≤ 6–8 px).

**Riscos:**

- Cruzamentos topológicos persistem: o número de cruzamentos entre cadeias fica próximo ao das retas (−10% a +12%, em A e E). Quem espera que o anti-cruzamento os desfaça vai se frustrar; só o layout ou uma operação discreta os reduz.
- Densidade: com N ≥ 200, a zona linear cede sob carga. N=200 tem 54 segmentos com até 5.8 px de penetração e overlap nó×nó de 7.2 px; N=500 tem 16 px e 38 px. Mitigações: M6 (subdivisão adaptativa) e K=8, que ajuda só em parte (54 → 37) e custa 1.5×.
- O perfil linear tem barreira de energia finita: qualquer fonte de velocidade alta produz cruzamentos. Os casos são drag por teletransporte (compile-world.js:272), edição da DSL com salto e um cap mal configurado. O teto de velocidade virou requisito, não detalhe.
- Assentamento lento: com alphaDecay 0.012, fica quieto em 554–1155 ticks (9–19 s de CPU a 60 fps). Isso exige um critério de parada próprio e calibração de alpha (0.03 dá 418–502 ticks).
- Guarda por chaveamento: a guarda aditiva-normal foi a melhor das 4 variantes, mas P2 mostra não-conservatividade local de até 6% numa seed. Pode haver chatter em geometrias não testadas.
- Gap endpoint–perímetro de 2.4–7.8 px, resolvido só cosmeticamente no render. Se o produto exigir contato exato na física, vai precisar de XPBD ou RAIL1, o que contraria este ângulo.
- Um default com ρEnd=α muda o layout existente quando as arestas estão ligadas: nós conectados se aproximam enquanto o layout está quente. Isso conflita com o live.connectivitySpring default off da Fase 3 e é uma decisão de produto.
- Dependência de correções do v2 ainda abertas: E1-01 (fim do loop), E1-03 (containers como corpos), E1-04 (warm restart) e E1-08 (estado por slot, obrigatório para M6).
- Medições feitas só em Node, com a CPU compartilhada por cerca de 10 agentes. Não verifiquei custo em navegador ou mobile, alocação/GC do protótipo nem determinismo entre navegadores (Math.hypot/sqrt).
- Os limiares da regra de barreira são ruidosos (varredura de cap com kCross 0.5 não é monotônica). A regra é qualitativa, não uma fórmula de projeto exata.

### Proposta xpbd

Refiz o protótipo do zero. A tentativa anterior foi arquivada em proposta-xpbd/_tentativa-anterior/: ela nunca assentava e tinha cruzamentos ≈ os das retas, por misturar leis não conservativas (repouso da cadeia dependente da corda, atrator de porta, midline).

A versão nova (380 linhas) põe as arestas como cadeias de K corners POINT/FREE2 no MESMO World de src/physics e se pluga no createSolver existente sem alterá-lo: um contributor para SAP e atrator, um constraint para XPBD. Todas as medições são scripts meus; o repo segue intocado (`git status` vazio).

**O que os números sustentam:**
1. **Identidade de tendência preservada.** Num contato nó×nó (restrição única), o resíduo de equilíbrio XPBD é α·F com erro ≤1e-4 px (F=2, α=1 → 2.0000; α=3 → 5.9999) e é idêntico ao do penalty k=1/α quando este é estável. O penalty k=100 diverge (resíduo −21.8 px, vFim 21). O XPBD com α=0.01 fica exato (0.0200).
2. **Estabilidade incondicional.** Varredura dt∈{1,2,4} × sub∈{1,4} × α∈{0, 1e-3, 1, 3, tudo 0}, sem velocityCap:
   - XPBD: 0/30 explosões (vPico máx 121.9).
   - Penalty: 12/18 explodem e outras 3 divergem para 222–632 px/tick.
3. **Zona macia + núcleo firme substitui o termo integral do PI (E1-02).** Com F=40, acima da capacidade da zona, o overlap real fica em 0.016/0.032 px = (F−24/α)·α_núcleo, sem acumulador e sem estado por contato.
4. **Eixo recíproco "de graça".** A fase XPBD conserva momento (|ΣmΔv|/Σ|mΔv| = 2.6e-8). Com ρ=0 (aresta não empurra nó) o resultado é pior: vFim 8.3 px/tick, trilho 5.3 px.
5. **Obstáculos.** pen = 0 cadeias atravessando nós alheios em N=40/100, contra 23/82 das retas e 2/33 do A* Hanan do fallback atual, aplicado nas mesmas posições.
6. **Determinismo** bit a bit (0/9216 floats diferentes).

**Custos medidos (honestos):**
- (a) **"Não explode" ≠ "assenta".** O XPBD assentou em 1/30 da varredura dentro de 900 ticks.
  - Com os defaults, N=40 assenta nos ticks 353–680; N=100 não assenta em 900 ticks (fluência de corners ~0.07–0.5 px/tick e eventos de "escorrega e estala").
  - O encerramento por alpha no estilo v1 (E1-01) continua obrigatório.
- (b) **Três mecanismos precisaram ser adicionados**, cada um diagnosticado por trace:
  - passe de velocidade de contato com restituição 0: sem ele, ciclo de período 2 sub-passos a ±4.9 px/tick, ou velocidade fantasma;
  - manifold de features vértice×aresta: com contato de ponto único numa face paralela há ciclo-limite de 0.31 px/tick mesmo com nós pinados; com manifold assenta no tick 130;
  - zona macia + núcleo firme: com zona macia apenas, um nó passa por cima da cadeia (d = −26 px).
- (c) **O anti-cruzamento por empurrão local praticamente não disca.** Em N=100, crossCap 0/1/4/16 dá 91/93/94/89 cruzamentos. A zona seg×seg reduz ~15% (109 → 93). Os cruzamentos residuais são topológicos: ~1.8–2.4x os das retas (que atravessam nós), 1.25x o A* em N=100 e 0.52x em N=200.
- (d) **Custo/qualidade.** Com K=6 e sub=4:
  - N=100/M=150 custa 7.0 ms/tick (p95 9.4);
  - N=200 custa 18.6 ms;
  - sub=2 barateia, mas degrada: trilho 19.8 px e pen 6 com K=4.
  - Orçamento de qualidade a 60 fps: ~100 nós / 150 arestas.
- (e) **Com manifold, a rigidez por par vira m/α.** O resíduo seg×nó fica α·F/2, com viés de −6% de Gauss-Seidel.

**Recomendação:** adotar o híbrido (forças para campos, XPBD complacente para estrutura e contato), com os três mecanismos acima como parte do contrato. O não-cruzamento precisa de um pré-passo discreto de semeadura (lado de contorno / face, reaproveitando face-select), porque a repulsão local não o entrega.

**Protótipo:** **Caminho:** /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/proposta-xpbd/
- xpbd-edges.mjs: 250 linhas, núcleo (geometria + sistema de arestas);
- run.mjs: 130 linhas, experimentos;
- total 380 linhas.
- Importa src/physics/world.js, src/physics/solver.js e src/routing/obstacle-route.js (hananRoute, só na baseline) por caminho absoluto. Nenhuma alteração no repo.

**Como rodar:** `cd <pasta> && node run.mjs [geo|tend|sweep|scene|dial|recip|det|all]`. Saídas salvas em out/*.txt. Diagnósticos em diag/*.mjs, com saídas em out/diag/ (perf.txt, tune-n100.txt, coolinertia.txt).

**Números:**

geo (4000 casos):
- erro de distância ≤2.7e-3 px (segBox) e ≤3.7e-3 px (segSeg);
- 0 falhas de translação mínima.

tend, caso A nó×nó:

| F | α | XPBD | penalty |
|---|---|---|---|
| 2 | 1 | 2.0000 | 2.0000 |
| 2 | 3 | 5.9999 | 6.0000 |
| 2 | 0.01 | 0.0200 | diverge (−21.8, vFim 21) |
| 40 | 1 e 3 | overlap real 0.016 e 0.032 px (núcleo) | atravessa (6e5 px) |

tend, caso B nó×segmento (manifold com 2 quinas):
- 0.9375 contra teoria 1.0 (F=2, α=1);
- jitter de 0.13 px/tick com α=0.01.

sweep (N=40):
- XPBD: 0/30 explosões;
- penalty: 12/18 explosões, mais 3 divergindo a 222–632 px/tick;
- assenta em 900 ticks: XPBD 1/30, penalty 1/18;
- dt=4, sub=1: cruzamentos 270–871.

scene (K=6, sub=4, cap 32):

| N | ms/tick | assenta | cruz (retas / A*) | pen (retas / A*) | trilho | outros |
|---|---|---|---|---|---|---|
| 40 | 2.1 | tick 353 | 42 (27 / 54) | 0 (23 / 2) | — | — |
| 100 | 7.9 (p95 11.7) | não | 95 (38 / 76) | 0 (82 / 33) | 1.6 | v@481 = 2.3 |
| 200 | 17.4 | não | 247 (131 / 476) | 4 | 4.3 | — |
| 400 | 47 | não | — | 11 | 9 | esticam 4.5 (degrada) |

dial (N=100, cruzamentos):
- crossCap 0/1/4: 91/93/94;
- constante 4/16: 91/89;
- seg×seg desligado: 109;
- varredura simétrica: 93, com vFim 1.8 (pior);
- K=4: 91 com trilho 5.96 (4.4 ms);
- K=10: 95 (12.5 ms).

recip:
- momento 2.6e-8;
- ρ=0 → vFim 8.26 e trilho 5.34; ρ=1 esfriado → vFim 0.16, trilho 1.51, desloc. dos nós 39 px.

det: 0/9216 floats diferentes.

**Riscos:**

- Repouso não garantido: com os defaults, N=100 não assenta em 900 ticks (v@481 de 2.3–3.1 px/tick, fluência de ~0.07 px/tick no fim). O término por alpha congela o diagrama no meio de eventos de 'escorrega e estala'. Mitigações não testadas: ilhas com sleeping e mais de 1 iteração com λ acumulado.
- Anti-cruzamento por força local é quase inócuo contra cruzamentos topológicos (91→89 com crossCap 0→16). As cadeias cruzam 1.8–2.4x mais que as retas, que atravessam nós, e 1.25x mais que o A* em N=100. Sem semeadura discreta, a qualidade de cruzamentos pode frustrar a expectativa de 'não-cruzamento como tendência'.
- Complexidade escondida: os três mecanismos (passe de velocidade, manifold, zona+núcleo) foram descobertos por trace depois que a versão 'XPBD de livro' falhou (período 2, velocidade fantasma, troca de feature). Outros casos degenerados (quinas, SAT de segmento atravessando o nó, heurístico e não conservativo) podem reintroduzir ciclos-limite.
- Custo: com K=6 e sub=4, N=200 custa 18.6 ms/tick e só cabe a 60 fps com K=4 e sub=2, que degrada a qualidade (trilho 19.8 px, pen 6 em N=100). Números de Node; não medi no navegador nem em mobile (F-0019).
- Semântica de rigidez: com manifold, a rigidez por par vira m/α e o equilíbrio tem viés de ~6% por Gauss-Seidel com λ=0. Isso diverge do 'k por par' literal do ADR-0011 se não for normalizado.
- Reciprocidade muda o layout: com ρ=1 os nós se deslocam 39–53 px em média contra ρ=0, e com ρ fixo aparece overlap de nós de 0.29 px. Pode surpreender usuários de diagramas existentes (mudança de default visível) e interage com a decisão pendente de tornar o v2 default.
- Dependência de ordem do Gauss-Seidel: o determinismo é bit a bit no mesmo runtime, mas a ordem do SAP depende das posições e a semente depende do índice (E1-18). A varredura simétrica piorou o assentamento (vFim 1.8 contra 0.16), então o viés de ordem não é mitigado.
- Tunelamento: a margem especulativa do SAP é limitada a 40 px/tick e as correções XPBD somam velocidade depois do velocityCap. Pares podem faltar num tick com saltos grandes (não medido).
- Escopo não prototipado: containers como corpos (E1-03), topologia adaptativa e fusão de feixes, snap Manhattan, espalhamento de endpoints na face e labels. As estimativas desses marcos não têm evidência numérica.

### Proposta perf

**Hipótese central.** Em JS puro, sem WASM e sem sub-stepping, estas escolhas fazem 500 nós + 1000 arestas caberem com folga em 60 fps:

- layout SoA;
- cápsulas derivadas de comprimento limitado;
- broad-phase CSR sem alocação;
- sleep/wake por corpo.

Além disso, o sistema **assenta** (custo cai para ~0) e uma edição local da DSL custa proporcional à vizinhança.

**Resultado: confirmada**, com números do protótipo em `proposta-performance-first/`. São 361 linhas e o repo segue intocado (`git status` vazio).

**Custo**
- **N=500 / E=1000** (4333 cápsulas, ~15.8k pares), tudo acordado: tick de **4.97 ms mediana, p95 7.06 ms** (`out/scale.txt`).
- N=1000 / E=2000: 10.84 ms, p95 15.3. É o limite do JS single-thread.
- Para comparar (cenas diferentes, ordem de grandeza): a proposta "fiel" mediu 27.6 ms/tick com 500 nós / 750 arestas usando o `collision.js` atual (cache-parcial.json, proposta fiel, campo protótipo).

**Assentamento**
- Tudo dorme no **tick 504**, com 2.7 s de CPU no total (`out/bench.txt`).
- Depois disso o tick devolve `false` e custa 3–24 µs. Isso resolve o E1-01 por construção.

**Edição local** (+1 nó, +2 arestas vizinhas)
- 74 ticks até dormir de novo, pico de 56 das 1002 arestas acordadas, **59 ms de CPU contra 2261 ms** re-semeando tudo.
- As 867 arestas a mais de 600 px se moveram no máximo **0.165 px** (`out/incr.txt`). O E1-04 media 93 px.

**Alocação**
- **0 GCs em 300 ticks**, com ~1 KB/tick amostrado.
- Antes de duas correções eram 87 Scavenges e 604 KB/tick (`out/diag-heapprof*.txt`).

**Invariantes**
- Σ forças internas / Σ|f| = 2.7e-15.
- Determinismo bit a bit.
- Broad-phase igual à força bruta: 0 pares faltando e 0 duplicados (`out/props.txt`).

**Qualidade**
- Arestas que atravessam nós alheios: **483 → 154 (−68%)**.
- Pares de arestas que se cruzam: **2888 → 3305 (+14%)** contra retas.
- A força anti-cruzamento reduz 8% em relação a desligá-la, e satura: 4x mais forte não melhora. O desvio de nós é o que cria cruzamentos: sem ele fica −18% de cruzamentos, mas +21% de penetração (`out/diag-cross.txt`).

**Oito defeitos de estabilidade achados e corrigidos.** Qualquer Fase 4 com forças explícitas precisa tratá-los. Os sete primeiros são numéricos (`attic/` guarda cada versão); o oitavo é de alocação no V8.

1. **SDF dentro da caixa.** O gradiente salta entre eixos, então a cadeia fica presa e vibra (KE/corner 0.99). Com SAT de 3 eixos cai para 5e-3.
2. **Trilho na quina do nó.** A normal alterna x/y a cada tick e o nó vibra: 109 de 400 arestas em movimento. Com um cone de normais, caem para 4.
3. **Cápsulas quase paralelas.** O ponto mais próximo salta entre as pontas. Um manifold de 4 pontos zera o movimento residual.
4. **Wake no meio do tick.** A aresta integra sem a própria tensão e leva um chute (v=4.3). Com o wake adiado para o tick seguinte, o problema some.
5. **Contatos empilhados num feixe.** A rigidez soma perto de 2 e surge um ciclo de período 3. Um limitador de Jacobi F·min(1/m, κ/ΣK), com rigidez em rampa, resolve.
6. **Alpha global reaquecido na edição.** Provoca cascata: 996 das 1002 arestas acordam. Com alpha por aresta, o pico cai para 56.
7. **Campo SAT não conservativo.** Gera ciclos-limite raros (1 aresta em 600, até 1.4 px). A mistura suave de eixos e o sono por janela de deslocamento (1 px) os absorvem.
8. **Duas armadilhas de alocação no V8.** Um double vindo de phi passado como argumento custava 390 KB/tick; um `let` de módulo com double, 63 KB/tick.

**Recomendação**
- Evoluir `src/physics` para stores SoA por arquétipo (nós, blocos de cadeia, colisores derivados), com grid CSR no lugar de `spatial-grid.js` e sleep/alpha local como mecanismo de assentamento.
- Rodar o solver num Worker de módulo.
- Deixar WASM SIMD como opção só acima de ~1000 nós.

**O que não verifiquei:** custo de DOM/SVG e navegadores reais (não há Chromium aqui), Firefox/Safari e mobile.

**Protótipo:** **Caminho:** `/tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/motor/proposta-performance-first/`

- `proto.mjs` (276 linhas): o núcleo (stores SoA, narrow, grid CSR e SAP, topologia, tick com sleep, métricas).
- `run.mjs` (85 linhas): os experimentos. Total: 361 linhas.
- Não importa src/physics: o núcleo é autônomo para medir o layout proposto sem o AoS atual.
- Diagnósticos em `diag/*.mjs`, saídas em `out/*.txt`, e cada versão intermediária em `attic/` (v0 a v9, com suas saídas).

**Como rodar**
- `cd <caminho> && node run.mjs bench|scale|props|incr|giant|worker`
- Alocação: `node --trace-gc run.mjs alloc`
- Exemplos de diagnóstico: `node diag/cross.mjs`, `node diag/heapprof.mjs`, `node diag/eps.mjs`

**Números finais**

- **bench** (500 nós / 1000 arestas / 4336 cápsulas):
  - janela quente com mediana de 5.6 ms e p95 12.8;
  - **tudo dormindo no tick 504**, com 2.7 s de CPU;
  - retas → final: pares cruzados 2888 → 3305 (+14%) e arestas atravessando nós 483 → 154 (−68%);
  - nós deslocados 17 px em média pelas arestas;
  - controle sem sleep: 3308/156.
- **scale** (tudo acordado, grid / SAP): 0.87/0.75, 2.54/2.67, **4.97/6.11** e 10.84/15.2 ms para 100, 250, 500 e 1000 nós.
- **props:**
  - momento 2.72e-15;
  - determinismo bit a bit: sim;
  - paridade grid e SAP com força bruta: 9867/9867, 0 faltando, 0 duplicados;
  - sleep ligado ≈ desligado nas seeds 2 e 3.
- **incr:**
  - local: 74 ticks, pico de 56/1002 acordadas, 0.84 ms/tick, **59 ms** de CPU; arestas a >600 px moveram no máximo **0.165 px**;
  - com arestas longas: 398 ticks e 560 ms;
  - re-semear tudo (cold): 2261 ms;
  - tick ocioso: 3–24 µs.
- **giant** (1 corpo de 3000×2000): broad de 2.87 para 4.55 ms, pares de 16k para 36.7k (reais), tick de 5.1 para 9.5 ms.
- **worker:** round-trip de 5.63 ms (tick + 128 KB em Float32 por transfer).
- **alloc:** 0 GC em 300 ticks.
- **diag-cross:** a força anti-cruzamento reduz 8% em relação a desligá-la; 4x mais forte não melhora; sem desvio de nós, cruzamentos −18% mas penetração +21%.
- **diag-pathstr:** montar as strings `d` de 1000 arestas custa 1.33 ms.

**Evolução, com evidência de cada passo**
- A v0 (SAP + SDF por seção áurea) nunca assentava: KE ~9e3 e 7.29 ms/tick (`attic/bench-v0.txt`).
- Correções em ordem: SAT; cone no trilho; manifold de 4 pontos; wake adiado; Jacobi com rampa; micro-otimizações (7.15 → 4.97 ms); alpha local; janela de sono; mistura suave de eixos; correções de alocação (604 → 1 KB/tick).
- Cada passo tem sua saída em `out/diag-*.txt`.

**Riscos:**

- Números medidos em Node 22 (V8) num container compartilhado. Chrome deve ficar próximo por usar o mesmo V8, mas Firefox, Safari e mobile (F-0019) não foram medidos; mobile pode ser 3–5x mais lento (estimativa, não medida).
- Render SVG não foi medido (não há browser aqui). O renderer atual faz querySelector, setAttribute e getBBox por aresta a cada frame (src/renderer/edges.js:7-51) e provavelmente é o gargalo real com 1000 arestas; a física em Worker não resolve isso sozinha.
- O anti-cruzamento é uma tendência fraca: +14% contra retas, −8% contra desligado, e satura. Ele conflita com o desvio de nós (sem desvio, −18% de cruzamentos e +21% de penetração). Pode frustrar a expectativa; a mitigação é semear a topologia com o face-select do legado sem prescrever rota.
- O sono congela movimento lento (menos de 1 px em 30 ticks). Se o mantenedor quiser o diagrama 'respirando' continuamente em repouso, o custo em repouso deixa de ser zero; o meio-termo é física a taxa reduzida.
- O campo de contato por SAT não é conservativo. Ciclos-limite raros (1 aresta em 600, até 1.4 px) ficam mascarados pelo sono; a cura estrutural é um potencial via distância exata ou XPBD para os contatos.
- Várias heurísticas não vêm de literatura: κ do Jacobi, rampa de rigidez, pesos ^4 da mistura de eixos e janela de sono de 1 px. Mudar parâmetros pode reabrir instabilidades; os testes de propriedade (movimento residual, terminação) precisam fazer parte do gate.
- Blocos fixos de CAP=16 limitam a aresta a ~15 segmentos (~1700 px) e desperdiçam memória (média de 5.3 corners por bloco de 16). Arestas mais longas exigem blocos por classe de tamanho ou Lmax adaptativo.
- As otimizações de alocação dependem do tier do V8 (Maglev/TurboFan): as armadilhas medidas (double vindo de phi como argumento, let de módulo com double, let sem inicializar) voltam com refactors inocentes, por isso o teste de alocação opt-in é necessário.
- Container gigante gera muitos pares reais (36.7k, tick de 9.5 ms) se não houver exclusão ancestral por máscara no broad; depende de resolver E1-10 e E1-03.
- A Fase 4 sozinha não habilita o v2 como default: containers (E1-03), pipeline (E1-14), PI (E1-02) e término (E1-01) precisam de correção antes (marco M0 e dependências do layout).
- O Worker introduz ~1 frame de latência em drag e edição, e o getBBox de labels precisa voltar do main thread por protocolo, com risco de defasagem visível.
- Determinismo entre navegadores não verificado. Math.sqrt é exato em IEEE, mas a semente atual usa sin/cos (compile-world.js:88-90), cuja precisão depende da implementação.

## Apêndice C · Auditoria do motor atual

Auditei o motor unificado (src/physics, 696 linhas), o compilador v2 (src/layout/compile-world.js), o adapter live, os testes, os ADRs 0010/0011/0012, o playground e o legado src/routing/physics. As medições foram feitas com 15 scripts próprios. Nenhum arquivo do repo foi alterado (git status limpo).

O núcleo é pequeno, determinístico (bit a bit dentro do mesmo processo) e 20–53x mais barato por tick que o v1. Mesmo assim, não está pronto para virar default nem para receber a Fase 4 como está.

Achados mais graves, todos medidos:

1. **O v2 nunca termina.** O alpha tem piso em alphaMin (solver.js:42), mas o compile-world testa com `<` estrito (compile-world.js:240/244). Resultado: o loop de requestAnimationFrame roda para sempre e o evento 'end' nunca é emitido. Medido com rAF simulado: 5000 frames, end=null. O v1 termina no frame 481.
2. **O termo integral do PI piora o assentamento.** Ele vem ligado por default (Ki=0.04), contra o ADR-0011. Sob carga, cria ciclo-limite e windup: KE 3.7 perpétuo contra 4e-12 no P puro; overshoot de 31.7 px contra 6.4 no drag; assentamento ~25x mais lento.
3. **Regressões do v2 frente ao v1:**
   - Containers com filhos não são corpos: container×container sobrepõe 24.4 px e peer×container 22 px; no v1, 0.
   - O warm restart (seedPositions) é ignorado: cada edição da DSL desloca os nós em média 93 px, contra 0 no v1.
   - Não há velocityCap: pico de 368 px/tick.
4. **O sub-stepping aplica o damping a cada sub-passo.** Com N=4, o damping efetivo por tick vira 0.82⁴ = 0.45. Isso muda a dinâmica, não só a estabilidade, e o cenário A2 do playground (usado como evidência) tem a mesma confusão.
5. **A broad-phase não compensa e degrada com corpos grandes.**
   - A enumeração de pares do grid é só 1.6–2.4x mais rápida que força bruta, e fica 5x mais lenta que ela se houver um único corpo grande (cellSize 3024).
   - Alocação: 0.3 / 1.0 / 8.0 MB por tick (N=100/500/2000), contrariando o "zero pressão de GC" de world.js:5.
   - Um spike de sweep-and-prune (SAP) com typed arrays, com paridade de força de 1e-5, ficou 9–25x mais rápido com corpos grandes e alocou 6–30x menos.
6. **Fase 4: SHAPE.CAPSULE e DOF.RAIL1 são só constantes.**
   - RAIL1 se move em 2D livre; CAPSULE vira uma AABB e gera falso contato a 99 px.
   - Não há colisores derivados, pad por corpo nem gate bipartido aresta×nó / aresta×aresta.
   - O estado guardado por slot (acumulador PI, molas) sobrevive ao reuso: força 24x maior num corpo novo.

Recomendação de engine: manter o motor próprio. Rapier (WASM) e planck não trazem ganho decisivo na escala-alvo (Rapier 1.5 ms e planck 6.9 ms contra 1.9 ms do motor, em N=500), conflitam com as tendências do ADR-0012 (contato rígido) e o Rapier pesa 1.29 MB gzip. O caminho sugerido é híbrido:
- forças para as tendências;
- XPBD (já prototipado no B1) para comprimento de cadeia, trilho de perímetro e snap Manhattan: estável em qualquer rigidez, enquanto a mola penalty explode com k≥2;
- SAP;
- camada de colisores derivados (cápsulas).

O legado traz peças prontas para a Fase 4: trilho de perímetro, fissão/fusão com cooldown e trava anti-cascata, seleção de face, snap e warm-start. Os caminhos estão no campo `reaproveitavel_do_legado`.

### Baseline de testes (arquivos do motor)
`node --test --test-concurrency=1 --experimental-test-coverage tests/physics/*.test.js tests/layout/compile-world.test.js` → **46/46 pass**.

| arquivo | linhas % | branches % | funcs % | não coberto relevante |
|---|---|---|---|---|
| src/physics (total c/ compile-world) | 93.20 | 76.21 | 78.08 | — |
| compile-world.js | 81.45 | 74.70 | 67.86 | 246-252 (loop rAF, onde está o E1-01), 260-300 (drag/release, onde está o windup do E1-02) |
| solver.js | 100 | 63.64 | 60 | substeps>1 e topology não testados |
| registry.js | 87.88 | 90 | 50 | não é usado em produção |

### Broad-phase e custo por tick (central+colisão PI, pad 12; `bench/broadphase.mjs`)
| caso | cellSize | candidatos | pares reais | grid ms | pares ms | colisão ms | tick ms | força bruta O(N²) ms (só teste) |
|---|---|---|---|---|---|---|---|---|
| N=100 | 162 | 728 | 189 | 0.033 | 0.129 | 0.275 | 0.375 | 0.801 |
| N=500 | 164 | 7 623 | 1 850 | 0.130 | 0.724 | 1.640 | 1.946 | 1.720 |
| N=2000 | 164 | 64 911 | 13 257 | 0.738 | 11.918 | 26.922 | 28.481 | 18.973 |
| 500 + 1 corpo 3000x2000 | **3024** | 39 149 | 1 961 | 0.040 | 7.228 | 12.947 | 9.798 | 1.424 |
| 500 + 1 AABB de segmento 1200x3 | **1224** | 42 633 | 1 768 | 0.045 | 4.963 | 10.224 | 10.893 | 1.393 |

Escalonamento do tick de 100→500→2000: 1.9 → 29 ms. Aproximadamente O(N^1.4), dominado por Set/Map/alocação e não pelo número de pares reais.

### Alocação por tick (janela sem GC confirmada por `--trace-gc`: 0 Scavenges; `bench/alloc.mjs`)
| N | só grid+pares | tick completo | contatos PI ativos |
|---|---|---|---|
| 100 | 80.8 KB | 296.7 KB | 195 |
| 500 | 579.8 KB | 979.6 KB | 1 864 |
| 2000 | 4 177 KB | 8 005 KB | 13 690 |

### Spike SAP (typed arrays, chave de par Smi, sem objeto por contato; mesma física; `bench/sap-spike.mjs`)
| caso | atual ms | SAP ms | ganho | atual KB/apply | SAP KB/apply | Δforça máx |
|---|---|---|---|---|---|---|
| N=100 | 0.14–0.32 | 0.03 | 4.5–9x | 353 | 11 | 3.8e-6 |
| N=500 | 1.63–1.88 | 1.07–1.11 | 1.5–1.7x | 1 173 | 118 | 7.6e-6 |
| N=2000 | 24.2–28.2 | 14.1 | 1.7–2.0x | 6 825 | 1 076 | 1.5e-5 |
| 500+corpo gigante | 8.5–24.5 | 0.85–0.98 | 10–25x | 4 390 | 133 | 5.9e-3 |
| 500+segmento longo | 9.7–10.2 | 1.06 | 9–10x | 4 680 | 116 | 7.6e-6 |

### Estabilidade (`bench/stability.mjs`)
- **Colisão** (anel de 6 corpos, dt=1, sub=1): nunca diverge para infinito, mas não assenta com Kp≥2. KE final 1e1…8e4 (chatter permanente). Com sub=4, assenta até Kp=10.
- **Mola de conectividade** (2 corpos, sub=1): explode com k≥2.5 (limite teórico ω·dt<2 ⇒ k<2); com sub=4, estável até k=5.
- **Damping por sub-passo** (v0=10, sem forças):

  | substeps | fator por tick | distância percorrida |
  |---|---|---|
  | 1 | 0.820 | 45.6 px |
  | 2 | 0.672 | 22.8 px |
  | 4 | 0.452 | 11.4 px |
  | 8 | 0.204 | 5.7 px |

  Deveria ser invariante a N.
- **Velocidade de pico** (20 nós 200x100 sobrepostos): sem cap (v2) 368 px/tick; cap 32 (v1) 32 px/tick.
- **XPBD × penalty** (cadeia de 12 corners com carga lateral; `bench/xpbd-vs-penalty.mjs`):
  - dt=1: penalty explode com k≥2; XPBD fica ok com α∈[0,1] (strain ≤2.7 px).
  - dt=2: penalty explode com k≥1; XPBD fica ok (strain ≤7.1 px).

### Controlador PI (`bench/collision.mjs`)
| cenário | Ki=0 (P puro, ADR-0011) | Ki=0.04 (default v2) |
|---|---|---|
| Anel de 6 corpos sob carga constante, últimos 500 de 3000 ticks | KE 3.8e-12, overlap padded fixo 2.75 px, 0 trocas de contato | KE **3.7**, overlap 1.3–5.5 px, **368** trocas (ciclo-limite) |
| Coluna de 10 contra parede (overlap máx em t=100/500/1000/3000) | 16.3 / 16.7 / 16.7 / 16.7 px (estável) | 8.5 / 18.7 / 26.0 / 17.7 px (não converge) |
| Drag e soltura (acumulador em 200 = accMax) | v pico 12.3 px/tick, sobra 6.4 px | v pico **21.6** px/tick, sobra **31.7** px |

### Cena DSL realista v1 × v2 (`bench/v1v2.mjs`; nodePad 12; 3000 ticks máx)
| caso | ticks até 'end' | ms/tick | vmax px/tick | overlap real | overlap padded máx | Σd² no tick 400 |
|---|---|---|---|---|---|---|
| N=40 v1 | 482 | 1.647 | 21.3 | 0 | 0.01 | 2.1e-4 |
| N=40 v2 default | **nunca** (3000) | 0.082 | 35.9 | 0 | 0.41 | 1.4 |
| N=40 v2 Ki=0 | nunca | 0.068 | 28.5 | 0 | 0.29 | 5.7e-2 |
| N=40 v2 sub=4 | nunca | 0.206 | 17.3 | 0 | 0.06 | 7.1e-3 |
| N=40 v2 + mola | nunca | 0.064 | 114.3 | 0 | 1.38 | 1.0e1 |
| N=150 v1 | 482 | 18.553 | 379.9 (projeção dura) | 0 | 0.21 | 3.2e-2 |
| N=150 v2 default | nunca | 0.349 | 131.6 | 0 | 2.08 | 1.8e2 |
| N=150 v2 Ki=0 | nunca | 0.306 | 125.0 | 0 | 2.26 | 1.4e1 |

Outras medições v1 × v2:
- **Containers** (`bench/containers.mjs`): overlap container×container v1 0 contra v2 24.4 px; peer×container v1 0 contra v2 22 px.
- **Edição de DSL** (+1 nó; `bench/warmrestart.mjs`): deslocamento médio dos nós existentes após 1 tick, v1 0 px contra v2 93 px (máx 166).
- **Determinismo**: 2 execuções do v2 saem idênticas bit a bit. Com a ordem de declaração invertida, um nó se desloca até 555 px (o seed depende do índice). Não verifiquei entre navegadores.

### Engines externas, mesma cena (`spike-libs/bench-libs.mjs`; ordem de grandeza, contatos rígidos ≠ tendências)
| engine | N=100 | N=500 | N=2000 | peso |
|---|---|---|---|---|
| motor atual (tick) | 0.38 ms | 1.95 ms | 28.5 ms | 0 dependências |
| Rapier2D 0.21 compat (WASM, ESM) | 2.91 | 1.53 | 8.43 | 3.4 MB mjs / 1.29 MB gzip |
| planck.js 1.4.2 (JS, ESM) | 3.97 | 6.94 | 42.9 | 297 KB min / 55 KB gzip |

**Conformidade com os ADRs:** **ADR-0010 (repulsão só entre corpos; atração só por atratores): conformidade parcial.**
- Conforme:
  - A colisão só repele (unilateral), com impulso igual e oposto ponderado por massa (collision.js:80-89).
  - O atrator central é um atrator-ponto (contributors/central.js).
  - A mola de conectividade é acoplamento estrutural declarado e opt-in (connectivity-spring.js; registry.js:38 defaultEnabled false), o que o ADR permite.
- Diverge:
  - (a) Atratores de path e de região não existem; só há o central.
  - (b) Container como corpo que repele peers e hospeda atrator-região não foi implementado. Containers com filhos não são corpos (compile-world.js:72-74) e a contenção é só projeção dura opcional (constraints/index.js:60-77). Medido: overlap container×container de 24.4 px e peer×container de 22 px, contra 0 no v1 (E1-03).
  - (c) tag-forces attractTo é atração corpo→corpo sem reação (tag-forces.js:23-39; E1-12).

**ADR-0011 (zona por elemento, gate zona×zona, perfil linear): conformidade parcial.**
- Conforme:
  - Perfil linear f=Kp·pen sobre a penetração de eixo mínimo da AABB acolchoada (collision.js:62-80).
  - Gate zona×zona correto para pad uniforme (2·pad).
- Diverge:
  - (1) O pad é global por contributor, não por elemento (collision.js:37; sem campo no stride, world.js:17-26); pads assimétricos não são possíveis (E1-11).
  - (2) O ADR diz que 'antídotos conhecidos (termo integral, projeção) ficam fora do default', mas o default do v2 liga o integral (compile-world.js:42, Ki=0.04; createCollision tem default 0.05, collision.js:36). Medido: o integral cria ciclo-limite e windup e atrasa o assentamento (E1-02).
  - (3) repelFrom é um campo 1/d² (tag-forces.js:52-56), o tipo de perfil que o ADR rejeita como 'barreira 1/d' incontrolável; medi salto de 124 px/tick.

**ADR-0012 (arestas por tendências de força): não implementado (Fase 4), e a API ainda não comporta.**
- SHAPE.CAPSULE e DOF.RAIL1 são só constantes (world.js:29,33): RAIL1 integra como FREE2 e CAPSULE colide como AABB.
- Faltam colisores derivados, estrutura de cadeia, trilho de perímetro, pad por elemento, gate bipartido aresta×nó / aresta×aresta e saída routedEdges (E1-07, E1-10, E1-14).
- A fase `topology` existe no solver (solver.js:21,38), mas o estado indexado por slot vaza entre corpos reusados (E1-08).
- O playground prototipa o modelo quase completo (cadeia 2-DOF, cadeia+midline, segmento×obstáculo baricêntrico, anti-cruzamento com força dedicada, fixa × dinâmica com histerese, Manhattan híbrido, reciprocidade, XPBD), com duas lacunas: endpoints vão ao CENTRO e não ao perímetro (:758, :801), e o teste segmento×retângulo erra penetrações reais (E1-13).
- O ADR-0012 cita 'sub-stepping' como antídoto, mas o sub-stepping atual também multiplica o damping (E1-05).

**ADR-0009**: segue vigente. src/routing/physics está marcado @deprecated (index.js:3-8) e o pipeline avisa (pipeline.js:188-200). A supersessão depende da Fase 4.

**ADR-0006 (sem bundler)**: conforme. src/physics não tem dependências e usa ESM puro. Os spikes externos (Rapier 1.29 MB gzip) contrariariam o espírito de runtime mínimo.

**ADR-0007 (DSL × Config)**: conforme. Os knobs ficam em `live.*` (compile-world.js:37-57) e a DSL declara layers e pesos.

**Reaproveitável do legado:** Reaproveitável do legado para a Fase 4. Entre parênteses, o que vira no motor unificado.

**Trilho de perímetro (DOF.RAIL1)**
- src/routing/physics/constraints.js:130-143 `clampAnchorToPerimeter`: projeta no perímetro, zera a velocidade perpendicular, preserva a tangencial e recalcula a face.
  → Vira a constraint RAIL1, com o rect vindo do corpo-nó a cada tick.
- src/routing/physics/constraints.js:161-180 `slideFreeCornersWithAnchors`: o corner vizinho acompanha o deslize tangencial.
- Helpers NÃO deprecated usados por ambos:
  - src/routing/anchor-utils.js:34 `projectToPerimeter`, :9 `faceOf`, :61 `intersectRayWithPerimeter`, :106 `midpointOfCenters`;
  - src/routing/obstacle-route.js:217 `segmentHitsRect` (Liang–Barsky, predicado exato segmento×rect para o narrow-phase; aloca 2 arrays por chamada, pré-alocar).

**Atração de endpoint e snap de portas**
- src/routing/physics/forces-edge-central.js:20-41 `applyEdgeCentralForce`: puxa a âncora para o edgeCenter ou para o snapTarget. É a lei 'endpoint atraído' do ADR-0012; o playground atrai ao centro, então o legado é a referência correta.
- src/routing/snap-resolver.js:31 `resolveNodeSnapPoints` e :65 `pickSnapPoint`.
- src/routing/snap-endpoints.js:17 `snapEndpointsToDiscretePorts`.
- src/routing/physics/warm-start.js:146-168: escolha do snapTarget e reprojeção no perímetro.

**Espalhamento de endpoints numa face**
- src/routing/physics/forces-endpoint-bbox.js:1-13 e :96: repulsão BBox de endpoint × BBox de endpoint, com auto-clamp effectiveSide = min(side, faceSpan / N) (Q11), mais BBox × segmento alheio filtrado por edgeLayer.
  → Vira colisor de endpoint com pad próprio.

**Seleção de face anti-cruzamento (pré-passo discreto)**
- src/routing/face-select.js:87 `reassignFacesToReduceCrossings`: busca gulosa sobre as 2 faces 'à frente'.
- src/routing/crossings.js:94 e :103 `countSharedLayerCrossings` / `sharedLayerCrossingEdges`: métrica para testes e HUD.
- Útil como semeadura de topologia inicial, não como rota prescrita (atenção ao ADR-0012).

**Fissão e fusão de segmentos**
- src/routing/physics/topology.js:
  - :31-89 `splitSegment`;
  - :114-189 `splitSegmentShelf` (desvio H-V-H-V-H quando a perna está presa a uma âncora);
  - :203-253 `mergeColinear`;
  - :270-301 `shouldMerge`, com a guarda de segurança Manhattan para pinos em coordenadas diferentes;
  - :310-350 split/merge de curva;
  - :372-397 gatilho por força residual (`segmentResidualForce`, `updateSplitCounter`, `shouldSplit`), com zona morta;
  - :16-20 cooldowns.
- src/routing/physics/solver.js:
  - :169-213 `runFission`, com modo hardOnly e `hardSplitCap` = 3 (trava anti-cascata);
  - :250-259 `topologyStable`;
  - :221-229 `converged`.
- Lições registradas:
  - src/routing/physics/index.js:48-54: a fissão por resíduo 'explode em grafos densos', por isso é opt-in;
  - src/routing/physics/forces.js:29-38 PERP_PUSH_CAP: manter a força perpendicular abaixo do limiar de fissão, para cruzamentos se resolverem por deslize e não por fissão.
- Portar trocando referências a objetos por handles {slot, gen} (ver E1-08).

**Manhattan**
- src/routing/physics/constraints.js:37-100: `projectManhattanEdge` / `projectRun` (equalização por run em O(1)) e `anchorPinsAxis` (pino parcial de âncora de perímetro).
  → Vira projeção XPBD 'snap no repouso' do cenário G4 híbrido.

**Repulsão aresta×nó com gate por camada e detecção de 'espetado'**
- src/routing/physics/forces.js:60-100 `applyNodeRepulsion`: filtro edgeNodePair e flag foreignObstacle, que dispara a fissão dura.
- src/routing/physics/forces.js:279 `applyPerpRepulsion`: anti-cruzamento com edgeLayerPair, poupando a vizinhança do nó compartilhado.

**Warm-start**
- src/routing/physics/warm-start.js:44-190 `buildWorld`: polyline algébrica → cadeia de corners, âncora inicial pela interseção do raio centro↔edgeCenter, pad de aresta em cascata (:22-42, :120).
  → Semeadura inicial da cadeia; com o motor unificado, preferir persistir a cadeia entre ticks e sessões.
- src/routing/physics/index.js:107-139 `seedWithAStar` (hananRoute, obstacle-route.js:129): só como semente de topologia, com cautela diante do ADR-0012.

**Testes como especificação de comportamento**
- tests/routing/physics/: perimeter-clamp, snap-selection, endpoint-bbox-bbox, endpoint-bbox-vs-segment, fusion-manhattan-safety, hard-fission, phase5-fission, phase5-fusion, phase5-curved, node-repulsion-layers, parallel-repulsion-layers.
- Reescrevê-los contra a API nova antes de apagar o legado.

**NÃO portar**
- src/routing/physics/forces.js:191-202 `applySegPerpForce`: dá a força inteira a cada corner. Não conserva momento e não tem reação no nó, e a Fase 4 exige reciprocidade.
- src/routing/physics/forces.js:43-52 `applyOriginSprings`: puxa de volta para a rota algébrica, ou seja, rota prescrita, contra o ADR-0012.
- src/routing/physics/solver.js:33-34 DAMPING 0.5 e VELOCITY_CAP 16 fixos.
- src/routing/physics/bodies.js: objetos JS por corpo, não AoS.

#### E1-01 · v2 nunca emite 'end' e o loop de rAF roda para sempre (critica, esforço P)

- **Evidência:** src/physics/solver.js:42 `alpha = Math.max(alphaMin, alpha * (1 - alphaDecay))` põe piso em alphaMin; src/layout/compile-world.js:240 testa `alpha < cfg.alphaMin` e :244 reagenda se `alpha >= alphaMin`. Medido (bench/endcheck.mjs, out/endcheck.txt): v2 executa 5000 frames com end=null, alpha=0.003 e loop ainda agendado; v1 termina no frame 481. Os testes não pegam: tests/layout/compile-world.test.js:11 para em 0.005, e as linhas 246-252 estão sem cobertura.
- **Detalhe:** Na prática, diagrama em v2 consome CPU e bateria a 60 fps indefinidamente e nunca 'assenta'. O dossiê cogita tornar o v2 default junto com a Fase 4, o que tornaria isso bloqueante.
- **Recomendação:** Deixar o alpha decair até 0, como no v1 (index.js:366), ou comparar com `<=`. Adicionar teste com requestAnimationFrame falso exigindo 'end' em até N frames.

#### E1-02 · Termo integral do PI (default Ki=0.04) cria ciclo-limite e windup e atrasa o assentamento ~25x (alta, esforço P)

- **Evidência:** compile-world.js:42 `collisionKi: 0.04` (default de createCollision: 0.05 em collision.js:36). O acumulador é descartado quando o par separa (collision.js:68, 93) e satura em accMax=200 (:77), o que dá Ki·200=8 ≫ Kp·pen. Medido (out/collision.txt): no anel de 6 sob carga, Ki=0 dá KE 3.8e-12 e resíduo fixo de 2.75 px, enquanto Ki=0.04 dá KE 3.7 perpétuo, overlap entre 1.3 e 5.5 px e 368 trocas de contato em 500 ticks. Na coluna de 10 corpos o PI não converge (8→26→18 px). No drag, v pico 21.6 contra 12.3 e sobra de 31.7 px contra 6.4. Na cena N=40 (out/v1v2.txt), Σd² no tick 400 é 1.4 (Ki=0.04) contra 0.057 (Ki=0).
- **Detalhe:** O teste que 'prova' o PI (tests/physics/collision.test.js:55-78) é 1D, com 2 corpos e damping 0.5; não representa contato unilateral com várias restrições. O próprio playground marca C3 (PI) como 'aberto' (physics-playground.html:829), e o ADR-0011 manda deixar o integral fora do default.
- **Recomendação:** Default Ki=0, alinhado ao ADR-0011. Se o resíduo sob carga incomodar: integral com vazamento (leaky, e.v *= λ) e bumpless (sem zerar na separação, só decair), ou garantir não-overlap por projeção XPBD de desigualdade só na fase de repouso (alpha baixo).

#### E1-03 · v2 não trata containers como corpos: container×container e peer×container se sobrepõem (alta, esforço M)

- **Evidência:** compile-world.js:72-74: containers com filhos não viram corpos (rect derivado em :191-212). O v1 resolve folha×container e container×container (src/layout/adapters/live/collision-resolution.js:54-76). Medido (bench/containers.mjs, out/containers.txt): após 1500 ticks, v2 tem AB=24.4 px, pB=22 px e qA=22 px de overlap; v1 tem 0 em todos.
- **Detalhe:** O ADR-0010 prevê 'container é um corpo que repele peers E hospeda um atrator-região'. O playground F5 (decisivo) chama a geometria derivada de 'a costura frágil do compile-world'.
- **Recomendação:** Antes de tornar o v2 default: container como corpo cinemático/derivado. Duas formas: (a) AABB recalculada por tick, com a força de colisão distribuída aos filhos na proporção da massa; ou (b) atrator-região para os filhos + corpo repulsor do frame, conforme ADR-0010. Adicionar teste de paridade container×container.

#### E1-04 · v2 ignora o warm restart: cada edição da DSL re-semeia o layout em círculo (alta, esforço P)

- **Evidência:** src/app/pipeline.js:121-151 passa live.seedPositions/seedAlpha; o v1 os usa (live/index.js:107-114, 149-152); compile-world.js:81-91 sempre semeia no círculo. Medido (bench/warmrestart.mjs): ao adicionar 1 nó, o deslocamento médio dos nós existentes após 1 tick é 0 px no v1 e 93 px no v2 (máx 166); após 600 ticks, médio de 10 px no v1 e 50 px no v2. A inversão da ordem de declaração desloca um nó até 555 px (out/v1v2.txt).
- **Detalhe:** Para 'diagramas vivos' isso anula a continuidade entre edições, que é a experiência central do projeto.
- **Recomendação:** Portar a lógica de seed/warmAlpha do v1 para startLayoutV2 e, para corpos novos, semear perto de vizinhos conectados em vez do índice.

#### E1-05 · Sub-stepping aplica o damping a cada sub-passo: a dinâmica muda com N (alta, esforço P)

- **Evidência:** integrator.js:41 `vx = (vx + ax*dt) * damping` roda uma vez por sub-passo (solver.js:39, com o mesmo integratorOpts). Medido (out/stability.txt b): o fator por tick é 0.82^N e a distância de planeio cai de 45.6 px (N=1) para 11.4 (N=4) e 5.7 (N=8). No playground o loop de frame faz o mesmo (physics-playground.html:1014-1024), então a evidência do A2 ('sub-stepping doma a rigidez') mistura menor dt com damping ~0.45 por tick.
- **Detalhe:** Separando os efeitos com damping corrigido d^(1/N): sub=4 continua estabilizando (Kp=10 com dt=1 assenta), mas com dt=2 e Kp≥6 sobra KE de 7e1–7e2. O efeito é real, só menor do que o playground sugere.
- **Recomendação:** Expressar damping como taxa: d_sub = d^(dt/baseDt), ou v *= exp(-c·dt). Adicionar teste de invariância a substeps. Reavaliar a conclusão do A2 depois da correção.

#### E1-06 · Broad-phase (hash de strings) não compensa, degrada com corpos grandes e aloca MB por tick (alta, esforço M)

- **Evidência:** spatial-grid.js:14-16 (chave string por célula), :26-36 (cellSize = 2·maior meia-extensão), :64-75 (Set de pares com chave double não-Smi); collision.js:52 (closure por par) e :74 (objeto {v,s} por contato). Medido (out/broadphase.txt, out/alloc.txt): enumeração de pares 0.72 ms contra 1.72 ms da força bruta em N=500 e 11.9 contra 19.0 em N=2000, mas a colisão completa custa 26.9 ms em N=2000. Com 1 corpo de 3000x2000, cellSize vai a 3024, 39 149 candidatos para 1 961 reais e pares 5x mais lentos que a força bruta. Alocação por tick: 297 KB / 980 KB / 8 MB (N=100/500/2000), contra o 'zero pressão de GC' de world.js:5.
- **Detalhe:** Na Fase 4, cápsulas de aresta longas e diagonais têm AABB grande: é exatamente o caso degenerado. Um grafo de ~100 nós + 150 arestas × 6 corners já passa de 1000 corpos.
- **Recomendação:** Trocar por sweep-and-prune com ordenação por inserção (coerência temporal) ou por árvore AABB dinâmica. Chave de par Smi (a*32768+b), cache de contatos em typed arrays e máscara de camadas em bitset. O spike bench/sap-spike.mjs mantém paridade de força (Δ≤1.5e-5 em cena uniforme), é 9–25x mais rápido com corpos grandes, 1.5–2x em N=500–2000, e aloca 6–30x menos.

#### E1-07 · API do World não suporta arestas-como-corpos: CAPSULE e RAIL1 são só constantes (alta, esforço G)

- **Evidência:** world.js:29 SHAPE.CAPSULE e :33 DOF.RAIL1 são só constantes; `kind` nunca é lido (grep) e o integrador só olha FIXED0 (integrator.js:30). Medido (out/phase4-probe.txt): um corpo RAIL1 com força (3,4) vai para (3,4), ou seja, livre em 2D. A colisão trata a cápsula diagonal como AABB 200x200 e empurra um nó a 99 px da linha. O stride tem 9 campos (world.js:17-26), sem endpoints, raio, orientação ou pad.
- **Detalhe:** Faltam: (1) colisores derivados (cápsula = 2 handles de corner + raio), com força distribuída por (1-t, t) e reação no nó (o eixo recíproco); (2) narrow-phase cápsula×AABB e cápsula×cápsula exata, incluindo força perpendicular dedicada para cruzamento real (playground :625/:734); (3) estrutura de cadeia (aresta → lista ordenada de handles); (4) restrição de trilho de perímetro que acompanha o nó em movimento; (5) atrator do endpoint ao perímetro; (6) saída routedEdges na sessão.
- **Recomendação:** Criar uma camada 'colliders' separada de 'bodies' (arrays paralelos: tipo, slotA, slotB, raio, pad, máscaras) consumida pela broad-phase. Implementar RAIL1 como constraint XPBD de projeção no perímetro (reusar anchor-utils.projectToPerimeter). Definir um módulo 'chains' com fissão/fusão sobre handles. Escrever o plano da Fase 4 em torno dessas três peças.

#### E1-08 · Estado externo indexado por slot sobrevive ao reuso de slot; grow() invalida referências (media, esforço P)

- **Evidência:** collision.js:66 usa chave por slot (sem geração); connectivity-spring.js:21-22 e as constraints guardam slots crus; grow() realoca data (world.js:53-68). Medido (out/phase4-probe.txt): um corpo novo no slot reusado herda o acumulador 200 e recebe força 8.30 com overlap de 1 px (24x o esperado, 0.34). A mola passa a agir sobre um corpo não relacionado (força 49). Escrita via referência antiga de data após grow não aparece no World (out/phase4-grow.txt).
- **Detalhe:** A free-list com geração existe (world.js:99-117), mas nenhum consumidor usa handles. Fissão/fusão (Fase 4) cria e remove corpos dentro da fase de topologia (solver.js:38), então esse caminho será exercitado.
- **Recomendação:** removeBody notifica os contributors (hook onRemove) ou a chave de contato inclui a geração; molas e constraints guardam {slot, gen} e validam com isAlive; reservar capacidade antes da topologia ou proibir cache de world.data entre addBody.

#### E1-09 · v2 sem velocityCap; repelFrom 1/d² gera saltos de centenas de px por tick (media, esforço P)

- **Evidência:** compile-world.js:163 não passa velocityCap (o default do integrador é Infinity, integrator.js:23); o v1 usa maxVel 32 (live/index.js:31). Medido: pico de 368 px/tick com sobreposição inicial (out/stability.txt d); repelFrom a 5 px dá |v| = 123.7 px/tick num único tick (out/tagforces.txt; tag-forces.js:52-56).
- **Recomendação:** Passar velocityCap (≈32, como no v1) e limitar ou suavizar repelFrom (o ADR-0011 rejeita barreiras 1/d); por exemplo, perfil linear com zona.

#### E1-10 · Gate de camadas (um Set por corpo) e massa global não expressam a semântica do produto (media, esforço M)

- **Evidência:** collision.js:24-29 faz interseção simétrica de um único Set (world.js:43). O resolver do produto usa duas specs por aresta, edge.nodeCollision (aresta×nó) e edge.edgeCollision (aresta×aresta), com exclusão de endpoints/ancestrais e de arestas com endpoint comum (src/layout/collision.js:113-148). Pesos: o v2 usa invMass = 1 - maxWeight de todas as camadas (compile-world.js:92); o v1 usa a média dos pesos nas camadas compartilhadas por par (layout/collision.js:63-69).
- **Detalhe:** Um nó com peso 1 na camada A e 0 na B é pesado contra todos no v2, mas leve nas colisões de B no v1. O pairFilter por par (compile-world.js:105-111) com lookups em Map é o único escape, e é caro no laço quente.
- **Recomendação:** Máscaras categoria/colisão por classe de colisor (nó, segmento) em bitsets, grupos de exclusão precomputados e um ADR curto sobre semântica de massa × peso por camada.

#### E1-11 · Zona de força por elemento (ADR-0011 item 1) não implementada (media, esforço P)

- **Evidência:** collision.js:37 tem pad global por contributor e :62-63 soma 2·pad; o World não tem campo de pad (world.js:17-26). O playground implementa padA+padB por corpo (physics-playground.html:196-198, cenário C5).
- **Detalhe:** A Fase 4 precisa de pads distintos: aresta com pad = traço e nó com pad = nodePad.
- **Recomendação:** Adicionar PAD ao stride (ou a array paralelo do colisor) e trocar 2·pad por padA+padB. A broad-phase deve inflar pelo pad de cada corpo.

#### E1-12 · tag-forces viola o ADR-0010 (atração corpo→corpo, sem reação) (media, esforço P)

- **Evidência:** tag-forces.js:23-39: attractTo puxa o corpo i para cada corpo com a tag e escreve só em oi (:36-37). Medido: F(a)=0.60, F(b)=0, soma 0.60 ≠ 0 (out/tagforces.txt). O ADR-0010 diz 'toda atração vem de atratores'.
- **Recomendação:** Reescrever attractTo como atrator-ponto no centróide do grupo da tag (ou atrator-região), ou registrar a exceção num ADR.

#### E1-13 · Protótipo de aresta do playground usa aproximações que não podem ser portadas (media, esforço P)

- **Evidência:** segVsBodies (physics-playground.html:237-254) mede a SDF no ponto do segmento mais próximo do CENTRO do obstáculo. Medido (out/playground-segvs.txt): em 2 de 3 casos com nó largo (200x20), um segmento que penetra de fato (SDF mínima -10 e -7.9) não é detectado. Os endpoints são atraídos ao centro do nó, não ao perímetro (:758, :801). É O(N²) sem broad-phase, e o PI acumula sem dt (:203).
- **Detalhe:** O que o playground prototipa e que vale como especificação: cadeia de corners 2-DOF, molas de cadeia e midline, repulsão segmento×obstáculo com distribuição baricêntrica, anti-cruzamento segmento×segmento com força perpendicular dedicada a cruzamento real (:625), topologia fixa × dinâmica com histerese lmin=lmax/4 (:650), dobra/snap/híbrido Manhattan (G4), reciprocidade aresta→nó (:768) e XPBD com varredura Gauss-Seidel simétrica (B1, :285-291).
- **Recomendação:** Usar distância exata segmento×AABB: Liang–Barsky de obstacle-route.js:217 como predicado, mais o mínimo da SDF nos cantos e arestas do retângulo. Tratar os números do playground como qualitativos.

#### E1-14 · Sessão v2 não entrega saída de arestas, e o pipeline ainda aplica pós-processamento algébrico (media, esforço M)

- **Evidência:** compile-world.js:177-227 (commit) não produz edgeWaypoints nem labelBBoxes, que o v1 produz (live/index.js:185-189, 504) e o pipeline consome (pipeline.js:215). pipeline.js:179-180 já aceita `session.routedEdges`, mas no ramo não-'physics' ainda roda applyObstacleRouting, clip e snap (:208-238). Caps do live: providesRouting=false (live/index.js:47).
- **Recomendação:** Na Fase 4: o compile-world expõe routedEdges, caps.providesRouting=true e o pipeline ganha um ramo que pula o detour algébrico quando a sessão fornece rotas. Até lá, documentar a perda de colisão de label no v2.

#### E1-15 · Registry de fields/contributors é código morto em produção (baixa, esforço P)

- **Evidência:** `grep physics/registry|buildContributors` em src não encontra nenhum import fora do próprio registry.js; compile-world.js:28-32 importa os contributors direto. O registry não inclui tag-forces (registry.js:13-17) e está 50% em funcs.
- **Recomendação:** Ou o compile-world passa a montar o schedule via registry (útil para plugar campos da Fase 4), ou o registry é removido.

#### E1-16 · Integrador explícito limita a rigidez; XPBD é estável em qualquer rigidez para as restrições da aresta (info, esforço M)

- **Evidência:** Medido (out/stability.txt c; out/xpbd.txt): mola penalty explode com k≥2.5 (sub=1) e fica estável até k=5 com sub=4. Numa cadeia de 12 corners, penalty explode com k≥2 (dt=1) e k≥1 (dt=2), enquanto XPBD (porta de physics-playground.html:285-291) fica estável com α∈[0,1] e dt∈{1,2}. A colisão faz chatter sem assentar com Kp≥2 (dt=1, sub=1).
- **Detalhe:** O ADR-0012 pede tendências, não garantias. XPBD com complacência α>0 é tendência com rigidez contínua e estável, e o playground já o marca como finalista (B1 'decisivo', B2 'aberto').
- **Recomendação:** Engine da Fase 4 híbrida no mesmo solver: forças (atratores, repulsão de zona, anti-cruzamento) + fase XPBD pós-integração para comprimento de cadeia, trilho de perímetro e snap Manhattan híbrido, com varredura simétrica. Registrar em ADR.

#### E1-17 · Engines externas (Rapier, planck) não justificam a troca (info, esforço P)

- **Evidência:** Medido (out/libs.txt), mesma cena: Rapier2D 0.21 com 1.53 ms (N=500) e 8.43 ms (N=2000); planck 1.4.2 com 6.94 e 42.9 ms; motor atual com 1.95 e 28.5 ms. Rapier: 3.4 MB mjs (WASM inline, 1.29 MB gzip). planck: 55 KB gzip, ESM (dist/planck.mjs).
- **Detalhe:** As duas usam solver de contato rígido com rotação a travar e não modelam zona de força nem PI. Com o SAP do E1-06, o motor atual fica em ~14 ms em N=2000. O ganho de velocidade do Rapier só pesa acima da escala-alvo (centenas) e custa ADR-0006 (peso) e ADR-0012 (contato duro).
- **Recomendação:** Manter o motor próprio (valor de pesquisa) e otimizar. Guardar o Rapier como baseline de referência em benchmark, não como dependência.

#### E1-18 · Determinismo: idêntico bit a bit no mesmo runtime, mas sensível à ordem de declaração (info, esforço P)

- **Evidência:** Medido (out/v1v2.txt): duas execuções do v2 (200 ticks) saem idênticas bit a bit. Com os nós declarados em ordem inversa, um nó se desloca até 554.9 px após 400 ticks, porque o seed depende do índice (compile-world.js:88-90). Math.cos/sin/hypot têm precisão definida pela implementação: determinismo entre navegadores NÃO verificado.
- **Recomendação:** Semear por hash do id do nó (estável à ordem) e adicionar teste de determinismo do solver (snapshot de posições).

