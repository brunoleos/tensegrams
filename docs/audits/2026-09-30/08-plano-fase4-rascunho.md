# Rascunho do plano da Fase 4

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

> Rascunho produzido pelo sintetizador da trilha 7 a partir de 3 propostas com protótipo e 2 julgamentos independentes. Não é decisão: as decisões arquiteturais correspondentes estão como ADRs *proposed* em `.feat-memory/decisions/proposals/`.

# Plano da Fase 4 — routing no motor unificado (RASCUNHO)

> Rascunho de 2026-09-30, derivado da avaliação do motor: auditoria E1-01..E1-18, propostas fiel/xpbd/perf e juízes das lentes visual e engenharia. Nada foi implementado. Os números vêm de protótipos em Node 22, não do navegador.

## 1. Objetivo

As arestas passam a ser corpos do motor unificado `src/physics`, movidas por tendências de força (ADR-0012), no mesmo World e no mesmo tick dos nós. A fase fecha quando:

- a sessão v2 entrega `session.routedEdges`, sem pós-processamento algébrico;
- existe o eixo recíproco aresta→nó (contato e tração), que a Fase 3 deixou de fora;
- o diagrama assenta de verdade (custo zero em repouso) e uma edição local não mexe no resto;
- `src/routing/physics` (9 arquivos, 1952 linhas) e seus 19 arquivos de teste saem, e o ADR-0012 passa a superseder o ADR-0009.

| meta (bench comum, Node) | valor | referência hoje |
|---|---|---|
| arestas em nó alheio, pinned N ≤ 100 (arestas) | 0 | fiel: 0 |
| arestas cruzando o próprio nó (arestas) | 0 | fiel com semente centro: ~25% |
| tick 150 nós / 225 arestas (ms) | ≤ 4 | fiel: 2.14 em 100/150 |
| tick 500 / 1000 pinned (ms) | ≤ 20 | fiel: 54.4; perf: 5.68 |
| tick com tudo assentado (µs) | < 50 | v2 hoje: loop eterno (E1-01) |
| arestas a > 600 px após edição local (px) | < 0.5 | fiel com alpha global: 53–63 |

## 2. Arquitetura escolhida

Base: proposta **fiel** (forças lineares explícitas, sem XPBD e sem RAIL1). Enxertos: a camada de execução da **perf** e os oráculos de teste da **xpbd**.

### 2.1 Modelo de forças (default)

| termo | lei | parâmetro inicial | reação |
|---|---|---|---|
| F1 tensão da cadeia | mola de repouso 0 entre corners vizinhos; comprimento emergente | kChain 0.05 | interna, recíproca |
| F2 endpoint → perímetro | atrator-path: f = kEnd·(Π(x) − x) | kEnd 1 | −ρEnd·f no nó, ρEnd = alpha da aresta |
| F3 cápsula × nó | zona linear sobre SDF amostrada em K=4 pontos fixos + guarda de núcleo aditiva na normal | kRep 2; zona padN+padE+rE = 17 px | −f no nó, ρ = 1, sem alpha |
| F4 cápsula × cápsula | manifold de 4 pontos ponta×segmento (enxerto perf); par já cruzado sem força | kCross 2 (= kRep); zona 10 px | recíproca, baricêntrica |
| F5 nó × nó | eixo mínimo da AABB acolchoada, P puro | Kp 0.3, Ki 0 | recíproca |
| F6 atrator central | só nós | 0.012·alpha | — |

A midline fica desligada por default: a fiel argumenta que ela prescreveria a reta, sem medição direta. Ela volta como opção A/B no M9.

### 2.2 Integração e estabilidade

- dt 1 e 2 sub-passos; broad-phase 1x por tick, com AABB engordada (fat 8 px).
- Damping como taxa: 0.82^(dt/baseDt) (corrige E1-05).
- Teto de velocidade de 8 px/tick por eixo com arestas ligadas (regra R1 da fiel). O drag move o nó em passos ≤ cap, sem teletransporte.
- Alpha por corpo, decaindo até 0, sem piso.
- Sono por janela de deslocamento (1 px em 30 ticks), com wake adiado para o tick seguinte. A aresta dormindo mantém no nó a força normal em cache.
- `tick()` devolve `false` quando tudo dorme, e o loop de rAF para.

