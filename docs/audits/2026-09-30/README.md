# Avaliação multidimensional do Tensegrams (2026-09-30)

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito geral:** O Tensegrams entrega com disciplina, mas pesquisa pouco. Vale 2 de 5 como experimento e 1 de 5 como produto, a definição do objetivo recebe 1,5 de 5, e o repositório está parado há 96 dias (último commit 5bb9b8d, 2026-06-26; trilha estratégia). A entrega funciona: 797 testes unit verdes e deploy conferido no SHA 5bb9b8d. Mesmo assim, a suíte dá falsa segurança: a mutação mata 53,3% com 93,3% de linhas cobertas, e o v2 falha em 8 de 35 testes do contrato do v1 (trilha testes). O motor v2 tem defeitos que invalidam medições: o rAF nunca para (solver.js:42 × compile-world.js:240), o v2 ignora a semente (70,2 px por edição, mm-warm.out) e os containers colapsam (154 violações em syn:100). O '<=' só troca o loop eterno pelo cronograma de alpha (tick 481), que não é repouso. A hipótese central, a reciprocidade aresta→nó, nunca foi testada, e nenhuma trilha fez ablação. O '0 penetração em nó alheio' da proposta fiel vale só com nós fixos (invMass 0, com a reação desligada). Com layout vivo, ela não assenta no grid500: 80 ms/tick e 13 px de sobreposição entre nós (cross.jsonl). A novidade já está parcialmente coberta pelo vis-network e por Dwyer, Marriott e Wybrow (2008). O veredito GO/NO-GO deve vir antes de qualquer default e do cutover, e exige 5 P + 11 M de trabalho. Isso consome quase todo o timebox de 92 dias, que foi sugerido pelo avaliador e não pelo mantenedor.

## Síntese

O Tensegrams vale 2 de 5 como pesquisa, 1 de 5 como produto e 1,5 de 5 na definição do objetivo.

O repositório está parado há 96 dias. O motor v2 nunca para o rAF (`solver.js:42` × `compile-world.js:240`), ignora `seedPositions` e colapsa containers. A hipótese central nunca foi testada. O “0 penetração em nó alheio” da proposta fiel vale só com nós fixos (pinned). Nesse modo, a reação aresta→nó está desligada. Com layout vivo (native), a fiel não assenta no grid500: 80 ms/tick e 13 px de sobreposição entre nós.

### Roadmap

| id | item | impacto | esforço | horizonte |
|---|---|---|---|---|
| R01 | Carta de pesquisa: H1 por ablação, H2 em 100/150, H4 cinética | alto | P | agora |
| R02 | Motor v2 e Fase 4 na memória; reconciliar ADR-0010/0011 | alto | M | agora |
| R03 | `<=` no `end`: encerra o rAF, mas não é repouso | alto | P | agora |
| R04 | M0: `end` cinético, semente, cap, Ki, damping por dt | alto | M | agora |
| R05 | Borda robusta: crashes, Float32, ids, última IR válida | alto | M | agora |
| R06 | Harness `bench/` pinned/native, várias seeds, baselines dev | alto | M | agora |
| R07 | Testes: contrato v1×v2, pipeline real, PBT, sinal no E2E | alto | M | proximo |
| R08 | Cabo só-tração e `length`/`stiffness` por aresta | alto | P | proximo |
| R09 | LA-3: semente stress no cold start do live | alto | P | proximo |
| R10 | Containers compostos (LA-1/M2) e ADR de pesos | alto | M | proximo |
| R11 | Porte de paridade v1→v2, com waypoints e labels | alto | M | proximo |
| R12 | Algébrico: baseline corrigido e contrato com estado | alto | M | proximo |
| R13 | Remover o routing físico anterior, fora do caminho do veredito | medio | M | proximo |
| R14 | Fase 4, núcleo: M1, M3, M4 e I1 no motor real | alto | G | proximo |
| R15 | Fase 4: assentamento e edição local (M5) em native | alto | M | proximo |
| R16 | Ablação de H1: ρEnd 0 × α, mesma semente, várias seeds | alto | M | proximo |
| R17 | M7 (orçamento, Chromium) e M9 (semente de face) | alto | G | proximo |
| R18 | Veredito GO/NO-GO de H1–H4 em ADR | alto | M | proximo |
| R19 | v2 default de layout após o veredito, em release própria | medio | M | proximo |
| R20 | Em GO: cutover (M8, M10) e `unified` default | medio | M | proximo |
| R21 | Governança automatizada, CI por branch e higiene | medio | M | proximo |
| R22 | DSL e produto: schema único, editor, `custom` | medio | M | depois |
| R23 | Pesquisa exploratória: energia, modal, OVG, M11 | medio | G | depois |

O veredito (R18) vem antes de qualquer default e do cutover. O fecho de dependências do R18 soma 5 P + 11 M. Pela estimativa do revisor (P ≈ 1–2 dias, M ≈ 1 semana), são 12–13 semanas integrais.

### Conflitos entre trilhas

| tema | posições | resolução |
|---|---|---|
| Default v2 × Fase 4 | Layout e motor: entrega própria. Estratégia: o GO leva ao default | Release própria, depois do R18 e antes do cutover |
| Legado: antes ou depois | Routing: antes. Motor: no M10 | Fora do caminho do veredito; sai antes do cutover |
| Fissão e fusão no porte | Testes: descartar. Motor: reescrever no M8 | Portar a regra; a mecânica nova ganha testes |
| Critério de repouso | `<=` × `end` cinético × sono | `<=` só para o rAF; cinético no M0; sono no M5 |
| Termo integral (Ki) | ADR-0011: sem integral. Código: Ki 0,04 | Ki = 0 após medir a sobreposição residual |
| ρEnd | Motor: decisão do mantenedor | Variável experimental de H1 (R16) |
| Escala de H2 | 13,4 ms (spike ingênuo) × 4,17 ms (fiel native) | 100/150 native no Chromium |
| Cruzamentos na Fase 4 | Motor: nenhuma proposta reduz | A perf reduz 9,5–18,5%, com 5–176 arestas penetrando |
| Correções do algébrico | Síntese: depois. Crítico: antes do R06 | Depois do R06, que as mede; antes do R18 |
| DSL × produto congelado | DSL: 11 bugs e schema. Estratégia: congelar | Agora só crash e contaminação (R05) |

### Riscos

