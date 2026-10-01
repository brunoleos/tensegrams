# Trilha 6 · Routing: qualidade e alternativas

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito:** Adotar 2 de 7 propostas (RA-1 como desenho da Fase 4 e o descarte RA-7), levar 1 a spike adicional (RA-3, OVG como semente) e rejeitar 4 (RA-2, RA-4, RA-5, RA-6). Verifiquei por execução própria que a continuidade vem da PERSISTÊNCIA da cadeia, não do planejador nem principalmente do clamp: sem clamp (vmax=10⁶), a cadeia teve 0 de 89 frames com salto > 20 px nas sementes corda e OVG (máx. 11,2 e 9,6 px), contra 10 de 89 do app (máx. 275,5 px). O planejador só compra qualidade: E×N de política 8,4 contra 55,2. Também confirmei o segundo mecanismo de flicker apontado pelo defensor: com clipAnchors=false, e:n28|n4 ainda alterna entre diagonal e dois L espelhados. ADRs: manter e emendar o 0012, superseder já o 0009 por um contrato de engine com estado, revisitar o 0013 e registrar um ADR de rejeição de libs. O legado src/routing/physics deve ser removido ANTES da Fase 4, depois de extrair portas e trilho.

Adoto 2 de 7 propostas, mando 1 a spike e rejeito 4: Fase 4 como cadeia persistente, planejador só como semente opcional.

### Decisões por proposta

| proposta | decisão | evidência decisiva | condição |
|---|---|---|---|
| RA-1 cadeia persistente semeada por evento | adotar | salto > 20 px em 0 de 89 frames, contra 10 a 89 de 89 no app (synth40 v2) | semente plugável, default trivial (corda ou Hanan) |
| RA-2 atrator-path com replano K=20 | rejeitar | E×N 29,4 contra 6,9 do S0; 184,7 contra 43,4 ms/frame | — |
| RA-3 OVG própria (ESM, 6,1 KB gz) | spike adicional | melhor semente medida; sozinha, X de −30% a −38% contra o orthogonal | política do resolver; Worker com orçamento |
| RA-4 libavoid-js (LGPL, beta) | rejeitar | pior semente (X 443,6); X pior que o interno no synth40 (155 vs 125; 385 vs 290) | só oráculo offline |
| RA-5 Graphviz WASM | rejeitar | 632 KB gz; 12 de 168 arestas de container sem rota | ortho como régua dev-only no harness |
| RA-6 FDEB e bundling | rejeitar | X +44% por −8,7% de tinta (synth120 v1); atração par-a-par fere o ADR-0010 | — |
| RA-7 descartar ELK e MSAGL | adotar | ELK move 40 de 40 folhas; MSAGL crasha no v2 e importa CommonJS | registrar nota de rejeição |

### Alegações contestadas que verifiquei

**Origem da continuidade.** O defensor atribui o "0 de 89" ao clamp vmax=4 (spikes/attractor/attractor.mjs:125-129). Rodei o mesmo código com vmax=10⁶ (juiz/seed-sens-vmax.mjs). A cadeia seguiu contínua: a persistência é a causa principal, e o clamp só corta resíduos.

| synth40 v2, ticks 200–289, sem clamp | X médio | E×N de política médio | frames com salto > 20 px | salto máx. (px) | plano (ms) |
|---|---|---|---|---|---|
| app orthogonal por frame | 269,9 | 51,4 | 10 de 89 | 275,5 | 4,2 por frame |
| app reamostrado (só viés de X) | 303,6 | 56,8 | — | — | — |
| cadeia, semente corda | 228,9 | 55,2 | 0 de 89 | 11,2 | 0 |
| cadeia, semente app | 278,8 | 54,8 | 2 de 89 | 31,5 | 0 |
| cadeia, semente OVG | 183,4 | 8,4 | 0 de 89 | 9,6 | 360 |

No containers v2 sem clamp, corda, app e OVG deram 5, 3 e 0 frames acima de 20 px (máx. 33 px). O app cru salta até 159 px. O planejador não compra continuidade; compra E×N de política (8,4 contra 55,2 da corda).

**Viés da métrica.** Reamostrar a mesma rota do app sobe X de 269,9 para 303,6 (+12%). As paralelas vão de 381 para 2090, porque a métrica conta segmentos. Cadeias devem ser comparadas ao baseline reamostrado, e "paral." de cadeias não vale.

**Flicker de e:n28|n4.** Rodei os scripts das duas partes (juiz/out/flicker-*.txt). Com clipAnchors=false o bbox fica estável, como diz o desafiante. Mas a rota ainda alterna entre diagonal e dois L espelhados, com o canto indo de (−72,76) a (72,−286).

O defensor está certo: há um segundo mecanismo no obstacle-route. "Elimina o flicker" só vale porque a cadeia deixa de recalcular por frame.

**Outras.** ovg.js e run-ovg.mjs têm 0 ocorrências de resolver ou edgeNodePair. out1/eval.md tem 11 cenas, sem o intro v2. router.js:8 é síncrono e não há `.load(` em src/app nem em src/routing.

O payload por arquivo é 170,7 KB (src) mais 81,4 KB (yaml) gz. O libavoid somaria +79%, não "dobraria". Não rodei libavoid sem clamp nem o motor real; a cadeia é o brinquedo do desafiante (26 a 43 ms/frame no synth40).

### Implicações para os ADRs

| ADR | ação | motivo |
|---|---|---|
| 0012 | manter e emendar | continuidade exige persistência (medido); esclarecer que "topologia semeada" (linhas 31-32) admite planejador por evento, nunca por frame |
| 0009 | superseder já | "qualidade superior em casos densos" não se sustenta (R1-09); a co-igualdade não existe no código (pipeline.js:187) |
| 0013 | revisitar | "qualquer combinação layout×router funciona" (linha 34) é falso (R1-06); live com planejador caro rotearia a cada frame |
| 0010 | manter | RA-2 e FDEB não justificam atração par-a-par |
| novo | criar | contrato de engine com estado: route(ir, rects, ctx, prevState) → {routedEdges, state, diagnostics}, load() assíncrono e caps |
| novo | criar | nota de rejeição: libavoid e Graphviz em runtime, ELK, MSAGL e FDEB |

A emenda do ADR-0012 precisa de confirmação do mantenedor. A leitura do defensor, com base nas linhas 38-39 ("Híbrido A* + suavização"), é legítima para replanos que trocam topologia.

### Legado src/routing/physics

É o pior em continuidade: 89 de 89 frames com salto, máximo de 802,7 px. Apaga qualquer semente: E×N de 0 para 49 (v1) e de 0 para 90 (v2) em 30 passos (spikes/seed/out). Reconstrói o mundo a cada tick (src/routing/physics/index.js:35, `void prevState`).

Antes da Fase 4, nesta ordem:
1. Extrair snap-resolver, trilho de perímetro e espalhamento de portas para um módulo neutro (R1-17).
2. Portar o espalhamento como passe algébrico, único ganho robusto (portas 82 contra 233 no synth120 v2).
3. Reescrever os E2E 14, 18 e 19 como cenários do harness com limiares.
4. Remover as 1952 linhas, os 19 arquivos de teste e as superfícies órfãs da DSL (hard cut, ADR-0008).

Depois da Fase 4, nada do legado deve voltar. Não portar rebuild por tick, topology.js nem o warm-start (R1-07, R1-08).

### Recomendações priorizadas

| # | ação | origem | esforço |
|---|---|---|---|
| 1 | v2 emitir 'end' (solver.js:42 contra compile-world.js:240) | R1-05 | P |
| 2 | extrair runRoutingStage e contrato com estado | R1-14, R1-18 | M |
| 3 | harness como teste unitário com limiares, incluindo salto > 20 px | R1-16, R1-09 | P |
| 4 | corrigir pernas para dentro, gatilho pela corda, clip-anchors e curved | R1-01, R1-11, R1-19, R1-02 | P |
| 5 | desempate estável no obstacle-route | verificação do juiz | P |
| 6 | extrair portas e remover o legado | R1-13, R1-17, R1-03 | M |
| 7 | Fase 4 com semente trivial; aceitação de 0 frames > 20 px | RA-1 | G |
| 8 | spike da OVG como semente no motor real, com política e Worker | RA-3 | M |
| 9 | configuração única de routing | R1-10 | P |
| 10 | decidir o canal edgeWaypoints na virada para o v2 | R1-12 | M |

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Fazer o layout v2 emitir 'end' (R1-05) | alto | P | solver.js:42 põe piso em alphaMin e compile-world.js:240 só emite 'end' com alpha < alphaMin, então o routing roda a cada frame para sempre. Qualquer gatilho 'por evento' (RA-1) e a virada do v2 para default dependem disso. |
| 2 | Extrair runRoutingStage e definir contrato de engine com estado (R1-14, R1-18) | alto | M | route() é síncrono (router.js:8), load() nunca é chamado (grep vazio) e o estágio vive num closure (pipeline.js:170-245). Sem isso, nem a Fase 4 nem um planejador caro (OVG em Worker) podem ser plugados, e o harness continua espelhando o pipeline à mão. |
| 3 | Harness como teste unitário com limiares, incluindo continuidade (R1-16, R1-09) | alto | P | Salto > 20 px, X, E×N de política, ←in e portas viram critério objetivo de aceitação da Fase 4 e regressão para o algébrico. Comparar cadeias contra o baseline reamostrado: reamostrar infla X em 12% e paralelas em 5,5×. |
| 4 | Correções P do algébrico: pernas para dentro, gatilho pela corda e A* silencioso, clip-anchors e curved degenerado (R1-01, R1-11, R1-19, R1-02) | alto | P | São defeitos do default do app (orthogonal) que as alternativas 'zeram'. Corrigi-los reduz o ganho marginal real dessas alternativas e melhora o baseline-oráculo permanente. clipAnchors=false sozinho já baixa o orthogonal de 10 para 2 frames com salto no synth40 v2. |
| 5 | Desempate estável e histerese no obstacle-route (segundo mecanismo de flicker) | medio | P | Verifiquei que, com clipAnchors=false, e:n28\|n4 alterna entre diagonal e dois L espelhados, com o canto indo de (−72,76) a (72,−286). O straight ainda salta em 39 de 89 frames. É defeito do routing sem estado, independente do R1-19. |
| 6 | Extrair portas, trilho e espalhamento; depois remover src/routing/physics antes da Fase 4 (R1-13, R1-17, R1-03) | alto | M | O legado é o pior em continuidade (89 de 89 frames, máx. 802,7 px), apaga sementes (E×N 0→49 e 0→90 em 30 passos) e ocupa 1952 linhas mais 19 arquivos de teste. Seu único ganho robusto é o espalhamento de portas (82 contra 233 no synth120 v2), que pode ser portado como passe algébrico. |
| 7 | Fase 4 com cadeia persistente e semente trivial; aceitação de 0 frames com salto > 20 px sem depender de clamp | alto | G | Medi que a persistência sozinha dá continuidade (corda sem clamp: máx. 11,2 px) e ainda reduz X contra o app reamostrado (228,9 contra 303,6). O planejador fica para depois, como semente plugável. |
| 8 | Spike da OVG como provedor de semente no motor real | medio | M | É a melhor semente medida (E×N de política 8,4 contra 55,2 da corda), mas o spike não consome a política da DSL, custa até 17,7 s e não roda o intro v2. Medir no src/physics, em Worker, com orçamento e com a transição de replano. |
| 9 | Fonte única de configuração de routing (R1-10) | medio | P | options.routing.engine na DSL é aceito e ignorado, e há flags validadas que nunca são lidas. Isso contraria o ADR-0007 e vai confundir a seleção de engine/semente da Fase 4. |
| 10 | Decidir o canal lateral edgeWaypoints na virada para o v2 (R1-12) | medio | M | O v1 roda A* por tick fora do contrato do adapter (63% do tempo no synth120), e o v2 não o fornece. Tornar o v2 default muda o routing em silêncio. A saída compatível é virar semente da Fase 4 ou ser removido. |
| 11 | Registrar as decisões: emenda do ADR-0012, novo ADR de contrato (supersede 0009) e nota de rejeição de libs | medio | P | Evita reabrir libavoid, Graphviz, ELK, MSAGL e FDEB sem fato novo, e fixa a leitura de 'topologia semeada' antes do plano da Fase 4, que hoje não está no repo. |

### ADRs candidatas desta trilha

- **Contrato de engine de routing com estado** (confiança alta; supersede ADR-0009). Engine de routing = plugin registrado com route(ir, rects, ctx, prevState) → {routedEdges, state, diagnostics}, load() assíncrono efetivamente chamado pelo pipeline e caps declaradas (orthogonal, curves, obstacleAware, stateful, custo). O algébrico vira engine-oráculo permanente; a co-igualdade é verificada pela mesma bateria do harness.
- **Remover o routing físico deprecated antes da Fase 4** (confiança media). Extrair snap-resolver, trilho de perímetro e espalhamento de portas para um módulo neutro, portar o espalhamento como passe algébrico, reescrever os E2E 14, 18 e 19 como cenários do harness e então remover o legado e as superfícies órfãs da DSL (hard cut à la ADR-0008), sem esperar a Fase 4.
- **Emenda do ADR-0012: continuidade por persistência; planejador só como semente por evento** (confiança media). Esclarecer que 'topologia semeada' admite um planejador obstacle-aware executado por EVENTO (carga, edição, fim de arrasto, 'end'), nunca por frame, com a cadeia persistente como única dona da geometria entre eventos. Replano que troca topologia fica em aberto até que a transição seja medida.
- **Rejeição de roteadores externos em runtime e de edge bundling** (confiança alta). Não adotar nenhuma dessas bibliotecas em runtime. libavoid e Graphviz-ortho ficam permitidos só como oráculos dev-only no harness, fora de src/ e da suíte obrigatória. Reabrir apenas com fato novo (por exemplo, API de exclusão por conector no libavoid).