### 2.3 Dados e módulos (`src/physics/edges/`)

| módulo | conteúdo | marco |
|---|---|---|
| `geometry.js` | segRect, segSeg, boxSdf sem alocação | M1 |
| `chains.js` | pool de cadeias em typed arrays; nodeA/nodeB com geração; corners são corpos POINT/FREE2 do World (`world.js:72-97`) | M3 |
| `colliders.js` | colisores derivados (nó, segmento), máscaras em bitset, pad por elemento | M3 |
| `edge-field.js` | contributor F1–F5, sem closures por tick | M3, M7 |
| `settle.js` | alpha por corpo, sono e wake | M5 |
| `broadphase.js` | grid CSR em Int32, dedupe por célula de referência, lista de corpos grandes | M7 |
| `topology.js` | fissão e fusão com handles {slot, gen} | M8 |

Toda referência externa a corpo usa handle {slot, gen} validado com `isAlive` (E1-08).

### 2.4 Saída e pipeline

- O compile-world cria uma cadeia por aresta do IR, semeada reta entre portas do perímetro.
- `session.routedEdges` mantém o contrato `Map<string, RoutedEdge>` (`src/layout/adapter.js:34`). O endpoint é projetado no perímetro só no render, para cobrir o gap físico de 2.4–7.8 px.
- O live declara `caps.providesRouting = true` com o campo ativo (hoje `false`, `src/layout/adapters/live/index.js:47`).
- O pipeline pula `applyObstacleRouting`, clip e snap quando a sessão fornece rotas (`src/app/pipeline.js:179-238`).
- A flag é `routing.engine: 'unified'`, com knobs em `live.edges.*` (ADR-0007).
- `live.connectivitySpring` fica desligada com o campo ativo, porque a tensão da cadeia já é essa mola.

### 2.5 Fora do default

| item | motivo (medido) | destino |
|---|---|---|
| XPBD no contato | saltos de 54–59 px no drag; reversões até 0.64 | snap Manhattan no M11 |
| DOF.RAIL1 como restrição | o endpoint deixa de ser "atraído" | remover ou reservar a constante no M10 |
| reescrita SoA do World | compatibilidade 3/10; mudança big-bang | não fazer |
| 1 sub-passo + Jacobi | só medido no protótipo perf | experimento no M7 |
| Worker ESM | sem medição em navegador | M11, se a física passar de 8 ms/quadro |
| WASM | exige toolchain (ADR-0006) | M11, com ADR próprio |

## 3. Marcos

| id | marco | depende de | esforço |
|---|---|---|---|
| M0 | Núcleo saneado | — | M |
| M1 | Geometria exata e bancada comum | — | P |
| M2 | Containers como corpos | M0 | M |
| M3 | Campo de arestas isolado | M0, M1 | M |
| M4 | Integração atrás de flag | M3 | M |
| M5 | Assentamento e edição local | M4 | M |
| M6 | v2 como default de layout | M2, M5 | P |
| M7 | Orçamento de performance | M5 | M |
| M8 | Topologia adaptativa | M5 | M |
| M9 | Legibilidade de portas e paralelas | M2, M5 | M |
| M10 | Cutover e remoção do legado | M6, M7, M8, M9 | P |
| M11 | Pesquisa (opcional) | M10 | G |

M1 e M2 correm em paralelo com M0 e M3. M7, M8 e M9 são independentes entre si.

### M0 — Núcleo saneado
- **Entrega:** E1-01 (alpha decai até 0 e o teste usa `<=`); E1-02 (Ki = 0 por default); E1-05 (damping como taxa); E1-09 (velocityCap configurável: 8 com arestas, 32 sem); E1-18 (semente por hash do id, sem trigonometria por índice); E1-04 (porta de `seedPositions`/`seedAlpha` do v1); E1-08 (hook `onRemove` e handles nos consumidores); ctx reutilizado por sub-passo; filtro de classe POINT no central e na collision.
- **Aceite:** rAF falso emite 'end' em ≤ 600 frames na cena N=40 (v1: 481; hoje nunca). Planeio igual ±1% com 1, 2, 4 e 8 sub-passos (hoje 45.6 → 5.7 px). Anel de 6 corpos sob carga com KE < 1e-6 (hoje 3.7). vmax ≤ cap (hoje 368 px/tick). Ordem de declaração invertida desloca < 1 px (hoje 555). +1 nó desloca os existentes < 1 px após 1 tick (hoje 93). Slot reusado recebe força 0.34, não 8.30. Suíte unit verde.