- **H1 sem evidência válida.** Cenas pinned não testam a reciprocidade. A semente domina: stress dá 427 cruzamentos, e o círculo, 685 (syn:100). Um GO pode vir da semente, não da tensegridade.
- **H1 depende da escala.** Em N=60, o cabo dá 105 contra 141 do d3-force (GO). Em N=120, dá 601 contra 326 (NO-GO). Os dois harnesses divergem no d3-force: 326 contra 463.
- **Novidade parcialmente coberta.** O vis-network já põe um nó de suporte por aresta na física. Dwyer, Marriott e Wybrow (2008) fazem layout interativo preservando topologia. O delta a demonstrar é DSL, mundo único e reciprocidade medida.
- **Layout vivo instável.** Em native, a fiel não assenta em diag100 nem em grid500. No grid500, os nós andam 1.191 px em média.
- **Medição frágil.** Tudo roda em Node, com ruído de 10–24% e uma seed por tamanho. Nada foi medido em navegador ou mobile.
- **O flip muda o routing.** O v1 produz `edgeWaypoints` e `labelBBoxes` (`live/index.js:504,185`); o v2, nenhum dos dois.
- **Paralisia.** São 96 dias parados e três migrações de metodologia em 23 dias. O timebox de 2026-12-31 é sugestão do avaliador. Ele deixa 92 dias para 12–13 semanas de trabalho integral.
- **Falsa segurança.** A mutação mata 53,3% com 93,3% de linhas cobertas. O CI roda só na main, sem proteção de branch.

### Decisões pendentes do mantenedor

1. Aprovar a carta: pergunta, H1–H4, limiares por escala e timebox sugerido pelo avaliador.
2. Confirmar a emenda do ADR-0012: planejador obstacle-aware só como semente por evento.
3. Repouso: “congelar” (proposto, WCAG 2.2.2) ou “respirar” como identidade.
4. Aceitar o gap físico de 2,4–7,8 px no endpoint, coberto só no render.
5. Escala de estresse além da H2: 150/225 ou 500/1.000.
6. Em NO-GO, arquivar ou pivotar; em GO, `routing.engine: unified` como default.

## Roadmap completo

