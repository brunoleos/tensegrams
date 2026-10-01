# Trilha 5 · Layout: avaliação das estratégias e alternativas

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito:** Das 7 propostas de layout, adoto 3 (LA-1 no núcleo, com a regra de gating por cobertura; LA-3 só no cold start do live; LA-4 só como oráculo no harness), mando 1 a spike adicional (LA-2, a âncora) e rejeito 3 (LA-5, LA-6, LA-7). O v2 NÃO deve virar default agora nem junto com a Fase 4: só depois de 6 gates medidos no harness, numa entrega própria.

Das 7 propostas, adoto 3, mando 1 a spike adicional e rejeito 3; o v2 só vira default após 6 gates medidos.

### Decisões por proposta

| Variante | Decisão | Violações syn:100 (pares) | Cruzamentos syn:100 (n) | Δwarm syn:100 (px) | Tempo syn:100 (ms) |
|---|---|---|---|---|---|
| v1 (status quo) | — | 2 | 719 | 90,6 | 6.037 |
| v2 atual (flag) | — | 154 | 688 | 8,4 (empilhado) | sem 'end' |
| LA-1 híbrido nativo | adotar | 0 | 427 | 12,0 | 171 |
| LA-2 âncora | spike adicional | 0 | 427 | 0,3 | 181 |
| LA-3 stress (medido no `custom`) | adotar só no live | 21 | 276 | 269 | 56 |
| LA-4 WebCoLa | só oráculo | 1 | 247 | 26,9 | 8.343 |
| LA-5 ELK layered / dagre | rejeitar | 0 / 0 | 603 / 820 | 1.258 / 1.041 | 316 / 352 |
| LA-6 fcose | rejeitar | 23 | 309 | 39,1 | 131 |
| LA-7 d3-force | rejeitar | 17 | 463 | 415,7 | 231 |

Fontes: `spikes/results/compare.md` e `harness/results/main.json`.

A LA-1 implementa o que o ADR-0010 já decidiu (`0010-*.md:26-28`), agora com medição. Adoto o composite, o atrator-região e o 'end' cinético, com a condição de usar a regra de gating por cobertura. A forma da mola (içada ou folha) fica em aberto.

A LA-2 vence no mapa mental, mas congela a topologia: uma aresta nova não aproxima os nós (razão de comprimento 1,00). O spike não implementa `update`, e o drag acontece dentro da mesma sessão (`src/app/gestures.js:211,273-275`). O reaquecimento local com alpha global falhou (81,9 px), e a temperatura por corpo não tem spike.

A LA-3 entra só no cold start do live. No `custom`, a semente custa 11× mais por edição, porque o pipeline recria a sessão a cada tecla (`src/app/pipeline.js:134,155`).

A LA-4 fica no harness, rotulada como referência sob um contrato mais forte. O `avoidOverlaps` do cola ignora `nodeLayers`, então os números dele não servem de meta 1:1.

A LA-5 perde para o v1 em cruzamentos (dagre) ou em área (ELK: 20,4 M px²), e embaralha o layout a cada edição. A LA-6 viola o contrato e a LA-7 duplicaria um motor pior que o do repo; aqui as duas partes concordam.

### Verificações próprias

Reproduzi 3 alegações contestadas (`juiz/verify.mjs`, `verify-cov.mjs`, `verify-kick.mjs`).

| Cenário allcollide | Híbrido entregue: end (ticks) | Híbrido: violações (pares) | Híbrido: bbox (M px²) | Regra cobertura: violações (pares) | Regra cobertura: end (ticks) |
|---|---|---|---|---|---|
| syn100 s13 | não (1500) | 30 | 125,2 | 0 | 461 |
| syn100 s3 | não (1500) | 68 | 9.001,6 | 0 | 434 |
| syn100 s21 | não (1500) | 30 | 147,5 | 0 | 386 |
| syn100 s99 | não (1500) | 23 | 132,0 | 0 | 510 |
| syn60 s5 | não (1500) | 2 | 60,4 | 0 | 423 |

A linha s13 da regra de cobertura vem de `defensor/robust3-fixes.md`; as demais eu medi. O defensor tem razão, e o defeito aparece em todas as sementes, não só na 13. Sem mola também diverge, então a causa é o gating do composite (`spikes/hybrid/hybrid-variants.mjs:169`).

| Cenário | Içada, região 0,02 (cruz.) | Içada, região 0,3 (cruz.) | Folha, região 0,3 (cruz.) | Sem mola, região 0,3 (cruz.) | bbox folha / içada 0,3 (M px²) |
|---|---|---|---|---|---|
| syn:100 | 427 | 381 | 356 | 386 | 4,38 / 3,96 |
| syn100 s7 | 334 | 405 | 371 | 448 | 5,65 / 4,53 |
| syn100 s42 | 442 | 464 | 395 | 480 | 6,56 / 4,98 |

Com região forte, a mola folha fica estável e tem 7–15% menos cruzamentos que a içada. Em troca, ocupa 11–32% mais área; em syn:300 são 37,7 contra 17,9 M px² (`defensor/diag/leafspring-region-300.md`). É empate técnico. A lição robusta é "a coesão do container domina a força de aresta".

A mola acrescenta pouco sobre a semente: 356–464 cruzamentos com mola, 386–480 sem. A semente em círculo dá 685 (`defensor/diag/circle-nospring.md`).

O knob do v1 se confirma. Com `alphaKick` 0,05, o reaquecimento da mesma IR cai de 76 para 10,4 px (syn:100) e de 20,6 para 2,3 px (ex:containers). O mesmo kick serve ao drag e ao release (`live/index.js:221,255`), então é preciso um `warmKick` separado.

Achado adicional: a semente stress piora o `custom` nos exemplos pequenos. O Δcold de ex:quad sobe de 20,3 para 211,6 px, e ex:quad é o DSL inicial do app (`src/store.js:30`).

### Parecer sobre o v2 como default

Não agora, e não junto com a Fase 4. Os bloqueadores são funcionais: o clamp de alpha impede o 'end' (`src/physics/solver.js:42`, `compile-world.js:240,244`), os containers colapsam e o warm start é ignorado. A "calibração provisória" não é o problema.

Gates, todos medidos no harness:

1. 'end' finito em todos os cenários (hoje o v2 emite em 0 de 9).
2. Violações ≤ v1 e contenção 0 nos 16 cenários, incluindo allcollide e layers desalinhadas.
3. Pico de reaquecimento ≤ v1, honrando `seedPositions`.
4. Paridade de tag forces, constraints, `update`/frozen e `velocityCap`, e semântica de pesos decidida em ADR.
5. Menos de 16 ms/tick com 300 nós (o spike dá 3,25).
6. Harness como teste de caracterização, mais E2E com `engine: v2` nos dois projetos.

O flip vai numa entrega própria, com o v1 disponível por flag durante um ciclo. Depois vêm a Fase 4 e a remoção do v1 (~1.260 linhas). Com a LA-1 o esforço é M: o spike já resolve L1-01 a L1-03 com custo ~30× menor que o do v1.

### Implicações para os ADRs

| ADR | Ação | Motivo |
|---|---|---|
| 0010 | manter e emendar | O container composto passa a ter código medido; acrescentar "força de aresta subordinada à coesão do container". |
| 0011 | manter | O composite usa `Kp·pen` linear; a projeção segue fora do default (`0011-*.md:34-35`). |
| 0013 | manter | O slot LAZY segue vazio (`src/layout/registry.js:9-10`); libs externas só como oráculo. |
| novo | criar | Gating composite×layer por cobertura das unidades do LCA, que é semântica nova do contrato F-0005. |
| novo | criar | Flip v1→v2 desacoplado da Fase 4, sob os 6 gates. |
| novo | criar | Semântica dos pesos de `nodeLayers` no v2 (L1-08). |

### Dívidas do estado atual

A geometria de container tem 6 derivações diferentes (L1-12). Elas causam as violações residuais do v1 (L1-05, 46 px) e a fragilidade à ordem do YAML (L1-06). Unificá-las numa função recursiva bottom-up, como `collision-postpass.js:114`, deve vir antes do flip.

O `custom`, default do app (`src/store.js:32`), deixa 46 e 206 violações em escala (L1-11). Iterar o pós-passo até convergir e semear por hash do id custam P. O quick-win de desempenho do v1 (L1-04) só vale se o flip atrasar.

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Corrigir o término do v2: separar o piso de alpha do critério de 'end' e usar 'end' cinético | alto | P | src/physics/solver.js:42 clampa alpha em alphaMin, e compile-world.js:240,244 nunca emite 'end'. O resultado é RAF perpétuo, com re-routing e repaint por frame (L1-01). O spike prova que o 'end' cinético funciona (263–613 ticks). Os testes atuais mascaram o bug com o critério alpha>=0.005 (tests/layout/compile-world.test.js:9-13). |
| 2 | Container composto + atrator-região no v2 com gating por cobertura das unidades do LCA | alto | M | É o bloqueador principal (L1-02): 154 violações em syn:100 e 545 em syn:300. O núcleo da LA-1 zera isso. O gating ingênuo diverge em 5 de 5 cenários allcollide, e o 'só irmãos' quebra com layers desalinhadas (70/577 violações). A regra de cobertura passou em todos os regimes medidos (juiz/cov-allcollide.md, defensor/robust3-fixes.md, robust4-misaligned.md). |
| 3 | Harness como teste de caracterização com gates (end, violações, contenção, reaquecimento, determinismo) e cenários allcollide, desalinhado e pins | alto | P | O v2 tem 7 testes contra 35 do v1, e nenhum E2E usa engine v2 (L1-13). Os cenários allcollide e misaligned mostraram falhas que os 9 cenários originais não pegavam. O subset rápido leva ~5 s. A coluna do cola (LA-4) entra como referência. |
| 4 | Honrar seedPositions/warmAlpha e passar velocityCap no v2 | alto | P | O v2 re-explode 150–250 px a cada edição (L1-03), porque compile-world.js não lê a semente. Sem cap, a velocidade é Infinity (integrator.js:23), enquanto o v1 usa maxVel 32 (L1-09). |
| 5 | Unificar a geometria de container numa função recursiva bottom-up compartilhada, com constantes HEADER/pad | alto | M | Há 6 derivações com 4 semânticas (L1-12). Elas causam as violações residuais do v1 (46 px = pad+HEADER, L1-05) e a dependência da ordem do YAML (3 passes fixos em live/index.js:458 e compile-world.js:191, L1-06). O off usa HEADER 16 contra 22 no renderer. |
| 6 | Portar tag forces, constraints, pesos e update/frozen para o v2 com composite | alto | M | O spike LA-1 não cobre isso, e ex:forces não é comparável. A interação com constraints que usam getParentRect com lag de 1 tick (compile-world.js:113-160) não foi medida. É pré-requisito para o flip e para remover o v1. |
| 7 | Separar warmKick de alphaKick no v1 e usar 0,05 no warm start | medio | P | Verifiquei que reduz o reaquecimento da mesma IR de 76 para 10,4 px (syn:100) e de 20,6 para 2,3 px (ex:containers), sem mudar contrato (L1-10). O alphaKick também é o kick de drag e release (live/index.js:221,255), por isso precisa de knob próprio. |
| 8 | ADR sobre a semântica dos pesos de nodeLayers no v2 | medio | P | O v2 usa massa global (1 - maxWeight de todas as layers, compile-world.js:92). O v1 divide por par, pelas layers compartilhadas (collision.js:63-68). O mesmo YAML cede de forma diferente: deslocamento de a de 120,9 px no v1 contra 36,9 px no v2 (L1-08). |
| 9 | Flip do default do live para v2 numa entrega própria, com v1 por flag um ciclo; depois Fase 4; depois remover v1 e o routing físico deprecated | alto | M | Acoplar o flip à Fase 4 impede atribuir uma regressão ao layout ou ao routing. O flip só entra com os 6 gates verdes. |
| 10 | Semente por stress no cold start do live/v2, com BFS ou pivot-MDS no lugar do APSP O(N³) | medio | P | É a principal fonte de ganho topológico medida no híbrido (427 contra 685 cruzamentos em syn:100). Com APSP custa 626 ms em 300 nós. O aspecto em cadeias (ex:intro 6,3–9,6) precisa de gate. |
| 11 | Spike comparando mola içada e mola folha com região forte, em syn:300, allcollide e desalinhado | medio | P | O resultado deu empate técnico em syn:100. A folha tem 7–15% menos cruzamentos, e a içada 11–32% menos área e 2,1× menos área em syn:300. Isso decide o desenho da força de aresta que vai para a Fase 4. |
| 12 | Spike da âncora de warm start com re-ancoragem no release do drag, ação 'relaxar' e resposta topológica medida | medio | M | Tem o melhor Δwarm medido (0,3 px), mas congela a topologia (razão 1,00) e não foi testada com drag dentro da sessão. |
| 13 | custom (default do app): iterar o pós-passo até convergir e semear por hash do id | medio | P | Deixa 46 e 206 violações em syn:100 e syn:300, com 4 passes fixos (collision-postpass.js:18). A semente por índice desloca 130–380 px com +1 nó (L1-11). É a primeira impressão de qualquer usuário (store.js:32). |
| 14 | Atualizar F-0002 e README com o v2, a flag engine e a mola; expor a flag no formulário de config | baixo | P | O manifest não menciona o v2, que hoje viola os critérios A3 e A4 da F-0002. config-schema.js não tem 'engine' (L1-13). |
| 15 | Quick-win de desempenho no v1 (pré-computar leafIndicesUnder e pares colidíveis) só se o flip atrasar | baixo | P | O v1 leva 12,5 ms/tick com 100 nós e 123 com 300 (L1-04). O ganho estimado de 25–30% não foi medido, e o v1 será removido. |

### ADRs candidatas desta trilha