### Sugestões de evolução do processo desta trilha

- `RT-J01` (new-adr) → .feat-memory/decisions/ (novo ADR): Contrato de engine de routing com estado, com load() assíncrono e caps. Supersede o ADR-0009 e corrige o ADR-0013:34.
- `RT-J02` (new-adr) → .feat-memory/decisions/0012-edges-driven-by-force-tendencies.md: Emenda do ADR-0012: continuidade por persistência medida; planejador obstacle-aware só como semente por evento; replano com troca de topologia em aberto. Precisa de confirmação do mantenedor.
- `RT-J03` (new-adr) → .feat-memory/decisions/ (novo ADR): Nota de rejeição de libavoid e Graphviz em runtime, e de ELK, MSAGL e FDEB, com os números dos spikes, para não reabrir sem fato novo.
- `RT-J04` (new-rule) → AGENTS.md (gate) e tests/routing (teste unitário do harness): Toda mudança em src/routing ou no routing da Fase 4 roda o harness com limiares por cenário: salto > 20 px, X, E×N de política, ←in, portas e invariantes.
- `RT-J05` (heuristic-fix) → harness/lib/metrics.js: A métrica de paralelas conta segmentos e explode em cadeias reamostradas (381 → 2090 com a MESMA forma); X sobe 12%. Comparar cadeias contra o baseline reamostrado e normalizar 'paral.' por comprimento.
- `RT-J06` (heuristic-fix) → src/routing/obstacle-route.js: obstacle-route alterna entre reta e dois L espelhados em frames consecutivos (e:n28\|n4, synth40 v2), mesmo com clipAnchors=false. Faltam desempate determinístico estável e histerese.
- `RT-J07` (doc-gap) → .feat-memory/manifest/features/ (nova feature ou F-0017): O plano escrito da Fase 4 não está no repo. Reescrevê-lo com: persistência primeiro, semente plugável, critérios de aceitação medidos pelo harness e sequência de remoção do legado.
- `RT-J08` (doc-gap) → .feat-memory/decisions/0009-physics-routing-opt-in.md e F-0017: ADR-0009:37 e F-0017 afirmam 'qualidade superior em casos densos' e os critérios A2/A3, mas a medição não sustenta (R1-09). Corrigir com números reprodutíveis.

### Fontes

- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/juiz/seed-sens-vmax.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/juiz/out/seed-sens__synth40__v2__t200-290__vmax1000000__ovg.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/juiz/out/seed-sens__containers__v2__t30-482__vmax1000000__ovg.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/juiz/out/flicker-on.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/juiz/out/flicker-off.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/juiz/out/flicker2-off.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/cache-parcial.json
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/attractor/attractor.mjs:125-129
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/attractor/out/synth40__v2__t200-289__K20.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/attractor/out/jumps-internal-synth40-v2-t200-m290.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/seed/out/synth40__v1__s30.json
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/seed/out/synth40__v2__s30.json
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/ovg-astar/out1/eval.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/spikes/libavoid/node_modules/libavoid-js/package.json
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/defensor/out/seed-sens__synth40__v2__t200-290.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/defensor/out/seed-sens__synth40__v2__t200-290__ovg.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/defensor/out/jumps-fix__synth40__v2__t200-290.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/harness/lib/frame.js:79-114
- /home/user/tensegrams/.feat-memory/decisions/0012-edges-driven-by-force-tendencies.md:24-39
- /home/user/tensegrams/.feat-memory/decisions/0009-physics-routing-opt-in.md:18-37
- /home/user/tensegrams/.feat-memory/decisions/0013-plugin-architecture-layout-routing.md:34
- /home/user/tensegrams/.feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md:24-29
- /home/user/tensegrams/src/routing/router.js:7-8
- /home/user/tensegrams/src/routing/registry.js:1-11
- /home/user/tensegrams/src/app/pipeline.js:170-215
- /home/user/tensegrams/src/routing/physics/index.js:35
- /home/user/tensegrams/src/physics/solver.js:42
- /home/user/tensegrams/src/layout/compile-world.js:240-244
- /home/user/tensegrams/src/editor.js:16
- /home/user/tensegrams/index.html:10-16

## Apêndice A · Propostas, réplicas e decisões

#### RA-1 · Semente obstacle-aware + cadeia de partículas PERSISTENTE (topologia semeada) como base da Fase 4

- **Substitui:** O warm-start que reconstrói tudo a cada tick no engine deprecated (src/routing/physics: buildWorld/seedWithAStar; index.js:35 'void prevState'). O canal lateral edgeWaypoints do live v1 (src/layout/adapters/live/collision-waypoints.js, A* de Hanan por aresta a cada tick). E a proposta de usar a rota algébrica 'apenas como semente' SEM persistência.
- **Proposta:** O planejador obstacle-aware (RA-3 OVG próprio ou RA-4 libavoid) roda por EVENTO, nunca por frame: carga ou edição da DSL, fim de arrasto, 'end' do layout. A polilinha que ele produz vira a cadeia inicial de corners 2-DOF da Fase 4. Essa cadeia PERSISTE entre frames:
- endpoints presos ao trilho do perímetro;
- repulsão de nós por zona linear (ADR-0011);
- repulsão entre segmentos;
- molas de cadeia;
- velocidade limitada por frame.
O planejador escolhe a topologia; a física a mantém viva. A diferença para o engine deprecated é que ele recria o mundo a cada tick a partir do orthogonal ingênuo (R1-07) e suas forças apagam a semente.
- **Evidência do desafiante:** (a) Continuidade. O salto é o deslocamento máximo, entre frames consecutivos, de 24 pontos reamostrados de cada aresta. Medido sobre frames REAIS do live v2.
- synth40 v2, ticks 200–289 (nós movendo p50 2,8 px/frame, máx. 5,6 px, conforme node-motion.mjs):
  - libavoid recalculado por frame: salto > 20 px em 88 de 89 frames (p50 250,6 px, máx. 292,7).
  - routing atual do app: straight 80 de 89 (p50 583 px); curved 70 de 89; orthogonal 10 de 89 (máx. 275,5); physics deprecated 89 de 89 (máx. 802,7). Fonte: out/jumps-internal-synth40-v2-t200-m290*.md.
  - S0 (semente única + cadeia persistente): 0 de 89, máx. 6,8 px.
- containers v2 (451 frames): libavoid por frame com 18 frames acima de 20 px (máx. 352,6); interno orthogonal 11 (máx. 158,6); physics 12 (máx. 185,1); S0 com 0 (máx. 6,7).
- forces v2: libavoid por frame 7 (máx. 87,5); S0 0 (máx. 5,4).
- Mecanismo de um flicker do app (flicker-edge.mjs): a âncora de e:n28|n4 alterna entre (72,76) e (−48,−141) a cada ~3 frames. Com routing.algebraic.clipAnchors=false o bbox fica estável, logo é o clip-anchors projetando a âncora na face de um container alheio sobreposto (R1-19).

(b) Qualidade no synth40 v2 (médias de 6 amostras):
- S0: E×N 6,9 (pol 3,4), X 462 (26).
- libavoid por frame: E×N 0, X 223 (22,6).
- Leitura: a semente envelhece em cruzamentos conforme o layout evolui. No último frame, X 457 contra 171.