| Id | Item | Trilhas | Impacto | Esforço | Horizonte | Depende de |
|---|---|---|---|---|---|---|
| R01 | Publicar a carta de pesquisa no README (seção 'Propósito e hipóteses', com trabalhos relacionados) e num ADR. H1: diferença pareada por ablação, com ρEnd 0 contra α, mesma semente, 5 ou mais seeds, N=60 e N=120, em modo native. H2: até 8 ms/tick em 100 nós/150 arestas, native, no Chromium. H3: deriva de até 5 px após editar e desfazer. H4: repouso cinético (max\|v\| < 0,1 px/tick por 30 ticks) em até 5 s. Incluir baselines dev-only e não-objetivos. O timebox 2026-12-31 vai marcado como sugestão do avaliador, sujeito à aprovação do mantenedor (decisão pendente nº 1) | estrategia, governanca, layout, motor | alto | P | agora | — |
| R02 | Registrar na memória o motor v2 e a Fase 4: F-0020 (motor v2) e F-0021 (Fase 4, planned). Versionar o plano M0–M11 a partir do rascunho da trilha motor. Pôr no UNRELEASED o próximo passo e a decisão pendente. Criar o ADR de reconciliação 0010/0011 e exportar os vereditos do playground. Corrigir o drift do Manifest (F-0001 runPipeline, F-0002 v1/v2, F-0005 pesos, F-0016 side). Congelar a versão do feat-memory até o fim da Fase 4 | governanca, estrategia, motor, routing, layout | alto | M | agora | R01 |
| R03 | Hotfix do término do v2: trocar '<' por '<=' em compile-world.js:240/244 para encerrar o rAF. Criar um teste com corpo livre que distinga 'end' do cronograma de alpha. O helper runUntilSettled passa a importar o alphaMin do produto | testes, estrategia, layout, routing, motor | alto | P | agora | — |
| R04 | Fechar o M0 do motor: - 'end' por critério cinético (max\|v\| < ε por N ticks, alpha só como teto), com KE exposta na sessão; - honrar seedPositions/seedAlpha, com o nó novo no centróide dos vizinhos; - velocityCap: 8 com arestas, 32 sem; - Ki = 0, validado no harness (R06) antes de virar default; - damping como taxa por dt; - semente por hash do id; - handles {slot,gen}; - warmKick separado do alphaKick no v1. | motor, estrategia, layout, testes | alto | M | agora | R03 |
| R05 | Borda robusta do pipeline: - parse e buildIR nunca lançam (alias, alias circular, {toString:1}); - o destacador aceita U+2028/U+2029; - coordenadas limitadas ao Float32; - ids escapados no renderer (CSS.escape em ensure-el.js; id com quebra de linha lança SyntaxError a cada paint); - live.engine no config-schema e config validada; - última IR válida mantida em erro YAML; - warnings visíveis, com linha. | dsl, governanca | alto | M | agora | — |
| R06 | Versionar o harness de avaliação em bench/ (Node, seeds múltiplas): - modos sempre rotulados: pinned (nós fixos, só routing, reação aresta→nó desligada por construção) e native (layout vivo); - cenários syn, allcollide, desalinhado, pins e os N=60/N=120 da carta; - métricas de layout: violações, contenção, Δwarm, repouso cinético; - métricas de routing: salto > 20 px, X, E×N contra baseline reamostrado; - métricas de motor: ms/tick p50/p95, energia; - baselines d3-force, WebCoLa e ELK como devDependencies; - os dois harnesses de cruzamento reconciliados; - subset rápido no node --test. | estrategia, layout, routing, motor, testes | alto | M | agora | R01, R03 |
| R07 | Camada de testes do motor e do adapter: - suíte de contrato do live parametrizada por engine (v1, v2), com skips justificados; - createPipeline real com dom-mock, no lugar da cópia de integration.test.js; - propriedades metamórficas com fast-check (dev); - limiares com oráculo analítico (resíduo P = PULL/Kp = 6,667, hoje só 'residualP > 1' em collision.test.js:76); - sinal de convergência em window para o E2E, trocando os 49 waitForTimeout por expect.poll. | testes, layout, motor | alto | M | proximo | R03, R04 |
| R08 | Experimento barato antes das arestas-corpo: cabo só-tração com protensão (live.edgeModel: cable, prestress) e length/stiffness por aresta. Medir no harness em native, com seeds múltiplas, em N=60 e N=120, e repetir com containers compostos | estrategia, layout | alto | P | proximo | R04, R06 |
| R09 | LA-3: semente por stress no cold start do live/v2, com BFS ou pivot-MDS no lugar do APSP O(N³). Incluir um gate de aspecto em cadeias e deixar o custom de fora por ora. A semente entra como fator controlado da ablação de H1 (R16) | layout, estrategia | alto | P | proximo | R04, R06 |
| R10 | Containers como corpos compostos no v2 (LA-1 = M2): atrator-região e gating por cobertura das unidades do LCA. Unificar a geometria de container numa função bottom-up. Registrar o ADR da semântica de pesos de nodeLayers | layout, motor, governanca | alto | M | proximo | R04, R06 |
| R11 | Porte de paridade v1→v2: tag forces, constraints (getParentRect com lag de 1 tick), update/frozen, pesos, velocityCap, pin snap-back, kill-switch e folha dentro de container. Decidir explicitamente edgeWaypoints e labelBBoxes (virar semente da Fase 4 ou sair), com snapshot de rotas antes e depois | layout, testes, motor, routing | alto | M | proximo | R07, R10 |
| R12 | Routing algébrico como baseline e contrato: - correções P: pernas para dentro, gatilho pela corda, clipAnchors, curved degenerado e DUP_TOL de anchor-utils.js:290; - desempate estável e histerese no obstacle-route; - extrair runRoutingStage; - adapter com providesRouting e routedEdges; - routers com route(..., prevState) e load() assíncrono; - fonte única de configuração de routing. | routing, testes, motor, governanca | alto | M | proximo | R06 |
| R13 | Remover o routing físico anterior, fora do caminho do veredito: - extrair snap-resolver, trilho e espalhamento de portas para um módulo neutro; - inventariar por regra (~35 testes de domínio em 13 arquivos comportamentais) e portar como contrato engine-agnóstico; - descartar a mecânica de fissão/fusão/cooldown do legado, portando só a regra de não penetração (hard-fission.test.js:53-84); - E2E 14/18/19 viram cenários do harness, com a baseline gravada; - avisar e remover as chaves órfãs da DSL; - concluir antes do cutover (R20). | routing, motor, testes, dsl, governanca | medio | M | proximo | R06, R07, R12 |
| R14 | Fase 4, núcleo (M1 + M3 + M4): - geometria exata com os oráculos da xpbd; - cadeias da proposta fiel (F1–F6, 2 sub-passos, cap 8), semeadas nas portas do perímetro; - ρEnd como knob (0, α, fixo); - integração atrás de routing.engine: unified; - I1 portado para o motor real; - aceite medido em pinned e em native. | motor, routing, estrategia | alto | G | proximo | R04, R06, R12 |
| R15 | Fase 4, assentamento (M5): alpha por corpo até 0, sono por janela (1 px em 30 ticks), wake adiado, tick() → false, diff por id na edição e drag em passos ≤ cap. O aceite usa massa real e layout vivo (native), incluindo a localidade da edição sem a âncora khome | motor, layout, routing, estrategia | alto | M | proximo | R14 |
| R16 | Ablação de H1 em native: - reação do endpoint ρEnd = 0 contra α (e 'fixo'); - mesma semente (stress e círculo), 5 ou mais seeds, N=60 e N=120; - mola contra cabo; - cruzamentos contra as retas nas mesmas posições e contra os baselines; - resultado como diferença pareada, com intervalo. | estrategia, motor, layout | alto | M | proximo | R09, R15 |
| R17 | Fase 4 antes do veredito: - M7: manifold de 4 pontos, grid CSR, laço sem alocação, render incremental e spec opt-in no Chromium para H2 em 100/150; - M9: offset por parallelKey, espalhamento de portas, semente discreta de face e desvio de containers não ancestrais. | motor, routing | alto | G | proximo | R10, R15 |
| R18 | Veredito GO/NO-GO de H1–H4 registrado em ADR, com script, seeds e saída versionados. Vem antes de qualquer default (R19) e do cutover (R20). NO-GO também é resultado | estrategia, motor | alto | M | proximo | R08, R12, R16, R17 |
| R19 | v2 como default de layout em release própria, depois do veredito e antes do cutover, com o v1 por flag durante um ciclo. Gates: - repouso cinético finito; - violações ≤ v1 e contenção 0 em 16 cenários; - reaquecimento ≤ v1; - paridade do R11; - menos de 16 ms/tick com 300 nós; - coordenadas no Float32 (R05); - E2E com engine v2, usando o sinal de convergência; - edgeWaypoints e labelBBoxes decididos, com snapshot de rotas. Em NO-GO, reavaliar só pelos gates de layout. | layout, motor, testes, dsl | medio | M | proximo | R05, R11, R18 |
| R20 | Em GO, cutover da Fase 4: - M8: fissão/fusão, com testes próprios; - M10: routing.engine: unified como default com live v2; - remoção do v1 de layout após um ciclo; - F-0017 fora, ADRs aceitos e README atualizado. Em NO-GO, o algébrico permanece e o mantenedor decide arquivar ou pivotar. | motor, routing, layout, estrategia | medio | M | proximo | R13, R18, R19 |
| R21 | Governança e CI: - tests/governance/manifest.test.js; - CI em branch e PR, deploy só na main e branch protection; - job pós-deploy que verifica o SHA e roda um smoke do dist/; - failOnFlakyTests; - permissões por job e dependabot; - cobertura com exclusões e detecção de módulo sem import. Higiene: - LICENSE e license no package.json; - telemetria desligada; - release = SHA do deploy; - merge=ours fora do UNRELEASED; - frontmatter do AGENTS.md corrigido e skills em .claude/skills. | governanca, testes, dsl | medio | M | proximo | R02 |
| R22 | Evolução da DSL e do produto: D1 (AST + schema único + options.format), patch P do editor, chave canônica estruturada, Set para paralelas, ciclo de parent, pós-passo iterado do custom e semente por hash. CM6 só se o alvo passar de 1.000 nós | dsl, layout, routing, estrategia | medio | M | depois | R05, R18 |
| R23 | Pesquisa exploratória pós-veredito: raio-X de tensão/compressão, energia como observável, análise modal, SVG animado (SMIL) como figura, OVG como semente por evento, e Worker e XPBD só para o snap Manhattan (M11) | estrategia, motor, routing | medio | G | depois | R17, R18 |