- **Colisão composta: container é corpo composto, com gating por cobertura das unidades do LCA** (confiança media). Um par container×peer ou folha×folha só colide diretamente se não for 'coberto' pelo par de unidades-filhas do LCA que compartilham layer (defensor/diag/hyb-sib.mjs:125-133). A força do composite é distribuída aos descendentes. Os cenários allcollide e desalinhado viram gate do harness.
- **Flip do default de layout v1→v2 desacoplado da Fase 4, condicionado a gates do harness** (confiança alta). O v2 vira default do live numa entrega própria quando passar em 6 gates: 'end' finito; violações ≤ v1 e contenção 0 em 16 cenários; pico de reaquecimento ≤ v1; paridade (tag forces, constraints, update, velocityCap, pesos); <16 ms/tick com 300 nós; E2E com engine v2. O v1 fica por flag durante um ciclo. A Fase 4 vem depois, e a remoção do v1 por último.
- **Força de aresta subordinada à coesão do container (emenda ao ADR-0010)** (confiança media). Qualquer força de aresta no layout (Fase 3) ou de aresta-corpo (Fase 4, ADR-0012) deve ser dominada pela coesão do container. Isso pode vir pelo içamento ao LCA, por um atrator-região mais forte ou por uma restrição de contenção, escolhidos por medição.
- **Semântica dos pesos de nodeLayers no motor v2** (confiança media). Escolher explicitamente entre split por contato (massa efetiva por par no contributor de colisão, que preserva a DSL documentada) e massa global (exige atualizar a doc e os exemplos).
- **Warm start ancorado para preservar o mapa mental** (confiança baixa). Adotar a âncora atrás de flag, com re-ancoragem no release e uma ação 'relaxar', somente se o spike adicional mostrar resposta topológica (razão <1) e drag correto.

### Sugestões de evolução do processo desta trilha

- `LAY-B1` (new-adr) → .feat-memory/decisions/ (novo ADR; relacionado a ADR-0010/0011, F-0005): Gating da colisão composta por cobertura do LCA; semântica nova do contrato de layers, verificada em 5 cenários allcollide e 2 desalinhados.
- `LAY-B2` (new-adr) → .feat-memory/decisions/ (novo ADR; F-0002): Flip do default v1→v2 desacoplado da Fase 4, com 6 gates mensuráveis.
- `LAY-B3` (new-adr) → .feat-memory/decisions/ (novo ADR; F-0005): Semântica dos pesos de nodeLayers no v2 (L1-08).
- `LAY-B4` (heuristic-fix) → tests/layout/compile-world.test.js:9-13,86-96: Os testes do v2 usam o critério alpha>=0.005, que mascara a ausência de 'end' (L1-01). Falta uma cena móvel que exija 'end' finito.
- `LAY-B5` (doc-gap) → .feat-memory/manifest/features/F-0002-*.md; src/controls/config-schema.js; README.md: A F-0002 não menciona o v2, a flag engine nem a mola; o v2 viola A3 e A4. A flag não aparece no formulário de config.
- `LAY-B6` (new-rule) → AGENTS.md (gate) ou tests/layout/characterization: Mudar o default de layout exige o harness de caracterização verde, incluindo os cenários allcollide, desalinhado e pins.

### Fontes

- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/verify.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/v1-allcollide.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/verify-cov.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/cov-allcollide.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/v2-spring.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/verify-kick.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/juiz/v3-kick.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/cache-parcial.json
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/spikes/results/compare.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/spikes/results/custom-stressseed.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/spikes/hybrid/hybrid-variants.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/robust2-ref.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/robust3-fixes.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/robust4-misaligned.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/diag/hyb-sib.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/diag/leafspring-region.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/diag/leafspring-region-300.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/diag/circle-nospring.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor/diag/v1-lowkick.md
- /home/user/tensegrams/.feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md:26-28
- /home/user/tensegrams/.feat-memory/decisions/0011-force-zone-linear-zone-x-zone.md:34-35
- /home/user/tensegrams/.feat-memory/decisions/0013-plugin-architecture-layout-routing.md
- /home/user/tensegrams/src/physics/solver.js:42
- /home/user/tensegrams/src/layout/compile-world.js:191,240,244
- /home/user/tensegrams/src/layout/adapters/live/index.js:30,151,221,255,458
- /home/user/tensegrams/src/app/pipeline.js:134,155
- /home/user/tensegrams/src/app/gestures.js:211,273-275
- /home/user/tensegrams/src/store.js:30,32
- /home/user/tensegrams/src/layout/adapters/custom/index.js:1-7
- /home/user/tensegrams/src/layout/registry.js:9-10
- /home/user/tensegrams/src/layout/collision.js:63-68,97-104
- /home/user/tensegrams/src/physics/integrator.js:23

## Apêndice A · Propostas, réplicas e decisões

#### LA-1 · Híbrido nativo: completar o ADR-0010 no motor v2 (container composto + atrator-região + mola içada + 'end' cinético)

- **Substitui:** O `runSession` do v1 (default do `live`, ~1260 linhas de legado segundo o avaliador). Também a compilação atual do `compile-world.js`, onde containers com filhos não são corpos (`compile-world.js:71-74,191-212`) e a mola só liga folhas, pulando containers (`compile-world.js:135-145`).
- **Proposta:** Manter o motor unificado (`src/physics`: world Float32, grid espacial, colisão PI) e adicionar três contributors e um ciclo de vida corrigido:

1. **createCompositeCollision**: todo container com filhos vira um CORPO COMPOSTO. A AABB é derivada por tick, de baixo para cima por profundidade, com a mesma convenção do render (pad nos lados, pad+HEADER no topo). A força container×peer (outro container não aparentado ou corpo não descendente, com gate por layer compartilhada) usa perfil linear Kp·pen e é distribuída igualmente aos corpos descendentes, o que dá movimento rígido do grupo.
2. **createRegionAttractor**: atrator-região que puxa cada corpo ao centróide dos corpos do seu container. Escala com alpha.
3. **createLiftedSpring**: aresta entre folhas de containers diferentes vira mola entre as UNIDADES filhas do LCA (containers compostos ou corpos). Só atrai quando o gap entre os rects passa de `rest`. É o equivalente em física do 'içamento' de arestas que o ELK faz por nível.
4. **Término**: 'end' quando alpha < alphaMin e a velocidade máxima fica < 0,05 por 10 ticks. O solver roda com alphaMin=0, sem o clamp que causa o L1-01.

A semente para cold start é a da LA-3 e o warm start é o da LA-2. O drag continua pelo modo `frozen` existente (`compile-world.js:258-265`).
- **Evidência do desafiante:** **Contrato do app** (`S/results/compare.md`, `hybrid-lifted*.json`), violações de colisão:

| Cenário | Híbrido (`ext:hybrid-stress`) | v1 | v2 |
|---|---|---|---|
| ex:containers | 0 | 0 | 5 |
| syn:30 | 0 | 2 | 20 |
| syn:100 | 0 | 2 | 154 |
| syn:300 | 0 | 11 | 545 |

Contenção = 0 em todos os cenários, inclusive probe:deep6 e deep6-childfirst.

**Término.** 'end' em 263 (exemplos), 334 (syn:30), 468 (syn:100) e 613 (syn:300) ticks. O v2 nunca termina.

**Custo.**
- syn:100: 0,37 ms/tick, 171 ms até o 'end'. O v1 leva 12,5 ms/tick e 6037 ms.
- syn:300: 1724 ms até o 'end', contra 59370 ms do v1.
- Re-medido lado a lado com load 2,6 (`ref-v2-now.json` × `ref-hybrid-now.json`): 3,25 ms/tick contra 5,69 do v2. No v2 o grid degenera porque tudo empilha (densidade 3,18).

**Qualidade em syn:100** (bbox em px²):

| Métrica | Híbrido | v1 |
|---|---|---|
| bbox | 3,5 M | 5,3 M |
| aresta/diag | 3,64 | 4,55 |
| cruzamentos | 427 | 719 |

Em syn:300 os cruzamentos são 5034 contra 6766.

**Instabilidade da mola folha×folha com composite** (`S/results/hybrid-big-leafspring.json`):
- syn:100: bbox de 53,7 M e 69,4 M px², reaquecimento de 1136 e 1450 px;
- syn:300: bbox de 448 M e 531 M px².
Com a mola içada: 3,5 M e 16,3 M px².
- **Spike:** Prototipado em `S/hybrid/hybrid-variants.mjs`, que importa read-only `src/physics/{world,solver,collision}.js` e `contributors/{central,connectivity-spring}.js` do repo.

Mapa do arquivo:
- `stressSeed`: l.61–114;
- composite: l.121–181;
- região: l.184–219;
- mola içada: l.223–269;
- variante com término cinético e âncora: l.272–362.

Variantes: `ext:phys-composite` (semente em círculo), `ext:hybrid-stress`, `ext:hybrid-anchor`, `ext:hybrid-local`, `ext:hybrid-nospring` e `ext:hybrid-leafspring`.

Resultados:
- `S/results/hybrid-lifted.json` (exemplos, sondas, syn:30, syn:100);
- `hybrid-lifted-syn300.json`;
- `hybrid-anchor.json`;
- `hybrid-big-leafspring.json` (instabilidade).

Para reproduzir:
```
node <H>/run.mjs --external S/hybrid/hybrid-variants.mjs --only-external --scenarios ex:,probe:,syn:30,syn:100
```
Métricas principais: ver o campo evidência.
- **Encaixe nas restrições:** **ADRs**
- ADR-0010, encaixe 1:1: 'container é um corpo que repele peers E hospeda um atrator-região' (`0010-*.md:27`), e aresta como 'acoplamento estrutural declarado' (`:31`). A mola içada é exatamente isso.
- ADR-0011: perfil linear Kp·pen e gate zona×zona com 2·pad, os mesmos do `src/physics/collision.js`.
- ADR-0013: mesmo contrato de sessão (tick/end/update/stop). Nenhuma mudança no routing.
- ADR-0006: zero dependência nova, ESM puro.
- ADR-0012: não afetado. A mola içada é o análogo de layout do que a Fase 4 fará com arestas-corpo, e o achado da instabilidade deve orientar a Fase 4.

**Diagrama vivo**
- Animação contínua até 'end' e reinício por `kick` no drag.
- Atualização incremental por warm start (LA-2).
- **Ganho:** Fecha de uma vez os bloqueadores L1-01, L1-02 e L1-03 do avaliador, com número objetivo. Permite remover o v1 (~1260 linhas) sem regredir: contrato 0/0, 'end' finito, custo de 18 a 38× menor que o v1 por tick e topologia melhor. Transforma o 'container composto' do ADR-0010 de texto em código medido.
- **Custo:** M. São cerca de 210 linhas de contributors no protótipo, mais testes: casos do harness como caracterização e sonda deep6 nas duas ordens.

Faltam portar:
- pesos de massa por layer (decidir a semântica, L1-08);
- tag forces e constraints, que já existem no `compile-world` e só precisam conviver;
- broad-phase no composite (hoje O(C·(C+N)) por tick).
- **Risco:** - O composite distribui a força igualmente, não por massa, e isso precisa ser recalibrado com os pesos da DSL.
- Sem broad-phase, o composite pode pesar com mais de 1000 nós (não medido).
- A calibração (Kp 0,3, região 0,02, mola 0,05, rest 120, alphaDecay 0,02) foi escolhida à mão, uma vez.
- ex:forces não é comparável porque tag forces e constraints não foram portados no spike.
- O aspecto chega a 7,8–9,6 em cadeias (ex:intro) quando a semente é por stress.
- **Réplica do defensor (aceitar_com_condicoes):** MELHOR CASO CONTRA (steelman):
1) Isto não é uma alternativa ao status quo, é o plano que já existe. O ADR-0010 já decidiu que "um container é um corpo que repele peers E hospeda um atrator-região" (0010-*.md:26-29). O avaliador já tratou isso como item de paridade (L1-02, L1-14). O que o LA-1 traz de novo é a mola içada, um critério de 'end' próprio e a remoção do v1, e é isso que precisa de escrutínio.
2) Generalização. Os 9 cenários de calibração têm layers ALINHADAS à hierarquia: os irmãos compartilham `g_<pai>` (harness/lib/scenarios.mjs:58,64) e os exemplos do app seguem o mesmo padrão (src/dsl/examples.js:117-169). Fora desse regime, o spike ENTREGUE diverge. Em syn100-allcollide (todo nó também na layer global 'all'):
   - `ext:hybrid-stress` fica sem 'end' em 1500 ticks, com 30 violações, bbox de 125 M px² (aspecto 68,6) e reaquecimento de 11.646 px;
   - `ext:phys-composite` chega a 194 M px²;
   - `ext:hybrid-nospring` também diverge (179 M), então a causa é o composite, não a mola;
   - `ext:hybrid-anchor` idem (30 violações).
   No mesmo cenário o v1 emite 'end' em 482 ticks, com 2 violações e 23,5 M px².
   A correção óbvia (gating composite/folha só entre IRMÃOS) resolve o allcollide, mas QUEBRA o contrato com layers desalinhadas (containers sem layer, folhas com 'all'): 70 violações em syn30 e 577 em syn100, contra 0 do v1.
   Escrevi uma regra "par coberto pelas unidades-filhas do LCA" (~15 linhas) que passa nos três regimes com 0 violações. Mas é semântica NOVA do contrato de layers (F-0005, `collision.js:79-110`) e merece ADR e testes. Sem memoização, custou 2,5–3,5× o tempo.
3) A mola içada quase não entrega força topológica. Com semente stress, os cruzamentos com e sem mola são 23 vs 23 (syn:30), 427 vs 403 (syn:100) e 5034 vs 4748 (syn:300). A vantagem topológica sobre o v1 vem da SEMENTE estática (LA-3), não de força de aresta.
   Com semente em círculo, a içada corta ~20% (862→685 em syn:100; 72→44 em syn:30). Ainda assim fica ≈ v1 (719) e ≈ v2 sem mola (688).
   Resumo: o híbrido resolve containers abrindo mão da força de aresta que a Fase 3 mostrou (688→303). Para a identidade do ADR-0012 isso é um recuo, não um avanço.
4) A "incompatibilidade estrutural" mola folha×folha × composite é em boa parte CALIBRAÇÃO: região 0,02 contra mola 0,05. Com região 0,3 e a mola folha do repo:
   - syn:100: bbox 4,38 M (contra 53,7 M), 356 cruzamentos (MELHOR que os 427 da içada), 0 violações, 'end' em 471;
   - syn:300: 37,7 M (contra 448 M), mas ainda 2,3× a içada (16,3 M).
   A lição robusta é "a coesão deve dominar a força de aresta". "Içar ao LCA" é só uma das soluções, e não a de melhor topologia.
5) Paridade não coberta. O spike não é adapter de sessão: não tem `update` (drag/release via `session.update`, `src/app/gestures.js:211-275`), labelBBoxes, waypoints, tag forces, constraints nem pesos. As "~210 linhas" não incluem a integração no `compile-world.js` (318 linhas), onde tag-forces e constraints com `getParentRect` de lag de 1 tick (`compile-world.js:113-160`) teriam de conviver com o composite. Essa interação não foi medida.
6) A calibração foi feita à mão, uma vez, e avaliada nos mesmos 9 cenários (risco de overfit). O allcollide mostra esse risco na prática.