### M1 — Geometria exata e bancada comum
- **Entrega:** `geometry.js` com os oráculos da xpbd. Bancada `bench/fase4/` derivada de `juiz-eng/cross.mjs`, com as métricas do juiz visual: mesma cena, modos `pinned` e `native`. Métricas: penetração alheia, próprio nó, cruzamentos contra retas porta→porta, portas coincidentes, giro, reversões tardias, ticks até quieto, ms/tick p50/p95, Hausdorff pós-edição e salto no drag. Baseline dos 3 protótipos registrada.
- **Aceite:** 4000 casos de propriedade com erro ≤ 5e-3 px e 0 falhas de translação mínima. A bancada reproduz `cross.jsonl` com métricas de qualidade idênticas e tempos em ±25%. Roda em ≤ 2 min de CPU.

### M2 — Containers como corpos
- **Entrega:** container com filhos vira corpo derivado (E1-03): AABB por tick com força distribuída aos filhos por massa, ou atrator-região mais corpo do frame (ADR-0010).
- **Aceite:** overlap container×container e peer×container = 0 após 1500 ticks (hoje 24.4 e 22 px, `bench/containers.mjs` da auditoria). Nenhum filho é repelido pelo próprio ancestral.

### M3 — Campo de arestas isolado
- **Entrega:** porta de `proposta-fiel/edges.mjs` para `chains.js`, `colliders.js` e `edge-field.js`, com F1–F6, guarda aditiva-normal, 2 sub-passos e cap 8. Semente reta entre portas do perímetro. Subdivisão fixa nseg = clamp(ceil(L/60), 2, 10). Máscaras em bitset e pad por elemento (E1-10, E1-11). Broad-phase de chaves ordenadas da fiel, provisório. Sem UI.
- **Aceite:** momento |ΣF|/Σ|F| < 1e-6; determinismo bit a bit; broad-phase = força bruta em 20/20 seeds. Corredor K=4/8/12 com 0 cruzamentos e 0 px de penetração. Nas 9 cenas A (N ≤ 100): penetração alheia ≤ 2 px, próprio nó = 0, overlap nó×nó = 0. diag100 pinned quieto em ≤ 200 ticks (fiel: 113). N=100/E=150 ≤ 3 ms/tick. perimeter-clamp, node-repulsion-layers, parallel-repulsion-layers, forces-layer-filter e phase3c reescritos contra a API nova e verdes.

### M4 — Integração atrás de flag
- **Entrega:** compile-world cria as cadeias e expõe `routedEdges`; `caps.providesRouting = true`; ramo do pipeline que pula o pós-processamento algébrico; `routing.engine: 'unified'` opt-in; `live.edges.*`; `connectivitySpring` desligada com o campo; modo 'frozen' mantém os corners livres. ADR de `providesRouting`, que emenda o ADR-0013.
- **Aceite:** teste de contrato com uma polilinha por aresta e pontas no perímetro (±0.5 px). Exemplo da DSL renderiza sem rota algébrica. Sem 'unified', a saída é idêntica à atual (snapshot). Unit e E2E (chromium e mobile-chromium) verdes pelo gate do AGENTS.md.