## Conflitos entre trilhas

- **v2 como default de layout: antes ou depois do veredito, junto ou separado da Fase 4.** Estratégia (carta): em GO, o v2 vira default junto com a saída do legado. Governança (ADR-0014 candidato): o default é decidido junto, com critério explícito. Layout: nem agora nem junto com a Fase 4; entrega própria após 6 gates. Motor: marco M6 próprio, após M2 e M5 e antes do cutover M10. Testes: só com o contrato v1×v2 verde (hoje falham 8 de 35). Síntese anterior: flip desacoplado de H1 e anterior ao veredito. Crítico: o GO vem antes do default. **Resolução:** Release própria (R19), depois do veredito (R18) e antes do cutover (R20).
- Os experimentos rodam com live.engine: v2 por flag, então nada exige o default antes do veredito, e a carta congela produto até H1–H3.
- A ordem respeita o motor (M6 após M5) e a separação que layout e motor pedem.
- O argumento de bisect vale só em parte. O próprio flip troca o routing: some o A* por tick via edgeWaypoints (live/index.js:504 → pipeline.js:215) e some a colisão de label (E1-14). Por isso entram os gates de waypoints/labels, Float32 e E2E com sinal de convergência, e o esforço sobe para M.
- 'O v2 com LA-1 já vence o v1' não sustenta o flip sozinho. O LA-1 é spike fora do repo, sem paridade, e só a regra de cobertura passa nos cenários allcollide.
- Em NO-GO, o flip é reavaliado apenas pelos gates de layout.
- **Remover o routing físico anterior: antes, durante ou depois da Fase 4.** Routing: antes da Fase 4, após extrair portas e trilho. Motor: no M10, portando os 13 arquivos comportamentais em M3/M8/M9. Testes: só depois de o contrato por engine passar nos dois. Síntese anterior: antes do M4. **Resolução:** Fora do caminho do veredito (R13). O legado sai assim que as regras estiverem portadas e a baseline estiver gravada no harness, e precisa estar fora antes do cutover (R20).
- Isto muda a síntese anterior. 'Antes do M4' punha R07 e R13 (~2 M) no fecho do R18 sem medir nenhuma hipótese. O legado é opt-in e não contamina as medições.
- O pipeline comporta os ramos 'physics' e 'unified' durante M4–M9, como no plano do motor.
- O inventário é por regra (~35 testes de domínio em 13 arquivos), não por arquivo.
- **Fissão e fusão no porte dos testes do legado.** Testes: descartar a mecânica de fissão, fusão e cooldown e os hooks de warmStart. Motor: reescrever hard-fission, phase5-fission, phase5-fusion e fusion-manhattan-safety no M8. **Resolução:** Portar a regra, não a mecânica.
- A regra de domínio 'nenhuma penetração em nó alheio' (hard-fission.test.js:53-84; e2e/18:46-93) vira contrato engine-agnóstico.
- Os testes da mecânica do legado são descartados.
- A subdivisão adaptativa nova do M8 ganha testes próprios, a partir do aceite do motor: no máximo 1 mudança de topologia por aresta a cada 30 ticks em repouso e |ΔE| < 1e-6 num split colinear.
- **XPBD × ADR-0011 (contato por projeção).** Auditoria do motor (E1-16): híbrido com XPBD para estrutura e contato. Estratégia: RQ4 aberta (P, PI ou XPBD; cenários C3/B1 do playground). ADR-0011:34-35: projeção fora do default. Juízes do motor: XPBD rejeitado (saltos de 54–59 px no drag, reversões até 0,64; não assenta com nós fixos). **Resolução:** O XPBD fica fora do default, coerente com o ADR-0011 e com a medição dos dois juízes. A RQ4 fecha para o default com P puro. O XPBD fica como pesquisa no M11 (snap Manhattan em repouso). Só se reabre com medição nova na bancada comum do M1.
- **Termo integral do controlador de colisão (Ki).** Governança: o ADR-0011 exclui o integral, mas o código liga Ki 0,04 (compile-world.js:42); o mantenedor escolhe o lado. Estratégia/futuro: zerar alpha perderia o integral que fecha o overlap residual. Advogado da estratégia: o PI entra em ciclo-limite (20,48–24,98 px). Motor: Ki = 0 no M0. Crítico: ninguém mediu a sobreposição residual com Ki = 0. **Resolução:** Ki = 0 como default proposto, alinhando o código ao ADR-0011 por um ADR novo, sem editar no lugar (METHODOLOGY:86).
- A objeção ao Ki = 0 é real. O P puro tem resíduo analítico PULL/Kp = 2,0/0,3 = 6,667 px na cena de teste (tests/physics/collision.test.js:63,76, que hoje só exige 'residualP > 1'). Ninguém mediu a sobreposição com Ki = 0, composite e mola ou cabo puxando.
- Por isso a mudança fica condicionada a medir no harness (R06): contenção 0 e sobreposição ≤ v1 + 0,5 px.
- A favor do Ki = 0: KE 3,7 perpétuo com Ki, contra 3,8e-12 com P puro (motor), e o ciclo-limite medido (estratégia).
- O PI fica como knob.
- **Onde mora o routing da Fase 4 e quando superseder o ADR-0009.** Routing: contrato de router com estado (route com prevState, load assíncrono) e supersessão do ADR-0009 já. Motor e governança: o layout adapter fornece as rotas (providesRouting/routedEdges), e o ADR-0012 supersede o 0009 no M10. **Resolução:** As duas coisas coexistem. O campo de arestas mora no adapter via providesRouting, porque a reciprocidade aresta→nó exige o mesmo World. O contrato com estado serve ao algébrico e às sementes (OVG) sob custom/off. O ADR-0009 é superseded na remoção do legado (R13), pois seu texto já diverge do código (pipeline.js:187-208).
- **Critério de repouso do v2.** Testes e estratégia: '<=' já, com teste de corpo livre; depois KE < ε e ‖F‖ < δ por N ticks. Layout: 'end' cinético (263–613 ticks no spike). Motor: alpha por corpo até 0 e sono por janela de 1 px em 30 ticks. Síntese anterior: o '<=' destrava H4. **Resolução:** Três passos, com papéis distintos.
- O '<=' (R03) só encerra o rAF. O tick 481 é o cronograma de alpha: ln(0,003)/ln(0,988) = 481,2 (compile-world.js:46-47), idêntico em quad e containers (end-fix.out). Com Ki 0,04, o loop para com corpos em movimento.
- O 'end' cinético entra no M0 (R04) e é o critério de H4: max|v| < ε por N ticks, como o quietTick do cross.mjs (v < 0,1 por 30 ticks).
- O sono por corpo do M5 (R15) é o critério final.
- Um teste precisa distinguir 'end' de cronograma: mudar o alphaDecay não pode fazer uma cena ainda em movimento passar em H4.
- **Cerimônia do feat-memory: cortar ou ampliar.** Governança: cortar telemetria, tags, merge=ours e migrações, mas criar F-0020/F-0021, ADRs e teste de governança. Testes, layout, routing e motor: cerca de 10 regras e gates novos no AGENTS.md (cobertura, mutação, harness, alocação, bancada, helpers). **Resolução:** Cortar a cerimônia de time e manter o núcleo (UNRELEASED, Manifest, ADRs), que foi o que permitiu esta avaliação. Sempre que possível, as regras viram checagens automáticas (R21). O AGENTS.md ganha no máximo 3 regras: evidência reproduzível, gate de engine (contrato + bancada) e feature planned antes do código. Mutação e alocação ficam opt-in, no fechamento de fase.
- **Investir na DSL agora × congelar produto.** DSL: 11 bugs P, adoção do D1 (schema único) e spike de CodeMirror 6. Estratégia: congelar produto até H1–H3; a exceção é só o SVG como figura. **Resolução:** Agora, só o que derruba o app ou contamina a medição (R05): live.engine no schema, Float32 e ids escapados no renderer, porque o id com quebra de linha lança SyntaxError a cada paint (ensure-el.js:24-26). D1, patch do editor e CM6 vão para depois (R22). A carta de pesquisa é o critério de corte.
- **Mola de conectividade: evoluir para cabo já ou esperar a Fase 4.** Estratégia/futuro: cabo só-tração com protensão atrás de live.edgeModel já (775 → 601 cruzamentos). Motor: a connectivitySpring desliga quando o campo de arestas liga, pois F1 (repouso 0) já é a mola. Layout: mola içada e folha empataram; a coesão do container domina a força de aresta. **Resolução:** Rodar o cabo e o length/stiffness por aresta como experimento no harness (R08), não como default de produto. O resultado calibra o kChain e dá o primeiro número de H1 antes do custo G da Fase 4. O experimento se repete com containers compostos (R10), porque a coesão domina a força de aresta.
- **Warm start: âncora, semente ou alpha local, e números que parecem divergir.** Layout: a âncora tem o melhor Δwarm (0,3 px), mas congela a topologia (razão 1,00); warmKick 0,05 no v1 (76 → 10,4 px). Estratégia: seedPositions + nó novo no centróide (70,2 → 27,7 px). Motor: alpha por corpo e diff por id (0–0,71 px nas arestas distantes). Crítico: 70,2, 93, 150–250 e 208 px sem reconciliação. **Resolução:** Semente agora (R04), alpha local no M5 (R15) e âncora só em spike: uma âncora com razão 1,00 anula a resposta topológica que a H1 quer medir. Os números não se contradizem, porque medem coisas diferentes:
- 70,2 px: deslocamento médio final após +1 nó e +1 aresta, em 5 grafos com n=20 (mm-warm.out);
- 93 px: deslocamento após 1 tick com +1 nó; são 50 px após 600 ticks (E1-04);
- 155–212 px: pico do reaquecimento da mesma IR, sem edição, em 4 exemplos (L1-03);
- 208 px: média de 7 medições (spike-v2-warmstart.out.txt).
O harness (R06) fixa uma métrica por hipótese: para H3, a deriva após editar e desfazer.
- **Cruzamentos na Fase 4 e evidência de H1: pinned × native.** Motor: 'nenhuma proposta reduz cruzamentos topológicos' (fiel 3.798 contra 3.793 retas). Síntese anterior: 'a fiel dá 0 penetração até 500/1.000' como notícia boa. Crítico: pinned tem a reciprocidade desligada, e a perf reduz os cruzamentos. **Resolução:** Confirmado em cross.jsonl.
- A perf reduz cruzamentos contra as retas nas mesmas posições, de −9,5% a −18,5%: 81 × 95 (diag100 pinned), 185 × 227 (diag200 pinned), 3.374 × 3.793 (grid500 pinned), 86 × 95 (diag100 native) e 3.305 × 3.662 (grid500 native). Em troca, deixa de 5 a 176 arestas penetrando nós: há um trade-off cruzamento × penetração.
- O modo pinned fixa os nós (invMass 0, cross.mjs:56,66) e só informa sobre o routing.
- Em native, a fiel fica em 95 × 99 no diag100, sem assentar (vEnd 0,32). No grid500 fica em 3.784 × 3.748, com 80 ms/tick, vEnd 8,5, 13 px de sobreposição entre nós e 1.191 px de deslocamento médio.
- H1 só se decide pela ablação em native (R16).
- **Escala de H2 e dos alvos de desempenho.** Estratégia (carta): H2 ≤ 8 ms/tick em 100 nós + 150 arestas × 6 corners, com 'hoje 13,4' (scale2.out). Motor: a fiel mede 2,14 ms (pinned) e 4,17 ms (native) em 100/150; alvos do M7 em 150/225 e 500/1.000. Layout: < 16 ms/tick com 300 nós. **Resolução:** H2 fica em 100/150, no modo native, medida no Chromium (spec do M7), porque é a escala da carta e do cenário I2.
- Os 13,4 ms vêm de um spike ingênuo no World atual: cantos como corpos genéricos com colisão PI, posições aleatórias e alpha constante (scale2.mjs).
- Os 2,14/4,17 ms são do protótipo fiel em Node, com cenas pré-relaxadas.
- As demais escalas viram metas de estresse: 150/225 (M7), 300 nós (gate do flip) e 500/1.000 (pergunta ao mantenedor).
- **ρEnd: decisão do mantenedor ou variável experimental.** Motor: pergunta 1 ao mantenedor (ρEnd = alpha ou 0). Juiz visual do motor: expor ρ como knob (0, α, fixo). Crítico: variável experimental de H1. **Resolução:** Variável experimental. ρEnd é exatamente o que liga a reciprocidade aresta→nó. A ablação (R16) compara 0 contra α, com a mesma semente e várias seeds. O default sai do resultado, e ρEnd = 0 fica como modo compatível. O tema sai da lista de decisões do mantenedor.
- **Em repouso: respirar ou congelar.** Estratégia: 'congelar' é o default, 'respirar' é opção, e prefers-reduced-motion pinta o estado final (WCAG 2.2.2). ADR-0012: movimento orgânico e vivo é identidade. Motor: pergunta 2 ao mantenedor e risco de que 'o sono congela o diagrama'. Síntese anterior: decidia 'congelar' no ADR e listava o tema como pendente. **Resolução:** O ADR de repouso propõe 'congelar' como default e 'respirar' como knob de pesquisa. Ele fica proposed até o mantenedor confirmar (decisão pendente nº 3). Assim, o ADR e a lista de pendências dizem o mesmo.
- **Correções do baseline algébrico: quando (discordância parcial com o crítico).** Routing: prioridade 4, com impacto alto, logo depois do harness (prioridade 3). Síntese anterior: depois (R19 antigo). Crítico: antes do R06 e do R17. **Resolução:** Discordo em parte do crítico. As correções saem do horizonte 'depois' e entram no R12, antes do veredito (R18), porque o algébrico é o baseline layout→routing de H1. Mas vêm depois do harness (R06), como na ordem da própria trilha routing. É o harness que mede o ganho (clipAnchors=false: de 10 para 2 frames com salto) e grava a baseline antes e depois.
- **Tabela consolidada de alternativas (discordância de formato com o crítico).** Crítico: as 22 propostas (LA-1..7, RA-1..7, D1..D5 e as 3 do motor) e os 36 grupos de ideias deveriam ir numa tabela única, com proposta, decisão, evidência e trilha. **Resolução:** Discordo no formato, não no conteúdo. A tabela não cabe num report de até 1.100 palavras. As decisões por proposta, com evidência, já estão nos relatórios das trilhas DSL, layout, routing e motor. A síntese traz as que mudam o roadmap:
- LA-1 (R10), LA-3 (R09) e LA-4 só como oráculo (R06);
- RA-1 (ADR das cadeias) e RA-3 (R23);
- D1 e a rejeição de D3 e D5 (R22);
- a fiel e seus enxertos (R14, R17);
- o item 10 do brainstorming (R08);
- a emenda ao ADR-0003, como ADR candidata nova.
As rejeições de bibliotecas ficam na ADR de dependências dev-only.