CONCESSÃO (a evidência dele é superior no núcleo):
- Fora da amostra, em 6 de 7 cenários novos (seeds 7/42, depth5, dense2.5, cont30%, syn200), o híbrido tem 0 violações e 0 de contenção, contra 1–9 violações do v1 (mais contenção de 54,6 px em depth5).
- Tem menos cruzamentos: 334–2941 contra 817–3706.
- Custa ~30× menos: 176–359 ms contra 5,4–6,3 s até o 'end' em 100 nós.
- Com pins satisfazíveis, também dá 0 violações (o v1 dá 6 e 2).
- Com layers desalinhadas, o spike original dá 0 violações e 314 cruzamentos, contra 1455 do v1.
O núcleo (composite + atrator-região + 'end' cinético) supera o status quo e deve ser adotado.

CONDIÇÕES:
(a) Um ADR curto com a regra de gating composite×layers, e os cenários allcollide/misaligned como gate do harness.
(b) Decidir entre mola folha com região forte e mola içada por medição, antes de fixar o desenho (e antes de levar a "lição" para a Fase 4).
(c) Portar tag forces, constraints, pesos (L1-08) e `update`/frozen, e só então remover o v1.
(d) Não acoplar à Fase 4 (sequência do L1-14).
(e) Memoizar LCA e cobertura por par. Evidência: Pasta D=/tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor.

Fora da amostra:
- `D/robust.mjs` → `D/robust-rerun.md` (re-rodado, idêntico a `robust-hybrid.md`: determinístico);
- `D/robust2.mjs` → `D/robust2-ref.md` (v1 e v2 nos mesmos 7 cenários; v1 allcollide 20.933 ms, 2 violações, 23,52 M; v2 972 violações);
- `D/robust2-allc-hyb.md` (anchor/nospring/composite no allcollide).

Correções de gating:
- `D/diag/hyb-sib.mjs` + `D/robust3.mjs` → `D/robust3-fixes.md`;
- `D/robust4.mjs` → `D/robust4-misaligned.md` (sib: 70/577 violações; cov: 0).

Pins: `D/robust5.mjs` → `D/robust5-pins.md`.

Mola:
- içada × sem mola: `spikes/results/hybrid-lifted.json`, `hybrid-lifted-syn300.json`, `hybrid-big-leafspring.json`, `hybrid-small-leafspring.json`;
- círculo: `D/diag/circle-nospring.json`;
- calibração região×mola: `D/diag/leafspring-region.json` e `D/diag/leafspring-region-300.json`.

Código:
- `spikes/hybrid/hybrid-variants.mjs:151` (força distribuída 1/N), `:204` e `:263` (região e mola escalam por alpha), `:323-324` (âncoras fixadas no início da sessão);
- `src/physics/contributors/connectivity-spring.js:27` (mola × alpha).
- **Decisão do juiz: adotar.** Adotar o núcleo: container como corpo composto, atrator-região e 'end' cinético. É a implementação do ADR-0010 (0010-*.md:26-28). Nos 9 cenários do harness e em 6 de 7 fora da amostra, dá 0 violações e 0 de contenção. Em syn:100 leva 171 ms, contra 6.037 do v1. Há uma condição obrigatória, que verifiquei por conta própria: o gating do spike entregue (hybrid-variants.mjs:169) diverge em 5 de 5 cenários allcollide. Nesses casos não há 'end' em 1500 ticks, há 2–68 violações e o bbox chega a 9.001 M px² (juiz/v1-allcollide.md). A regra de cobertura do defensor (defensor/diag/hyb-sib.mjs:125-133) dá 0 violações e 'end' em 386–510 ticks nas 4 sementes novas (juiz/cov-allcollide.md). Ela precisa de ADR e de testes. A forma da mola (içada ou folha com região forte) fica para spike, porque deu empate técnico (juiz/v2-spring.md). Antes de remover o v1 é preciso portar tag forces, constraints, pesos e update/frozen.

#### LA-2 · Warm start ancorado (mapa mental) + temperatura por corpo para reaquecimento local

- **Substitui:** Hoje há dois comportamentos ruins no warm start:
- **v1**: reaquece com `alphaKick` 0,5 e o atrator central recomprime tudo (L1-10: 20,6 a 111 px de drift sem mudança geométrica).
- **v2**: ignora `seedPositions` e re-explode (150–250 px).
- **Proposta:** Na continuação de uma sessão (pipeline com `seedPositions`):
- todo corpo que já existia recebe um atrator-PONTO na sua posição anterior (mola fraca, k=0,02, não escalada por alpha);
- o atrator central é desligado;
- nós novos nascem no centróide dos vizinhos, ou dos irmãos se não houver vizinho posicionado;
- o alpha de reaquecimento é baixo (0,08).

Passo 2, de pesquisa: temperatura POR CORPO. Os nós 'sujos' (novos, endpoints de aresta adicionada ou removida, vizinhos de nó removido) ficam sem âncora e com alpha alto; os demais ficam ancorados. Isso exige que `createSolver` e os contributors aceitem alpha por slot, porque hoje ele é escalar e global (`src/physics/solver.js:42`).
- **Evidência do desafiante:** **Reaquecimento da mesma IR**, final/pico em px (`S/results/hybrid-anchor.json` × `hybrid-lifted*.json` × baseline):

| Cenário | Ancorado | Sem âncora | v1 | v2 |
|---|---|---|---|---|
| ex:containers | 0/0,6 | 3,4/3,4 | 20,6/20,6 | 0/202 |
| syn:30 | 0/5 | 6,2/10,4 | 22,2/22,2 | – |
| syn:100 | 0,1/25 | 8,9/59,9 | 76/76 | 0/149 |
| syn:300 | 0/73,4 | 55,5/200,9 | 111,5/111,5 | 0/155 |

**Δwarm médio de 4 perturbações**, final/pico em px: 6,6/15,4 (ex:containers), 1,3/7,1 (syn:30), 0,3/26,2 (syn:100), 0,4/73,8 (syn:300). O v1 dá 49,9, 28,8 e 90,6 nos três primeiros.

**Qualidade após perturbar** (`S/pertcheck.mjs`): 0 violações e 0 de contenção em todas as perturbações warm. No v1 ficam 3 violações em syn:30.

**Custo topológico**: a aresta nova não encurta (razão 1,00). O v1 dá 0,96–0,97 e o cola 0,61 em ex:containers e 0,99 em syn:30.

**Tentativa de reaquecimento local com alpha global** (`ext:hybrid-local`) falhou: syn:100 −aresta = 81,9 px e +aresta = razão 0,94.
- **Spike:** Prototipado em `S/hybrid/hybrid-variants.mjs`:
- âncora e desligamento do central: bloco 'Warm start com ÂNCORA';
- conjunto 'sujo': compara `prev._edges` com as arestas atuais;
- variantes `ext:hybrid-anchor` (âncora 0,02) e `ext:hybrid-local` (âncora 0,05 + alpha 0,5 quando há sujos).

Para medir a resposta topológica e a qualidade após perturbação, escrevi `S/pertcheck.mjs`:
```
node S/pertcheck.mjs ex:containers,syn:30,syn:100 S/hybrid/hybrid-variants.mjs ext:hybrid-anchor,ext:hybrid-stress
```
- **Encaixe nas restrições:** - ADR-0010: a âncora é um 'atrator ponto' e só atrai; a repulsão continua sendo só entre corpos.
- Vale para o v1 e o v2 sem mudar contrato (ADR-0013). O pipeline já passa `seedPositions` e `seedAlpha` (`src/app/pipeline.js:121-151`).
- Identidade 'viva': o diagrama continua animando nas edições, mas sem a explosão. É o critério de UX que o avaliador apontou como central.
- ESM, zero dependência.
- **Ganho:** Leva a continuidade entre edições para ≤1 px no caso sem mudança, contra 20–111 px do v1 e 150–250 px do v2. É a métrica que mais diferencia um 'diagrama vivo' de um re-layout.
- **Custo:** - Âncora: P, cerca de 15 linhas.
- Temperatura por corpo: M, porque mexe no solver e nos contributors (alpha passa a ser escalar ou Float32Array por slot).
- **Risco:** - A âncora pura congela a topologia: uma aresta nova não aproxima os endpoints, então o layout 'envelhece' ao longo da sessão.
- Mitigações: um botão/atalho 'relaxar' (cold start com semente = layout atual, sem âncora) ou a temperatura por corpo, cuja eficácia NÃO foi demonstrada neste spike.
- O pico de 73 px em syn:300 mostra que a âncora ainda cede sob colisão quando nasce um nó.
- **Réplica do defensor (aceitar_com_condicoes):** MELHOR CASO CONTRA:
1) Existe um conserto muito mais barato no status quo. O `alphaKick` do v1 (DEFAULTS `live/index.js:30`, usado no warm start `:151`) a 0,05 derruba:
   - o reaquecimento da mesma IR: 76→10,4 px (syn:100), 20,6→2,3 (ex:containers), 22,2→3,2 (syn:30), 15,1→1,7 (deep6);
   - o Δwarm: 90,6→44,2 (syn:100), 49,9→21,9 (ex:containers), 28,8→13,4 (syn:30);
   - sem mudar contrato nem desligar o atrator central.
   No pico de reaquecimento da mesma IR em syn:100, o knob (10,4) é MELHOR que a âncora (25).
   Ressalva honesta: `alphaKick` também é o kick de drag e release (`:221`, `:255`). Aplicá-lo só ao warm start exige separar um `warmKick`, o que é 1 linha, mas não é zero-código.
2) A âncora congela a física. A resposta topológica a uma aresta nova é nula (razão 1,00, admitido pelo desafiante), e o layout "envelhece" na sessão. Para um projeto cujo valor central é o diagrama VIVO movido por física (dossiê, ambição do mantenedor), trocar física por histerese é uma escolha de identidade, não só de UX.
3) Drag. A âncora do spike é fixada no início da sessão (`hybrid-variants.mjs:323-324`, k não escalado por alpha). No app, drag e release acontecem DENTRO da mesma sessão via `session.update` (`src/app/gestures.js:211-275`), então um nó solto voltaria elasticamente à posição pré-drag. Isso é inferência de código: o spike não implementa `update`, então não foi medido.
4) Histerese sem persistência. Só a DSL e a config são persistidas (`src/store.js:29-44`); as posições não. Com âncora, o diagrama visto após N edições diverge do que um reload ou o import por outra pessoa produz (Δcold após 1 edição: 183 px em syn:100, contra 0,3 no warm). O v1 também tem essa dependência de caminho, mas a âncora a torna sistemática ao nunca relaxar.
5) A metade "temperatura por corpo" não tem evidência. A tentativa do próprio desafiante falhou (81,9 px em syn:100 −aresta) e ela exige mudar solver e contributors (alpha escalar, `src/physics/solver.js:36,45`).

CONCESSÃO: no mapa mental a âncora é claramente superior. O Δwarm final fica em 0,3 contra 44,2 do knob e 90,6 do v1 (syn:100), e em 6,6 contra 21,9 e 49,9 (ex:containers), com 0 violações após as perturbações. É o jeito mais direto de cumprir o critério de continuidade que o avaliador chamou de central.

CONDIÇÕES:
(a) Aplicar já o `warmKick` baixo no v1 (P, risco mínimo).
(b) A âncora entra atrás de flag, com re-ancoragem no release do drag e uma ação "relaxar" (cold start semeado com o layout atual).
(c) Rejeitar a temperatura por corpo até haver spike que a demonstre. Evidência: `D/diag/v1-lowkick.mjs` → `D/diag/v1-lowkick.json` (D = .../scratchpad/eco/layout/defensor): variantes `live-v1-kick0.05` e `-kick0.1` pelo harness, com reheatDrift/pertWarm por cenário. Baseline v1 em `harness/results/main.json`; âncora em `spikes/results/hybrid-anchor.json` (pertWarm syn:100 0,3/26,2; pertCold 183,3).

Código:
- `src/layout/adapters/live/index.js:30,151,221,255`;
- `src/app/gestures.js:211,273-275`;
- `src/store.js:29-44`;
- `src/app/pipeline.js:134,155` (nova sessão a cada edição).
- **Decisão do juiz: spike_adicional.** A âncora tem o melhor Δwarm medido: 0,3 px em syn:100, contra 90,6 do v1 e 44,2 do v1 com kick 0,05. Porém congela a resposta topológica (razão 1,00 para aresta nova). O spike não implementa update, e o drag no app acontece dentro da mesma sessão (src/app/gestures.js:211,273-275). Com as âncoras fixadas no início da sessão (hybrid-variants.mjs:323-324), um nó solto voltaria à posição anterior; isso é inferência, não medição. O reaquecimento local com alpha global falhou (81,9 px) e a temperatura por corpo não tem spike. O spike seguinte deve medir: re-ancoragem no release, uma ação 'relaxar' e uma razão de comprimento menor que 1 para aresta nova. Enquanto isso, o warmKick 0,05 no v1 resolve a maior parte do drift (verifiquei 76→10,4 px em syn:100).

#### LA-3 · Semente determinística por stress majorization (zero-dep) para cold start: live e adapters estáticos

- **Substitui:** - Semente em círculo por índice: `live/index.js:118-121` e `compile-world.js:85-91`.
- `centerSeed` por índice (`src/layout/adapter.js`) no `custom` (default do app, `src/store.js:32`) e no `off`.
- **Proposta:** SMACOF localizado (Gauss-Seidel, w=d⁻²) sobre corpos mais um nó virtual por container com filhos:
- arestas reais com comprimento 170 + ¼ da soma das diagonais;
- arestas hierárquicas filho↔virtual do pai com 40 + ½ diagonal;
- distâncias por caminho mínimo;
- componentes desconexos com d = 1,1·max + 170 e peso 0,1.

A inicialização usa hash do id em vez do índice. No live, a semente só é usada no cold start: a física relaxa depois e o warm start (LA-2) nunca re-semeia. No `custom`/`off`, entra no lugar do `centerSeed` antes do mesmo pós-passo de colisão do repo.
- **Evidência do desafiante:** **Adapter custom** com o pós-passo do repo (`S/results/custom-stressseed.json` × baseline):

| Métrica | Semente stress | custom atual | v1 |
|---|---|---|---|
| cruzamentos syn:100 | 276 | 569 | 719 |
| cruzamentos syn:300 | 4835 | 6670 | 6766 |
| violações syn:100 | 21 | 46 | – |
| violações syn:300 | 108 | 206 | – |
| aresta/diag syn:100 | 3,43 | 3,89 | – |