### M5 — Assentamento e edição local
- **Entrega:** alpha por corpo; ρEnd usa o alpha da aresta; sono por janela, wake adiado e força em cache; `tick()` devolve `false` e o rAF para. Diff por id na edição: só o novo nasce quente, e os vizinhos acordam por contato. Warm restart das cadeias por id. Drag em passos ≤ cap. O limitador de Jacobi nos nós entra só se a massa real não dormir.
- **Aceite:** com massa real (`invMass = 1 − maxWeight`, `compile-world.js:92`) e layout vivo, N40 e N100 dormem, com tick ocioso < 50 µs. Restart sem edição move < 1 px (hoje, fiel: 30 px médios). +1 nó e +2 arestas: arestas a > 600 px movem < 0.5 px pela Hausdorff da polilinha inteira, com pico de acordadas < 10%. Sono ≈ sem sono (|Δcruzamentos| ≤ 1%, |Δpenetração| ≤ 2 arestas). Sem sono, após 1500 ticks pinned, 0 corners acima de 0.05 px/tick. Drag de 600 px: arestas não incidentes saltam ≤ 15 px/quadro, e a penetração alheia é 0 após 400 ticks (nativo).

### M6 — v2 como default de layout
- **Entrega:** `live.engine` passa a 'v2' em release própria, com ADR e changelog.
- **Aceite:** no bench v1×v2 da auditoria, 'end' em ≤ 1.5x os ticks do v1; overlap padded máximo ≤ v1 + 0.5 px; containers com overlap 0; warm restart ≤ v1 + 1 px. A perda de `labelBBoxes` no v2 (E1-14) está resolvida ou aceita por escrito. Unit e E2E verdes nos dois projetos; deploy verificado pelo SHA.

### M7 — Orçamento de performance
- **Entrega:** laço sem closures nem alocação; manifold de 4 pontos no cápsula×cápsula; grid CSR em Int32 no lugar do sort (e do `spatial-grid.js` nos nós); cone de normais no endpoint na quina. Render incremental: referências dos `<path>` em cache, dirty list das arestas acordadas e `getBBox` só quando o label muda. Experimento: 1 sub-passo + Jacobi.
- **Aceite:** qualidade igual à do M5 na bancada (penetração, próprio nó e cruzamentos ±2%). 0 Scavenge em 100 ticks com `--trace-gc`. 150/225 ≤ 4 ms/tick e 500/1000 pinned ≤ 20 ms/tick (Node). Spec E2E opt-in no Chromium: 150/225 com main thread < 8 ms/quadro durante o assentamento e 0 quadros de física depois dele. O experimento só entra com 0 penetração pinned e 0 cruzamentos no corredor K ≤ 12.

### M8 — Topologia adaptativa
- **Entrega:** fissão acima de 1.25·Lmax; fusão por segmento curto ou colinear; cooldown de 40 ticks; hardSplitCap 3; histerese lmin = lmax/4; renormalização de rigidez (filhos com 2k, fusão em série). Roda só na fase topology. hard-fission, phase5-fission, phase5-fusion e fusion-manhattan-safety reescritos.
- **Aceite:** N=200/E=300 com penetração alheia ≤ 2 px (hoje 54 segmentos até 5.8 px). Em repouso, ≤ 1 mudança de topologia por aresta a cada 30 ticks. |ΔE| < 1e-6 num split colinear. Nenhum estado vaza entre slots reusados. Testes portados verdes.

### M9 — Legibilidade de portas e paralelas
- **Entrega:** offset perpendicular determinístico por `parallelKey` na semente (`src/dsl/ir.js:335`); espalhamento de endpoints na face (porta de `forces-endpoint-bbox.js`, clamp Q11); snap declarado no nó (`src/dsl/attr-set.js:61`) como atrator ao ponto de snap; desvio de containers não ancestrais; semente discreta de face (`src/routing/face-select.js:87`) como opção; midline fraca como opção A/B. endpoint-bbox-*, snap-selection e edge-central reescritos.
- **Aceite:** multi-aresta `[a,b,k]` com separação ≥ 10 px e 0 cruzamentos entre elas (juiz visual: 11–16 px). Portas coincidentes (< 4 px) ≤ 2 por cena N40. Com semente de face, cruzamentos ≤ 1.15x as retas porta→porta. Penetração em container não ancestral = 0. A midline só entra se o giro cair sem aumentar a penetração.

### M10 — Cutover e remoção do legado
- **Entrega:** apagar `src/routing/physics`; no pipeline, o import (`src/app/pipeline.js:23`), o `physicsState` (:168) e o ramo `engine === 'physics'` (:189-207); e os 6 testes estruturais. F-0017 removida. ADR-0012 supersede ADR-0009. ADRs novos aceitos; README atualizado.
- **Aceite:** grep sem import de `routing/physics`. Unit e E2E verdes nos dois projetos. Code review do diff. Deploy verificado pelo SHA (lição 5 do AGENTS.md).