## Crítico de completude

O crítico revisou a primeira versão da síntese; as correções abaixo já foram aplicadas por um agente revisor na síntese apresentada acima.

A síntese cobre as 7 trilhas com evidência densa, e as alegações centrais que conferi se sustentam: solver.js:42 × compile-world.js:240, o helper com 0,005 em compile-world.test.js:11, 0 ocorrências de 'seed', grep de pesquisa = 0, 1.952 linhas e 19 arquivos de teste no legado, e 775/326/601 em exp3.out e cable-h1.out. Ela tem, porém, três falhas de fundo.

1. O '<=' do R03 não "destrava H4". O 'end' no tick 481 é o próprio cronograma de alpha: ln(0,003)/ln(0,988) = 481,2 (compile-world.js:46-47; end-fix.out dá 481 em quad e em containers). Não é repouso físico.
2. Ela usa cenas com nós fixos, onde a reciprocidade está desligada por construção, como evidência sobre H1. E omite os números com nós livres: no grid500 native a fiel nunca assenta, tem 5 arestas penetrando nós, 13 px de sobreposição entre nós e 80 ms/tick (cross.jsonl). A frase "nenhuma proposta reduz cruzamentos" é falsa para a perf.
3. O veredito GO/NO-GO (R17) depende do cutover (R16/M10). Isso inverte a carta, em que o GO é que leva ao default.