As violações caem, mas o pós-passo de 4 passes continua insuficiente (L1-11).

**Dentro do híbrido**, semente stress contra círculo (`hybrid-lifted*.json`):

| Cenário | Cruzamentos (stress / círculo) | aresta/diag (stress / círculo) |
|---|---|---|
| syn:30 | 23 / 44 | 2,18 / 3,29 |
| syn:100 | 427 / 685 | 3,64 / 4,35 |
| syn:300 | 5034 / 7268 | – |

**Estabilidade não melhora**: Δcold de 269 px contra 140,5 do custom em syn:100. O stress é global, então +1 nó re-otimiza tudo.

**Custo**: 56 ms (syn:100) e 626 ms (syn:300), com APSP ingênuo O(N³) e 120 iterações.
- **Spike:** Prototipado:
- `stressSeed` em `S/hybrid/hybrid-variants.mjs:61-114`;
- adapter estático de teste em `S/hybrid/custom-seed.mjs`, que importa `applyCollisionPostPass` e `buildCollisionResolver` do repo e deriva containers por profundidade, o que também corrige a suposição de ordem de L1-06.

Para reproduzir:
```
node <H>/run.mjs --external S/hybrid/custom-seed.mjs --only-external --scenarios ex:,probe:,syn:30,syn:100,syn:300 --no-determinism-big
```
Resultado em `S/results/custom-stressseed.{json,md}`.
- **Encaixe nas restrições:** - Zero dependência, ESM (ADR-0006).
- Não é força: a semente só define posições iniciais. Não conflita com o ADR-0010 (nenhum campo de atração novo) nem com o ADR-0012 (arestas).
- ADR-0013: é detalhe interno do adapter.
- Vivo: melhora a primeira impressão, que é onde o `custom` hoje mostra sobreposições (L1-11), sem afetar a continuidade.
- **Ganho:** A topologia passa a importar desde o primeiro frame: metade dos cruzamentos do `custom` em syn:100. Hoje as arestas não exercem força nenhuma no v1 nem nos estáticos (L1-07), e a semente é o jeito mais barato de corrigir isso.
- **Custo:** P. Cerca de 55 linhas, mais a troca por BFS e pivot-MDS se N > 300.
- **Risco:** - Custo O(N²) de memória e O(N³) no APSP ingênuo: com 626 ms em 300 nós, precisa de BFS/pivot-MDS ou de um Worker antes de ir para produção.
- Aspecto alongado em cadeias (ex:intro chega a 6,3–9,6).
- NÃO resolve a estabilidade a edições dos estáticos. O hash do id só estabiliza a inicialização, não o ótimo global.
- **Réplica do defensor (aceitar_com_condicoes):** MELHOR CASO CONTRA (no `custom`/`off`):
1) O `custom` é o default do APP (`src/store.js:32`) e é recalculado a CADA edição: o pipeline para a sessão e chama `adapter.start` de novo (`src/app/pipeline.js:134,155`). A semente stress custa 56 ms (syn:100) e 626 ms (syn:300) por edição, contra 5 e 52 ms hoje. É 11–12× mais lento em toda tecla, na main thread, com APSP O(N³) e memória O(N²) (`hybrid-variants.mjs:80-92`).
2) A estabilidade a edições PIORA exatamente onde o `custom` já é fraco, porque ele não tem warm start e o stress é global:

| Cenário | Δ atual | Δ com stress |
|---|---|---|
| syn:100 | 140,5 px | 269 px |
| syn:300 | 226 px | 544,9 px |

   Nos pequenos melhora (ex:containers 32,1→21,1; syn:30 151,1→118,9).
3) Muda a semântica documentada do adapter: "sem collision layer compartilhada, os nós ficam empilhados: separação é explícita, nunca implícita" (`custom/index.js:1-7`; `README.md:191`). A semente stress introduz separação implícita por topologia. Pode ser desejável, mas é decisão de contrato, não detalhe interno.
   Também há tensão de espírito com o ADR-0010, que rejeitou objetivo todos-com-todos: o stress usa todos os pares, inclusive componentes desconexos com peso 0,1. Não é uma força do motor, porém.
4) Aspecto ruim em cadeias: ex:intro com aspecto 7,83 (`hybrid-anchor.md`), contra 1,36 do v1.
5) As violações caem (46→21; 206→108) mas continuam: o gargalo real do `custom` é o pós-passo de 4 passes (L1-11), não a semente.

CONCESSÃO:
- No cold start do live/híbrido, a semente é a ÚNICA fonte medida de ganho topológico: 427 contra 685 cruzamentos em syn:100, e 5034 contra 7268 em syn:300.
- É zero-dep e roda uma vez só.
- No `custom` também corta os cruzamentos pela metade (569→276).

CONDIÇÕES:
(a) Adotar só como semente de cold start do live.
(b) Antes de ir ao `custom`: trocar o APSP por BFS/pivot-MDS com custo O(N·k), usar as posições anteriores como init (warm) e medir Δ ≤ o atual.
(c) Decisão explícita sobre o contrato "separação só explícita" do `custom`. Evidência: Dados em `spikes/results/custom-stressseed.{json,md}` e `spikes/results/compare.md`:
- ms: custom 5/52 contra stressseed 56/626;
- Δwarm: 140,5/226 contra 269/544,9;
- violações: 46/206 contra 21/108.

Código:
- `spikes/hybrid/hybrid-variants.mjs:80-92` (Dijkstra O(N²) por fonte, N fontes);
- `src/store.js:32`;
- `src/app/pipeline.js:134,155`;
- `src/layout/adapters/custom/index.js:1-7,24-28`;
- `README.md:191`;
- `spikes/results/hybrid-anchor.md` (ex:intro aspecto 7,83).
- **Decisão do juiz: adotar.** Adotar SÓ como semente de cold start do live/v2. No híbrido, é a principal fonte de ganho topológico: 427 cruzamentos contra 685 com a semente em círculo em syn:100, e 5034 contra 7268 em syn:300. Não adotar no custom por ora. Custa 11–12× mais por edição (56/626 ms contra 5/52 ms), porque o pipeline recria a sessão a cada tecla (pipeline.js:134,155). Também piora o Δcold: 269 contra 140,5 px em syn:100, e 20,3→211,6 px em ex:quad, que é o DSL inicial do app (store.js:30). Além disso, muda o contrato 'separação só explícita' (custom/index.js:1-7). Antes de produção, trocar o APSP O(N³) por BFS ou pivot-MDS.

#### LA-4 · WebCoLa como oráculo de qualidade no harness (e fonte de ideias: projeção VPSC, restrições de alinhamento), não como runtime

- **Substitui:** Nada em runtime. Complementa o harness como referência de qualidade topológica, e opcionalmente vira um adapter experimental 'constraints' limitado a diagramas pequenos.
- **Proposta:** O cola faz stress majorization com projeção de restrições de separação (VPSC) e grupos hierárquicos com padding. No mapeamento:
- folhas viram nodes com margem de 12 px;
- containers viram groups com padding pad+HEADER−margem;
- arestas folha×folha viram links.

O warm start usa as posições anteriores com 0 iterações irrestritas. O spike dirige tick a tick (`kick` desligado) e emite 'end' pela convergência do stress.

Propostas:
- (a) usar o cola como ORÁCULO: uma coluna 'gap para o cola' em cruzamentos e reaquecimento, para calibrar o motor nativo;
- (b) importar a ideia de PROJEÇÃO de separação, que o ADR-0011 já cita como antídoto fora do default (`0011-*.md:35`), como constraint opcional em `src/physics/constraints` para garantir não-sobreposição dura;
- (c) importar as restrições de alinhamento como 'atrator-path' do ADR-0010.
- **Evidência do desafiante:** Fonte: `S/results/cola-small.json`, `cola-syn100.json`, `cola-syn300.json`.

**Contrato**: 0 violações e 0 de contenção em todos os cenários, com uma exceção residual em syn:100 que não investiguei.

**Cruzamentos**, os melhores medidos:

| Cenário | cola | v2+spring | v1 |
|---|---|---|---|
| syn:30 | 21 | 21 | 58 |
| syn:100 | 247 | 303 (degenerado) | 719 |
| syn:300 | 2186 | 2724 | 6766 |

**Reaquecimento da mesma IR**: 0,4 a 13,5 px (syn:100 2,2; syn:300 2,6/3,3). **Δwarm**: 26,9 px em syn:100 (v1 90,6) e 30,2 em syn:30.

**Custo**:
- 1,8 ms/tick em syn:30;
- 8,8 ms/tick em syn:100 (851 ticks, 8,3 s);
- 56,9 ms/tick em syn:300, sem 'end' em 1500 ticks (90 s).

**Resposta a aresta nova**: razão 0,61 em ex:containers e 0,99 em syn:30.

**Tamanho e formato**: `WebCola/cola.min.js` tem 79.814 B (22.667 B gz), é UMD e `dist/index.js` é CommonJS.

**Variante jaccard**: degenera com aspecto 18,2 em syn:100.
- **Spike:** Prototipado em `S/cola/cola-variants.mjs` (webcola 3.4.0 em `S/cola/node_modules`), com as variantes `ext:cola` e `ext:cola-jaccard`, ambas animadas com `onTick` para medir o pico.

Para reproduzir:
```
node <H>/run.mjs --external S/cola/cola-variants.mjs --only-external --scenarios ex:,probe:,syn:30
```
syn:300 rodou só a base e o reaquecimento (`--reheat-only --no-determinism`).
- **Encaixe nas restrições:** **Como runtime o encaixe é fraco:**
- ADR-0006: não tem ESM; só entra por `<script>` clássico (global `cola`), não por importmap.
- O `avoidOverlaps` é global e ignora `nodeLayers`, contrariando a semântica de colisão por layer (F-0005). Em ex:forces zera sobreposições que o DSL permite.
- Arestas que tocam container não são suportadas.
- A ideia de atração do cola (stress entre todos os pares) é atração corpo-corpo global, rejeitada pelo ADR-0010.

**Como oráculo ou fonte de ideias, encaixa bem**: a projeção entra como constraint (ADR-0011) e o alinhamento como atrator-path (ADR-0010).

**Vivo**: anima e aceita drag (`Layout.dragStart/drag/dragEnd`), mas custa O(N²) por tick.
- **Ganho:** Dá um alvo mensurável de qualidade: o motor nativo em syn:100 está com 427 cruzamentos, contra 247 do cola. A projeção abre o caminho para garantir não-sobreposição dura sem passe manual.
- **Custo:** - Oráculo no harness: P (o spike já é o plugin).
- Constraint de projeção no motor: M.
- Adapter experimental: P a M, mais a decisão sobre o ADR-0006.
- **Risco:** - Adotar como runtime traria O(N²) por tick, inviável acima de ~100 nós a 60 fps, e desviaria a semântica de layers.
- Como oráculo, o risco é baixo.
- A calibração do spike (linkDistance 150, iterações 30/60) não foi otimizada.
- **Réplica do defensor (aceitar_com_condicoes):** Há pouco a objetar ao uso como ORÁCULO fora do runtime: o spike já é o plugin e o custo é P. Mesmo assim, três riscos:
1) Goodhart. O cola otimiza stress entre TODOS os pares, que é atração/repulsão corpo-corpo global, rejeitada pelo ADR-0010 (0010-*.md:35). Perseguir o "gap para o cola" empurra o motor nativo de volta ao modelo que o projeto rejeitou.
2) O contrato não é o mesmo. O `avoidOverlaps` do cola é global e ignora `nodeLayers` (o desafiante admite: zera sobreposições que a DSL permite em ex:forces), e não suporta aresta tocando container. Os números de cruzamento dele (247 em syn:100) saem de outro problema, mais restrito, e não servem de alvo 1:1.
3) Formato: `webcola` 3.4.0 só tem CommonJS (`package.json` com main `dist/index.js`, sem `module`; `dist/index.js` começa com `require`). Como devDependency de teste em Node isso é aceitável; no navegador, não (ADR-0006).

Sobre (b), a projeção de separação: o ADR-0011 diz explicitamente que "antídotos conhecidos (termo integral, projeção) ficam fora do default" (0011-*.md:71-72). Portanto, só opt-in.
Sobre (c), alinhamento como atrator-path: não há evidência medida no spike.

CONCESSÃO: como referência de qualidade é útil e barato. O reaquecimento de 2–13 px e os cruzamentos baixos dão um teto empírico que o harness hoje não tem.

CONDIÇÕES: ficar só no harness (nunca em runtime); rotular a coluna como "referência sob contrato mais forte" e não como meta; projeção só como constraint opt-in. Evidência: - `spikes/results/cola-small.json`, `cola-syn100.json`, `cola-syn300.json`, `compare.md` (cola syn:100: 8.343 ms, 247 cruzamentos; syn:300: 90.202 ms sem 'end').
- Verificado: `spikes/cola/node_modules/webcola/package.json` (v3.4.0, main `dist/index.js`, module/exports indefinidos) e o cabeçalho CJS de `dist/index.js`. `WebCola/cola.min.js` tem 79.814 B (22.761 B gz, medido com `gzip -c | wc -c`).
- `.feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md:35`.
- `.feat-memory/decisions/0011-force-zone-linear-zone-x-zone.md:71-72`.
- **Decisão do juiz: adotar.** Adotar só como oráculo no harness de avaliação, nunca em runtime. Tem os melhores cruzamentos medidos (247 em syn:100, 2186 em syn:300) e reaquecimento de 2–13 px. Mas o avoidOverlaps é global, ignora nodeLayers e não aceita aresta tocando container, então a coluna deve ser rotulada 'referência sob contrato mais forte', não meta. O pacote é só CJS/UMD (webcola 3.4.0), aceitável como devDependency de teste e não no navegador (ADR-0006). A projeção só entra como constraint opt-in (ADR-0011:34-35). O alinhamento como atrator-path não tem evidência.

#### LA-5 · ELK layered (ou dagre, mais leve) como adapter ESTÁTICO opcional 'Arrumar/Hierárquico', lazy e fora do caminho do live

- **Substitui:** Ocupa o slot LAZY já previsto em `src/layout/registry.js:10` ('dagre / elk land here in future phases') e mencionado em `src/layout/adapter.js:4`. Não substitui o live.
- **Proposta:** **ELK layered** com `hierarchyHandling: INCLUDE_CHILDREN`: containers como nós compostos, padding top=pad+HEADER e spacing de 36 px. O ELK devolve os rects dos containers.