### M11 (opcional) — Pesquisa
- **Entrega:** Worker ESM; WASM SIMD no narrow acima de ~1000 nós; feixes como atrator-path compartilhado; snap Manhattan por XPBD complacente no repouso; knob "ρ fixo" (modo vivo).
- **Aceite:** cada experimento no playground com métrica antes/depois e ADR próprio. Nada entra no default sem passar na bancada do M1.

## 4. Estratégia de testes

1. **Propriedades** (`node:test`, PRNG semeado, sem dependências): momento < 1e-6; broad-phase = força bruta; determinismo bit a bit e invariância à ordem de declaração; oráculos geométricos (xpbd); lei constitutiva (resíduo sob carga constante = F/k); fuzz sem NaN nem Inf sem velocityCap; invariância do damping a sub-passos.
2. **Cenas-contrato com limiar:** corredor K=4/8/12; cadeia atravessando nó pinado precisa sair; cenas mínimas de ciclo-limite da xpbd (corner entre duas zonas; segmento paralelo à face com nós pinados); término com rAF falso; sono ≈ sem sono; localidade por Hausdorff da polilinha inteira; restart sem edição; drag.
3. **Qualidade como snapshot** na bancada do M1: penetração, próprio nó, cruzamentos contra retas porta→porta, portas coincidentes e multi-arestas. Uma versão reduzida (N ≤ 40) entra no `node --test`.
4. **Legado como especificação**, triado pelos nomes de `describe`/`test` (não li os corpos):

   | destino | arquivos |
   |---|---|
   | portar no M3 | perimeter-clamp, node-repulsion-layers, parallel-repulsion-layers, forces-layer-filter, phase3c |
   | portar no M8 | hard-fission, phase5-fission, phase5-fusion, fusion-manhattan-safety |
   | portar no M9 | endpoint-bbox-bbox, endpoint-bbox-vs-segment, snap-selection, edge-central |
   | descartar no M10 | phase2, phase3, phase4, phase5-curved, phase5-trigger, scaffold |

   Os blocos de `perimeter-clamp` que testam `projectToPerimeter` cobrem `src/routing/anchor-utils.js`, que fica. Eles migram para um teste próprio desse helper.
5. **Performance opt-in**, fora do gate padrão: ms/tick em N=150 e N=500; 0 Scavenge com `--trace-gc` ou HeapProfiler < 5 KB/tick; spec de frame time no Chromium.
6. **Gate do AGENTS.md** em todo push: unit completo e Playwright nos projetos chromium e mobile-chromium, mais code review do diff.

## 5. O que remover e quando

| item | quando | condição |
|---|---|---|
| `src/routing/physics/` (9 arquivos, 1952 linhas) | M10 | M8 e M9 portaram fissão/fusão e espalhamento de portas |
| import, `physicsState` e ramo `engine === 'physics'` em `pipeline.js:23, 168, 189-207` | M10 | idem |
| 13 testes comportamentais do legado | M3, M8, M9 | cada um só sai depois do equivalente novo estar verde |
| 6 testes estruturais | M10 | nenhum |
| F-0017 no Manifest | M10 | junto com o código |
| `DOF.RAIL1` e `SHAPE.CAPSULE` (`world.js:29-33`) | M10 | remover ou marcar como reservados |

Ficam no repo: `anchor-utils.js`, `obstacle-route.js`, `face-select.js`, `crossings.js` e `snap-resolver.js`. Eles servem ao routing algébrico e à Fase 4.

## 6. Decisão pendente: v2 como default de layout

**Recomendação:** tornar o v2 default no M6, depois de M2 e M5 e antes do cutover M10, numa release própria.

- Os motivos do adiamento de junho ("calibração provisória") são defeitos medidos e corrigíveis: E1-01, E1-02, E1-04, E1-05 e E1-09 (M0) e E1-03 (M2).
- O campo de arestas só existe no v2. Deixar o v2 rodar como default antes de apagar o legado dá tempo de uso real ao layout isolado.
- Duas mudanças visíveis num push só impedem saber qual delas regrediu.
- Se o mantenedor preferir "junto com a virada", o custo é esse acoplamento. Nesse caso, M6 e M10 viram um marco só, com os critérios somados.