Há ainda omissões concretas:
- a semente stress LA-3, adotada pela trilha layout;
- a perda de edgeWaypoints e labelBBoxes quando o default vira v2;
- o trabalho de paridade sem dono;
- as correções do baseline algébrico adiadas para depois do veredito;
- a E2E sem sinal de convergência;
- a viabilidade do timebox, que foi sugerido pelo avaliador, não pelo mantenedor.

Dimensões rasas: valor (sem as notas de produto 1/5 e de objetivo 1,5/5 e sem risco de novidade), alternativas e brainstorming (22 propostas e 36 grupos de ideias sem tabela consolidada), E2E e segurança.

### Lacunas

- **H1 sem ablação: não isola a reciprocidade aresta→nó.** H1 compara contra baselines externos (d3-force 326), não contra o próprio motor sem reação. A trilha layout mediu que a semente domina: stress 427 contra 685 em círculo (syn:100), e a mola acrescenta pouco (356–464 com mola contra 386–480 sem). Um GO pode vir da semente ou da coesão de container, não da tensegridade. Como fechar: Definir H1 como diferença pareada, com e sem reação do endpoint (ρEnd 0 contra α), com a mesma semente e várias seeds. Tirar ρEnd da lista de 'decisões do mantenedor' e tratá-lo como variável experimental; o knob já está proposto pelo juiz visual do motor.
- **LA-3 (semente stress no cold start do live) sumiu do roadmap.** A trilha layout a adotou como 'principal fonte de ganho topológico medida' (427 contra 685 cruzamentos em syn:100; 5.034 contra 7.268 em syn:300). É a alavanca de H1 com melhor evidência, e a síntese aposta só na 'semente de face do M9'. Como fechar: Incluir no R10 ou num item próprio 'próximo', trocando o APSP O(N³) por BFS ou pivot-MDS e medindo no harness do R06 junto com o cabo (R09).
- **Tornar o v2 default muda o routing em silêncio.** O v1 produz edgeWaypoints (live/index.js:504) e labelBBoxes (live/index.js:185), consumidos em pipeline.js:215. O compile-world não produz nenhum dos dois (0 ocorrências de labelBBox; motor E1-14; routing R1-12). O gate do M6 do motor incluía o E1-14, e a síntese o descartou. Isso invalida o argumento de 'bisect' do R11. Como fechar: Acrescentar um 7º gate ao R11: decisão explícita sobre o canal edgeWaypoints (virar semente da Fase 4 ou sair) e sobre a colisão de label no v2, com snapshot de rotas antes e depois.
- **Paridade v1→v2 sem item de trabalho.** O R11 exige paridade de tag forces, constraints, update/frozen e pesos, mas nenhum item faz o porte (layout rec. 6, alto/M). Pin snap-back e kill-switch (falhas do 8/35, trilha testes) também ficam sem dono. O R11 está com esforço P; a trilha layout diz M. Como fechar: Criar um item 'porte de paridade para o v2' dependente do R10 e mudar o R11 para M.
- **E2E: sinal de convergência, flakiness e dist/.** Há 49 waitForTimeout, retries:1 sem failOnFlakyTests e 0 specs com engine v2 (testes rec. 10). O E2E testa a raiz, não o dist/ (G2-06, playwright.config.js:31). O gate do R11 'E2E com engine v2' não é confiável sem um sinal de 'settled' em window. Como fechar: Pôr no R08 ou no R18: expor um sinal de convergência, trocar os sleeps por expect.poll, ativar failOnFlakyTests e rodar um smoke do dist/ no CI.
- **Viabilidade do timebox e aprovação da carta.** São 3 itens G e cerca de 9 M para um mantenedor solo parado há 96 dias, num timebox de 92 dias sem estimativa. A trilha estratégia escreveu 'timebox sugerido por mim, não pelo mantenedor'. A aprovação da carta (H1–H4, limiares, timebox) não aparece entre as decisões pendentes. Como fechar: Colocar 'aprovar carta, limiares e timebox' como decisão pendente nº 1. Definir o caminho mínimo até o veredito (R03, M0, harness, R09/LA-3 e M3–M5 com medição native) e estimá-lo.
- **Valor: notas e risco de novidade.** O mantenedor pediu valor e definição do objetivo. A síntese dá só a nota de pesquisa (2/5) e omite produto 1/5 e objetivo 1,5/5. Também não registra que o vis-network já põe um 'invisible support node' por aresta na física, nem o trabalho de Dwyer, Marriott e Wybrow (2008), ambos citados pela trilha estratégia. Isso reduz a novidade alegada da Fase 4. Como fechar: Incluir as três notas e um risco de 'novidade parcialmente coberta', declarando o delta a demonstrar (DSL, mundo único e reciprocidade medida).
- **Alternativas e brainstorming sem visão consolidada.** As 22 propostas (LA-1..7, RA-1..7, D1..D5 e as 3 do motor) e os 36 grupos de ideias aparecem em fragmentos. Sumiram o #10 do top 10 (length/stiffness por aresta, esforço P, pré-requisito de H1 com semântica; compile-world.js:141), a emenda ao ADR-0003 (chave canônica e auto-laço) e a rejeição de D3 e D5. Como fechar: Uma tabela única proposta → decisão → evidência decisiva → trilha, e o #10 no R09.
- **Segurança e supply chain.** pages:write e id-token:write valem para jobs que rodam npm ci, e não há dependabot (governança rec. 11, G2-08). Um id com \n lança SyntaxError em todo paint (DSL rec. 9; ensure-el.js:11,24-26): é um crash, e ficou fora do R05. Como fechar: Incluir o escape de ids no R05 e as permissões por job e o dependabot no R18.
- **Conflito não listado: fissão e fusão no porte de testes.** A trilha testes manda descartar a mecânica de fissão, fusão e cooldown. O motor reescreve hard-fission e phase5-fission/fusion no M8. O R13 fala em '13 testes comportamentais', mas são 13 arquivos; a trilha testes contou uns 35 testes de domínio. Como fechar: Fazer o inventário por regra, não por arquivo, e decidir fissão e fusão explicitamente na tabela de conflitos.