**ELK stress** por nível (SEPARATE_CHILDREN) com arestas 'içadas' ao LCA, seguido de sporeOverlap.

**dagre** com `compound: true` e clusters, sem arestas para cluster.

Uso sugerido: uma ação 'arrumar' que roda o layout estático uma vez e, opcionalmente, entrega o resultado como SEMENTE para o motor físico. Assim o diagrama volta a ser vivo a partir de um arranjo em camadas. O ELK roda num Web Worker (`elk-worker.min.js`) para não travar a UI.
- **Evidência do desafiante:** **Contrato**: ELK layered, ELK stress e dagre dão 0 violações e 0 de contenção em todos os cenários (`S/results/elk-main.json`, `dagre-main.json`).

**Densidade e forma** (bbox em px²):

| Variante | Cenário | bbox | aresta/diag | aspecto | cruzamentos |
|---|---|---|---|---|---|
| v1 (ref.) | syn:100 | 5,3 M | 4,55 | – | – |
| ELK layered | syn:100 | 20,4 M | 10,08 | – | 603 |
| ELK stress | syn:100 | 12,6 M | 7,04 | – | 629 |
| dagre | syn:100 | 8,9 M | 13,85 | 10 | 820 |

Os cruzamentos foram medidos com o router straight.

**Mapa mental**: não é preservado. Os modos interactive também falham.
- ELK layered-i, reaquecendo a mesma IR: 147 px (ex:containers), 506 px (syn:30), 1249 px (syn:100).
- Δwarm do ELK layered: 161,5, 306,5 e 1258 px.
- ELK stress-i: Δwarm de 123, 225 e 957 px.
- dagre não aceita posições iniciais: Δ de 1041 px em syn:100.

**Tempo**: ELK de 27 a 316 ms por layout (syn:100); dagre 352 ms em syn:100.

**Tamanhos**:
- `elk.bundled.js`: 1.609.707 B (466.978 B gz), UMD/GWT;
- `dagre.esm.js`: 48.559 B (16.897 B gz), ESM autocontido;
- referência: `yaml/browser` tem 280.297 B (58.845 B gz) e todo o `src/` tem 454.303 B.

**Gotcha**: o modo interactive do layered exige a mesma estratégia em todo nó composto; sem isso, dá `UnsupportedGraphException` (LAYER_SWEEP).
- **Spike:** Prototipado:
- `S/elk/elk-variants.mjs`: elkjs 0.12.0, variantes `ext:elk-layered`, `-layered-i`, `-stress` e `-stress-i`;
- `S/dagre/dagre-variants.mjs`: @dagrejs/dagre 3.1.1.

Para reproduzir:
```
node <H>/run.mjs --external S/elk/elk-variants.mjs --only-external --scenarios ex:,probe:,syn:30,syn:100
```
Resultados em `S/results/elk-main.{json,md}` e `dagre-main.{json,md}`.
- **Encaixe nas restrições:** - ADR-0013: encaixe perfeito, é um plugin de layout estático.
- ADR-0006: o ELK só entra por `<script>` ou Worker, não por importmap, e custa ~8× o `yaml`. O dagre entra por importmap com uma entrada.
- Identidade: NÃO é vivo e não preserva o mapa mental. Por isso deve ser uma ação pontual ou uma semente, nunca o default.
- ADR-0012: é preciso ignorar o routing ortogonal do ELK para manter as arestas por força.
- ADR-0003: layered impõe direção às arestas, que são não-direcionadas no Tensegrams. O layering vira escolha arbitrária do algoritmo.
- **Ganho:** Dá um preset 'arrumado', com garantia de contrato, para quem quer um diagrama estático limpo. Pode ser uma boa SEMENTE alternativa para o motor físico.
- **Custo:** - dagre: P.
- ELK: M, por causa do carregamento UMD/Worker, da conversão hierárquica e do gotcha das opções interactive.
- **Risco:** - O ELK pesa 467 KB gz, contra o espírito de runtime mínimo.
- Os layouts ficam esparsos em 100 nós.
- Cada re-layout embaralha o diagrama (1000+ px de Δ em syn:100).
- A direção imposta conflita com o ADR-0003.
- Os cruzamentos não foram medidos com o routing próprio do ELK.
- **Réplica do defensor (rejeitar):** 1) Pelas métricas do próprio harness, o preset "arrumado" não arruma:

| syn:100 | Cruzamentos | Aspecto | Aresta/diag | bbox |
|---|---|---|---|---|
| v1 | 719 | 1,0 | 4,55 | 5,3 M px² |
| dagre | 820 | 10,0 | 13,85 | – |
| ELK layered | 603 | – | 10,08 | 20,4 M px² |

   O dagre fica PIOR que o v1. O ELK layered tem 3,8× o bbox do v1 e mais que o dobro de aresta/diag.
2) O mapa mental é destruído: Δwarm de 1.041 px (dagre) e 1.258 px (ELK layered) em syn:100. Os modos interactive do ELK ficam em 147–1249 px.
3) ADR-0003: o layered impõe direção a arestas que o modelo declara não-direcionadas. O layering vira artefato do algoritmo.
4) ADR-0006: o ELK tem 1.609.707 B (469.661 B gz), é UMD/GWT, ~8× o `yaml`, e entra só por `<script>`/Worker.
5) Custo de oportunidade: a ambição declarada é pesquisa sobre diagramas vivos por física. Um preset estático de biblioteca agrega pouco aprendizado e compete com a paridade v2/Fase 4 pelo mesmo tempo.

CONCESSÕES:
- Os cruzamentos foram medidos com o router straight, o que penaliza layouts em camadas feitos para roteamento ortogonal.
- O dagre é ESM de 48.559 B (16.954 B gz) e encaixaria no importmap.
- O status quo JÁ acomoda isso sem mudança arquitetural: o registry tem o slot LAZY ("dagre / elk land here") e o descriptor `caps.layered` (`registry.js:9-17`).

Por isso: não agora. Reavaliar o dagre como SEMENTE opcional depois do flip do v2, medido com o router ortogonal. Evidência: - `spikes/results/compare.md`, `elk-main.{json,md}`, `dagre-main.{json,md}`.
- Tamanhos verificados com `stat` e `gzip -c | wc -c`: `spikes/elk/node_modules/elkjs/lib/elk.bundled.js` 1.609.707/469.661 B; `@dagrejs/dagre/dist/dagre.esm.js` 48.559/16.954 B.
- `src/layout/registry.js:9-17`.
- `.feat-memory/decisions/0003-edges-non-directed.md` (Decisão); `0006-no-bundler-esm-importmap.md`.
- **Decisão do juiz: rejeitar.** Pelas métricas do harness, o preset 'arrumado' não arruma. Em syn:100 o dagre tem 820 cruzamentos (v1: 719) e aspecto 10. O ELK layered chega a 20,4 M px² contra 5,3 M do v1, e o ELK stress a 12,6 M. O mapa mental se perde: Δwarm de 1.041 px (dagre) e 1.258 px (ELK). O layered impõe direção a arestas não-direcionadas (ADR-0003), e o ELK tem 1,6 MB em UMD/GWT (ADR-0006). O slot LAZY (registry.js:9-10) continua disponível. Reavaliar o dagre como semente opcional só depois do flip do v2, medido com o router ortogonal.

#### LA-6 · NÃO adotar cytoscape-fcose (compound nodes nativos) — rejeição com evidência

- **Substitui:** Candidato a 'layout de força com containers nativos' que substituiria o live.
- **Proposta:** O cytoscape roda headless com fcose: compound nodes via `parent`, padding pad+HEADER, init espectral no cold start e `randomize: false` no warm start (modo incremental). O `Math.random` é semeado para ter determinismo.
- **Evidência do desafiante:** Fonte: `S/results/fcose-main.json`.

**Viola o contrato** em grafos médios: 5 violações em syn:30 e 23 em syn:100, com 62 folhas invadindo containers alheios. É esparso: densidade 0,04, bbox de 12,9 M px² em syn:100 (v1: 5,3 M) e 863 k em ex:containers (v1: 294 k).

**Pontos positivos**: 309 cruzamentos em syn:100, e um incremental aceitável depois da correção, com Δwarm de 21,4, 35,2 e 39,1 px e reaquecimento de 5,7, 3,9 e 17,7 px.

**Tempo**: 110 a 170 ms por layout em syn:100.

**Tamanho** (em bytes):

| Arquivo | Min | gz |
|---|---|---|
| cytoscape.esm.min | 434.102 | 135.667 |
| fcose (UMD) | 57.239 | 13.404 |
| cose-base (UMD) | 118.906 | 22.413 |
| layout-base (UMD) | 147.958 | 33.606 |
| **Total** | 758.205 | 205.090 |

A cadeia `require('cose-base')` é UMD.

**Pegadinha medida**: no setup headless, `position` no JSON do elemento é ignorado (`S/fcose/dbg2.mjs`); só `node.position()` depois da criação funciona. O primeiro resultado 'incremental' estava errado por isso e foi descartado (`S/results/STALE-fcose-*`).
- **Spike:** Prototipado em `S/fcose/fcose-variants.mjs` (cytoscape 3.34.3 + cytoscape-fcose 2.2.0), variantes `ext:fcose` e `ext:fcose-inc`.

Para reproduzir:
```
node <H>/run.mjs --external S/fcose/fcose-variants.mjs --only-external --scenarios ex:,probe:,syn:30,syn:100
```
- **Encaixe nas restrições:** - ADR-0006: ruim. O cytoscape é ESM, mas o fcose e as bases são UMD encadeados, e o total é 3,5× o `yaml` em gzip.
- ADR-0010: a repulsão é global, de todos contra todos (nodeRepulsion), e não só entre corpos.
- Vivo: não anima frame a frame (animate só interpola o resultado final).
- ADR-0013: encaixaria como plugin, mas não vale o peso.
- **Ganho:** Nenhum que as alternativas LA-1 a LA-4 não deem com menos custo.
- **Custo:** Não aplicável (rejeição). Se fosse adotar: M.
- **Risco:** Adotar traria violações de contrato em grafos médios, peso e um modelo de força contrário ao ADR-0010.
- **Réplica do defensor (conceder):** Concordo com a rejeição: ela favorece o status quo e a evidência é sólida.
- Violações de contrato em grafos médios: 5 em syn:30 e 23 em syn:100.
- Layout esparso: bbox de 12,9 M px² contra 5,3 M do v1, e densidade 0,04.
- ~205 KB gz em cadeia UMD, contra o ADR-0006.
- Repulsão global todos-contra-todos, contra o ADR-0010.
- Não anima frame a frame, contra a identidade "vivo".

Nada a defender do lado do fcose. O único mérito medido (309 cruzamentos, Δwarm ~21–39 px) já é alcançado pelas alternativas nativas. Evidência: - `spikes/results/fcose-main.{json,md}` e `compare.md` (syn:100 fcose-inc: 23 violações, 12,9 M px², 309 cruzamentos).
- `spikes/fcose/dbg2.mjs` (pegadinha do `position` headless).
- `.feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md:24-31`.
- **Decisão do juiz: rejeitar.** A alternativa fcose é rejeitada, como propõe o desafiante e concede o defensor. Viola o contrato em grafos médios (5 violações em syn:30, 23 em syn:100) e é esparso (12,9 M px² contra 5,3 M). Pesa ~205 KB gz em cadeia UMD, contra o ADR-0006. Usa repulsão global todos-contra-todos, contra o ADR-0010, e não anima frame a frame.

#### LA-7 · NÃO trocar src/physics por d3-force — usar só como referência; e aplicar a lição da mola içada também à Fase 4

- **Substitui:** Candidato natural a 'não reinventar a roda' do motor (alpha/alphaDecay/velocityDecay, Barnes–Hut, 'end' nativo).
- **Proposta:** Montei o d3-force dirigido tick a tick, com forças custom para o que ele não tem:
- colisão AABB com pad, gate por layer e exclusão ancestral;
- container composto com impulso distribuído;
- cluster (atrator-região).

As forças nativas usadas foram forceLink (folha×folha), forceX/forceY e, numa das variantes, forceManyBody.
- **Evidência do desafiante:** Fonte: `S/results/d3-main.json`.

**Exemplos pequenos**: tudo certo, com 'end' em 300 ticks, 0 violações e Δwarm de 6 a 24 px.

**syn:100**:

| Métrica | Com forceManyBody | Sem forceManyBody |
|---|---|---|
| violações | 17 | 15 |
| bbox | 18,2 M | 14,4 M |
| aresta/diag | 6,72 | 6,80 |
| reaquecimento | 453,5 px | 261,1 px |

Em syn:30 o reaquecimento fica em 142,5 px.

Isso reproduz, de forma independente, a instabilidade 'mola folha×folha × container composto' do LA-1 (`hybrid-big-leafspring.json`). O d3 também para quando alpha < alphaMin mesmo com sobreposição residual, porque a colisão não é escalada por alpha e termina junto com a simulação.

**Tamanho**: `d3-force.min` 8.300 B, `d3-quadtree` 5.279, `d3-dispatch` 1.901 e `d3-timer` 1.947, total ≈17,4 KB min (≈7 KB gz). O `src/index.js` é ESM, mas importa por especificador nu, então precisa de 4 entradas no importmap.

**Referência**: `src/physics` inteiro tem 26.542 B e já tem grid espacial, controlador PI e Float32 AoS.
- **Spike:** Prototipado em `S/d3force/d3-variants.mjs` (d3-force 3.0.0), variantes `ext:d3` (com charge) e `ext:d3-nocharge`.

Para reproduzir:
```
node <H>/run.mjs --external S/d3force/d3-variants.mjs --only-external --scenarios ex:,probe:,syn:30,syn:100
```
- **Encaixe nas restrições:** - ADR-0006: ótimo, é ESM e pequeno.
- ADR-0010: o `forceManyBody` é um campo de repulsão global de longo alcance, e o forceLink é mola corpo-corpo. Sem o charge, o d3 vira só um integrador com alpha, que o repo já tem.
- Vivo: é nativo (`simulation.on('tick'/'end')`, fx/fy para drag).
- A troca não resolve nenhum dos bloqueadores L1-01 a L1-03 por si. Todos exigem os contributors do LA-1.
- **Ganho:** A lição transferível: qualquer força de aresta (Fase 3 ou Fase 4, com arestas como corpos, ADR-0012) precisa respeitar a coesão do container. Pode ser via içamento ao LCA, via atrator-região mais forte que a mola, ou via restrição de contenção. Sem isso, o grupo estica sem limite; esse efeito apareceu em duas implementações independentes.
- **Custo:** Não aplicável (rejeição). Uma migração seria M, com ganho nulo.
- **Risco:** Trocar o motor seria perder o que o `src/physics` já tem de melhor (PI, grid, determinismo, sub-stepping) em troca de API familiar, sem ganho mensurável.
- **Réplica do defensor (conceder):** Concordo em NÃO trocar o `src/physics` pelo d3-force. Isso reforça o status quo: o motor do repo já tem grid espacial, colisão PI e determinismo, e o próprio híbrido do desafiante o reusa read-only, sem mudar uma linha. No spike, o d3 dá 17 violações e 453 px de reaquecimento em syn:100.