(c) Contraste: a mesma ideia no engine deprecated (spikes/seed, 30 passos a partir da semente) APAGA a semente.
- synth40 v1, semente libavoid: E×N 0→49 (pol 0→11).
- Semente com penalidade de cruzamento: X 45→77 (v1) e 43→245 (v2).
- synth40 v2, semente libavoid: E×N 0→90 (pol 0→49).
- **Spike:** R/spikes/attractor/.
- attractor.mjs compara 4 métodos sobre frames reais do live: libavoid a cada frame; replano a cada 20 frames + deformação; atrator-path; S0 = semente sem atrator.
- Saídas: out/containers__v2__K20.md, out/forces__v2__K20.md, out/synth40__v2__t200-289__K20.md.
- jumps-internal.mjs mede a linha de base do app (out/jumps-internal-*.md); flicker-edge.mjs e node-motion.mjs isolam o mecanismo.
- R/spikes/seed/seed-physics.mjs (out/*__s30.json) é o contraste com o engine deprecated.
- Métricas: lib/metrics.js do harness.
- A cadeia é um brinquedo JS (~60 linhas, 8 passos por frame, repulsão nó O(partículas×folhas) sem grid, sem repulsão de cápsulas). S0 custa 1,4–1,8 ms/frame (forces/containers) e 43 ms/frame (synth40).
- **Encaixe nas restrições:** - ADR-0012: as linhas 31-32 aceitam 'topologia de subdivisão fixa ou semeada'. A objeção às alternativas rejeitadas (linhas 36-39: o A* 'viola… movimento contínuo no live') é CONFIRMADA pela medição (libavoid por frame salta em 88 de 89 frames) e não se aplica aqui, porque o planejador não prescreve posição por frame.
- ADR-0010: repulsão só entre corpos; nenhum atrator novo é necessário.
- ADR-0011: zona linear f = k·pen para a repulsão de nós.
- ADR-0013: o planejador vira componente interno do engine unificado.
- ADR-0006: com o OVG como planejador, custo zero; com libavoid, ver RA-4.
- Pesquisa: alinha com a identidade 'viva'.
- **Ganho:** - Continuidade garantida: 0 frames com salto > 20 px em todos os cenários medidos, contra 10 a 89 de 89 do app atual no synth40 v2.
- E×N baixo (6,9 contra 29,4 do atrator e 0 do planejador).
- Elimina de quebra o flicker do clip-anchors, porque as âncoras deixam de ser recalculadas por frame.
- **Custo:** M. Entra no plano já previsto da Fase 4, mais o planejador (RA-3 ou RA-4) e os gatilhos de replano por evento.
- **Risco:** - Cruzamentos acumulam entre replanos: X 462 contra 223 do planejador por frame. Isso exige desembaraço (repulsão de cápsulas da Fase 4, ausente no brinquedo) e replano por evento com transição.
- Replanejar troca a topologia: pular ou animar é decisão de produto.
- Não validado no motor real (src/physics).
- **Réplica do defensor (aceitar_com_condicoes):** Concedo a direção: uma cadeia persistente com semente obstacle-aware é melhor que o routing atual no live. Contesto a atribuição dos ganhos, e várias alegações não se sustentam como foram escritas.

1) O núcleo da RA-1 já é o status quo. A cadeia persistente é o plano da Fase 4: ADR-0012:24-32 e R1-07 ('o mundo unificado persiste entre ticks por construção'). A única novidade real é o planejador.

2) A evidência de continuidade não sustenta o planejador. O S0 limita cada partícula a vmax=4 px por frame (attractor.mjs:125-129), então '0 frames com salto > 20 px' vale por construção. Medi a cadeia com 4 sementes nos mesmos frames: corda sem planejador, rota atual do app, libavoid e OVG. Todas deram 0 de 89 no synth40 v2 e no v1, e 0 de 451 no containers v2. O router atual passado pelo MESMO clamp, como filtro, também dá 0 de 89 (máx. 8,6 px). O contraste '88/89 contra 0/89' mede o clamp, não o planejador.

3) A semente que o desafiante mediu (libavoid) é desfavorável e ele não comparou com o app nos mesmos frames. Médias de X / E×N:
- synth40 v2: S0 libavoid 443,6 / 8; semente-corda 223,3 / 159,3; app 269,9 / 188,8. O S0 dele tem +64% de X contra o app.
- synth40 v1: libavoid 140,6 contra corda 90,7 e app 109,2.

4) Concessão importante. A semente OVG, que o desafiante recomenda mas NÃO mediu na cadeia persistente, é boa:
- synth40 v2: X 177,6 / E×N 29,7 / portas 0 / ←in 1,4, contra 269,9 / 188,8 / 85 / 6,1 do app (−34% de X, −84% de E×N);
- synth40 v1: 95,1 / 18,9 contra 109,2 / 76,9;
- containers v2: 6 / 8,9 contra 3,6 / 14,3 (X pior).

5) 'Elimina de quebra o flicker' é exagerado. O flicker de e:n28|n4 tem dois mecanismos:
- o clip-anchors (R1-19, correção P);
- um desempate instável do Hanan A* no obstacle-route. Com clipAnchors=false a rota ainda alterna entre reta de 2 pontos e dois L simétricos, e a aresta segue saltando em 39 frames.
Só com clipAnchors=false o orthogonal já cai de 10 para 2 de 89 frames com salto.

6) Custo e arquitetura, não medidos pelo desafiante:
- a OVG leva 382 ms num frame em movimento do synth40 v2 e 6,5 / 10,2 / 14,1 s no synth120 v2 (ticks 100/200/481);
- o editor dispara re-render com debounce de 150 ms e route() é síncrono, então 'replano por evento' exige Worker e mudança de contrato (ADR-0013);
- a cadeia-brinquedo já custa 28–42 ms/frame no synth40, acima do orçamento de 16,7 ms;
- 'end' do layout não existe no v2 (R1-05).

7) A semente envelhece e a transição não está resolvida. Com a semente OVG, E×N vai de 0 para 35 em 90 frames (synth40 v2). O único replano 'animado' testado (A20) quadruplica o E×N, e o replano seco (P20) salta 281 px. Logo 'replano por evento com transição' é problema aberto.

8) ADR-0012:38-39 rejeita 'Híbrido A* + suavização de waypoints'. Um replano por evento que substitui a topologia fica perto disso. As linhas 31-32 falam de 'topologia de SUBDIVISÃO fixa ou semeada', no contexto de fissão/fusão. O trigger 'astar' do engine deprecated ('hananRoute semeia topologia') torna plausível a leitura do desafiante, mas ela precisa de confirmação explícita do mantenedor.

Condições:
- (a) entregar primeiro a persistência (Fase 4) com semente trivial, corda ou Hanan já existente;
- (b) planejador como provedor de semente plugável e opcional, decidido por uma matriz de sementes {corda, interno, OVG} no motor REAL, usando o harness como função de aptidão;
- (c) planejador em Worker, com orçamento e fallback;
- (d) consumir a política do resolver (edgeNodePair) antes de reivindicar ganho de E×N;
- (e) medir a transição do replano (salto e E×N transitório);
- (f) emenda ou confirmação do ADR-0012 pelo mantenedor. Evidência: Base D=/tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/defensor.

Sensibilidade à semente: D/seed-sens.mjs, com particlesStep copiado verbatim de spikes/attractor/attractor.mjs:94-130 e os mesmos ganhos (ka=0,1). Saídas:
- D/out/seed-sens__synth40__v2__t200-290.md e __ovg.md;
- D/out/seed-sens__synth40__v1__t200-290.md e __ovg.md;
- D/out/seed-sens__containers__v2__t30-482.md e __ovg.md;
- D/out/seed-sens__forces__v2__t30-482.md.
A réplica do S0:libavoid confere com o desafiante: saltos 3,2 / 5,2 / 6,8 e último frame X 457 / E×N 8 idênticos; média de X 452,9 contra 462,1 (2%); forces v2 com X 1 / E×N 4,7 contra 1 / 4,6.

Clamp de velocidade: attractor.mjs:125-129.

Flicker:
- D/out/jumps-fix__synth40__v2__t200-290.md: orthogonal 10 → 2 de 89 frames com clipAnchors=false; straight 80 → 39; curved 70 → 45.
- D/flicker2.mjs, ticks 200-211 com clip off: e:n28|n4 alterna entre (72,76)(-72,-284), (72,76)(-72,76)(-72,-284) e (72,74)(72,-286)(-73,-286) com a rota crua sempre de 2 pontos.

Custo da OVG: D/ovg-cost.mjs (synth120 v2: 6496 / 10164 / 14098 ms; 20,6–28,7 milhões de estados); 382 ms no cabeçalho de seed-sens synth40 v2 __ovg.

Repo:
- debounce em src/editor.js:16;
- route síncrono em src/routing/router.js:8;
- pipeline chama router.route em cada 'tick' (src/app/pipeline.js:169-180);
- ADR-0012 em .feat-memory/decisions/0012-edges-driven-by-force-tendencies.md:24-39;
- trigger 'astar' em src/routing/physics/index.js (comentário 'hananRoute semeia topologia').

Ressalva: nas linhas S0, a coluna 'f0' é medida após o 1º frame de física, não sobre a semente pura.
- **Decisão do juiz: adotar.** Adotar como desenho da Fase 4. A persistência dá a continuidade que o ADR-0012 exige, o que verifiquei sem clamp: 0 de 89 frames com salto > 20 px nas sementes corda e OVG (máx. 11,2 e 9,6 px), contra 10 a 89 de 89 do app no synth40 v2. Porém o ganho de continuidade NÃO vem do planejador, que só melhora a qualidade (E×N de política 8,4 contra 55,2). Condições: (a) entregar a persistência primeiro, com semente trivial (corda ou Hanan); (b) semente como provedor plugável, escolhido pelo harness no motor real; (c) planejador só por evento, em Worker e com orçamento; (d) medir a transição de replano antes de habilitá-la; (e) emenda do ADR-0012 confirmada pelo mantenedor.

#### RA-2 · Planejador como ATRATOR-PATH contínuo (ADR-0010), com replano a cada K frames

- **Substitui:** Variante de RA-1: troca a semente única por um alvo atualizado periodicamente.
- **Proposta:** O planejador roda a cada K=20 frames. Entre replanos, sua polilinha é deformada pelos deslocamentos dos endpoints e usada como atrator-path (mola ka) da cadeia de partículas, junto com repulsão de nós e de arestas, trilho de perímetro e velocidade máxima por frame.
- **Evidência do desafiante:** synth40 v2, ticks 200–289:
- A20 (atrator-path): X 456 (32,7), E×N 29,4 (13,9), salto máx. 9,2 px, 0 frames acima de 20 px, 185 ms/frame.
- S0 (sem atrator): X 462 (26), E×N 6,9 (3,4), máx. 6,8 px, 43 ms/frame.
- P20 (replano + deformação, sem física): X 374 (32,9), E×N 0,1, mas salta 281 px nos replanos (4 de 89 frames).
- Planejador a cada frame: X 223, E×N 0, 88 de 89 frames com salto.

Cenários pequenos (A20 vs S0, X / E×N):
- containers v2: 3,8 / 9,7 contra 3,0 / 10,3.
- forces v2: 0,7 / 4,4 contra 1,0 / 4,6.

Conclusão: na forma ingênua, o atrator não transfere a qualidade do planejador (X cerca de 2× o do planejador por frame). Quando o replano muda a topologia, ele PUXA a cadeia através de nós: E×N 4× maior que o S0.
- **Spike:** R/spikes/attractor/attractor.mjs, métodos 'A20 atrator-path' e 'P20 replano+deformação'. Parâmetros: ka=0,1, K=20, 8 passos/frame, vmax=4. Saídas out/*__K20.md e out/synth40__v2__t200-289__K20.md. A rodada de 282 frames estourou 600 s; a de 90 frames é a válida.
- **Encaixe nas restrições:** - ADR-0010: uso literal do atrator-path (linhas 26-28).
- ADR-0012: forças, não rota prescrita.
- ADR-0006: sem dependência nova além do planejador.
- **Ganho:** Continuidade (0 frames acima de 20 px). Porém o S0 (RA-1) já entrega isso, mais barato e com menos E×N.
- **Custo:** Planejador a cada K frames: 138 ms/frame amortizado com libavoid no synth40 v2, com 4,9 s por plano nessa fase do layout.
- **Risco:** - Transientes de E×N ao trocar de topologia.
- Ganho sobre RA-1 não demonstrado.
- Calibrar ka × kn × vmax é caixa-preta.
- Recomendação: não adotar na forma ingênua. Se revisitado, atrair só para a classe de homotopia (lado de cada obstáculo), não para a posição.
- **Réplica do defensor (rejeitar):** Concordo com a recomendação do próprio desafiante e acrescento motivos.
- Não há ganho sobre a persistência simples: no synth40 v2 o A20 tem X 456,3 contra 462,1 do S0, E×N 29,4 contra 6,9, e custa 184,7 contra 43,4 ms/frame.
- Replanejar a cada K frames exige o planejador sob movimento, que é o regime mais caro: libavoid 4,9 s/plano segundo o desafiante, 6,46 s na minha medição no tick 200; OVG de 6,5 a 14,1 s no synth120 v2.
- O atrator puxa a cadeia através de nós na troca de topologia, justamente o que o ADR-0012 quer evitar com 'tendência'.
- Minha medição mostra que a continuidade vem da persistência e do clamp, independentemente de atrator ou semente. O atrator é custo sem benefício demonstrado. Evidência: - spikes/attractor/out/synth40__v2__t200-289__K20.md (linhas A20 e S0).
- D/out/seed-sens__synth40__v2__t200-290.md: libavoid com 6460 ms num plano no tick 200.
- D/ovg-cost.mjs: synth120 v2 com 6496 / 10164 / 14098 ms.
- attractor.mjs:125-129 (clamp comum a A20 e S0).
- **Decisão do juiz: rejeitar.** As duas partes concordam e os números sustentam. No synth40 v2, o A20 tem E×N 29,4 contra 6,9 do S0, praticamente o mesmo X (456,3 contra 462,1) e custa 184,7 contra 43,4 ms/frame. O replano puxa a cadeia através de nós quando a topologia muda. A continuidade já vem da persistência, então o atrator é custo sem benefício.

#### RA-3 · Roteador ortogonal próprio: grafo de visibilidade esparso + A* com estado de direção, custos de dobra e cruzamento, rip-up & reroute e nudging (ESM puro)

- **Substitui:** - routers/orthogonal.js: escolha de face pelo sinal entre centros (R1-01).
- obstacle-route.js: applyObstacleRouting e hananRoute, com gatilho pela corda e falha silenciosa (R1-11).
- A falta de distribuição de portas (R1-03).
- Como planejador de RA-1, também o A* por tick dentro do layout v1.
- **Proposta:** R/spikes/ovg-astar/ovg.js tem 283 linhas, 16,7 KB (6,1 KB gz) e zero dependências. Funcionamento:
- Coordenadas 'interessantes': bordas acolchoadas, linhas de porta no centro das faces, faces de containers, linhas médias de canais largos e um quadro externo.
- A* por aresta com estado (vértice, direção). Custo = comprimento + dobra (24) + cruzamento com rotas já traçadas (40) + compartilhamento de trilho (4) + container alheio (150, suave) + folha alheia (3000, suave: nunca falha em silêncio).
- Perna terminal perpendicular à face por construção.
- Uma passada de rip-up & reroute.
- Nudging de segmentos colineares (8 px) ordenado para não cruzar, o que equivale a espalhar as portas.
- **Evidência do desafiante:** Harness eval-external, cenas completas (spikes/ovg-astar/out1/eval.md), contra o orthogonal interno (harness/out/results.md):
- synth40 v1: X 88 (5) vs 125 (3); E×N 0 vs 75 (pol 0 vs 6); portas coincidentes 0 vs 59; paralelas 26 vs 102; inv 0 vs 1; dobras 158 vs 129; stretch 1,13 vs 1,04; tempo 144 ms vs 2 ms.
- synth120 v1: X 916 (35) vs 1358 (93); E×N 0 vs 197; portas 0 vs 155; paralelas 230 vs 303; inv 9 vs 13; dobras 632 vs 367; tempo 7,2 s vs 57 ms.
- synth120 v2: X 2052 (62) vs 2915 (111); E×N 0 vs 1265 (pol 0 vs 482); portas 0 vs 233; inv 59 vs 15; tempo 17,7 s vs 49 ms.
- quad: pernas para dentro 0 vs 6; inv 0 vs 6; ⊥ 100% vs 25%.
- Único cenário pior: containers v2, com X 16 vs 4 e stretch 4,54 vs 1,0 (desvios longos em torno dos containers sobrepostos do v2).
- Subconjunto folha–folha (spikes/compare/sub-eval.md), synth120 v1: X 760 contra libavoid 1091, Graphviz-ortho 1094 e interno 1111. É o menor entre todos os ortogonais.
- O custo cresce com a grade: 139×144 → 428×436 vértices, de 353 mil para 17,6 milhões de estados expandidos (out1/batch.log). A janela de busca já baixou o synth40 v1 de 242 para 144 ms (out/ vs out1/).
- **Spike:** R/spikes/ovg-astar/: ovg.js, run-ovg.mjs, out1/ (versão com janela) e out1/eval.md; out/ é a versão sem janela; outhw/ usa heurística ponderada (1,5 e 2). Rodado nos 12 dumps e avaliado pelo eval-external.js do harness. Também serve de semente no spike seed.
- **Encaixe nas restrições:** - ADR-0006: encaixe perfeito (ESM, sem dependências, 6 KB gz).
- ADR-0009/0013: router co-igual registrado no registry (src/routing/registry.js:1-11) ou planejador de RA-1.
- Política de layers da DSL: pode entrar direto no custo por aresta via resolver.edgeNodePair. O libavoid não permite isso; o spike ainda não consome o resolver.
- ADR-0012: é rota prescrita, então só como router algébrico ou planejador, nunca recalculado por frame no live.
- Pesquisa: alto valor de aprendizado.
- **Ganho:** - 30 a 33% menos cruzamentos que o orthogonal interno nos cenários densos v1/v2.
- Zera E×N, portas coincidentes e pernas para dentro.
- Ortogonalidade de 100%.
- **Custo:** M/G. É 2 a 3 ordens de grandeza mais caro que o interno (144 ms a 17,7 s). Precisa de A* incremental ou janelado por aresta, grade limitada ao bbox da corda e orçamento por frame. Faz 22–72% mais dobras.
- **Risco:** - Performance acima de 100 nós.
- Manter código próprio de geometria.
- Calibrar os pesos.
- Degrada com containers sobrepostos (depende de corrigir o v2).
- **Réplica do defensor (aceitar_com_condicoes):** Rejeito a OVG como router co-igual de runtime agora. Aceito como componente de pesquisa (planejador de semente, RA-1) e como oráculo offline no harness.

1) Registrar como router co-igual contradiz a própria condição da proposta ('nunca recalculado por frame no live'). O pipeline chama router.route a cada 'tick' (pipeline.js:169-180), o v2 nunca emite 'end' (R1-05) e o ADR-0013 promete 'qualquer combinação layout×router'. Na prática, live×ovg roteia a cada frame, com 557 ms no synth40 v2 e 17,7 s no synth120 v2. Antes seria preciso o contrato com caps/estado do R1-18.

2) Os defeitos que a OVG 'zera' têm correções P/M no status quo:
- pernas para dentro por escolha de face: R1-01, P;
- portas colapsadas: R1-03, M;
- E×N de política, que é 100% A* falhando em silêncio com a âncora no obstáculo acolchoado: R1-11, P;
- flicker: R1-19, P.
Comparar contra o baseline SEM essas correções infla o ganho.

3) Nos 4 exemplos reais o X empata ou piora: containers v2 16 contra 4, forces v2 2 contra 1, quad e intro 0 contra 0. O stretch explode no containers v2 (4,54 contra 0,995), e há mais dobras (+22–72%) e mais invariantes violados no synth120 v2 (59 contra 15).

4) O spike não consome a política (grep sem 'resolver|edgeNodePair|nodeLayers' em ovg.js). O E×N 0 é sobre-evitação: a OVG desvia de nós que a DSL permite cruzar, o que explica parte do stretch. A integração da política é alegada, não medida.

5) O custo é superlinear: de 353 mil a 28,7 milhões de estados expandidos, e 6,5–14,1 s por plano no synth120 v2 em movimento.

Concessão: como SEMENTE da cadeia persistente, a OVG é a melhor semente medida, com X −34% e E×N −84% contra o app no synth40 v2. Tem valor real de pesquisa, é ESM puro e tem 6 KB gz.

Condições: só como planejador ou oráculo, em Worker e com orçamento; política do resolver integrada; o intro v2 faltando no out1/eval.md (11 de 12 cenas) precisa ser rodado. Evidência: - spikes/ovg-astar/out1/eval.md: quad, intro, containers e forces; synth40 v2 com 557,34 ms e synth120 v2 com 17721,9 ms; inv 59; containers v2 com X 16 e stretch 4,544; tabela com 11 linhas.
- harness/out/results.md: orthogonal containers v2 X 4 e stretch 0,995; forces v2 X 1.
- grep vazio de política em spikes/ovg-astar/ovg.js e run-ovg.mjs.
- spikes/ovg-astar/out1/batch.log: expanded de 353529 a 1188417 no synth40.
- D/ovg-cost.mjs: synth120 v2 com 20,6–28,7 milhões expandidos e 6,5–14,1 s.
- src/app/pipeline.js:169-180.
- Achados R1-01, R1-03, R1-05, R1-11, R1-18 e R1-19 em cache-parcial.json.
- D/out/seed-sens__synth40__v2__t200-290__ovg.md (a concessão).
- **Decisão do juiz: spike_adicional.** É a melhor semente medida na cadeia persistente: X 183,4 e E×N de política 8,4, contra 228,9 e 55,2 da corda (execução própria, sem clamp). Sozinha, reduz X de 30% a 38% contra o orthogonal nos densos (out1/eval.md). Não vira router de runtime agora porque: custa de 144 ms a 17,7 s, com crescimento superlinear; não consome a política da DSL (grep com 0 ocorrências de resolver ou edgeNodePair); piora o containers v2 (X 16 contra 4, stretch 4,54); o intro v2 não foi rodado. O spike deve medir a OVG como provedor de semente no motor real, com política, Worker e orçamento.

#### RA-4 · libavoid-js (porte WASM do libavoid, Wybrow/Marriott) como router plugin co-igual 'avoid' (ortogonal com nudging e polyline)

- **Substitui:** O mesmo que RA-3 no caminho algébrico para layouts estáticos (custom/off), ou planejador de referência de RA-1.
- **Proposta:** Montagem do spike:
- Todas as folhas são ShapeRef; containers não são obstáculos, e um endpoint container vira ponto no perímetro.
- 4 pinos por folha, no centro de cada face, perpendiculares e não exclusivos.
- nudgeOrthogonalSegmentsConnectedToShapes e nudgeSharedPathsWithCommonEndPoint ligados; buffer 8, nudge 8, segmentPenalty 10.
- Variantes: crossingPenalty 200 com hateCrossings, e roteamento polyline.
- **Evidência do desafiante:** Métricas contra o orthogonal interno (spikes/libavoid/out/eval.md):
- synth40 v1: X 155 (8) vs 125 (3), PIOR; E×N 0 vs 75; portas 0 vs 59; paralelas 72 vs 102; 51 ms.
- synth40 v2: X 385 (26) vs 290 (16), PIOR; E×N 0 vs 187; portas 9 vs 85; 45 ms.
- synth120 v1: X 1266 (66) vs 1358 (93); E×N 0 vs 197; portas 0 vs 155; paralelas 175 vs 303; 1149 ms.
- synth120 v2: X 2975 vs 2915; E×N 2 vs 1265; portas 14 vs 233; 445 ms.
- quad: ⊥ 100% vs 25%; pernas para dentro 0 vs 6; inv 0 vs 6.

Penalidade de cruzamento (subconjunto folha–folha, compare/sub-eval.md): synth40 v1 com X 44 contra 148 sem penalidade, mas em 2,6 s; v2 com X 40 contra 380, em 5,4 s.

Custo incremental (out/batch.log):
- synth40: 16–22 ms.
- synth120 v1: 1,26 s movendo todas as folhas e 1,23 s movendo UMA. No modo ortogonal o incremental custa praticamente o mesmo que o total.
- No layout vivo (attractor, planejador por frame): 4,9 s/frame no synth40 v2, contra 44 ms na cena assentada.

Browser sem bundler (spikes/browser-esm/result.json): Chromium headless com importmap {"libavoid-js": "./vendor/libavoid-js/index.js"}. O glue ESM busca o libavoid.wasm via new URL(..., import.meta.url). Foram 3 requisições, load de 52 ms, rota correta desviando do obstáculo e 0 erros.

Tamanho: libavoid.wasm 492 KB (180,5 KB gz) + index.js 44 KB (17,3 KB gz) ≈ 198 KB gz. O app hoje soma ~196 KB gz (src 137,6 + yaml 58,8).

API (dist/index.d.ts:34-98): não há exclusão de obstáculo por conector, só checkpoints, setHateCrossings e pinos exclusivos. Por isso a política edgeNodePair da DSL não é expressável: E×N 0 significa sobre-evitação.

Metadados (npm view): LGPL-2.1-or-later, versão 0.5.0-beta.5, modificado em 2026-02-23.
- **Spike:** R/spikes/libavoid/: route-libavoid.mjs (modos ortho e poly, incremental), batch.sh, out/*.json, out/eval.md, out/xpen/. R/spikes/browser-esm/: index.html, serve-and-test.mjs e result.json (Playwright do repo como biblioteca, servidor próprio em porta aleatória; não é o E2E). Rodado nos 12 dumps e avaliado com o harness.
- **Encaixe nas restrições:** - ADR-0006: compatível e testado no browser. Integração: acrescentar node_modules/libavoid-js/dist em ASSETS (scripts/build-dist.js:34) e uma entrada no importmap (index.html:10-16).
- ADR-0009/0013: plugin 'avoid' carregado por import dinâmico no registry (src/routing/registry.js:1-5, que já tem o campo lazy nas linhas 7-11), chamando AvoidLib.load() no load() assíncrono do contrato (src/routing/router.js:7). Hoje o pipeline nunca chama load() (R1-14).
- ADR-0012: é rota prescrita, então só router algébrico ou planejador.
- Restrição 1: primeira dependência de runtime WASM e copyleft.
- **Ganho:** - Zera E×N, portas coincidentes e pernas para dentro.
- Ortogonalidade de 97–100%.
- Nudging ordenado de qualidade acadêmica, sem precisar escrever o algoritmo.
- **Custo:** P para o plugin. Porém +198 KB gz (dobra o payload), 45 ms a 1,15 s por roteamento, e o incremental não ajuda no modo ortogonal.
- **Risco:** - Versão beta.
- LGPL: aceitável como módulo separado e substituível, mas é a primeira dependência copyleft.
- Memória do embind: pinos são deletados pelo FinalizationRegistry quando o handle JS é coletado. Observado no synth120; o contorno está em route-libavoid.mjs:44-46.
- X pior que o interno no synth40.
- Política de layers não expressável.
- Custo varia 100× com a geometria.
- **Réplica do defensor (rejeitar):** Rejeito como plugin de runtime e aceito o uso que o próprio desafiante recomenda (referência ou oráculo offline).

1) A qualidade no que importa é pior que o status quo: X 155 contra 125 no synth40 v1 e 385 contra 290 no v2. Como semente da cadeia persistente é a PIOR semente medida: X 443,6 contra 223,3 da corda e 269,9 do app no synth40 v2; 140,6 contra 90,7 no v1.

2) A política de layers da DSL, que é o diferencial semântico do projeto (resolver edgeNodePair/edgeLayerPair), não é expressável. O binding não expõe exclusão por conector nem ClusterRef, só checkpoints, hateCrossings e pinos exclusivos. O E×N 0 é sobre-evitação.

3) O custo é imprevisível: 45 ms–1,15 s assentado; 4,9–6,5 s por plano num frame em movimento; o incremental não ajuda no modo ortogonal.

4) Dependência: seria a primeira de runtime WASM e copyleft (LGPL-2.1-or-later), em versão 0.5.0-beta.5. São +198 KB gz contra ~196 KB gz (concatenado) ou ~252 KB gz (soma por arquivo, que é o que trafega sem bundler). Honestidade: com carga lazy o custo inicial some, e o registry já faz import dinâmico.

5) Integração: o pipeline nunca chama load(), route() é síncrono e o campo lazy é só descritivo. Plugar exige mexer no pipeline e no contrato antes do ganho.

Concedo que o carregamento no browser sem bundler está demonstrado: importmap, 3 requisições, 52 ms. Isso remove a objeção do ADR-0006, mas não as de qualidade, política e licença. Evidência: - spikes/libavoid/out/eval.md, na citação do desafiante.
- Semente: D/out/seed-sens__synth40__v2__t200-290.md e D/out/seed-sens__synth40__v1__t200-290.md.
- Plano no tick 200 do synth40 v2: 6460 ms (mesmo arquivo).
- API: spikes/libavoid/node_modules/libavoid-js/dist/index.d.ts:30-100. O grep mostra só clusterCrossingPenalty, setHateCrossings, setRoutingCheckpoints e Exclusive; não há ClusterRef.
- package.json do pacote: libavoid-js 0.5.0-beta.5, LGPL-2.1-or-later.
- Tamanhos: libavoid.wasm 492029 B (180504 gz) e index.js 44017 B (17281 gz).
- App: src concatenado 137562 B gz, soma por arquivo 170716 B gz; yaml browser 81273 B gz em 73 arquivos (medido com gzip -9).
- spikes/browser-esm/result.json: loadMs 52,1, 3 requisições, 0 erros.
- src/routing/registry.js:1-11; src/routing/router.js:7-8; grep '.load(' vazio em src/app e src/routing.
- **Decisão do juiz: rejeitar.** Como plugin de runtime, o X piora em relação ao interno no synth40 (155 contra 125 no v1; 385 contra 290 no v2). É a pior semente medida (X 443,6). Não expressa a política de layers (index.d.ts sem exclusão por conector), custa de 45 ms a 6,5 s e seria a primeira dependência WASM e LGPL, em versão 0.5.0-beta.5 (conferido no package.json). O carregamento sem bundler foi demonstrado, mas o custo real é +79% do payload por arquivo (198 contra 252 KB gz), não o dobro. Fica só como oráculo offline.

#### RA-5 · Graphviz via WASM (@hpcc-js/wasm-graphviz, neato -n2 com posições fixas): splines=true, polyline e ortho

- **Substitui:** O router curved, cuja Bézier é degenerada (R1-02), e o straight. Alternativamente, só como oráculo externo offline no harness.
- **Proposta:** O neato recebe as posições fixas com pos="x,y!" e nop=2. As rotas vêm do roteador de splines do Graphviz (caminho mínimo em polígono + ajuste de Bézier), de polyline ou de ortho. O spike desfaz a translação do bounding box e amostra as Béziers.
- **Evidência do desafiante:** Subconjunto folha–folha, porque o neato não tem clusters: 12 de 168 arestas com endpoint container ficam sem rota (spikes/compare/sub-eval.md).

ortho:
- synth120 v1: X 1094 (61) vs 1111 (71) do orthogonal interno; paralelas 67 vs 283; portas 10 vs 148; inv 0 vs 13; 149 ms.
- synth120 v2: X 1975 (49) vs 2852 (104); paralelas 868 vs 2319; 119 ms.
- É o externo mais rápido e o de menos paralelas.

splines=true:
- synth120 v2: X 4793 vs 1697 do straight; 28,9 dobras por aresta amostrada; 3578 paralelas.
- synth40 v1: X 152 vs 91. As curvas serpenteiam.

polyline:
- synth120 v1: X 992 (46) vs 1006 (45) do straight; E×N 0 vs 236.

Outros dados:
- 4 a 30 âncoras fora do perímetro no synth120.
- Posições preservadas (desvio ≤ 0,1 px, out/batch.log); load do WASM entre 88 e 286 ms.
- Tamanho: dist/index.js de 815 KB com o WASM embutido (632 KB gz), cerca de 3,2× o app. Licença Apache-2.0.
- **Spike:** R/spikes/graphviz/: route-graphviz.mjs (modos true, polyline e ortho), out/*.json, out/eval.md, out/batch.log. A comparação justa usa R/spikes/compare/subset.mjs.
- **Encaixe nas restrições:** - ADR-0006: ESM de arquivo único, carregável via importmap em tese. NÃO testei no browser. O peso contraria o runtime mínimo.
- ADR-0004: containers como endpoint não são suportados no neato.
- ADR-0012: rota prescrita.
- **Ganho:** O modo ortho é bom e rápido nos cenários densos. As splines 'true' decepcionam nas métricas do projeto.
- **Custo:** 632 KB gz, mais tratamento à parte para arestas de container.
- **Risco:** Alto para runtime. Recomendação: usar só como baseline externo no harness (dev-only).
- **Réplica do defensor (aceitar_com_condicoes):** Aceito só como baseline externo dev-only no harness, que é o que o próprio desafiante recomenda. Em runtime, rejeito:
- 632 KB gz, cerca de 3,2× o app;
- sem clusters: 12 de 168 arestas com endpoint container ficam sem rota, contrariando o ADR-0004;
- 4 a 30 âncoras fora do perímetro;
- splines=true piora X (4793 contra 1697 do straight no synth120 v2);
- o carregamento no browser não foi testado.

Condições para o uso como oráculo:
- (a) fica fora de src/, do importmap e da suíte obrigatória (unit/E2E), sem virar dependência do repo;
- (b) as comparações usam sempre o subconjunto folha–folha (compare/subset.mjs), porque o universo é outro;
- (c) o ortho do Graphviz é o baseline mais rápido e com menos paralelas (149 ms no synth120 v1), útil como régua para as correções R1-01 e R1-03 do status quo. Evidência: - spikes/graphviz/out/eval.md e out/batch.log (citados pelo desafiante).
- spikes/compare/sub-eval.md.
- ADR-0004 (hierarquia por referência).
- Não reexecutei o Graphviz, só conferi a coerência das saídas citadas com os arquivos existentes em spikes/graphviz/out.
- **Decisão do juiz: rejeitar.** Em runtime, rejeitado: 632 KB gz, cerca de 2,5 a 3,2 vezes o app; 12 de 168 arestas com endpoint container ficam sem rota, contra o ADR-0004; splines=true piora X (4793 contra 1697 do straight); não foi testado no browser. O modo ortho pode ser usado como régua dev-only no harness, fora de src/ e da suíte, sempre sobre o subconjunto folha–folha.

#### RA-6 · Edge bundling: FDEB próprio (Holten & van Wijk 2009) e 'ordered bundles' do MSAGL

- **Substitui:** Nada diretamente. Seria um modo visual opt-in para grafos muito densos.
- **Proposta:** Cada aresta vira uma cadeia de P pontos (1 → 32 em 6 ciclos). Forças: mola entre vizinhos e atração eletrostática unitária entre o i-ésimo ponto de arestas COMPATÍVEIS (produto Ca·Cs·Cp·Cv acima do limiar). As arestas são não-direcionadas (ADR-0003): quando as direções se opõem, o spike casa o ponto espelhado.
- **Evidência do desafiante:** FDEB comparado à corda pura (FDEB com 0 ciclos, mesmas âncoras); fonte spikes/fdeb/out/eval-*.md e ink.txt:
- Parâmetros da implementação de referência (passo 0,1): quase não move. No synth40 v1 o comprimento vai de 19642 para 19657 e X de 74 para 76.
- Passo 10× (S=1, limiar 0,4), synth120 v1: tinta (células de 2 px cobertas) cai de 90088 para 82253 (−8,7%). Em troca, X sobe de 1088 para 1562 (+44%; pol de 67 para 102), E×N de 392 para 478 e paralelas < 6 px de 267 para 2852.
- synth40 v1: X de 74 para 168.
- forces v1: X de 0 para 39, com 3 pares compatíveis entrelaçados (o harness conta cruzamentos dentro do feixe).
- Poucos pares compatíveis nos sintéticos: 12 de 1540 no synth40 v1 com limiar 0,6.

MSAGL bundling (spikes/msagl/out/eval.md): sem rotas em 7 das 12 cenas. No synth40 v1, X 128 contra 211 do spline do próprio MSAGL, mas com 912 dobras e 3093 inv.
- **Spike:** R/spikes/fdeb/: fdeb.js (89 linhas, 2,3 KB gz), run-fdeb.mjs, ink.mjs (métrica nova de tinta, a partir do renderPolyline do harness), out/*.json, out/eval.md, out/eval-chord.md, out/eval-S1.md, out/ink.txt. O modo bundling do MSAGL está em R/spikes/msagl/route-msagl.mjs.
- **Encaixe nas restrições:** - A formulação é por forças, o que combina com a identidade física.
- Mas a atração eletrostática PAR-A-PAR entre arestas contraria o ADR-0010 ('atração só por atratores').
- Reformulação compatível: o esqueleto do feixe como atrator-path compartilhado. Não prototipada.
- ESM puro, sem dependências.
- **Ganho:** −8,7% de tinta no synth120, e só com passo agressivo.
- **Custo:** O(E²·P): 75 a 218 ms por execução.
- **Risco:** Piora as métricas de legibilidade do projeto (X, E×N, paralelas), e o harness não mede o benefício percebido. Recomendação: não agora.
- **Réplica do defensor (rejeitar):** Concordo com o 'não agora' do desafiante.
- Nas métricas de legibilidade do projeto o ganho é negativo: X +44% (1088 → 1562) e paralelas < 6 px ×10,7 (267 → 2852) no synth120 v1, em troca de −8,7% de tinta, e só com passo 10× o de referência. No synth40 v1 a tinta do FDEB (10468 células) empata com o orthogonal atual (10476).
- A atração par-a-par entre arestas contraria o ADR-0010:24-31. A reformulação compatível (esqueleto do feixe como atrator-path) não foi prototipada.
- Custo O(E²·P).
- Nada no status quo depende disso, e o harness não mede o benefício percebido. Evidência: - spikes/fdeb/out/ink.txt: synth40 v1 com interno:orthogonal 10476 células e fdeb-t0.4 10468.
- spikes/fdeb/out/eval-S1.md (citado).
- .feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md:24-31.
- **Decisão do juiz: rejeitar.** O ganho é negativo nas métricas do projeto: X +44% e paralelas ×10,7 no synth120 v1, em troca de −8,7% de tinta e só com passo 10× o de referência. A atração par-a-par entre arestas contraria o ADR-0010 (linhas 24-29), e a reformulação como atrator-path compartilhado não foi prototipada.

#### RA-7 · ELK (elkjs) e MSAGL-JS como routers de posições fixas: descartar

- **Substitui:** Candidatos a router externo de 'prateleira'.
- **Proposta:** Verifiquei se as duas bibliotecas roteiam arestas com as posições dadas pelo layout do Tensegrams, que é o contrato de router do ADR-0013.
- **Evidência do desafiante:** ELK (spikes/elk/probe-elk.mjs e out/probe-*.txt):
- elk.algorithm 'fixed' falha com "The edge needs to have exactly one edge section. Found: 0".
- 'layered' com estratégias INTERACTIVE move 40 de 40 folhas (até 2417 px no synth40) e 7 de 7 no forces. Ou seja, o ELK não roteia com posições fixas.
- elk.bundled.js tem 1,6 MB (467 KB gz); licença EPL-2.0 OR GPL-3.0.

MSAGL-JS (spikes/msagl/out/eval.md):
- O modo spline crasha no synth40 v2 e no synth120 v2 ("Cannot read properties of undefined (reading 'containsPoint')"), por causa dos containers sobrepostos do v2.
- O modo bundling não gera rotas em 7 de 12 cenas.
- O modo rect leva 1,0 s (synth120 v1) e 4,7 s (v2, com X 2957 contra 2915 do interno).
- O spline no synth120 v1 dá X 2788, contra 1358 do orthogonal e 1206 do straight.
- O dist/index.js ESM importa dependências CommonJS (queue-typescript começa com 'use strict'; require(...)), então não carrega via importmap sem transformação. Só o dist.min.js IIFE (777 KB, 196 KB gz) funciona, via <script> clássico.
- **Spike:** R/spikes/elk/probe-elk.mjs (out/probe-forces-v1.txt, out/probe-synth40-v1.txt). R/spikes/msagl/route-msagl.mjs nos modos spline, bundling e rect, com containers como subgrafos e uma variante --flat; saídas em out/, outflat/ e out/eval.md; formato dos módulos conferido nos package.json.
- **Encaixe nas restrições:** - ELK: incompatível com o contrato de router, porque as posições do layout são entrada e o ELK as altera.
- MSAGL: contraria o ADR-0006 (dependências CommonJS) ou exige um global IIFE; e falha justamente nos layouts do v2.
- **Ganho:** Nenhum medido sobre RA-3 e RA-4.
- **Custo:** Alto (tamanho, integração e crashes).
- **Risco:** Alto. Recomendação: registrar a rejeição e não revisitar sem fato novo.
- **Réplica do defensor (conceder):** A evidência é sólida e o status quo não usa nenhuma das duas bibliotecas, então conceder não custa nada.
- O ELK não respeita posições fixas: 'fixed' falha e 'layered' move 40 de 40 folhas, até 2799 px (2417 no modo interativo). Isso viola o contrato de router do ADR-0013, em que as posições do layout são entrada.
- O MSAGL crasha nos layouts do v2 ('containsPoint'), o bundling fica sem rotas em várias cenas e o ESM importa dependências CommonJS (ADR-0006).
- Sugiro registrar a rejeição num ADR ou nota de decisão, para não reabrir o tema sem fato novo. Evidência: - spikes/elk/out/probe-synth40-v1.txt: 'fixed' com IllegalArgumentException 'exactly one edge section. Found: 0'; 'layered' interactive com movedNodes 40 e maxDisplacement 2416,7; não interativo com 2799,5.
- spikes/msagl/out/eval.md: synth40 v2 spline com crash 'containsPoint'; bundling 'SEM ROTAS' em containers, forces e synth40 v2.
- **Decisão do juiz: adotar.** Adotar o DESCARTE das duas bibliotecas. O ELK não roteia com posições fixas: 'fixed' falha e 'layered' move 40 de 40 folhas, o que viola o contrato do ADR-0013. O MSAGL crasha nos layouts v2 ('containsPoint'), o bundling fica sem rotas em 7 de 12 cenas e o ESM importa dependências CommonJS (ADR-0006). O defensor concede. Registrar numa nota de decisão para não reabrir sem fato novo.

## Apêndice B · Avaliação empírica e de código

Construí um harness headless reutilizável (Node, sem dependências próprias) em /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/harness/ e rodei a matriz 6 cenários (quad, intro, containers, forces, synth40, synth120) × layout (live v1, live v2, e também o custom, que é o default do store) × router (straight, orthogonal, curved, physics). A matriz mede cruzamentos gerais e cruzamentos que a própria DSL mandou evitar, aresta×nó, aresta×container estrangeiro, dobras, comprimento, paralelas coladas, ângulo e porta de chegada, invariantes B6/B7/B8 e tempo do estágio de routing inteiro. O harness também aceita rotas EXTERNAS sobre os mesmos rects (eval-external.js + dumps JSON); o fluxo está demonstrado com um roteador de exemplo.

Principais conclusões, todas com evidência:

(1) O router padrão do app (orthogonal) produz pernas que entram no corpo do próprio nó sempre que os nós estão em diagonal e próximos. O E2E de invariantes só cobre o exemplo intro, por isso não pega.

(2) O router curved desenha retas: os pontos de controle da Bézier ficam sobre a corda.

(3) Todos os routers algébricos colapsam portas e desenham multi-arestas [a,b,N] exatamente uma sobre a outra (11 de 11 no synth120 v2).

(4) Custo:
- O live v1 roda A* de Hanan por aresta A CADA TICK dentro do layout: 227 s para assentar o synth120, 63% do tempo em hananRoute.
- O engine físico deprecated custa 145–236 ms por tick no synth40 e 2,0–3,7 s por tick no synth120.
- O v2 nunca emite 'end', então o estágio de routing roda a cada frame para sempre.

(5) O engine físico deprecated corta pela metade as violações de política (cruzamentos entre arestas com edgeLayer comum e aresta×nó declarado) nos layouts v2 e custom. Em compensação, piora a geometria: mais dobras, 10× mais violações de invariantes, âncoras soltas. Também tem defeitos estruturais:
- ignora o estado entre ticks;
- a seleção de face é desfeita pelo warm-start (0 de 28 trocas preservadas);
- combinado com os routers straight ou curved, fica quebrado.

(6) Custo do legado: cerca de 2,47 mil linhas, 67% de src/routing. Somam-se 197 testes unitários (cerca de 3,5 mil linhas), 4 specs E2E, src/shapes inteiro e cerca de 150 linhas de parsing de DSL que só ele consome.

(7) Há duas fontes de configuração de routing, a DSL e a config, e divergem: options.routing.engine na DSL é aceito e ignorado.

(8) Existe um terceiro "engine" escondido no layout v1: os edgeWaypoints, um canal lateral fora do contrato do adapter. O v2 não o fornece.

Sobre o ADR-0009, a leitura do código é esta. A intenção de manter o algébrico como baseline permanente é boa. Mas "engines co-iguais" não existe no código: o físico é um if em pipeline.js que pós-processa a saída do orthogonal e é pós-processado de volta pelos passes algébricos. Recomendo reescrevê-lo como um contrato real de engine, com estado, e remover o legado sem esperar a Fase 4 (antes, extrair snap de portas, trilho de perímetro e espalhamento de portas).

Ressalvas:
- O E2E não foi rodado, conforme as regras.
- Os números do v2 são confundidos pela sobreposição de containers do próprio layout (94 pares cont×cont no synth120). O efeito foi isolado rodando o routing sobre rects do v1 com e sem waypoints.
- Tempos têm ruído de CPU compartilhada (4 CPUs para cerca de 10 agentes).

Harness: /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/routing/harness (resultados em out/results*.md|json, cenas em out/dumps). Node v22, reps=5 (mediana), rodado em 2026-09-30 com CPU compartilhada; os tempos são indicativos.

Legenda das colunas:
- X (pol): cruzamentos aresta×aresta (todos / só pares com edgeLayer comum).
- E×N (pol): pares aresta×folha não-endpoint atravessada (todos / só nós que a DSL mandou evitar).
- E×C: aresta×container estrangeiro.
- paral.: pares de segmentos paralelos a <6px (gap mínimo entre parênteses).
- ⊥%/desvio°: pernas terminais a ≤5° da normal da face / desvio médio.
- ←in: pernas que entram no próprio nó.
- portas: pares de âncoras coincidentes a <3px.
- fora perím.: âncoras fora do perímetro do próprio nó.
- inv: violações B6/B7/B8 de e2e/invariants.js.
- t ms: mediana do estágio de routing inteiro, que no app roda a cada tick.

physics = routing.engine: physics sobre o orthogonal.

### Contexto dos layouts
| cenário | layout | nós (folhas/cont.) | arestas (c/ layer) | ticks | layout ms | sobrep. folha×folha / cont×cont / folha×cont alheio | edgeWaypoints |
|---|---|---|---|---|---|---|---|
| quad | v1 | 4 (4/0) | 4 (4) | 482 | 38 | 0/0/0 | sim |
| quad | v2 | 4 (4/0) | 4 (4) | 482 | 10 | 0/0/0 | não |
| intro | v1 | 3 (3/0) | 2 (0) | 482 | 19 | 0/0/0 | não |
| intro | v2 | 3 (3/0) | 2 (0) | 482 | 5 | 0/0/0 | não |
| containers | v1 | 9 (7/2) | 10 (3) | 482 | 84 | 0/0/0 | sim |
| containers | v2 | 9 (7/2) | 10 (3) | 482 | 12 | 10/0/7 | não |
| forces | v1 | 7 (7/0) | 6 (0) | 482 | 13 | 6/0/0 | não |
| forces | v2 | 7 (7/0) | 6 (0) | 482 | 5 | 9/0/0 | não |
| synth40 | v1 | 45 (40/5) | 56 (32) | 482 | 9277 | 0/0/0 | sim |
| synth40 | v2 | 45 (40/5) | 56 (32) | 482 | 51 | 0/9/112 | não |
| synth120 | v1 | 135 (120/15) | 168 (97) | 482 | 227739 | 0/0/0 | sim |
| synth120 | v2 | 135 (120/15) | 168 (97) | 482 | 210 | 0/94/1158 | não |

### Routing — exemplo × layout × router
| cenário | layout | router | X (pol) | E×N (pol) | E×C | dobras (/ar.) | compr. (stretch) | paral. <6px (gap mín.) | ⊥% / desvio° | ←in | portas | fora perím. | inv | t ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| quad | v1 | straight | 0 (0) | 0 (0) | 0 | 0 (0) | 134.9 (0.272) | 0 (-) | 25 / 37 | 0 | 0 | 0 | 0 | 0.04 |
| quad | v1 | orthogonal | 0 (0) | 0 (0) | 0 | 6 (1.5) | 407.1 (0.819) | 1 (0) | 25 / 135 | 6 | 4 | 0 | 6 | 0.04 |
| quad | v1 | curved | 0 (0) | 0 (0) | 0 | 0 (0) | 134.9 (0.272) | 0 (-) | 25 / 37 | 0 | 0 | 0 | 0 | 0.03 |
| quad | v1 | physics | 0 (0) | 0 (0) | 0 | 0 (0) | 96 (0.193) | 0 (-) | 100 / 0 | 0 | 0 | 0 | 0 | 5.03 |
| quad | v2 | straight | 0 (0) | 0 (0) | 0 | 0 (0) | 133.2 (0.271) | 0 (-) | 25 / 36.5 | 0 | 0 | 0 | 0 | 0.02 |
| quad | v2 | orthogonal | 0 (0) | 0 (0) | 0 | 6 (1.5) | 413.9 (0.842) | 1 (0) | 25 / 135 | 6 | 4 | 0 | 6 | 0.03 |
| quad | v2 | curved | 0 (0) | 0 (0) | 0 | 0 (0) | 133.2 (0.271) | 0 (-) | 25 / 36.5 | 0 | 0 | 0 | 0 | 0.03 |
| quad | v2 | physics | 0 (0) | 0 (0) | 0 | 0 (0) | 96 (0.195) | 0 (-) | 100 / 0 | 0 | 0 | 0 | 0 | 3.44 |
| intro | v1 | straight | 0 (0) | 0 (0) | 0 | 0 (0) | 48 (0.333) | 0 (-) | 100 / 0.9 | 0 | 0 | 0 | 0 | 0.01 |
| intro | v1 | orthogonal | 0 (0) | 0 (0) | 0 | 4 (2) | 50.3 (0.35) | 0 (-) | 100 / 0 | 0 | 0 | 0 | 0 | 0.01 |
| intro | v1 | curved | 0 (0) | 0 (0) | 0 | 0 (0) | 48 (0.333) | 0 (-) | 100 / 0.9 | 0 | 0 | 0 | 0 | 0.01 |
| intro | v1 | physics | 0 (0) | 0 (0) | 0 | 0 (0) | 48 (0.333) | 0 (-) | 100 / 0.3 | 0 | 0 | 0 | 0 | 0.84 |
| intro | v2 | straight | 0 (0) | 0 (0) | 0 | 0 (0) | 48 (0.333) | 0 (-) | 100 / 0.9 | 0 | 0 | 0 | 0 | 0.01 |
| intro | v2 | orthogonal | 0 (0) | 0 (0) | 0 | 4 (2) | 50.3 (0.35) | 0 (-) | 100 / 0 | 0 | 0 | 0 | 0 | 0.01 |
| intro | v2 | curved | 0 (0) | 0 (0) | 0 | 0 (0) | 48 (0.333) | 0 (-) | 100 / 0.9 | 0 | 0 | 0 | 0 | 0.01 |
| intro | v2 | physics | 0 (0) | 0 (0) | 0 | 0 (0) | 48 (0.333) | 0 (-) | 100 / 0.3 | 0 | 0 | 0 | 0 | 0.92 |
| containers | v1 | straight | 2 (0) | 5 (0) | 1 | 1 (0.1) | 1304.2 (0.528) | 0 (-) | 15 / 27.3 | 0 | 0 | 0 | 0 | 0.09 |
| containers | v1 | orthogonal | 3 (0) | 5 (0) | 1 | 19 (1.9) | 1734.5 (0.702) | 7 (0) | 90 / 9 | 0 | 7 | 0 | 2 | 0.17 |
| containers | v1 | curved | 2 (0) | 5 (0) | 1 | 1 (0.1) | 1307.8 (0.53) | 0 (-) | 15 / 27.2 | 0 | 0 | 0 | 0 | 0.04 |
| containers | v1 | physics | 3 (0) | 4 (0) | 1 | 16 (1.6) | 1229.7 (0.498) | 1 (4.99) | 85 / 13.5 | 0 | 0 | 0 | 3 | 8.74 |
| containers | v2 | straight | 3 (0) | 12 (0) | 6 | 0 (0) | 455.9 (0.677) | 2 (0.29) | 33.3 / 89.3 | 8 | 5 | 2 | 0 | 0.08 |
| containers | v2 | orthogonal | 4 (0) | 14 (0) | 6 | 15 (1.5) | 669.9 (0.995) | 8 (0.53) | 33.3 / 120.2 | 12 | 6 | 2 | 20 | 0.11 |
| containers | v2 | curved | 5 (0) | 13 (0) | 7 | 0 (0) | 520.4 (0.773) | 0 (-) | 31.6 / 93.7 | 9 | 7 | 1 | 0 | 0.1 |
| containers | v2 | physics | 2 (0) | 12 (0) | 6 | 8 (0.8) | 454 (0.675) | 9 (0.37) | 55.6 / 79.9 | 8 | 6 | 2 | 12 | 3.96 |
| forces | v1 | straight | 0 (0) | 9 (0) | 0 | 0 (0) | 599.6 (0.78) | 3 (0.05) | 0 / 94.5 | 6 | 3 | 0 | 0 | 0.02 |
| forces | v1 | orthogonal | 1 (0) | 6 (0) | 0 | 12 (2) | 837.5 (1.09) | 9 (0) | 50 / 90 | 6 | 3 | 0 | 12 | 0.03 |
| forces | v1 | curved | 0 (0) | 9 (0) | 0 | 0 (0) | 599.6 (0.78) | 0 (-) | 0 / 94.5 | 6 | 3 | 0 | 0 | 0.02 |
| forces | v1 | physics | 4 (0) | 9 (0) | 0 | 11 (1.83) | 581.2 (0.756) | 2 (0.18) | 41.7 / 82.5 | 4 | 2 | 0 | 13 | 1.64 |
| forces | v2 | straight | 0 (0) | 9 (0) | 0 | 0 (0) | 598.8 (0.669) | 3 (0.05) | 0 / 95.4 | 6 | 3 | 0 | 0 | 0.02 |
| forces | v2 | orthogonal | 1 (0) | 12 (0) | 0 | 12 (2) | 789.8 (0.883) | 9 (0) | 33.3 / 120 | 8 | 7 | 0 | 14 | 0.03 |
| forces | v2 | curved | 0 (0) | 9 (0) | 0 | 0 (0) | 598.8 (0.669) | 0 (-) | 0 / 95.4 | 6 | 3 | 0 | 0 | 0.02 |
| forces | v2 | physics | 4 (0) | 9 (0) | 0 | 10 (1.67) | 561.3 (0.627) | 2 (0.18) | 50 / 75 | 4 | 1 | 0 | 12 | 2.11 |
| synth40 | v1 | straight | 99 (0) | 66 (4) | 13 | 35 (0.63) | 22380.1 (0.898) | 15 (0) | 42.9 / 19.4 | 0 | 13 | 0 | 3 | 1.07 |
| synth40 | v1 | orthogonal | 125 (3) | 75 (6) | 12 | 129 (2.3) | 26040.8 (1.044) | 102 (0) | 100 / 0 | 0 | 59 | 0 | 1 | 1.98 |
| synth40 | v1 | curved | 118 (5) | 71 (6) | 15 | 36 (0.64) | 23029.6 (0.924) | 69 (0.16) | 28.6 / 23.7 | 3 | 13 | 0 | 3 | 5.77 |
| synth40 | v1 | physics | 99 (5) | 58 (4) | 12 | 119 (2.13) | 22394.6 (0.898) | 39 (0) | 77.3 / 23.7 | 4 | 22 | 2 | 22 | 144.83 |
| synth40 | v2 | straight | 88 (10) | 136 (38) | 153 | 9 (0.16) | 12903.2 (0.589) | 11 (0) | 23.7 / 35.4 | 6 | 9 | 36 | 4 | 2.97 |
| synth40 | v2 | orthogonal | 290 (16) | 187 (50) | 164 | 94 (1.68) | 23263.5 (1.062) | 385 (0) | 93.2 / 10.6 | 7 | 85 | 9 | 6 | 3.16 |
| synth40 | v2 | curved | 182 (15) | 177 (57) | 164 | 9 (0.16) | 17461.9 (0.797) | 45 (0) | 18.4 / 33.3 | 8 | 17 | 9 | 4 | 7.49 |
| synth40 | v2 | physics | 200 (8) | 163 (42) | 164 | 183 (3.33) | 33993.4 (1.582) | 110 (0) | 65.7 / 37.3 | 7 | 16 | 11 | 34 | 236.31 |
| synth120 | v1 | straight | 1206 (60) | 246 (32) | 42 | 137 (0.82) | 210083.8 (1.062) | 61 (0) | 38.1 / 21.9 | 2 | 41 | 0 | 4 | 23.22 |
| synth120 | v1 | orthogonal | 1358 (93) | 197 (26) | 53 | 367 (2.18) | 238892.9 (1.208) | 303 (0) | 95.8 / 6.2 | 12 | 155 | 0 | 13 | 57.43 |
| synth120 | v1 | curved | 1334 (54) | 282 (66) | 61 | 148 (0.88) | 221363.3 (1.119) | 295 (0) | 21.1 / 28.8 | 11 | 41 | 0 | 8 | 73.66 |
| synth120 | v1 | physics | 1396 (57) | 227 (60) | 33 | 420 (2.5) | 222170.1 (1.123) | 218 (0) | 77.3 / 24.6 | 15 | 95 | 6 | 62 | 1989.36 |
| synth120 | v2 | straight | 1736 (81) | 943 (348) | 1876 | 4 (0.02) | 86042.7 (0.717) | 50 (0) | 24.3 / 29.2 | 11 | 61 | 44 | 5 | 32.2 |
| synth120 | v2 | orthogonal | 2915 (111) | 1265 (482) | 1966 | 306 (1.82) | 127260.1 (1.06) | 2388 (0) | 96 / 7.3 | 13 | 233 | 15 | 15 | 49.23 |
| synth120 | v2 | curved | 2390 (120) | 1163 (413) | 1970 | 13 (0.08) | 105574.8 (0.879) | 835 (0) | 20.8 / 29.4 | 19 | 68 | 9 | 5 | 50.09 |
| synth120 | v2 | physics | 3149 (62) | 618 (157) | 1894 | 733 (4.36) | 193255.5 (1.609) | 838 (0) | 46.4 / 53.3 | 19 | 82 | 30 | 152 | 3662.71 |

### Layout custom (default do store, src/store.js:32) — linhas selecionadas (completo em out/results-custom.md)
| cenário | router | X (pol) | E×N (pol) | portas | ←in | inv | t ms |
|---|---|---|---|---|---|---|---|
| containers | orthogonal | 6 (1) | 13 (1) | 10 | 0 | 0 | 0.35 |
| containers | physics | 1 (0) | 12 (0) | 0 | 0 | 1 | 30.87 |
| synth40 | orthogonal | 116 (6) | 239 (81) | 89 | 18 | 28 | 11.32 |
| synth40 | physics | 57 (2) | 167 (20) | 11 | 21 | 28 | 186.42 |
| synth120 | straight | 1145 (50) | 2103 (681) | 116 | 25 | 12 | 522.44 |
| synth120 | orthogonal | 1660 (65) | 2150 (705) | 263 | 33 | 41 | 422.08 |
| synth120 | physics | 1300 (28) | 1535 (236) | 50 | 22 | 123 | 2238.36 |

### Diagnósticos complementares
- Engine físico sobre outros routers (out/results-physics-combos.md), synth40 v1:
  - curved: X 118 (5), E×N 71 (6), fora do perímetro 0;
  - physics:curved: X 74 (3), E×N 80 (20);
  - straight: X 99 (0), E×N 66 (4), fora do perímetro 0;
  - physics:straight: X 87 (5), E×N 50 (4), 26 âncoras fora do perímetro, inv 10.
  - Containers com physics:straight: 5 âncoras fora do perímetro.
- Convergência do physics com 300 passos/tick (out/results-steps300.md), comparada aos 30 do app:
  - synth40 v2: X 200→170, E×N 163→103, dobras 183→148, t 236→2215 ms;
  - synth40 v1: X 99→95, dobras 119→85, t 145→1231 ms.
- Multi-arestas coincidentes (diag/multiedges.mjs):
  - synth120 v2: straight, orthogonal e curved 11/11; physics 4/11;
  - synth120 v1: 8/11 nos três algébricos; physics 7/11;
  - synth40 v2: 2/2 nos três algébricos; physics 1/2.
- Seleção de face (diag/faceselect.mjs): nenhuma troca de face sobrevive ao buildWorld (0/3, 0/1, 0/12, 0/12). Cruzamentos shared-layer no synth120 v1: 97 na base, 26 após face-select, 34 após buildWorld.
- Causas das violações de política restantes no algébrico (diag/obstacle-causes.mjs): no v2, 100% são âncoras dentro do obstáculo acolchoado (13/13 no synth40, 57/57 no synth120). No v1 synth40, 4/4 vêm dos waypoints do layout.
- Mesmos rects do v1, com e sem os edgeWaypoints do layout (diag/no-waypoints.mjs, synth40): orthogonal E×N (pol) 75 (6) → 87 (17); straight 66 (4) → 65 (0).
- clipAnchors=false no v2 (diag/out/results-noclip.md), synth40: âncoras fora do perímetro caem de 36 para 0 no straight e de 9 para 0 no orthogonal, mas os cruzamentos do straight sobem de 88 para 203.
- Perfil do layout v1 (--cpu-prof): hananRoute ocupa 26,1% no synth40 (482 ticks) e 62,6% no synth120 (40 ticks, 16 s).
- Testes unitários do routing (node --test --test-concurrency=1): deprecated 158/158 passando; demais 138/138.

#### R1-01 · Router orthogonal (default do app) gera pernas DENTRO do próprio nó quando os nós estão em diagonal e próximos (alta, esforço P)

- **Evidência:** src/routing/routers/orthogonal.js:28-41 escolhe as faces pelo sinal de dx/dy entre CENTROS e põe a midline no meio das âncoras. Se as projeções no eixo dominante se sobrepõem, as âncoras ficam 'cruzadas' (face oeste de a em x=0 e face leste de b em x=65) e a midline cai dentro dos dois nós. Reprodução: diag/ortho-inward.mjs, rota [(0,24),(32.5,24),(32.5,96),(65,96)] com 2 violações B7 de e2e/invariants.js, mesmo após clip-anchors e snap-container. Os pós-passes não corrigem, porque enforcePerpendicularLegs só roda quando uma âncora mudou (clip-anchors.js:82). Harness (←in = pernas saindo para dentro do nó; ⊥% = pernas perpendiculares à face): quad v1/v2 com 6 ←in em 4 arestas, ⊥% 25 e desvio 135°, inv 6; forces 6-8 ←in; containers v2 12 ←in e inv 20; synth120 12-13 ←in. O default do store é routerId 'orthogonal' (src/store.js:33). O E2E de invariantes cobre só o exemplo intro × custom/off (e2e/13-geometry-invariants.spec.js:26-28), o único exemplo em que o harness mostra tudo limpo.
- **Recomendação:** Escolher as faces pela separação real dos retângulos (gap em x × gap em y), não pelo sinal entre centros. Quando os intervalos se sobrepõem no eixo dominante, usar as faces do outro eixo, ou uma rota em L/U por fora. Ampliar a matriz de invariantes para os 4 exemplos × live (o harness já roda isso em Node, sem browser).

#### R1-02 · Router 'curved' desenha RETAS: pontos de controle da Bézier ficam sobre a corda (alta, esforço P)

- **Evidência:** src/routing/routers/curved.js:21-28 põe c1 e c2 ao longo do vetor source→target. Em diag/curved-is-straight.mjs a distância dos controles à corda é de ~1e-15 e as âncoras são idênticas às do straight. Harness: curved e straight dão métricas idênticas em quad e intro (comprimento 134.9, 0 dobras). O renderer desenha 'M p0 C p1,p2,p3' (src/renderer/edges.js:157-159), ou seja, um segmento. tests/routing/routers/curved.test.js só verifica que há 4 pontos e o kind. A curvatura só aparece quando obstacle-route transforma a aresta em 'spline'.
- **Recomendação:** Deslocar os controles na direção normal à face de saída/chegada (tangente perpendicular à face) e/ou aplicar um offset lateral por multi-aresta. Adicionar um teste de que a Bézier não é degenerada (distância do controle à corda maior que zero).

#### R1-03 · Portas colapsadas e multi-arestas desenhadas uma sobre a outra (alta, esforço M)

- **Evidência:** O orthogonal ancora sempre no CENTRO da face (orthogonal.js:32-38), então todas as arestas de uma face saem do mesmo ponto e compartilham a primeira perna. Harness (portas = pares de âncoras a <3px no mesmo nó; paralelas = pares de segmentos a <6px): orthogonal synth120 v1 com 155 portas coincidentes e 303 paralelas (gap 0); v2 com 233 e 2388; custom com 263 e 857. Multi-arestas [a,b,1]+[a,b,2] (diag/multiedges.mjs): straight, orthogonal e curved desenham coincidentes 11/11 no synth120 v2 e 2/2 no synth40 v2 (8/11 no v1; as exceções pegaram waypoints do layout). O physics reduz para 4/11. O engine físico prova que o espalhamento resolve: portas 95 vs 155 (v1), 82 vs 233 (v2).
- **Recomendação:** Criar um passe algébrico barato de distribuição de portas por face: ordenar pelo ângulo do outro endpoint e espaçar uniformemente, com offset por chave de multi-aresta. É a parte de maior valor do forces-endpoint-bbox.js e pode ser portada como zona de força por endpoint (ADR-0011) na Fase 4.

#### R1-04 · Custo por tick inviável em grafos densos: A* dentro do layout v1 e engine físico (alta, esforço M)

- **Evidência:** Layout v1 no synth120: 227,7 s para 482 ticks (~470 ms/tick). No synth40: 9,3 s. O v2 leva 0,2 s. O perfil de 40 ticks do synth120 (diag/v1prof120.mjs com --cpu-prof) atribui 62,6% do tempo a hananRoute, chamado por collision-waypoints.js:125 a cada tick para cada aresta com layer (a chave de semente muda enquanto os nós se movem). No synth40 são 26% + ~10% em seedKeyOf/uniqSorted/collectEdgeObstacles. O passable() do A* é O(k) por aresta de grid (obstacle-route.js:138-144), com grid O(k²). Estágio de routing por tick: algébrico 23-57 ms no synth120 com v1/v2 e 420-530 ms com custom (A* estático); physics 145-236 ms no synth40 e 2,0-3,7 s no synth120. Tudo isso roda a cada tick/frame (pipeline.js:170).
- **Recomendação:** (a) A* incremental: só recalcular quando uma âncora ou obstáculo muda de célula; limitar os obstáculos ao bbox da corda expandido; grid esparso com broad-phase (reusar o spatial grid de src/physics). (b) Orçamento de routing por frame: rotear só as arestas afetadas e deixar as demais para frames seguintes. (c) No engine unificado, persistir o mundo entre ticks (ver R1-07). O harness mede isso e serve como teste de regressão de performance.

#### R1-05 · Layout v2 nunca emite 'end': o estágio de routing roda a cada frame indefinidamente (alta, esforço P)

- **Evidência:** src/physics/solver.js:42 faz alpha = max(alphaMin, alpha*(1-decay)), um PISO em alphaMin. Mas compile-world.js:240 só emite 'end' se alpha < alphaMin, e o loop (compile-world.js:244) continua enquanto alpha >= alphaMin. diag/v2alpha.mjs: 3000 ticks com alpha=0.003 e 0 eventos 'end'; o v1 emite 'end' com alpha 0.0007. No browser, o rAF nunca para e cada frame roda o routing (com physics, ~200 ms por frame no synth40). O bug é do layout, mas o impacto recai no routing.
- **Recomendação:** Trocar para alpha <= alphaMin no stepOnce/loop (ou decair abaixo do piso) e adicionar um teste unitário que exija o 'end'. Isso também vale para o plano de tornar o v2 o default.

#### R1-06 · Engine físico combinado com router straight ou curved está quebrado (contradiz ADR-0013) (media, esforço P)

- **Evidência:** Com straight (diag/phys-straight.mjs), as duas âncoras terminam em y=70, fora de s (y 0..40) e de t (y 100..140). projectRun (constraints.js:65-87) iguala a coordenada tangencial das âncoras sem reprojetá-las no perímetro, e warm-start.js:127 trata a diagonal como segmento Manhattan. Harness, physics:straight: 26 âncoras fora do perímetro no synth40 e 5 no containers. Com curved, o branch físico não chama applyObstacleRouting nem usa session.edgeWaypoints (pipeline.js:189-207), e as curvas só recebem mola de origem. Resultado: a detecção de obstáculos é descartada, com aresta×nó que a DSL mandou evitar subindo de 6 para 20 no synth40 v1. Os números de physics:curved são idênticos aos do roteador externo trivial centro-a-centro (out/external-example.md). ADR-0013 afirma que 'qualquer combinação layout×router funciona'.
- **Recomendação:** Enquanto o legado existir, rejeitar ou avisar nas combinações engine=physics com router≠orthogonal. Na Fase 4, modelar engine e router como UM plugin com capacidades declaradas (caps), em vez de dois eixos cruzados.

#### R1-07 · Engine físico descarta o estado entre ticks; o 'warm-start incremental' do pipeline não existe (media, esforço P)

- **Evidência:** src/routing/physics/index.js:35 tem 'void prevState' e index.js:33-34 anula warmStart.aStar. Mesmo assim, pipeline.js:166-168 comenta 'Estado persistente do solver físico entre ticks (warm-start incremental no LIVE)' e guarda physicsState (pipeline.js:204-206). Cada tick reconstrói o mundo e roda só 30 passos (STEPS_PER_TICK_DEFAULT, index.js:25). Harness com 300 passos (results-steps300.md), synth40 v2: X 200→170, aresta×nó 163→103, dobras 183→148, paralelas 110→78. O app nunca atinge essa convergência, nem com o layout parado.
- **Recomendação:** Na Fase 4, o mundo unificado persiste entre ticks por construção. Não portar o padrão rebuild-por-tick. Até lá, corrigir o comentário do pipeline, que induz a erro.

#### R1-08 · A seleção de face anti-cruzamento é desfeita pelo warm-start (media, esforço P)

- **Evidência:** face-select.js troca as faces e reconstrói as rotas, mas buildWorld recoloca as âncoras na interseção do raio centro→edgeCenter (warm-start.js:92-97). diag/faceselect.mjs: 0 de 3, 0 de 1, 0 de 12 e 0 de 12 faces trocadas sobrevivem ao buildWorld. Cruzamentos shared-layer no synth120 v1: 97 na base, 26 após face-select, 34 após buildWorld (antes de qualquer passo). No v2: 74, 29 e 58. A 'seleção de face anti-cruzamento', citada como qualidade em ADR-0009 e F-0017, é parcialmente anulada.
- **Recomendação:** Se for reaproveitada na Fase 4, o warm-start precisa respeitar a face escolhida (âncora inicial = anchorOn(rect, face)) ou a face precisa virar uma restrição. Adicionar um teste que verifique a face após o buildWorld.

#### R1-09 · Afirmações do ADR-0009/F-0017 não se sustentam integralmente na medição (media, esforço P)

- **Evidência:** ADR-0009 diz que o físico 'produz roteamentos de qualidade superior em casos densos'. Mesmo router base (orthogonal), comparando physics com algébrico:
- Violações de política (cruzamentos entre arestas com edgeLayer comum e aresta×nó declarado), em que o físico MELHORA no v2 e no custom: synth120 v2 62 vs 111 e 157 vs 482; custom synth40 2 vs 6 e 20 vs 81; custom synth120 28 vs 65 e 236 vs 705.
- Violações de política no v1, onde o algébrico usa os waypoints do layout: synth120 57 vs 93 e 60 vs 26 (aresta×nó PIORA).
- Geometria, em que o físico PIORA: synth120 v2 X total 3149 vs 2915, invariantes 152 vs 15, dobras 733 vs 306, stretch 1,61 vs 1,06; custo 3663 vs 49 ms/tick.
Critérios do F-0017: A3 ('nenhum segmento atravessa nó estranho') é violado (aresta×nó declarado 4-157); A2 ('descruza arestas com layer comum') também (5-62 cruzamentos restantes). tests/routing/pipeline-opt-ins.test.js:34-35 termina em 'assert.ok(true)'.
- **Recomendação:** Corrigir os textos do ADR/F-0017 com números reprodutíveis do harness e transformar A2/A3 em limiares medidos (harness em CI unitário) em vez de afirmações. Usar as métricas de política do harness como função de aptidão da Fase 4.

#### R1-10 · Duas fontes de configuração de routing (DSL × config) divergentes, com flags mortas (media, esforço P)

- **Evidência:** A DSL options.routing é validada (attr-set.js:15-47, ir.js:480-546) e vai para ir.meta.routing. O pipeline lê SÓ a config, que não é validada (config.js:36): pipeline.js:187 (engine) e :222 (algebraic.*). Assim, 'options.routing.engine: physics' na DSL é aceito sem aviso e sem efeito (tests/dsl/ir.test.js:271 valida só o parse). O mesmo vale para central.k, endpointBBox e physics.hardObstacleEscalation, lidos da config (physics/index.js:93,96,101), embora o comentário em index.js:92 diga meta. Flags validadas e nunca lidas: algebraic.manhattanRebuild, algebraic.reanchorHubs, physics.aStarMidLoop; fission.threshold/ticks e fusion.manhattanK/minControlDistance/ticks (stepOpts em index.js:79-102 não os repassa). O placeholder da config anuncia 'router: padding: 12' (config.js:54,57,60), mas nenhum router lê opts. Knobs algorítmicos na DSL contrariam o ADR-0007.
- **Recomendação:** Um único ponto de verdade, conforme o ADR-0007: knobs de engine só na config, validada com o mesmo schema. A DSL fica com política (layers, snap on/off). Emitir erro para chaves sem efeito e remover o placeholder falso.

#### R1-11 · obstacle-route: gatilho pela corda e A* que falha em silêncio quando a âncora está no obstáculo acolchoado (media, esforço P)

- **Evidência:** obstacle-route.js:50 decide o desvio por segmentHitsRect(sourceAnchor, targetAnchor), a CORDA, e não pela polilinha roteada. diag/chord-trigger.mjs: um Z ortogonal atravessa o nó 'o', que a aresta declara evitar, sem que a corda toque o obstáculo, e a rota é mantida. Além disso, hananRoute (obstacle-route.js:129-191) devolve null quando S ou T estão dentro do obstáculo acolchoado (nodePad=12) e a rota original fica. diag/obstacle-causes.mjs: 100% das violações de política restantes no v2 vêm disso (13/13 no synth40 com orthogonal e com straight; 57/57 no synth120).
- **Recomendação:** Testar a polilinha real. No A*, excluir do acolchoamento a região da âncora (ou começar da borda do acolchoamento) e reportar 'sem rota' como diagnóstico, não em silêncio.

#### R1-12 · Terceiro engine de routing escondido no layout v1 (canal lateral edgeWaypoints) e ausente no v2 (media, esforço M)

- **Evidência:** O live v1 roteia as arestas com layer com A* + forças (collision-waypoints.js:1-24, cabeçalho 'HYBRID A* + physics') e publica session.edgeWaypoints (live/index.js:504), campo que NÃO está no contrato LayoutSession (src/layout/adapter.js:31-38). O pipeline consome esse campo (pipeline.js:215). O layout importa routing (collision-waypoints.js:28-29), contra a ortogonalidade do ADR-0013. O v2 (compile-world.js) não fornece waypoints, então tornar o v2 default muda o routing em silêncio. Com os MESMOS rects do v1, sem waypoints (diag/no-waypoints.mjs, synth40): no orthogonal, aresta×nó declarado vai de 6 para 17; no straight, de 4 para 0. O efeito é misto e caro (R1-04). O ADR-0012 rejeita 'Híbrido A* + suavização' como alternativa, e ela existe em produção.
- **Recomendação:** Na virada para v2/Fase 4, decidir explicitamente: portar a estratégia de faixa semeada por A* como topologia semeada (compatível com o ADR-0012, 'topologia fixa ou semeada') no motor unificado, ou removê-la. Enquanto existir, formalizar edgeWaypoints no contrato do adapter (caps.providesRouting).

#### R1-13 · Custo do legado src/routing/physics: 67% do routing, DSL e testes presos a ele (media, esforço M)

- **Evidência:** Código exclusivo do engine deprecated:
- physics/ com 1952 linhas;
- face-select.js 190, snap-endpoints.js 176, snap-resolver.js 183;
- ~70 linhas de anchor-utils (projectToPerimeter, intersectRayWithPerimeter, rectCenter, midpointOfCenters).
Total de ~2,47 mil das 3670 linhas. Somam-se:
- src/shapes (298 linhas; getShape só é usado por snap-resolver.js:17);
- ~150 linhas de ir.js (parseEdgeEndpoints 379-426, parseEdgeStyle 427-454, parseRouting 473-546) para superfícies só lidas por ele: node snap/snapGroups/snapAngles/anchors/shape (snapAngles e anchors não são lidos por ninguém) e edge style/endpoints (style.strokeWidth NÃO afeta o renderer).
Testes: 19 arquivos com 158 testes e 2951 linhas, mais 4 arquivos com 39 testes e 535 linhas; E2E 14, 17, 18 e 19.
Acoplamento no pipeline.js: linhas 23, 25-29, 166-168, 187-208 e 219-225.
Código morto em produção dentro dele: splitCurvePoint, mergeCurvePoint e curvePointNeighborDistance (só testes); applyChainSpring (flag nunca ligada); runUntilStable e converged (só testes); stubs em constraints.js:196-202 e forces.js (slackAttract); critério 'astar' como stub (snap-resolver.js:63-71). Fissão desligada por padrão porque 'explode em grafos densos' (index.js:51-54).
- **Recomendação:** Antes da remoção, extrair o que vale para a Fase 4 (ver R1-17). Remover o engine em seguida, sem esperar a Fase 4: congelar ou marcar como erro de DSL as superfícies órfãs (hard cut à la ADR-0008) e converter os E2E 14/18/19 em cenários de aceitação agnósticos de engine, usando as métricas do harness.

#### R1-14 · Estágio de routing não é testável isoladamente; contrato do router pouco usado (baixa, esforço P)

- **Evidência:** O estágio vive num closure (pipeline.js:170-245), e o harness teve de espelhá-lo (lib/frame.js:routeStage). router.caps e load() nunca são lidos: o pipeline compara a string store.state.routerId === 'orthogonal' (pipeline.js:214). O terceiro argumento de route(ir, positions, opts) é ignorado pelos 3 routers.
- **Recomendação:** Extrair runRoutingStage(ir, session, router, opts, prevState) → {routedEdges, state} puro e exportado. O pipeline, os testes e o harness passam a usar a mesma função, e o 'engine' vira implementação desse contrato (base para o R1-18).

#### R1-15 · Duplicação e funções longas concentradas no caminho deprecated (baixa, esforço P)

- **Evidência:** Duplicações:
- simplifyCollinear 2× com tolerâncias diferentes (obstacle-route.js:245 com cross 1e-6 e sem dedup; anchor-utils.js:293 com dedup 0,5 px);
- expandRect 3× (obstacle-route.js:195, physics/index.js:148, forces.js:148);
- routeWithFaces (face-select.js:50) ≡ rebuildWithFaces (anchor-utils.js:238);
- cauda de pós-processamento repetida 3× (clip-anchors.js:82-90, snap-container-anchors.js:81-87, obstacle-route.js:114-118);
- obstáculos para Hanan montados 2× com semânticas diferentes: collectEdgeObstacles respeita layers, seedWithAStar (physics/index.js:117-146) usa todos os rects.
Funções com mais de 100 linhas (acorn, tools/fnlen.mjs): buildWorld 147, step 113 e reassignFacesToReduceCrossings 104, todas do caminho deprecated. O núcleo algébrico não tem nenhuma (a maior é hananRoute com 63). O closure do pipeline tem 280 linhas e rerender, 171.
- **Recomendação:** Na remoção do legado, a maior parte desaparece. No núcleo, unificar simplifyCollinear e a cauda de pós-passes num único finalizePolyline(points, kind, sRect, tRect).

#### R1-16 · Lacunas de teste que deixam passar R1-01/R1-02/R1-03 (baixa, esforço P)

- **Evidência:** - E2E de invariantes só com intro × {custom, off} (e2e/13:26-28).
- curved.test.js não verifica curvatura.
- Nenhum teste de portas coincidentes ou de multi-aresta.
- pipeline-opt-ins.test.js:34-35 tem 'assert.ok(true)'.
- src/routing/crossings.js conta só cruzamentos PERPENDICULARES h×v (classifica pelo eixo dominante, :36-41) e ignora curve/spline (:65). Serve ao engine ortogonal, mas não como métrica geral: duas diagonais do straight classificadas como 'h' nunca contam.
- **Recomendação:** Rodar o harness (ou lib/metrics.js) como teste unitário com limiares por cenário: ←in=0 e inv=0 no orthogonal, curvatura maior que zero no curved, portas coincidentes abaixo de um limite. Custo de segundos, sem browser.

#### R1-17 · O que do legado é reaproveitável na Fase 4 (motor unificado) (info, esforço M)

- **Evidência:** - (a) Snap de portas: snap-resolver.js (183 linhas, geometria pura sobre src/shapes) reaproveitável ~100%. forces-edge-central.js (41) é exatamente um 'atrator de ponto' do ADR-0010. projectToPerimeter/intersectRayWithPerimeter (anchor-utils) dão o trilho de perímetro como constraint.
- (b) Seleção de face: face-select.js serve como pré-passe discreto, desde que o warm-start respeite a face (R1-08). Depende de crossings.js, que é só ortogonal.
- (c) Fissão/fusão: topology.js (404) é específica de Manhattan (shelf H-V-H-V-H), o split/merge de curva só é usado em testes e a fissão está desligada por padrão. Aproveitam-se apenas os contadores com histerese e o cooldown (updateSplitCounter/shouldSplit/tickCooldown, ~40 linhas), coerente com 'topologia fixa ou semeada' do ADR-0012.
- (d) Warm-start: buildWorld (147 linhas) é conversão polilinha→corpos. O modelo rebuild-por-tick NÃO deve ser portado (R1-07). A ideia de semear com Hanan (seedWithAStar) é compatível com o ADR-0012 como semente topológica.
- (e) Espalhamento de portas por BBox de endpoint (forces-endpoint-bbox.js, 231 linhas): é o único ganho medido e robusto do legado (portas 95 vs 155, paralelas 218 vs 303 no synth120 v1).
- Os E2E 14/18/19 codificam os comportamentos-alvo.
- **Recomendação:** Antes de remover o legado: mover snap-resolver e o trilho de perímetro para um módulo neutro (ex.: src/routing/ports.js), portar o espalhamento de portas como zona de endpoint (ADR-0011) e reescrever 14/18/19 como cenários do harness com limiares. Descartar topology.js e o solver.

#### R1-18 · Mérito do ADR-0009 (engines co-iguais) à luz do código (info, esforço M)

- **Evidência:** A intenção é boa: não privilegiar o default e manter o algébrico como baseline determinístico. O ADR rejeita, com razão, remover o algébrico, e o harness mostra que ele é 30-70× mais barato e geometricamente mais limpo. O código, porém, não implementa co-igualdade:
- (1) o físico não está em nenhum registry (src/routing/registry.js:1-11 tem só straight/orthogonal/curved); é um if em pipeline.js:187-208;
- (2) não é um engine, e sim um pós-processador que exige a saída de um router base (_inputRoutedEdges, index.js:28) e é pós-processado de volta pelos passes algébricos (gates legacy=true, pipeline.js:222-225);
- (3) existe um default privilegiado de fato: routing?.engine || 'algebraic' (pipeline.js:187);
- (4) o eixo engine × router gera combinações quebradas (R1-06);
- (5) há um terceiro engine não declarado no layout v1 (R1-12);
- (6) a seleção é feita por uma config não validada, enquanto a DSL aceita a mesma chave sem efeito (R1-10).
- **Recomendação:** Reescrever o ADR-0009, ou superá-lo junto com o ADR-0012 na Fase 4, como contrato de ENGINE de routing com estado: route(ir, rects, ctx, prevState) → {routedEdges, state, diagnostics}, registrado como os layouts, com caps (orthogonal, curves, obstacleAware, stateful). O 'algebraic' passa a ser o engine-oráculo permanente (baseline para as métricas do harness e fallback para layouts estáticos) e o 'unified' vira plugin sob o mesmo contrato. Co-igualdade verificável = ambos passam pela mesma bateria de métricas/invariantes do harness.

#### R1-19 · clip-anchors solta a aresta do próprio nó quando o nó sobrepõe um container estrangeiro (baixa, esforço P)

- **Evidência:** clipAnchorsToContainerFaces projeta a âncora na face do container 'bloqueador' (clip-anchors.js:110-120). Quando o próprio nó está dentro de um container alheio (sobreposição de layout), a âncora sai do perímetro do nó. Harness v2 straight: 36 âncoras soltas no synth40 e 44 no synth120. Com routing.algebraic.clipAnchors=false caem para 0 (diag/out/results-noclip.md), mas os cruzamentos sobem de 88 para 203. Aviso real emitido na matriz: '[clip-anchors] edge polyline fully inside foreign container "backend"' (containers v2). A causa raiz é a sobreposição de containers do v2: 94 pares cont×cont e 1158 folha×container alheio no synth120.
- **Recomendação:** Corrigir primeiro a sobreposição de containers no v2 (layout). No clip, só projetar na face do bloqueador se o resultado continuar no perímetro do nó; caso contrário, emitir um diagnóstico.