Depois do M10, com layout live v2, recomendo `routing.engine: 'unified'` como default. Com layouts `custom` e `off`, o algébrico continua. A decisão vai para o ADR de `providesRouting`.

## 7. Riscos e mitigação

| risco | evidência | mitigação | marco |
|---|---|---|---|
| cruzamentos topológicos não caem | fiel 3798 contra 3793 retas em grid500; +27% a +141% contra retas porta→porta na cena neutra | semente discreta de face; ADR-0012 registra a expectativa | M9 |
| densidade: a zona linear cede com N ≥ 200 | 54 segmentos até 5.8 px (N=200); 16 px e overlap de 38 px (N=500) | subdivisão adaptativa; K=8 opcional (+50% de custo) | M8 |
| custo da fiel | 54.4 ms/tick em 500/1000 pinned | enxertos do M7; teto declarado de 150/225 até lá | M7 |
| barreira finita: velocidade alta atravessa | cap 32 dá 20–48 cruzamentos no corredor | cap 8; drag em passos limitados | M0, M5 |
| enxertos da perf validados em ponto artificial | massa 20 e khome 0.5; com massa 1 nunca dorme (605/1000 acordadas) | critérios do M5 com massa real e layout vivo | M5 |
| sono congela o diagrama ("não respira") | janela de 1 px em 30 ticks | knob da janela; modo vivo como pesquisa | M5, M11 |
| heurísticas sem literatura | cap 8, kCross ≈ kRep, janela de 1 px, κ | testes de término, ciclo-limite e localidade no gate | M1, M5 |
| render SVG vira o gargalo | 5 querySelector e 10 setAttribute por aresta por quadro (`src/renderer/edges.js:1-55`) | render incremental e spec no Chromium | M7 |
| nós pinados prendem cadeias | após drag pinned, fiel mantém 2 arestas a 14.4 px (`juiz-visual/out/diag-drag.txt`) | cena de drag pinned na bancada; guarda mais rígida no núcleo (ideia zona + núcleo da xpbd como força) | M5, M8 |
| ρEnd = alpha muda o layout existente | nós conectados se aproximam enquanto quente; xpbd mediu 39–53 px | connectivitySpring desligada com arestas; ρEnd = 0 como modo compat | M4 |
| gap do endpoint de 2.4–7.8 px | fiel, cenas A | projeção cosmética no render; trilho exato só se o mantenedor exigir | M4 |
| determinismo entre navegadores | semente com sin/cos (`compile-world.js:88-90`) | semente por hash de id, sem trigonometria | M0 |
| formas não retangulares | só `rect` é renderizado; outras formas são stubs (`src/shapes/index.js:8-10`) | perímetro AABB por ora; SDF por forma quando o renderer suportar | fora da fase |
| medição só em Node | ruído de 10–24% entre execuções; nada em navegador ou mobile | spec opt-in no Chromium; mobile (F-0019) medido antes do M10 | M7 |

## 8. O que muda nos ADRs

| ADR | mudança | marco |
|---|---|---|
| ADR-0009 | `superseded_by: ADR-0012` | M10 |
| ADR-0010 | nota: endpoint → perímetro é atrator-path ancorado num corpo; a reação ρEnd = alpha é acoplamento estrutural declarado; a tensão substitui a connectivitySpring com arestas; midline fora do default | M4 |
| ADR-0011 | extensão, sem contradição: zona da cápsula por elemento (padE + rE); perfil linear sobre SDF amostrada (soma de K amostras); manifold de 4 pontos; guarda de núcleo aditiva e contínua; Ki = 0 confirmado no código | M3 |
| ADR-0012 | emenda: antídotos = 2 sub-passos + teto de velocidade + contato suave + sono; medido que a repulsão não desfaz cruzamentos topológicos; semente discreta de face permitida sem prescrever rota; passa a superseder o ADR-0009 | M3 e M10 |
| ADR-0013 | emendado por ADR novo: um layout adapter pode fornecer rotas (`providesRouting`) | M4 |
| ADR-0006 e ADR-0007 | sem mudança; zero dependências novas; knobs em `live.edges.*` | — |