CONTESTO a segunda metade ("aplicar a lição da mola içada à Fase 4") como está formulada. Medi que a instabilidade mola folha×folha × composite depende da razão entre os ganhos da região e da mola (0,02 contra 0,05). Com região 0,3, a mola folha do repo fica estável e melhor em topologia do que a içada em syn:100:

| syn:100 | Mola folha + região 0,3 | Mola içada |
|---|---|---|
| bbox | 4,38 M | 3,5 M |
| Cruzamentos | 356 | 427 |
| Violações | 0 | 0 |

Em syn:300 ainda infla (37,7 M contra 16,3 M da içada), então o içamento tem mérito em escala. Mas a regra geral que deve ir para a Fase 4 (arestas-corpo, ADR-0012) é "a coesão do container precisa dominar a força de aresta". "Içar ao LCA" é uma das implementações dessa regra, não a lição em si. O próprio desafiante lista a região mais forte como alternativa no campo ganho. Evidência: - `spikes/results/d3-main.{json,md}`.
- `D/diag/leafspring-region.mjs` → `D/diag/leafspring-region.json` (syn:30/100: variantes região 0,02/0,1/0,3, mola k 0,01, sem mola e içada) e `D/diag/leafspring-region-300.json` (syn:300). D = /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/layout/defensor.
- `spikes/results/hybrid-big-leafspring.json` (baseline instável: 53,7 M e 448 M px²).
- `src/physics/contributors/connectivity-spring.js:27`.
- **Decisão do juiz: rejeitar.** A troca de src/physics por d3-force é rejeitada. No spike, o d3 dá 17 violações e 453 px de reaquecimento em syn:100 e não resolve nenhum dos bloqueadores L1-01 a L1-03. O forceManyBody contraria o ADR-0010. A 'lição' para a Fase 4 é aceita, mas reformulada. Verifiquei que, com região 0,3, a mola folha é estável e tem 7–15% menos cruzamentos que a içada, com 11–32% mais área (juiz/v2-spring.md). Portanto, a regra geral é 'a coesão do container domina a força de aresta', e 'içar ao LCA' é só uma implementação dela. Isso entra como emenda ao ADR-0010.

## Apêndice B · Avaliação empírica

Avaliação empírica do layout feita com um harness headless reutilizável (Node, sem DOM, sem dependências). Ele roda os adapters reais do repo por `session.tick()` sobre 4 exemplos do app, 3 grafos sintéticos com containers aninhados (30/100/300 nós), 2 sondas de aninhamento profundo e um layout externo de exemplo (grid-pack). Resultado: 54 linhas cenário×variante e 17 métricas. Nenhum arquivo do repo foi alterado (`git status` limpo). O E2E não foi rodado.

**Conclusões principais**

1. **O v2 é muito mais barato, mas hoje é funcionalmente regressivo.**
   - Custo por tick 13–22× menor: 0,56 contra 12,5 ms/tick com 100 nós; 5,6 contra 123 ms/tick com 300. Com 300 nós o v1 roda a 8 fps e leva 57 s para assentar.
   - O v2 **nunca emite 'end'** (loop de RAF perpétuo, com re-routing e repaint a cada frame).
   - O v2 **não trata containers como corpos**, então diagramas aninhados colapsam: 154 violações do contrato de colisão contra 2 do v1 em syn:100, 545 contra 11 em syn:300, densidade >2 (tudo empilhado). No exemplo-vitrine `containers`, os nós Web e API ficam dentro do frame Backend. Isso contraria o próprio ADR-0010 ("um container é um corpo que repele peers").
   - O v2 **ignora o warm start**: toda edição re-explode a partir do círculo, com pico de 150–250 px no reaquecimento contra 0,5–20 px do v1 nos exemplos.
   - O v2 **muda a semântica dos pesos de `nodeLayers`**.
2. **No v1 e nos estáticos, as arestas não exercem força nenhuma.** O layout ignora a topologia: remover ou adicionar aresta com cold start desloca exatamente 0 px. Em cruzamentos, o v1 não é melhor que um grid-pack burro que ignora arestas (719 contra 772 em syn:100). A mola de conectividade do v2 corta os cruzamentos pela metade (688→303 e 5297→2724), o que prova o valor de uma força topológica.
3. **Preservação do mapa mental (crucial para diagramas "vivos") é fraca em todas as variantes.**
   - No v1, uma edição que não muda a geometria (ex.: trocar um label) desloca os nós em média 20,6 px no exemplo `containers`, 76 px em syn:100 e 111 px em syn:300. Causa: o atrator central escala com alpha, e o estado final não é um equilíbrio.
   - `custom` é o default do app. Nele e no `off`, a semente depende do índice, então +1 nó desloca 130–380 px.
4. **Geometria de containers tem 6 implementações com 4 semânticas diferentes.** Isso gera bugs mensuráveis:
   - O rect de colisão ≠ rect renderizado no v1, com overlap residual de exatamente pad+header = 46 px.
   - Violações de contenção com aninhamento >3 níveis ou quando o YAML declara o filho antes do pai.
   - No `off`, a contenção é violada mesmo sem layers.

**Qualidade do código de `src/layout` (2439 linhas)**

| Parte | Linhas (aprox.) | Arquivos |
|---|---|---|
| Legado v1 | ~1260 (52%) | `live/index.js` runSession, `collision-resolution`, `collision-waypoints`, `container-geometry`, `pins` |
| v2 | 318 (13%) | `compile-world.js`, mais `src/physics` 696 linhas fora de `src/layout` |
| Estáticos | 341 (14%) | `off`, `custom`, `collision-postpass` |
| Compartilhado | 461 (19%) | `adapter`, `registry`, `collision.js`, filtros de IR |

`src/layout/collision.js` e `src/physics/collision.js` não são duplicatas diretas: o primeiro é a POLÍTICA de pares (e também serve ao routing), o segundo o MECANISMO (grid + PI). A duplicação real está em:
- interseção de layers;
- exclusão ancestral;
- DEFAULTS;
- boilerplate de sessão;
- derivação de container;
- `computeBounds`;
- a constante HEADER (4 cópias de 22, mais uma de 16 no `off`).

A semântica de split de pesos divergiu entre v1 e v2.

**Parecer sobre "tornar v2 o default"**

NÃO agora, e NÃO junto com a Fase 4. Primeiro fechar a paridade, com gates mensuráveis por este harness:
1. `end` finito;
2. `viol. colisão` do v2 ≤ v1 em todos os cenários, com containers como corpos e atrator-região;
3. pico de reaquecimento ≤ v1, honrando `seedPositions`;
4. decisão explícita sobre a semântica dos pesos;
5. waypoints e labels, ou a declaração de que a Fase 4 os substitui.

Depois disso, virar o default numa entrega própria, e só então fazer a Fase 4. Assim, uma regressão de routing não se confunde com uma regressão de layout. O ganho de desempenho do v2 é real e decisivo para mais de 100 nós. O esforço de paridade é M.

Harness: `harness/run.mjs` e `harness/summarize.mjs` → `harness/results/summary.md`. Variantes: live-v1 (default do engine live), live-v2 (`live.engine: v2`), live-v2+spring (`connectivitySpring: true`), custom, off, e ext:grid-pack (layout externo de exemplo, ignora arestas).

**Cenários**
- 4 exemplos de `src/dsl/examples.js`.
- syn:N: YAML gerado com semente fixa e ~15% de containers até 3 níveis; irmãos compartilham a nodeLayer `g_<pai>`; ~1,3N arestas.
- probe:deep6: cadeia de 6 containers, declarada pais-primeiro ou filhos-primeiro.
- syn:300 × live-v1 rodou só a base e o reaquecimento (~1 min por execução).

**Legenda**
- **ticks (end?)**: "(NÃO)" = não emitiu 'end' em 1500 ticks.
- **assenta em**: tick após o qual nada anda >0,1 px/tick por 20 ticks.
- **viol. colisão**: pares que compartilham nodeLayer e se sobrepõem (folha×folha + container×container + folha×container alheio). Contrato do app = 0.
- **overlap folhas**: todos os pares de folhas sobrepostas, incluindo os que o app permite por não compartilharem layer.
- **densid.**: Σárea das folhas / área do bbox; >1 significa empilhamento.
- **aresta/diag**: comprimento centro→centro em diagonais de nó.
- **cruzam.**: cruzamentos com o router straight do repo.
- **aresta×nó**: aresta atravessando folha que não é endpoint.
- **reaquec. final/pico**: warm restart da mesma IR (estado final / pior frame).
- **Δ cold**, **Δ warm final/pico**: média de 4 perturbações (−aresta, +aresta, +nó, −nó), deslocamento médio dos nós comuns.