### Alegações fracas

- **O '<=' faz o 'end' sair no tick 481 e o R03 'destrava H4'** (veredito_geral; R03; conflito 'Critério de repouso'; ADR repouso-e-continuidade-do-v2): 481 = ln(alphaMin)/ln(1−alphaDecay) = ln(0,003)/ln(0,988) = 481,2 com alpha0 = 1 (compile-world.js:46-47,165). O end-fix.out dá 481 idêntico em quad e em containers: é o cronograma, não repouso. Mudar o alphaDecay faz passar em H4 sem mudar a física. Com Ki 0,04 (KE 3,7 perpétuo), o loop para com os corpos ainda em movimento. H4 exige critério cinético (max|v| < ε por N ticks, como pedem as trilhas layout e testes).
- **Nenhuma proposta reduz cruzamentos topológicos (fiel 3.798 contra 3.793)** (Riscos ('H1 pode falhar'); R16): Em cross.jsonl a perf reduz: 3.374 contra 3.793 (grid500 pinned), 81 contra 95 (diag100), 185 contra 227 (diag200) e 3.305 contra 3.662 (grid500 native), de −10% a −19%, ao custo de 9 a 176 arestas penetrando nós. Há um trade-off cruzamento × penetração que não foi registrado. Além disso, a cena pinned tem a reciprocidade desligada e não informa H1.
- **A fiel dá 0 penetração em nó alheio até 500/1.000 com nós fixos ('a notícia boa')** (veredito_geral; report_md): Isso vale só no modo pinned. No native (layout vivo, que é o regime do experimento), cross.jsonl mostra a fiel no grid500 com quietTick null, vEnd 8,5, 5 arestas penetrando, nodeOv 13,0 px, deslocamento médio de nós de 1.191 px e 80 ms/tick. No diag100 native ela também nunca assenta. A síntese omite ressalvas que o próprio motor listou: '2 arestas a 14,4 px após o drag' e 'localidade com layout vivo não medida'.
- **Custo de quadro: a fiel custa 54,4 ms/tick e a H2 exige ≤ 8 ms/tick** (Riscos): Compara 500/1.000 com um limiar definido em 100 nós/150 arestas. Nessa escala a fiel mede 2,14 ms (pinned) e 4,17 ms (native) em cross.jsonl, enquanto a carta usa 'hoje 13,4' (scale2.out, outra implementação). Há quatro escalas sem reconciliação: 100/150 (H2), 150/225 (M7), 300 nós (R11) e 500/1.000.
- **Cerca de 20 linhas destravam as medições** (veredito_geral; report_md): As 20 linhas são só o '<=' e a semente (estrategia/futuro). O M0 que a própria síntese exige (velocityCap, damping por dt, Ki = 0, hash, handles) é esforço M (R04). O patch de ~15 linhas deixa 27,7 px de deslocamento (mm-warm.out), contra o aceite do M0 de < 1 px.
- **Ki = 0: a objeção cai porque a contenção passa a vir do composite e do cap de velocidade** (conflitos, tema Ki): Não há medição. O P puro tem resíduo analítico PULL/Kp, medido em 6,667 (tests/physics/collision.test.js:76; testes/resultado.json). Ninguém mediu a sobreposição residual com Ki = 0 mais composite mais mola ou cabo puxando.
- **O v2 com LA-1 já vence o v1 como layout (0 contra 2 violações; 171 contra 6.037 ms)** (conflitos, tema v2 default): O LA-1 é um spike fora do repo e não cobre tag forces, constraints, pesos nem update/frozen (layout rec. 6). O gating entregue diverge em 5 de 5 cenários allcollide; só a regra de cobertura do defensor passa (juiz/cov-allcollide.md).
- **Separar o flip do cutover de routing permite bisect** (R11; ADR flip-do-default-v2-desacoplado): O próprio flip já troca o routing: some o A* por tick do v1 (edgeWaypoints, live/index.js:504 → pipeline.js:215) e a colisão de label (motor E1-14; routing R1-12).
- **H1: cruzamentos ≤ 326 em N=120/E=159** (R01; ADR carta-de-pesquisa): O exp3.out tem uma execução por engine. Em N=60 o cabo com p=0,3 já dá 105 contra 141 do d3-force (cable-h1.out, exp3.out), ou seja, 'GO'; em N=120 dá NO-GO. O harness da trilha layout (syn:100) dá d3-force 463 e LA-1 356–427. São dois harnesses de cruzamento não reconciliados, e o limiar depende da escala.
- **Timebox 2026-12-31 como mitigação da paralisia** (Riscos; R01): A trilha estratégia o marcou como sugestão do avaliador, não do mantenedor. Não há estimativa de esforço para o roadmap até o R17.