ADRs novos (numeração a partir de 0014):

| ADR | título | marco |
|---|---|---|
| 0014 | Arestas como campo de cadeias de forças no World unificado | M3 |
| 0015 | Regra de passo das zonas lineares | M3 |
| 0016 | Assentamento por sono/wake e alpha local por corpo | M5 |
| 0017 | Layout adapter pode fornecer roteamento (emenda ADR-0013) | M4 |
| 0018 | Máscaras de colisão em bitset e massa × peso por camada | M3 |
| 0019 | v2 como default de layout | M6 |

A proposta vencedora não contraria o ADR-0011: mantém o perfil linear, sem integral e sem projeção. Se o experimento de 1 sub-passo com Jacobi (M7) for adotado, o ADR-0015 ganha emenda.

## 9. Perguntas ao mantenedor

1. ρEnd = alpha (nós conectados se aproximam enquanto o layout está quente) ou ρEnd = 0 (semântica da Fase 3)?
2. Em repouso, o diagrama pode ficar parado (sono), ou deve "respirar"?
3. O gap físico de 2.4–7.8 px no endpoint, coberto só no render, é aceitável?
4. Escala-alvo: 150/225 (alvo I2 do playground) ou 500/1000?
5. Depois do M10, `routing.engine: 'unified'` vira default com o live v2?

## Marcos (estruturado)