| cenário | variante | ticks (end?) | assenta em | ms/tick | viol. colisão | overlap folhas | contenção | bbox px² (aspecto) | densid. | aresta/diag | cruzam. | aresta×nó | determ. | reaquec. final/pico px | Δ cold px | Δ warm final/pico px |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ex:quad | live-v1 | 482 | 27 | 0.09 | 0 | 0 | 0 | 58k (1.58) | 0.46 | 0.84 | 0 | 0 | sim | 1.3/1.3 | 20.9 | 8.8/8.8 |
| ex:quad | live-v2 | 1500 (NÃO) | 229 | 0.03 | 0 | 0 | 0 | 58k (1.58) | 0.46 | 0.83 | 0 | 0 | sim | 0/155.5 | 21 | 21/157.8 |
| ex:quad | live-v2+spring | 1500 (NÃO) | 307 | 0.01 | 0 | 0 | 0 | 58k (1.58) | 0.46 | 0.84 | 0 | 0 | sim | 0/237.5 | 83.3 | 83.3/229.7 |
| ex:quad | custom | 0 | 0 | 0.92 | 0 | 0 | 0 | 49k (1.01) | 0.55 | 0.80 | 0 | 3 | sim | 0/0 | 20.3 | 20.3/20.3 |
| ex:quad | off | 0 | 0 | 0.32 | 0 | 0 | 0 | 49k (1.01) | 0.55 | 0.80 | 0 | 3 | sim | 0/0 | 20.3 | 20.3/20.3 |
| ex:quad | ext:grid-pack | 0 | 0 | 0.26 | 0 | 0 | 0 | 42k (2.39) | 0.64 | 1.07 | 0 | 0 | sim | 0/0 | 48.3 | 48.3/48.3 |
| ex:intro | live-v1 | 482 | 87 | 0.02 | 0 | 0 | 0 | 27k (1.36) | 0.74 | 0.49 | 0 | 0 | sim | 0.5/0.5 | 39.3 | 5.5/5.5 |
| ex:intro | live-v2 | 1500 (NÃO) | 267 | 0.00 | 0 | 0 | 0 | 27k (1.36) | 0.74 | 0.49 | 0 | 0 | sim | 0/175.6 | 39.7 | 39.7/187 |
| ex:intro | live-v2+spring | 1500 (NÃO) | 231 | 0.00 | 0 | 0 | 0 | 43k (1.17) | 0.47 | 0.75 | 0 | 0 | sim | 0/208.1 | 66.2 | 66.2/221.1 |
| ex:intro | custom | 0 | 0 | 0.07 | 0 | 0 | 0 | 33k (1.16) | 0.62 | 0.53 | 0 | 0 | sim | 0/0 | 25.7 | 25.7/25.7 |
| ex:intro | off | 0 | 0 | 0.07 | 0 | 0 | 0 | 33k (1.16) | 0.62 | 0.53 | 0 | 0 | sim | 0/0 | 25.7 | 25.7/25.7 |
| ex:intro | ext:grid-pack | 0 | 0 | 0.02 | 0 | 0 | 0 | 42k (2.39) | 0.48 | 0.88 | 0 | 0 | sim | 0/0 | 0 | 0/0 |
| ex:containers | live-v1 | 482 | 185 | 0.34 | 0 | 0 | 0 | 294k (1.20) | 0.17 | 1.63 | 2 | 4 | sim | 20.6/20.6 | 22.3 | 49.9/49.9 |
| ex:containers | live-v2 | 1500 (NÃO) | 259 | 0.02 | 5 | 10 | 0 | 113k (1.55) | 0.44 | 0.44 | 8 | 10 | sim | 0/202.2 | 18 | 18/202.5 |
| ex:containers | live-v2+spring | 1500 (NÃO) | 205 | 0.01 | 5 | 6 | 0 | 107k (1.27) | 0.47 | 0.67 | 0 | 8 | sim | 0/248.6 | 52.7 | 52.7/246.9 |
| ex:containers | custom | 0 | 0 | 0.52 | 0 | 0 | 0 | 165k (2.13) | 0.30 | 1.53 | 3 | 13 | sim | 0/0 | 32.1 | 32.1/32.1 |
| ex:containers | off | 0 | 0 | 0.28 | 1 | 1 | 0 | 236k (1.03) | 0.21 | 1.36 | 1 | 6 | sim | 0/0 | 43.6 | 43.6/43.6 |
| ex:containers | ext:grid-pack | 0 | 0 | 0.04 | 0 | 0 | 0 | 228k (1.61) | 0.22 | 1.43 | 2 | 1 | sim | 0/0 | 40.2 | 40.2/40.2 |
| ex:forces | live-v1 | 482 | 86 | 0.02 | 0 | 6 | 0 | 132k (2.17) | 0.35 | 0.87 | 0 | 9 | sim | 0.5/0.5 | 5.2 | 1.8/1.8 |
| ex:forces | live-v2 | 1500 (NÃO) | 332 | 0.01 | 0 | 9 | 0 | 160k (1.34) | 0.29 | 1.01 | 0 | 9 | sim | 0/211.6 | 13.3 | 13.3/219.5 |
| ex:forces | live-v2+spring | 1500 (NÃO) | 331 | 0.01 | 0 | 9 | 0 | 138k (1.48) | 0.34 | 1.03 | 0 | 10 | sim | 0/215.9 | 16.4 | 16.4/222.5 |
| ex:forces | custom | 0 | 0 | 0.13 | 0 | 10 | 0 | 36k (1.16) | 1.31 | 0.34 | 0 | 11 | sim | 0/0 | 6.7 | 6.7/6.7 |
| ex:forces | off | 0 | 0 | 0.07 | 0 | 13 | 0 | 36k (1.56) | 1.29 | 0.50 | 0 | 9 | sim | 0/0 | 5.9 | 5.9/5.9 |
| ex:forces | ext:grid-pack | 0 | 0 | 0.02 | 0 | 0 | 0 | 106k (2.28) | 0.44 | 1.30 | 0 | 2 | sim | 0/0 | 15.1 | 15.1/15.1 |
| syn:30 | live-v1 | 482 | 268 | 0.88 | 2 | 0 | 0 | 953k (1.36) | 0.19 | 2.42 | 58 | 55 | sim | 22.2/22.2 | 97 | 28.8/28.8 |
| syn:30 | live-v2 | 1500 (NÃO) | 359 | 0.05 | 20 | 83 | 0 | 226k (1.12) | 0.81 | 0.74 | 42 | 211 | sim | 0/165.3 | 9.1 | 9.1/166.3 |
| syn:30 | live-v2+spring | 1500 (NÃO) | 450 | 0.05 | 20 | 75 | 0 | 236k (1.06) | 0.77 | 0.81 | 21 | 163 | sim | 0/193.7 | 47.9 | 47.9/194.2 |
| syn:30 | custom | 0 | 0 | 0.74 | 7 | 3 | 0 | 809k (1.55) | 0.23 | 2.22 | 71 | 91 | sim | 0/0 | 151.1 | 151.1/151.1 |
| syn:30 | off | 0 | 0 | 0.64 | 7 | 5 | 0 | 985k (1.21) | 0.18 | 2.64 | 82 | 81 | sim | 0/0 | 58.8 | 58.8/58.8 |
| syn:30 | ext:grid-pack | 0 | 0 | 0.03 | 0 | 0 | 0 | 1.25M (4.06) | 0.15 | 4.68 | 68 | 53 | sim | 0/0 | 21.1 | 21.1/21.1 |
| syn:100 | live-v1 | 482 | 322 | 12.53 | 2 | 0 | 0 | 5.35M (1.02) | 0.11 | 4.55 | 719 | 303 | sim | 76/76 | 239.2 | 90.6/97.8 |
| syn:100 | live-v2 | 1500 (NÃO) | 402 | 0.56 | 154 | 843 | 0 | 265k (1.06) | 2.21 | 1.03 | 688 | 2235 | sim | 0/149.2 | 8.4 | 8.4/149.7 |
| syn:100 | live-v2+spring | 1500 (NÃO) | – | 0.50 | 156 | 710 | 0 | 286k (1.07) | 2.04 | 0.91 | 303 | 1739 | sim | 0/212.6 | 59.3 | 59.3/212.8 |
| syn:100 | custom | 0 | 0 | 4.91 | 46 | 36 | 0 | 3.39M (2.52) | 0.17 | 3.89 | 569 | 514 | sim | 0/0 | 140.5 | 140.5/140.5 |
| syn:100 | off | 0 | 0 | 4.63 | 50 | 42 | 0 | 2.59M (2.12) | 0.23 | 3.73 | 737 | 501 | sim | 0/0 | 202.7 | 202.7/202.7 |
| syn:100 | ext:grid-pack | 0 | 0 | 0.08 | 0 | 0 | 0 | 6.22M (3.19) | 0.09 | 6.57 | 772 | 231 | sim | 0/0 | 6.4 | 6.4/6.4 |
| syn:300 | live-v1 | 482 | 394 | 123.17 | 11 | 0 | 0 | 20.85M (1.33) | 0.09 | 8.76 | 6766 | 1678 | – | 111.5/111.5 | – | –/– |
| syn:300 | live-v2 | 1500 (NÃO) | – | 5.56 | 545 | 6820 | 0 | 561k (1.30) | 3.18 | 1.11 | 5297 | 19150 | sim | 0/155 | 11.1 | 11.1/155.5 |
| syn:300 | live-v2+spring | 1500 (NÃO) | – | 5.12 | 562 | 6019 | 0 | 729k (1.38) | 2.45 | 1.02 | 2724 | 15349 | sim | 0/219.9 | 75.4 | 75.4/220.2 |
| syn:300 | custom | 0 | 0 | 51.91 | 206 | 205 | 0 | 17.19M (3.06) | 0.10 | 9.99 | 6670 | 4177 | sim | 0/0 | 226 | 226/226 |
| syn:300 | off | 0 | 0 | 32.03 | 203 | 220 | 0 | 21.35M (1.32) | 0.08 | 8.45 | 6023 | 2664 | sim | 0/0 | 383.2 | 383.2/383.2 |
| syn:300 | ext:grid-pack | 0 | 0 | 0.33 | 0 | 0 | 0 | 25.38M (5.99) | 0.07 | 17.89 | 6873 | 1373 | sim | 0/0 | 0.2 | 0.2/0.2 |
| probe:deep6 | live-v1 | 482 | 167 | 0.08 | 0 | 0 | 3 | 384k (1.29) | 0.12 | 1.09 | 0 | 0 | sim | 15.1/15.1 | 23.7 | 31.5/48.3 |
| probe:deep6 | live-v2 | 1500 (NÃO) | 97 | 0.02 | 6 | 21 | 2 | 74k (1.10) | 0.64 | 0 | 10 | 30 | sim | 0/224.2 | 1.4 | 1.4/223.2 |
| probe:deep6 | live-v2+spring | 1500 (NÃO) | 199 | 0.01 | 5 | 11 | 3 | 144k (1.09) | 0.33 | 0.76 | 3 | 13 | sim | 0/220.3 | 63.4 | 63.4/220.9 |
| probe:deep6 | custom | 0 | 0 | 0.18 | 0 | 0 | 0 | 559k (1.08) | 0.08 | 1.75 | 2 | 3 | sim | 0/0 | 93.8 | 93.8/93.8 |
| probe:deep6 | off | 0 | 0 | 0.14 | 4 | 2 | 0 | 313k (1.70) | 0.15 | 0.78 | 0 | 2 | sim | 0/0 | 140.2 | 140.2/140.2 |
| probe:deep6 | ext:grid-pack | 0 | 0 | 0.02 | 0 | 0 | 0 | 695k (3.17) | 0.07 | 1.63 | 0 | 0 | sim | 0/0 | 14.7 | 14.7/14.7 |
| probe:deep6-childfirst | live-v1 | 482 | 218 | 0.15 | 2 | 0 | 0 | 497k (1.29) | 0.10 | 1.25 | 0 | 0 | sim | 20.8/20.8 | 45.6 | 58/72.2 |
| probe:deep6-childfirst | live-v2 | 1500 (NÃO) | 97 | 0.01 | 6 | 21 | 0 | 200k (1.09) | 0.23 | 0 | 10 | 30 | sim | 0/224.2 | 1.4 | 1.4/223.2 |
| probe:deep6-childfirst | live-v2+spring | 1500 (NÃO) | 199 | 0.01 | 6 | 11 | 0 | 240k (1.10) | 0.20 | 0.76 | 3 | 13 | sim | 0/220.3 | 40.4 | 40.4/216.2 |
| probe:deep6-childfirst | custom | 0 | 0 | 0.21 | 5 | 0 | 0 | 283k (1.46) | 0.17 | 0.64 | 0 | 0 | sim | 0/0 | 130.1 | 130.1/130.1 |
| probe:deep6-childfirst | off | 0 | 0 | 0.19 | 5 | 0 | 0 | 268k (1.38) | 0.17 | 0.61 | 0 | 0 | sim | 0/0 | 179 | 179/179 |
| probe:deep6-childfirst | ext:grid-pack | 0 | 0 | 0.02 | 0 | 0 | 0 | 695k (3.17) | 0.07 | 1.63 | 0 | 0 | sim | 0/0 | 7.3 | 7.3/7.3 |

**Cuidados de leitura**

1. Δ baixo no v2 (ex.: 8,4 px em syn:100) vem de layout degenerado (densidade >2, tudo empilhado), não de estabilidade.
2. O "0" no reaquecimento final do v2 só reflete determinismo; o pico (150–250 px) é a re-explosão que o usuário vê.
3. Os ms/tick das variantes estáticas são o tempo total de uma única passada.
4. Tempos medidos em CPU compartilhada (load 2–4): compare razões, não valores absolutos.
5. Todas as variantes deram "determ. = sim" (posições bit-idênticas em 2 execuções).

#### L1-01 · Motor v2 nunca emite 'end': loop de RAF perpétuo, re-routing/repaint por frame e jitter permanente com mola (critica, esforço P)

- **Evidência:** `src/physics/solver.js:42` faz `alpha = Math.max(alphaMin, ...)`, então alpha nunca fica < alphaMin. `src/layout/compile-world.js:240` testa `alpha < cfg.alphaMin`, que é sempre falso. `compile-world.js:244` testa `solver.alpha >= cfg.alphaMin`, que é sempre verdadeiro, e agenda RAF para sempre. No browser, cada tick dispara o routing e o `paint()` do pipeline (`src/app/pipeline.js:169-253`). Repro `prof/end-repro.mjs`: v1 emite 'end' no tick 482; v2 fica 'SEM end em 5000 ticks (alpha=0.003)'. No harness, TODOS os cenários v2 terminam com `ended=false` após 1500 ticks. Com a mola, syn:100 nunca assenta cineticamente: maxStep 0,12–0,38 px/tick nos ticks 700–1500 (`prof/kin.mjs`). Lacuna de teste: `tests/layout/compile-world.test.js:86-96` só testa a cena 100% pinada, e os testes usam o critério `alpha >= 0.005` (linhas 9-13), que mascara o bug; os 12 testes v2/solver passam.
- **Detalhe:** Afeta bateria e CPU para qualquer usuário com `live.engine: v2`. Também viola o critério de aceitação A4 da F-0002 ('todo adapter implementa o mesmo contrato tick/end/...').
- **Recomendação:** Separar o piso de alpha do critério de término: emitir 'end' quando `alpha <= alphaMin` e a energia cinética ficar abaixo de um epsilon por N ticks, ou não clampar alpha no solver. Adicionar teste de cena móvel que exija 'end' num número finito de ticks. Se o 'vivo' contínuo for desejado, torná-lo um modo explícito com orçamento de CPU, não um efeito colateral.

#### L1-02 · v2 não trata containers com filhos como corpos de colisão: diagramas aninhados colapsam (critica, esforço M)

- **Evidência:** `compile-world.js:71-74,81-102`: corpos = folhas + containers vazios; containers com filhos só derivam o rect (linhas 191-212) e nunca colidem. O v1 resolve folha×container e container×container (`src/layout/adapters/live/collision-resolution.js:51-79`). O ADR-0010 exige 'um container é um corpo que repele peers E hospeda um atrator-região para os filhos'. Métricas de violação do contrato de colisão (pares que compartilham nodeLayer):
- ex:containers: v2 5, v1 0 (`prof/viol.mjs`: web 150×52 e api 140×48 totalmente dentro do frame backend; auth/worker/queue dentro do frame store);
- syn:30: v2 20, v1 2;
- syn:100: v2 154, v1 2 (densidade 2,21, ou seja, empilhamento);
- syn:300: v2 545, v1 11 (6820 pares de folhas sobrepostas, densidade 3,18).
Nas sondas deep6, o v2 empilha todas as folhas no mesmo centro (aresta/diag = 0).
- **Detalhe:** É o bloqueador principal para o v2 virar default: qualquer diagrama com containers (o exemplo-vitrine incluso) fica ilegível.
- **Recomendação:** Implementar o que o ADR-0010 já decidiu:
- container como corpo composto (AABB derivada por tick; força de colisão distribuída aos descendentes proporcionalmente à massa);
- atrator-região para manter os filhos juntos.
Gate: `viol. colisão` do v2 ≤ v1 em todos os cenários do harness.

#### L1-03 · v2 ignora o warm start (seedPositions/seedAlpha): cada edição re-explode o diagrama a partir do círculo (alta, esforço P)

- **Evidência:** `grep seed src/layout/compile-world.js` não retorna nada, e a semente é sempre o círculo (`compile-world.js:85-91`). O pipeline passa `live.seedPositions` e `seedAlpha` em toda edição (`src/app/pipeline.js:121-151`), e o v1 os honra (`live/index.js:107-114,149-152`). Harness, pico do reaquecimento da MESMA IR (pior deslocamento médio em qualquer frame):

| Cenário | v2 | v1 |
|---|---|---|
| ex:quad | 155,5 px | 1,3 px |
| ex:intro | 175,6 px | 0,5 px |
| ex:containers | 202,2 px | 20,6 px |
| ex:forces | 211,6 px | 0,5 px |

O estado final do v2 bate em 0 px só porque ele é determinístico.
- **Detalhe:** Para a identidade de diagrama 'vivo', a continuidade entre edições é o requisito central de UX; sem ela o v2 anima uma explosão a cada tecla.
- **Recomendação:** Portar para o `startLayoutV2` a semente por `seedPositions` e o `warmAlpha` do v1. Gate: pico de reaquecimento do v2 ≤ v1.

#### L1-04 · v1 não escala: O(N²) sem broad-phase e O(L·C·N) por passe; inviável acima de ~100 nós (alta, esforço P)

- **Evidência:** Custo medido (ms/tick):

| Motor | 30 nós | 100 nós | 300 nós |
|---|---|---|---|
| v1 | 0,88 | 12,5 | 123 |
| v2 | 0,05 | 0,56 | 5,6 |

Com 300 nós o v1 leva 57–59 s para assentar. Perfil de CPU (`prof/prof.mjs`, syn:100), maiores fatias:
- `leafIndicesUnder` (collision-resolution.js:103): 20,7%;
- `separateBodiesHard` (:164): 15,1%;
- `nodeNodePair` (`src/layout/collision.js:103`): 14,5%;
- `nodeSpec`: 7,8%;
- `sharedLabels`: 4,9%;
- `computeContainerRects`: 4,3%.
Causas no código: `leafIndicesUnder` é O(N) por par folha×container; o passe duro vai até 8× por tick (`collision-resolution.js:164`); `computeContainerRects` é O(C·N) a cada chamada (`container-geometry.js:37-48`).
- **Detalhe:** O orçamento de 16 ms/tick (60 fps) estoura por volta de 100 nós no v1.
- **Recomendação:** Não investir no v1 além de um quick-win, se ele continuar default por muito tempo: pré-computar `leafIndicesUnder` e os pares colidíveis uma vez por sessão (ganho estimado de ~25–30%, não medido). A saída estrutural é o v2 com spatial grid.