### Correções apontadas na síntese

- Tirar do R17 a dependência do R16 (cutover M10). O veredito deve vir depois do R15, do M7 (orçamento de performance) e do M9 (semente de face), e antes de tornar o 'routing.engine: unified' default. A carta da trilha estratégia diz que é o GO que leva ao default.
- R03: trocar 'destrava H4' por 'encerra o rAF'. Registrar que o 481 é o cronograma de alpha e definir H4 por critério cinético (max|v| < ε por N ticks), com teste que distinga 'end' de cronograma.
- Riscos: substituir 'nenhuma proposta reduz cruzamentos' por 'só a perf reduz (−10% a −19%), ao custo de penetração'. Acrescentar os números native da fiel (sem assentar, nodeOv 13 px, 80 ms/tick no grid500) e declarar que cenas pinned não testam H1.
- R11: acrescentar gates de edgeWaypoints e labelBBoxes (E1-14 e R1-12), de Float32 (depender do R05; a trilha DSL diz que bloqueia o default v2) e de sinal de convergência no E2E. Mudar o esforço de P para M e criar o item de porte de paridade (tag forces, constraints, update/frozen, pin snap-back, kill-switch).
- Incluir a LA-3 (semente stress no cold start, com BFS ou pivot-MDS) e uma ablação de H1 (ρEnd 0 contra α, com a mesma semente e várias seeds). Tratar ρEnd como variável experimental, não como decisão do mantenedor.
- Mover as correções P do algébrico (pernas para dentro, clipAnchors, curved degenerado, desempate estável do obstacle-route) do R19 para antes do R06 e do R17. Ele é o baseline-oráculo, e a trilha routing as pôs em prioridade 4, impacto alto.
- Resolver a contradição 'respirar ou congelar': o ADR repouso-e-continuidade-do-v2 decide congelar, mas os Riscos listam o tema como decisão pendente.
- Colocar 'aprovar carta, limiares e timebox' como decisão pendente nº 1, marcando o timebox como sugestão do avaliador, e anexar uma estimativa do caminho mínimo até o veredito.
- Incluir as notas de produto 1/5 e de objetivo 1,5/5 e um risco de novidade: o vis-network já põe um nó de suporte por aresta na física, e há o trabalho de Dwyer, Marriott e Wybrow (2008).
- H2: fixar uma única escala e reconciliar os 13,4 ms (scale2.out) com os 2,14 ms (pinned) e 4,17 ms (native) da fiel em 100/150.
- Reconciliar os números de warm start (70,2 px no mm-warm, 93 px no E1-04 do motor, 150–250 px no L1-03 do layout, 208 px em containers), declarando cenário e n de cada um.
- R13: trocar '13 testes comportamentais' por '13 arquivos'. Inventariar as cerca de 35 regras de domínio (trilha testes) e decidir fissão e fusão: a trilha testes descarta, o M8 do motor reescreve.
- R05 e R18: incluir o id com \n que lança SyntaxError em todo paint (ensure-el.js:11,24-26) e as permissões por job e o dependabot no workflow (G2-08).
- R09: incluir length/stiffness por aresta (item 10 do top 10 do brainstorming, esforço P; compile-world.js:141 usa o mesmo rest para todas as arestas).

## Arquivos

| Trilha | Arquivo |
|---|---|
| 1 · Governança e entrega | [01-governanca.md](01-governanca.md) |
| 2 · Testes | [02-testes.md](02-testes.md) |
| 3 · Estratégia (objetivo, valor, futuro) | [03-estrategia.md](03-estrategia.md) |
| 4 · DSL e parsing | [04-dsl-parsing.md](04-dsl-parsing.md) |
| 5 · Layout | [05-layout.md](05-layout.md) |
| 6 · Routing | [06-routing.md](06-routing.md) |
| 7 · Motor físico e Fase 4 | [07-motor-fase4.md](07-motor-fase4.md) |
| Rascunho do plano da Fase 4 | [08-plano-fase4-rascunho.md](08-plano-fase4-rascunho.md) |

## Como foi feito

36 agentes em 7 trilhas, mais 3 de síntese (sintetizador, crítico de completude e revisor). Onde coube, os papéis foram adversariais: verificador cético nas auditorias, mutante e fuzzer contra a suíte e o parser, desafiante × defensor com juiz nas alternativas, advogado × cético no valor, painel de 3 propostas com 2 juízes na Fase 4. O objetivo foi reconstruído às cegas, sem o dossiê e sem a resposta do mantenedor. Nenhum agente modificou o repositório; o mutante trabalhou num worktree isolado.