| Marco | Entrega | Critério de aceite | Depende de | Esforço |
|---|---|---|---|---|
| M0 · Núcleo saneado | Correções no v2: alpha até 0 com teste '<=' (E1-01), Ki=0 (E1-02), damping como taxa por dt (E1-05), velocityCap (8 com arestas, 32 sem; E1-09), semente por hash do id (E1-18), warm restart seedPositions/seedAlpha (E1-04), hook onRemove e handles {slot,gen} (E1-08), ctx reutilizado, filtro de classe POINT no central e na collision. | rAF falso emite 'end' em ≤600 frames (N=40); planeio ±1% com 1/2/4/8 sub-passos; anel de 6 com KE<1e-6; vmax ≤ cap; ordem invertida desloca <1 px; +1 nó desloca existentes <1 px após 1 tick; slot reusado sem estado herdado; suíte unit verde. | — | M |
| M1 · Geometria exata e bancada comum | src/physics/edges/geometry.js (segRect, segSeg, boxSdf sem alocação) com oráculos da xpbd; bancada bench/fase4/ derivada de juiz-eng/cross.mjs com métricas do juiz visual (pinned e native); baseline dos 3 protótipos. | 4000 casos de propriedade com erro ≤5e-3 px e 0 falhas; bancada reproduz cross.jsonl (qualidade idêntica, tempo ±25%); roda em ≤2 min de CPU. | — | P |
| M2 · Containers como corpos | Container com filhos vira corpo derivado (E1-03), por AABB por tick com força distribuída aos filhos ou por atrator-região + corpo do frame (ADR-0010). | Overlap container×container e peer×container = 0 após 1500 ticks (hoje 24.4 e 22 px); nenhum filho repelido pelo próprio ancestral. | M0 | M |
| M3 · Campo de arestas isolado | Porta da fiel (F1–F6, guarda aditiva-normal, 2 sub-passos, cap 8) para chains/colliders/edge-field; semente reta entre portas do perímetro; subdivisão fixa; máscaras bitset e pad por elemento (E1-10, E1-11); sem UI; 5 testes do legado reescritos. | Momento <1e-6; determinismo bit a bit; broad = força bruta 20/20; corredor K=4/8/12 com 0 cruzamentos; cenas A (N≤100): pen alheia ≤2 px, próprio nó 0, overlap nó×nó 0; diag100 pinned quieto ≤200 ticks; N=100/E=150 ≤3 ms/tick. | M0, M1 | M |
| M4 · Integração atrás de flag | compile-world cria cadeias e expõe routedEdges (Map); caps.providesRouting=true; pipeline pula applyObstacleRouting/clip/snap; routing.engine 'unified' opt-in; live.edges.*; connectivitySpring off com arestas; ADR providesRouting. | Contrato: uma polilinha por aresta, pontas no perímetro ±0.5 px; exemplo da DSL sem rota algébrica; sem 'unified' saída idêntica (snapshot); unit + E2E (chromium e mobile-chromium) verdes. | M3 | M |
| M5 · Assentamento e edição local | Alpha por corpo; ρEnd com alpha da aresta; sono por janela (1 px/30 ticks), wake adiado, força em cache; tick() → false; diff por id na edição; warm restart das cadeias; drag em passos ≤ cap; Jacobi nos nós só se necessário. | Com massa real e layout vivo, N40/N100 dormem e tick ocioso <50 µs; restart sem edição <1 px; edição local: arestas a >600 px <0.5 px (Hausdorff) e pico acordadas <10%; sono ≈ sem sono; sem sono 0 corners >0.05 px/tick após 1500 ticks; drag 600 px: salto ≤15 px/quadro e pen 0 após 400 ticks. | M4 | M |
| M6 · v2 como default de layout | live.engine passa a 'v2' em release própria, com ADR e changelog. | Bench v1×v2: 'end' ≤1.5x ticks do v1; overlap padded ≤ v1+0.5 px; containers 0; warm restart ≤ v1+1 px; E1-14 (labelBBoxes) resolvido ou aceito por escrito; unit + E2E verdes; deploy verificado pelo SHA. | M2, M5 | P |
| M7 · Orçamento de performance | Laço sem closures/alocação; manifold de 4 pontos no cápsula×cápsula; grid CSR Int32; cone de normais no endpoint; render incremental (paths em cache, dirty list, getBBox só com label mudado); experimento 1 sub-passo + Jacobi. | Qualidade = M5 (±2%); 0 Scavenge em 100 ticks; 150/225 ≤4 ms/tick e 500/1000 pinned ≤20 ms/tick (Node); Chromium opt-in: main thread <8 ms/quadro em 150/225 e 0 quadros de física assentado; experimento só com 0 pen pinned e 0 cruzamentos no corredor. | M5 | M |
| M8 · Topologia adaptativa | Fissão >1.25·Lmax, fusão curta/colinear, cooldown 40, hardSplitCap 3, histerese lmin=lmax/4, renormalização de rigidez; hard-fission, phase5-fission, phase5-fusion e fusion-manhattan-safety reescritos. | N=200/E=300 pen alheia ≤2 px (hoje 54 seg até 5.8 px); ≤1 mudança de topologia por aresta a cada 30 ticks em repouso; \|ΔE\|<1e-6 em split colinear; nenhum estado vaza entre slots; testes portados verdes. | M5 | M |
| M9 · Legibilidade de portas e paralelas | Offset por parallelKey na semente; espalhamento de endpoints na face (Q11 do legado); snap declarado no nó como atrator; desvio de containers não ancestrais; semente de face opcional; midline fraca A/B; endpoint-bbox-*, snap-selection e edge-central reescritos. | Multi-aresta [a,b,k] separada ≥10 px e 0 cruzamentos entre elas; portas coincidentes ≤2 por cena N40; com semente de face cruzamentos ≤1.15x retas porta→porta; pen em container não ancestral 0; midline só se giro cair sem aumentar pen. | M2, M5 | M |
| M10 · Cutover e remoção do legado | Apagar src/routing/physics, import/physicsState/ramo 'physics' do pipeline (pipeline.js:23, 168, 189-207) e 6 testes estruturais; F-0017 removida; ADR-0012 supersede ADR-0009; ADRs novos aceitos; README. | grep sem import de routing/physics; unit + E2E verdes nos dois projetos; code review do diff; deploy verificado pelo SHA. | M6, M7, M8, M9 | P |
| M11 · Pesquisa (opcional) | Worker ESM; WASM SIMD acima de ~1000 nós; feixes como atrator-path compartilhado; snap Manhattan por XPBD complacente no repouso; knob ρ fixo (modo vivo). | Cada experimento no playground com métrica antes/depois e ADR próprio; nada entra no default sem passar na bancada do M1. | M10 | G |