#### L1-05 · v1: o rect de colisão de container difere do rect renderizado em containers com subcontainers, deixando overlap residual (alta, esforço P)

- **Evidência:** A colisão usa o bbox das folhas TRANSITIVAS + pad + header (`src/layout/adapters/live/container-geometry.js:37-48`). O render usa filhos diretos + rects dos containers-filhos, que já incluem o pad e o header deles (`live/index.js:458-489`). `prof/geom.mjs` em syn:30, container c0:
- rect de colisão: {x:-402, y:-95, w:788, h:663};
- rect renderizado: {x:-426, y:-141, w:836, h:709}.
A diferença é exatamente pad+header. Pares violados (`prof/viol.mjs`), todos múltiplos de 22/46 (header, pad+header):
- c0×c3 com overlap de 570,9×46,0 (syn:30);
- c2×c10 com 479,3×46,0 e c10×n47 com 75×22 (syn:100);
- r0×d0 com 96×48 e x2 dentro de d3 (deep6-childfirst).
- **Detalhe:** Explica todas as violações residuais do v1: 2 em syn:30/syn:100 e 11 em syn:300 (10 container×container).
- **Recomendação:** Uma única função recursiva de rect de container, usada tanto para colisão quanto para render (ver L1-12).

#### L1-06 · Derivação de rect de container frágil a profundidade e ordem: 3 passes fixos, suposição de pais-antes-dos-filhos no custom, passe único só de folhas no off (media, esforço P)

- **Evidência:** - `live/index.js:458` e `compile-world.js:191`: `for (pass < 3)` em ordem de IR.
- `custom/index.js:32-34` assume que 'ir.nodes lists a container before its descendants', mas a ordem da IR é a ordem de declaração do YAML (`src/dsl/ir.js:72-93`).
- `off.js:43`: `bboxOf(children, session.positions)` só enxerga folhas e ignora containers-filhos.

`prof/nolayers.mjs` (cadeia de 6 containers, sem layers), violações de contenção:
- pais primeiro: live-v1 3, v2 3, v2+spring 3 (até 81,8 px), off 5 (38,5 px), custom 0;
- filhos primeiro: custom 5 (38,5 px), off 5 (38,5 px), live 0.

No harness, probe:deep6 dá contenção 3 no v1 e 2 no v2.
- **Detalhe:** Um frame que não contém o próprio filho é um erro visual grave e depende de como o usuário ordenou os blocos do YAML.
- **Recomendação:** Derivar bottom-up por profundidade, como `collision-postpass.js:114` (`reflowContainers`, que já ordena por profundidade), numa função compartilhada. Adicionar a sonda deep6 (as duas ordens) como teste.

#### L1-07 · Arestas não exercem força no v1 (e nos estáticos): o layout ignora a topologia (alta, esforço M)

- **Evidência:** `live/index.js:125-127`: 'Edges exert NO force'. A F-0002 lista 'arestas são passivas' como limite conhecido. No harness, remover/adicionar aresta com cold start dá Δ = 0,0 px em todos os cenários v1/custom/off.

| Métrica (syn:100) | v1 | grid-pack (ignora arestas) | custom | v2+mola |
|---|---|---|---|---|
| Aresta média (diagonais de nó) | 4,55 | – | – | – |
| Cruzamentos | 719 | 772 | 569 | 303 |

Em syn:300 o v1 chega a 8,76 diagonais por aresta. A mola de conectividade do v2 derruba os cruzamentos de 688→303 (syn:100) e 5297→2724 (syn:300).
- **Detalhe:** Para um produto DSL→diagrama, posicionar nós conectados perto uns dos outros é a razão de ser do auto-layout; hoje o default só empacota blocos em volta da origem.
- **Recomendação:** Tornar a mola de conectividade (ou uma força de stress) parte do modelo default do v2 depois de resolver L1-02. O ADR-0010 já permite 'acoplamento estrutural declarado' para arestas. Medir a qualidade topológica (cruzamentos, aresta/diag) como gate.

#### L1-08 · v2 muda silenciosamente a semântica dos pesos de nodeLayers (media, esforço P)

- **Evidência:** - v1: split por par, pela média dos pesos nas layers COMPARTILHADAS (`src/layout/collision.js:63-68`).
- v2: `invMass = max(0.05, 1 - maxWeight(TODAS as layers do nó))` (`compile-world.js:92`), e a massa escala TODAS as forças (central/tag), não só a colisão.

`prof/weights.mjs` (a com {g:1,h:0}, b com {h:0}; só h é compartilhada):

| Motor | Deslocamento de a | Deslocamento de b | x final de a |
|---|---|---|---|
| v1 | 120,9 | 150,1 | 59 |
| v2 | 36,9 | 214,2 | 143 |

No v2, a fica pesado para b por causa de uma layer que eles não compartilham, e fica lento para ser atraído ao centro.
- **Detalhe:** Um usuário que troca de engine vê o mesmo YAML ceder de forma diferente.
- **Recomendação:** Decidir via ADR. Ou peso = split por contato (massa efetiva por par, calculada no contributor de colisão), preservando o que a DSL documenta; ou atualizar a doc da DSL e os exemplos (`examples.js` 'pesos iguais → 50/50') para a semântica de massa global.

#### L1-09 · Outras lacunas de paridade do v2: sem limite de velocidade, sem waypoints de aresta, sem feedback de label (media, esforço P)

- **Evidência:** - `compile-world.js:163` passa `integrator: { damping, dampingOrder }` sem `velocityCap`, e o cap default é Infinity (`src/physics/integrator.js:23`); o v1 usa `maxVel: 32` (`live/index.js:31,339-347`).
- O v2 não expõe `session.edgeWaypoints` nem `reportLabelBBox`/`labelBBoxes` (grep vazio em `compile-world.js`). Com isso, `applyObstacleRouting` cai no A* estático por tick (`src/routing/obstacle-route.js:41-53`), e a colisão de labels (`live/index.js:180-189`) é perdida.
- `physics/registry.js` só é usado em teste (`tests/physics/solver.test.js:5`).
- **Detalhe:** Sem cap, forças `repelFrom` (4000/d²) a curta distância podem gerar saltos; não reproduzido aqui, é inferência do código.
- **Recomendação:** Passar `velocityCap` a partir de `cfg.maxVel`. Decidir explicitamente se waypoints e labels serão resolvidos pela Fase 4 (arestas como corpos) e registrar isso como pré-requisito ou não do flip de default.

#### L1-10 · Drift no reaquecimento do v1: uma edição sem mudança geométrica desloca o diagrama inteiro (media, esforço M)

- **Evidência:** Reaquecimento da MESMA IR (o pipeline faz isso a cada edição): deslocamento médio de 0,5–1,3 px nos exemplos pequenos, 20,6 px em ex:containers, 22,2 px em syn:30, 76 px em syn:100 (máx. 148) e 111,5 px em syn:300 (máx. 305). Em ex:containers, +1 nó com warm start desloca 124,6 px contra 62,8 px com cold start. Causa: o atrator central é escalado por alpha (`live/index.js:288-291`), mas a colisão não, então o estado final não é equilíbrio; o warm restart reaquece a `alphaKick` 0,5 (`live/index.js:151`) e recomprime tudo.
- **Detalhe:** 'Preservação do mapa mental' é o critério que mais diferencia um diagrama vivo de um re-layout; hoje nenhuma variante o cumpre acima de ~30 nós.
- **Recomendação:** Reaquecimento local: alpha alto só na vizinhança perturbada (nós novos/removidos e seus k vizinhos), com os demais inicialmente congelados (o modo `frozen` já existe), ou alpha de reaquecimento baixo (~0,05) para edições que não mudam a topologia. Gate: `reaquec. final` < 2 px e `Δ warm` < `Δ cold` em todos os cenários.

#### L1-11 · custom (default do app) e off: pós-passo insuficiente em escala, instáveis a edição, contrato de padding e header inconsistente (media, esforço P)

- **Evidência:** - O default do app é `layoutId: 'custom'` (`src/store.js:32`), não o live.
- O pós-passo tem só 4 passes (`collision-postpass.js:18`) e deixa violações: custom/off com 46/50 em syn:100 e 206/203 em syn:300 (aspecto do custom 3,06).
- A semente é por índice (`adapter.js` `centerSeed`), então +1 nó desloca muito: Δ cold de 140,5/202,7 px (syn:100) e 226/383 px (syn:300).
- Padding: o pós-passo usa `+ pad` uma vez (`collision-postpass.js:80`); a separação dura do live usa `2*pad` (`collision-resolution.js:236-237`), assim como a física v2 (`src/physics/collision.js:62-63`).
- Header: o off usa 16 (`off.js:47,49,63`), o renderer desenha 22 (`src/renderer/nodes.js:90`).
- **Detalhe:** Como o custom é o default, a primeira impressão de qualquer diagrama médio já vem com sobreposições.
- **Recomendação:** Iterar o pós-passo até convergir (com teto dependente de N) ou usar um grid/sweep. Semear por hash estável do id em vez do índice (estabilidade grátis). Unificar pad e HEADER num módulo de constantes.

#### L1-12 · Duplicação e dívidas estruturais em src/layout: 6 derivações de container, sessão triplicada, política de routing morando em layout (media, esforço M)

- **Evidência:** Derivação de rect de container em 6 lugares:
- `live/index.js:456-490`
- `compile-world.js:191-212`
- `live/container-geometry.js:19-57` (semântica diferente: folhas transitivas)
- `custom/index.js:56`
- `off.js:40-58`
- `collision-postpass.js:114`

Outras duplicações:
- `computeBounds` ×4 (`off.js:91`, `custom/index.js:83`, e inline no live e no compile-world);
- HEADER=22 ×4 (`container-geometry.js:17`, `custom/index.js:13`, `compile-world.js:34`, `renderer/nodes.js:90`), mais 16 no off;
- DEFAULTS duplicados (`live/index.js:19-42` × `compile-world.js:37-57`);
- semente em círculo duplicada (`live/index.js:118-121` × `compile-world.js:88-90`);
- boilerplate de sessão/RAF ×3 (`adapter.js emptySession`, `live/index.js:139-265,507-526`, `compile-world.js:230-305`);
- interseção de layers ×2 (`layout/collision.js:71 sharedLabels` × `physics/collision.js:24 layersIntersect`);
- exclusão ancestral ×2 (`collision.js:105-106` × `compile-world.js:105-111`).

`layout/collision.js` também hospeda política de ROUTING (`edgeNodePair`/`edgeEdgePair`/`edgeLayerPair`, usada por `src/routing` e pelo routing físico deprecated). O v1 embute A* de routing (`live/collision-waypoints.js`, 397 linhas), o que viola a ortogonalidade do ADR-0013. `layer-filter`/`collapse-filter` são transformações de IR, não layout.
- **Detalhe:** Classificação: legado v1 ~1260 linhas (52%); v2 318 (13%); estáticos 341 (14%); compartilhado 461 (19%). L1-05 e L1-06 são sintomas diretos dessa duplicação.
- **Recomendação:** Antes do flip de default, extrair:
1. `container-geometry` compartilhado (recursivo por profundidade), de onde sai o rect de colisão E o de render;
2. `session-base` (listeners/RAF/end);
3. constantes (HEADER, pad, min de container vazio);
4. `collision-policy` (camadas, ancestrais, split), consumido por v1, v2 e routing.

Depois do flip, remover o v1 inteiro (~1260 linhas) com seus testes.

#### L1-13 · Cobertura e superfície do v2 insuficientes para decidir o default (media, esforço P)

- **Evidência:** `tests/layout/compile-world.test.js` tem 7 testes, contra 35 em `tests/layout/adapters/live.test.js`. Nenhum teste do v2 cobre:
- containers colidindo;
- `update` (drag/release);
- warm start;
- 'end' em cena móvel;
- constraints no caminho do adapter.

Nenhum E2E usa `engine: v2` (grep vazio em e2e/ e em tests fora do compile-world). A flag não aparece no formulário de config (`src/controls/config-schema.js` não tem 'engine'). O manifest F-0002 não menciona o v2 nem a mola, e o v2 viola A3 ('acomoda os nós até não haver sobreposição' com containers) e A4 (contrato tick/end).
- **Detalhe:** O harness leva ~5 s nesse subset (medido: exemplos + sondas + syn:30 com todas as variantes).
- **Recomendação:** Transformar este harness num teste de caracterização (subset rápido: exemplos + syn:30 + sondas) que compare v1 × v2 por invariantes: contenção 0, violação de colisão ≤ referência, `end` finito, determinismo. Atualizar a F-0002 com o v2 e a flag.

#### L1-14 · Parecer: NÃO tornar v2 o default agora, e não acoplar o flip à Fase 4 (info, esforço M)

- **Evidência:** A favor do v2: custo 13–22× menor por tick (0,56 contra 12,5 ms com 100 nós; 5,6 contra 123 com 300); determinístico; zero sobreposição folha×folha dentro de uma layer em todos os cenários, sem passe duro (o PI funciona); a mola reduz cruzamentos pela metade.
Contra: L1-01 (sem 'end'), L1-02 (colapso de containers: 5/20/154/545 violações contra 0/2/2/11 do v1), L1-03 (re-explosão de 150–250 px a cada edição), L1-08 (semântica de pesos), L1-09 (waypoints, labels, cap).
- **Detalhe:** 'Calibração provisória' não é o bloqueador: os bloqueadores são funcionais (containers, término, continuidade) e cada um tem métrica objetiva no harness.
- **Recomendação:** Sequência sugerida:
1. Paridade (L1-01, L1-03 e o cap de L1-09: P; L1-02: M; L1-08: decisão).
2. Gates no harness: `end` finito; `viol. colisão` v2 ≤ v1; contenção 0; pico de reaquecimento ≤ v1; ms/tick < 16 com 300 nós (já atende).
3. Flip do default do `live` numa entrega própria, com o v1 disponível por flag por um ciclo.
4. Fase 4 (routing no motor).
5. Remover o v1 e o routing físico deprecated.

Acoplar o flip à Fase 4 impediria atribuir regressões (layout × routing). Vale também reavaliar se o default do APP (hoje `custom`) deveria virar o live-v2 depois disso; é a mudança de maior impacto no usuário, e o custom tem os problemas de L1-11.

