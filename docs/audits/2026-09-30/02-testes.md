# Trilha 2 · Testes: cobertura medida e mutation testing

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito:** A suíte dá falsa segurança no núcleo que parece bem coberto. 13 dos 14 mutantes sobreviventes estão em linhas que ela executa: a taxa de mutação é de 53,3%, contra 93,3% de linhas cobertas. O motor v2, candidato a default, não tem teste de contrato: 8 de 35 testes falham quando aplicados a ele. O v2 também tem um bug: o evento 'end' nunca é emitido. O próprio helper de teste esconde esse bug.

A suíte dá falsa segurança: 13 dos 14 mutantes sobreviventes (93%) estão em linhas que ela executa, e a taxa de mutação é 53,3%. Nos 13 arquivos mutados com 100% de linhas cobertas, só 9 de 17 mutantes morrem. O risco real sem rede está no motor v2, candidato a default, e no orquestrador `src/app/pipeline.js`.

### Onde a cobertura mente

| Subsistema | Linhas (%) | Branches (%) | Mutantes mortos (n/total) | Sinal |
|---|---:|---:|---:|---|
| dsl | 95,8 | 85,9 | 5/5 | suíte forte |
| physics (motor unificado) | 98,6 | 76,9 | 5/8 | `solver.js:33` roda 4.734 vezes e o mutante vive |
| live v1 | 91,7 | 80,9 | 2/4 | `pins.js:44` roda 16 vezes e o mutante vive |
| routing algébrico | 99,7 | 92,0 | 3/7 | 4 sobreviventes em arquivos com 100% de linhas |
| compile-world (v2) | 81,4 | 74,7 | 0/2 | 8 de 35 testes de contrato falham em v2 |
| app/pipeline.js | 0 | — | 0/1 | nenhum teste unit o importa |

As contagens de execução vêm do `DA:` de `lcov.info` em cada linha mutada. Seis dos 14 sobreviventes são assimetrias: o teste cobre um eixo ou sentido e o bug entra pelo outro. Os demais vêm de asserções só de "não sobrepõe", knobs nunca usados fora do default e um módulo sem import.

Achei uma máscara nova no próprio teste do v2. O helper `runUntilSettled` para em `alpha < 0.005` (`tests/layout/compile-world.test.js:11`). O produto usa `alphaMin: 0.003` (`src/layout/compile-world.js:47`), e o solver trava alpha nesse piso (`src/physics/solver.js:42`).

Com corpos móveis, 'end' nunca é emitido e o loop de rAF não para (`compile-world.js:240,244`). O único teste de 'end' usa cena toda pinada (`compile-world.test.js:86`). O helper esconde exatamente o bug que a mutação encontrou.

### Risco real sem cobertura

- `src/app/pipeline.js`: 310 linhas e 47 decisões, 0% unit. `tests/integration.test.js:14-22` reimplementa o pipeline sem filtros, seeds, gates P8 nem branch de engine. O mutante M29 (`pipeline.js:214`) gera diagonais e passa.
- Motor v2: 8 de 35 testes do `live.test.js` falham quando reaplicados ao v2. `seedPositions` tem 0 ocorrências em `compile-world.js`, mas o pipeline o monta a cada rerender (`pipeline.js:121-126`).
- UI e gestos: `gestures.js` (418 linhas, 89 decisões), `config-editor.js` e `wiring.js` só têm E2E, cuja cobertura não é medida.
- F-0016 não tem E2E (grep de `startStyle|endStyle|marker` em `e2e/*.spec.js` vazio). Forças por tag do v1 (`live/index.js:296-322`) não têm teste de efeito.

Correção ao achado Q1-06: o contributor de tags do v2 tem teste de efeito (`tests/physics/constraints-and-forces.test.js:51,64`). A lacuna é só do v1.

### Validação por amostragem

| Alegação | Origem | Verificação do juiz | Resultado |
|---|---|---|---|
| 'end' do v2 nunca emitido | mutação | `juiz/v2end.mjs` contra o repo principal | confirmado: 5.000 ticks, `ended=false`, alpha 0,003 |
| Diagonal ≤ 0,5 px no ortogonal pós-clip | qualidade | `pbt/repro-min.mjs` | confirmado: dx=0,5 dá `[[20,200],[20,120],[20.5,40]]`; dx ≥ 1 fica ok |
| 8/35 do contrato live falham em v2; pipeline sem import | qualidade, cobertura | reexecução de `v2-parity/live-v2.test.mjs`; `grep app/pipeline tests` | confirmado: 27 passam, 8 falham; grep vazio |

A causa da diagonal é o dedup com `DUP_TOL = 0.5` em `src/routing/anchor-utils.js:290`. Ele descarta o ponto sem realinhar o vizinho. O comentário em `:287-289` diz que a tolerância acompanha a do oráculo `e2e/invariants.js`.

### Os 10 testes que faltam

| # | O que testar | Onde | Invariante | Mata |
|---|---|---|---|---|
| 1 | 'end' do v2 com corpos móveis | tests/layout/compile-world.test.js | cena a–b solta emite 'end'; helper usa `cfg.alphaMin` | bug real (hoje falha) |
| 2 | Contrato do adapter live × {v1, v2} | tests/layout/adapters/live.test.js | seed, pin snap-back, folha fora de container; skip só com motivo | 8 falhas atuais |
| 3 | `createPipeline` real com fakes e dom-mock | tests/app/pipeline.test.js (novo) | flag orthogonal, gates P8, graphSig, filtros | M29 |
| 4 | Equivariância: troca de eixos, espelho, source↔target | tests/physics, tests/routing, tests/layout | f(T(cena)) = T(f(cena)) | M09, M12, M15, M16, M25, M28 |
| 5 | Pós-routing ortogonal como propriedade | tests/routing/postpass.property.test.js (novo) | segmentos axis-aligned (tol 0,01); âncora no perímetro | bug da diagonal |
| 6 | obstacle-route com 2+ obstáculos e empate de comprimento | tests/routing/obstacle-route.test.js | nenhum segmento cruza obstáculo; mínimo de curvas | M23, M24 |
| 7 | Colisão com força competidora e oráculo analítico | tests/physics/collision.test.js | gap = 2h + 2·pad ± 1 nos dois eixos; resíduo P = PULL/Kp ± 0,05 | M16; troca o `> 1` frouxo |
| 8 | Solver: substeps e alpha | tests/physics/solver.test.js | substeps 1 e 4 dão o mesmo deslocamento; `kick` e `set alpha` | M18 |
| 9 | Pin da DSL no modo frozen | tests/layout/adapters/live.test.js | drag e release de b não movem p pinado | M13 |
| 10 | Geometria e massa do v2 | tests/layout/compile-world.test.js | `frame.y = min(filho.y) − pad − 22`; peso 1 ainda se move | M06, M07 |

Juntos, eles matam 13 dos 14 sobreviventes, por leitura dos mutantes. Só M30 fica de fora (posição do label, `src/renderer/edges.js:36`), um teste de 5 linhas.

### Property-based e invariantes para o motor e a Fase 4

Testei o item 4 sem dependências. `juiz/meta.mjs` (41 linhas, 80 ms) roda 3 propriedades metamórficas com 300 casos cada. No código original: 0 falhas; numa cópia com M16, M15 e M28: 262, 272 e 143 falhas.

Recomendo `fast-check` como devDependency, com seed fixa no CI e registrada na falha. Não toca o runtime, então o ADR-0006 fica intacto. O spike da qualidade rodou 5 propriedades em 1,57 s e achou a diagonal.

Três famílias de propriedade para `src/physics`:

- **Equivariância:** troca de eixos, espelho e translação; troca source↔target, exigida pelo ADR-0003.
- **Conservação:** soma das forças de colisão nula; pinado imóvel; acumulador PI em [0, accMax]; slot morto ignorado.
- **Convergência com oráculo:** resíduo P = 6,667, mola em rest, repouso por max|v| < ε, 'end' alcançável.

A última substitui o "settled" atual, que é só o fim do cronograma de alpha (439 ticks em todo exemplo).

Para a Fase 4, porte uns 35 testes de domínio do routing deprecated como contrato parametrizado por engine. Ele roda contra `src/routing/physics` hoje e contra o motor unificado depois. Passar nos dois vira o critério de aceite da remoção.

| Regra a portar | Fonte (caminho:linha) |
|---|---|
| Âncora no perímetro, perto do edgeCenter; snap tem precedência | edge-central.test.js:89-152; phase3.test.js:243 |
| Endpoints no mesmo nó não se repelem | endpoint-bbox-bbox.test.js:41-73 |
| Source, target e ancestral não repelem a própria aresta | node-repulsion-layers.test.js:66; phase3.test.js:151,169 |
| Rota válida fica estável (round-trip ≤ 0,5 px) | phase2.test.js:220; phase4.test.js:57 |
| Mesma edgeLayer descruza; layers disjuntas preservam | phase3c.test.js:61,154,169 |
| Nenhuma penetração em nó alheio | hard-fission.test.js:53-84; e2e/18:46-93 |

Descarte a mecânica de fissão, fusão e cooldown e os hooks de warmStart. Use como oráculos `countSharedLayerCrossings` (`src/routing/crossings.js`) e `assertGeometryInvariants` (`e2e/invariants.js:24`), que hoje não gateia nada.

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Corrigir e testar o evento 'end' do motor v2 com corpos móveis | alto | P | solver.js:42 trava alpha em alphaMin, e compile-world.js:240 exige alpha < alphaMin. Resultado: 'end' nunca vem e o loop de rAF não para (juiz/v2end.mjs: 5.000 ticks, ended=false). O helper runUntilSettled (compile-world.test.js:11) para em 0,005 e mascara o problema. |
| 2 | Suíte de contrato do adapter live parametrizada por engine (v1 e v2) como critério do default v2 | alto | M | Reaplicado ao v2, o live.test.js tem 8 falhas em 35: seedPositions ignorado, pin snap-back, folha dentro de container e kill-switch. Nenhum E2E usa o v2. A decisão pendente de tornar o v2 o default não tem nenhum teste que a sustente. |
| 3 | Adotar propriedades metamórficas/PBT (fast-check como devDependency) em src/physics e no routing | alto | M | 6 dos 14 sobreviventes são assimetrias de eixo ou sentido. Três propriedades (41 linhas, 80 ms) matam M15, M16 e M28 com 143 a 272 falhas em 300 casos, e têm 0 falhas no código original. O spike de PBT também achou um bug real (a diagonal no roteamento ortogonal). |
| 4 | Testar createPipeline real e apagar a cópia do pipeline em integration.test.js | alto | P | pipeline.js (310 linhas, 47 decisões) tem 0% de cobertura unit, e o mutante M29 (diagonais no roteamento ortogonal) sobrevive. integration.test.js:14-22 reimplementa o pipeline e pode divergir dele sem aviso. O spike com dom-mock levou pipeline.js a 79% de linhas. |
| 5 | Portar ~35 testes de domínio do routing deprecated como contrato por engine antes da Fase 4 | alto | M | A Fase 4 remove 158 testes (19,8% da suíte). Uns 35 deles codificam regras de domínio: âncora no perímetro, REGRA DO USUÁRIO de layers, nenhuma penetração em nó alheio e estabilidade de rota. Essas regras precisam valer para o motor unificado, e são o critério de aceite da remoção. |
| 6 | Corrigir o dedup com DUP_TOL e cobrir o pós-routing ortogonal com uma propriedade | medio | P | Com dx=0,5, anchor-utils.js:290 descarta o ponto sem realinhar o vizinho, e a rota sai com segmento diagonal (reproduzido pelo juiz). O invariante axis-aligned que a spec 13 declara é violado sem que nenhum gate detecte. |
| 7 | Apertar os limiares de física com oráculo analítico e trocar o 'settled' por repouso físico | medio | P | Os testes aceitam resíduo P > 1 quando o valor analítico é 6,667, e aceitam mola < 80 ou < 120 com repouso em 40. O 'settled' atual é só o fim do cronograma de alpha (439 ticks), não equilíbrio físico. A calibração do v2 é provisória. |
| 8 | Gate de cobertura no CI com exclusões e detecção de módulo não importado | medio | P | O CI não mede cobertura (deploy-tensegrams.yml:31). O Node omite módulos que nenhum teste importa (9 arquivos, 1.615 linhas), e o 96,61% impresso conta os próprios arquivos de teste. Sem exclusões, o número não serve de gate. |
| 9 | Harness de mutação curado como gate de fase do motor | medio | P | O harness de 30 mutantes já existe (scratchpad/mutrun.mjs) e roda em poucos minutos. A cobertura de linhas não distingue suíte forte de fraca: nos arquivos com 100% de linhas, só 9 de 17 mutantes morrem. |
| 10 | Expor sinal de convergência no E2E e trocar os sleeps fixos | medio | M | A suíte E2E tem 49 waitForTimeout e nenhum sinal de 'settled' em window. Com retries:1 e sem failOnFlakyTests, a flakiness fica escondida. Sem esse sinal, não dá para incluir live/v2 na spec 13 de forma confiável. |

### ADRs candidatas desta trilha

- **Cutover e remoção de engine exigem suíte de contrato parametrizada por engine** (confiança media). Toda troca de default ou remoção de engine só acontece com uma suíte de contrato verde, parametrizada pelas engines envolvidas: layout v1/v2, e routing deprecated/unificado na Fase 4. Diferenças intencionais ficam como skip com motivo escrito.
- **Property-based e metamórfico como camada obrigatória de teste do motor físico** (confiança media). Adotar fast-check como devDependency, só para testes e sem efeito no runtime. Exigir propriedades de equivariância, conservação e convergência analítica para src/physics e para o pós-routing. A seed fica fixa no CI e é registrada na falha.

### Sugestões de evolução do processo desta trilha

- `gate-contrato-por-engine` (new-adr) → ADR novo: cutover ou remoção de engine só com suíte de contrato parametrizada por engine verde, com skips justificados. Complementa ADR-0009 e ADR-0013.: Reaplicado ao v2, o contrato do live.test.js falha em 8 de 35 testes, e a Fase 4 remove 158 testes do routing deprecated. Tanto o cutover de engine quanto a remoção de engine hoje não têm critério objetivo.
- `pbt-fast-check-dev` (new-adr) → ADR novo e package.json devDependencies, com convenção de seed fixa no CI.: Os spikes de PBT e metamórficos acharam um bug real (diagonal com dx de 0,5 px) e mataram mutantes que a suíte deixa passar, em menos de 2 s. fast-check entra só como devDependency, então não conflita com o ADR-0006.
- `gate-cobertura-ci` (new-rule) → AGENTS.md, gate pré-push item 1: script test:cov com --test-coverage-exclude para tests/** e src/routing/physics/**, e thresholds de linhas e branches (80). Aplicar também em .github/workflows/deploy-tensegrams.yml.: O CI não mede cobertura (deploy-tensegrams.yml:31). O 96,61% que o Node imprime inclui os próprios arquivos de teste e omite os 9 módulos de src que nenhum teste importa.
- `check-modulo-sem-teste` (heuristic-fix) → Script em scripts/ que lista os src/**/*.js sem importador em tests/, com allowlist justificada para ui e boot. Roda no CI.: O Node não reporta arquivos que nenhum teste carrega. pipeline.js, gestures.js, wiring.js e config-editor.js ficaram invisíveis na métrica.
- `mutacao-curada-gate-de-fase` (new-rule) → AGENTS.md: para fechar uma fase do motor (Fase 4, cutover v2), rodar o harness de mutação curado com score mínimo de 80% em src/physics e compile-world. Versionar o harness em scripts/mutate.mjs.: A taxa de mutação é 53,3% com 93,3% de linhas cobertas, e 13 dos 14 sobreviventes estão em linhas executadas. Cobertura de linhas não serve de gate para o motor físico.
- `helper-de-teste-usa-limiar-do-produto` (new-rule) → AGENTS.md, checklist do code review (gate item 2): helpers de teste importam constantes do produto em vez de redefini-las.: O runUntilSettled de compile-world.test.js:11 usa 0,005, diferente do alphaMin 0,003 do produto. Com isso, o bug do 'end' nunca emitido no v2 ficou escondido.
- `proibir-assert-vacuo` (new-rule) → AGENTS.md, checklist do code review, mais uma checagem por grep no CI (assert.ok(true), doesNotThrow sozinho, screenshot sem expect).: Há asserções que não podem falhar: assert.ok(true) em pipeline-opt-ins.test.js:34-35, testes do tipo 'aceita config sem crash' e screenshots sem comparação no e2e/19.
- `audit-api-symbols` (heuristic-fix) → feat-memory audit e skill memory-debrief: validar que cada símbolo declarado em api: existe.: O F-0001 declara api src/app/pipeline.js::runPipeline, mas esse símbolo não existe; o export real é createPipeline. O Manifest aponta para um símbolo inexistente.
- `skill-test-audit` (new-skill) → skills/test-audit: cobertura sem testes e sem deprecated, módulos não importados, mutação curada, paridade por engine e relatório de falsa segurança.: A trilha de testes precisou de 3 agentes ad hoc: cobertura efetiva, auditoria de oráculos e mutação curada. O juiz ainda cruzou os resultados com sondas metamórficas. Esse processo deve rodar de novo antes de cada fase do motor.
- `baseline-com-comando` (doc-gap) → Template do dossiê do ecossistema de agentes: todo número de baseline acompanhado do comando que o gerou.: O dossiê do ecossistema fala em 83 arquivos de teste, mas `find tests -name '*.test.js'` retorna 78. Dois agentes perderam tempo reconciliando esse número.

### Fontes

- /home/user/tensegrams/src/physics/solver.js:33,42
- /home/user/tensegrams/src/layout/compile-world.js:47,160-170,240,244,309
- /home/user/tensegrams/tests/layout/compile-world.test.js:9-12,86-96
- /home/user/tensegrams/src/routing/anchor-utils.js:287-300
- /home/user/tensegrams/tests/integration.test.js:1-22
- /home/user/tensegrams/src/app/pipeline.js:121-126
- /home/user/tensegrams/src/physics/collision.js:62
- /home/user/tensegrams/src/physics/integrator.js:22,45-46
- /home/user/tensegrams/src/routing/routers/orthogonal.js:37-38
- /home/user/tensegrams/tests/routing/routers/orthogonal.test.js:32-37
- /home/user/tensegrams/src/layout/collision.js:127-129
- /home/user/tensegrams/tests/layout/collision.test.js:169-178
- /home/user/tensegrams/tests/physics/constraints-and-forces.test.js:51,64
- /home/user/tensegrams/tests/routing/physics/phase3c.test.js:61,154,169
- /home/user/tensegrams/README.md:105
- /home/user/tensegrams/.feat-memory/suggestions.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/juiz/v2end.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/juiz/v2end-out.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/juiz/meta.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/juiz/meta-out.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/juiz/v2parity-rerun.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/juiz/report.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/pbt/repro-min.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/v2-parity/live-v2.test.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/testes/lcov.info
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/mut-results.json

## Apêndice A · Cobertura medida

Medição de cobertura da suíte unit (node 22.22.2, `--experimental-test-coverage`, concorrência 1): 797 testes, 797 passam, 0 falham, EXIT=0, 12,7 s (coverage.txt:6172-6179). O número que o Node imprime no fim, 96,61% de linhas em "all files" (coverage.txt:6374), está inflado por dois motivos: (a) conta os próprios arquivos de teste; (b) o Node não reporta módulos que nenhum teste carrega, nem com `--test-coverage-include='src/**'` (verificado). A cobertura efetiva de src/ ponderada por linhas é **80,7%** (9.632/11.934). Sem o routing físico deprecated, cai para **77,3%**. Branches ficam em 85,4% dos arquivos importados.

Nove arquivos (1.615 linhas, 13,5% de src) têm 0% porque nenhum teste os importa: `app/pipeline.js`, `app/wiring.js`, `app/boot.js`, `app/gestures.js`, `controls/config-editor.js`, `ui/*` (3 arquivos) e `main.js`. O maior deles em peso é `src/app/pipeline.js`, o orquestrador DSL→layout→routing→render. `tests/integration.test.js` não importa esse arquivo: tem uma cópia própria e reduzida do pipeline, então pode divergir do real sem que nenhum teste avise. Um spike fora do repo (3 testes, deps mockadas + tests/dom-mock.js) levou `pipeline.js` de 0% para 79% de linhas. Ou seja, a lacuna é barata de fechar.

Por subsistema: `app` tem 11,9% efetivo e `ui` 0%. Esses dois ficam só com o E2E, cuja cobertura não é medida. `controls` tem 55%, `renderer` 68,5% e `shapes` 83,9%, mas só 37,8% das funções. O núcleo algébrico está bem coberto: routing 99,7%, dsl 95,8%, layout 92,8%. O motor físico unificado `src/physics` tem 98,6% de linhas, mas só 76,9% de branches, e tem 46 testes contra 158 do routing deprecated. Os 158 testes deprecated são 19,8% da suíte e cobrem código que a Fase 4 vai remover.

Matriz de features: nenhuma das 19 features fica sem algum teste. Mas há lacunas relevantes:
- **F-0016 (estilos de ponta):** não tem nenhum E2E.
- **Só E2E, sem unit:** F-0007, F-0012, F-0014 e F-0019.
- **Motor v2 (candidato a default, decisão pendente):** nenhum spec E2E usa `live.engine: v2`. Drag e release do v2 têm 0% de cobertura. A sessão v2 não implementa o que o pipeline consome (seedPositions, reportLabelBBox, edgeWaypoints), e o contrato em `src/layout/adapter.js` não declara esses campos, então nenhum teste pegaria essa falta de paridade.
- **Forças por tag (attractTo/repelFrom):** o README promete um efeito visível no layout live, mas nenhum teste verifica esse efeito.
- **Oráculos fracos:** e2e/19 tem 5 testes e 5 expects, que só contam arestas. `tests/routing/pipeline-opt-ins.test.js` tem `assert.ok(true)` (linhas 34-35).
- **CI:** não mede nem exige cobertura (`deploy-tensegrams.yml:31`).

## 1. Execução
- Comando: `node --test --experimental-test-coverage --test-concurrency=1 $(find tests -name '*.test.js')` (node v22.22.2). EXIT=0.
- **797 testes / 198 suites / 797 pass / 0 fail / 0 skip / 0 todo**, 12,7 s (coverage.txt:6172-6179). Os mesmos números numa segunda execução (lcov/tap) e numa terceira (junit, 797 testcases).
- Arquivos de teste: **78** `*.test.js` (+ tests/dom-mock.js).
- Ressalva de método: a % de linhas do Node conta comentários e linhas em branco dentro de blocos executados (LF = wc -l). Por isso "linhas %" superestima. Ex.: routers/curved.js tem 100% de linhas e 50% de funções. Branches e funções são mais informativos.
- O "all files 96,61%" do Node (coverage.txt:6374) mistura tests/*.test.js e e2e/invariants.js e ignora arquivos não importados, então não serve como métrica.

## 2. Por subsistema (ponderado por linhas; não importado = 0%)
| subsistema | arquivos | não importados | linhas | linhas cobertas | linhas % (efetiva) | linhas % (só importados) | branches % (importados) | funções % (importados) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| layout | 14 | 0 | 2439 | 2264 | 92.8 | 92.8 | 82.9 | 87.3 |
| routing/physics (deprecated) | 9 | 0 | 1952 | 1915 | 98.1 | 98.1 | 83.5 | 96.1 |
| routing (sem physics) | 14 | 0 | 1718 | 1713 | 99.7 | 99.7 | 92.0 | 97.1 |
| dsl | 7 | 0 | 1462 | 1400 | 95.8 | 95.8 | 85.9 | 94.4 |
| app | 8 | 4 | 1259 | 150 | **11.9** | 82.9 | 75.0 | 86.7 |
| renderer | 6 | 0 | 834 | 571 | 68.5 | 68.5 | 90.2 | 77.1 |
| controls | 6 | 1 | 731 | 402 | 55.0 | 97.1 | 90.3 | 88.9 |
| physics (motor unificado) | 10 | 0 | 696 | 686 | 98.6 | 98.6 | **76.9** | 84.4 |
| raiz (editor, main, store, version, viewport) | 5 | 1 | 332 | 281 | 84.6 | 86.5 | 81.7 | 75.9 |
| shapes | 6 | 0 | 298 | 250 | 83.9 | 83.9 | 86.7 | **37.8** |
| ui | 3 | 3 | 213 | 0 | **0.0** | — | — | — |
| **TOTAL src/** | 88 | 9 | 11934 | 9632 | **80.7** | 93.3 | 85.4 | 85.9 |
| **TOTAL sem routing/physics deprecated** | 79 | 9 | 9982 | 7717 | **77.3** | — | 86.0 | — |

Testes unit por diretório (soma = 797): app 20 · controls 44 · dsl 139 · layout 140 (compile-world/v2: 7; live v1: 35) · physics 39 · renderer 42 · routing (sem physics) 138 · **routing/physics deprecated 158 (19,8%)** · shapes 20 (só rect) · raiz 57 (integration 13, e2e-invariants 15).

## 3. Arquivos de src/ que nenhum teste importa (0% efetivo): 9 arquivos, 1.615 linhas (13,5%)
| arquivo | linhas | pontos de decisão (estático) | feature | coberto só por E2E? |
|---|---:|---:|---|---|
| src/app/gestures.js | 418 | 89 | F-0007, F-0019 | sim (06, 07, 12) |
| src/controls/config-editor.js | 317 | 54 | F-0011 | sim (10, 20) |
| src/app/pipeline.js | 310 | 47 | F-0001 (orquestrador) | indireto (todos) |
| src/app/wiring.js | 190 | 36 | F-0012, F-0014, F-0019 | sim (02, 04, 07) |
| src/app/boot.js | 160 | 6 | bootstrap | sim (01) |
| src/ui/action-fab.js | 95 | 8 | F-0007 | sim (12) |
| src/ui/context-menu.js | 74 | 11 | F-0007 | sim (12) |
| src/ui/menu-button.js | 44 | — | F-0007 | sim (12) |
| src/main.js | 7 | — | entrada | sim (01) |

Obs.: src/physics/registry.js não é alcançável a partir de src/main.js (só tests/physics/solver.test.js o importa).

## 4. Cobertura por arquivo (src/, lcov)
| arquivo | linhas | linhas % | branches % | funções % |
|---|---:|---:|---:|---:|
| src/app/boot.js **(não importado)** | 160 | 0.0 | 0 | 0 |
| src/app/console-buffer.js | 31 | 41.9 | 100.0 | 50.0 |
| src/app/debug-export.js | 76 | 85.5 | 66.7 | 80.0 |
| src/app/download.js | 23 | 100.0 | 100.0 | 100.0 |
| src/app/dsl-io.js | 51 | 96.1 | 78.9 | 100.0 |
| src/app/gestures.js **(não importado)** | 418 | 0.0 | 0 | 0 |
| src/app/pipeline.js **(não importado)** | 310 | 0.0 | 0 | 0 |
| src/app/wiring.js **(não importado)** | 190 | 0.0 | 0 | 0 |
| src/controls/abstraction.js | 71 | 100.0 | 88.9 | 84.6 |
| src/controls/config-editor.js **(não importado)** | 317 | 0.0 | 0 | 0 |
| src/controls/config-schema.js | 90 | 100.0 | 92.9 | 100.0 |
| src/controls/drill.js | 40 | 100.0 | 100.0 | 80.0 |
| src/controls/layers.js | 58 | 84.5 | 85.7 | 83.3 |
| src/controls/yaml-highlight.js | 155 | 98.1 | 90.0 | 100.0 |
| src/dsl/ancestry.js | 61 | 67.2 | 100.0 | 75.0 |
| src/dsl/attr-set.js | 116 | 100.0 | 100.0 | — |
| src/dsl/config.js | 67 | 97.0 | 100.0 | 50.0 |
| src/dsl/diagnostics.js | 48 | 100.0 | 85.0 | 100.0 |
| src/dsl/examples.js | 260 | 100.0 | 100.0 | — |
| src/dsl/ir.js | 654 | 96.2 | 86.7 | 96.9 |
| src/dsl/parser.js | 256 | 94.1 | 80.8 | 100.0 |
| src/editor.js | 91 | 61.5 | 70.0 | 66.7 |
| src/layout/adapter.js | 74 | 100.0 | 100.0 | 87.5 |
| src/layout/adapters/custom/index.js | 95 | 95.8 | 86.2 | 90.0 |
| src/layout/adapters/live/collision-resolution.js | 266 | 100.0 | 90.8 | 100.0 |
| src/layout/adapters/live/collision-waypoints.js | 397 | 94.0 | 80.3 | 94.1 |
| src/layout/adapters/live/container-geometry.js | 58 | 82.8 | 86.7 | 100.0 |
| src/layout/adapters/live/index.js | 550 | 86.7 | 75.7 | 85.2 |
| src/layout/adapters/live/pins.js | 48 | 95.8 | 66.7 | 100.0 |
| src/layout/adapters/off.js | 103 | 100.0 | 84.6 | 90.0 |
| src/layout/collapse-filter.js | 68 | 100.0 | 96.6 | 100.0 |
| src/layout/collision-postpass.js | 143 | 97.9 | 89.8 | 77.8 |
| src/layout/collision.js | 164 | 100.0 | 78.8 | 100.0 |
| src/layout/compile-world.js | 318 | 81.4 | 74.7 | 67.9 |
| src/layout/layer-filter.js | 121 | 100.0 | 89.7 | 100.0 |
| src/layout/registry.js | 34 | 100.0 | 100.0 | 85.7 |
| src/main.js **(não importado)** | 7 | 0.0 | 0 | 0 |
| src/physics/collision.js | 97 | 100.0 | 95.6 | 80.0 |
| src/physics/constraints/index.js | 88 | 97.7 | 46.2 | 100.0 |
| src/physics/contributors/central.js | 25 | 100.0 | 77.8 | 100.0 |
| src/physics/contributors/connectivity-spring.js | 34 | 100.0 | 50.0 | 100.0 |
| src/physics/contributors/tag-forces.js | 63 | 100.0 | 53.3 | 100.0 |
| src/physics/integrator.js | 53 | 100.0 | 76.2 | 100.0 |
| src/physics/registry.js | 66 | 87.9 | 90.0 | 50.0 |
| src/physics/solver.js | 52 | 100.0 | 63.6 | 60.0 |
| src/physics/spatial-grid.js | 80 | 100.0 | 87.0 | 100.0 |
| src/physics/world.js | 138 | 100.0 | 94.4 | 100.0 |
| src/renderer/collision-debug.js | 258 | 12.8 | 66.7 | 14.3 |
| src/renderer/edge-end-styles.js | 96 | 100.0 | 100.0 | 100.0 |
| src/renderer/edges.js | 190 | 88.9 | 92.3 | 87.5 |
| src/renderer/ensure-el.js | 26 | 100.0 | 100.0 | 100.0 |
| src/renderer/index.js | 151 | 91.4 | 79.3 | 87.5 |
| src/renderer/nodes.js | 113 | 96.5 | 94.7 | 100.0 |
| src/routing/anchor-utils.js | 376 | 99.7 | 93.4 | 100.0 |
| src/routing/clip-anchors.js | 149 | 100.0 | 88.4 | 100.0 |
| src/routing/crossings.js | 107 | 100.0 | 100.0 | 100.0 |
| src/routing/face-select.js | 190 | 100.0 | 90.4 | 100.0 |
| src/routing/geometry.js | 29 | 100.0 | 100.0 | 100.0 |
| src/routing/obstacle-route.js | 310 | 100.0 | 93.2 | 100.0 |
| src/routing/physics/bodies.js (depr.) | 92 | 100.0 | 100.0 | 100.0 |
| src/routing/physics/constraints.js (depr.) | 202 | 97.5 | 90.6 | 77.8 |
| src/routing/physics/forces-edge-central.js (depr.) | 41 | 100.0 | 91.7 | 100.0 |
| src/routing/physics/forces-endpoint-bbox.js (depr.) | 231 | 95.7 | 77.7 | 100.0 |
| src/routing/physics/forces.js (depr.) | 340 | 98.2 | 86.3 | 92.9 |
| src/routing/physics/index.js (depr.) | 157 | 100.0 | 77.1 | 100.0 |
| src/routing/physics/solver.js (depr.) | 272 | 98.2 | 80.5 | 100.0 |
| src/routing/physics/topology.js (depr.) | 404 | 98.0 | 72.5 | 100.0 |
| src/routing/physics/warm-start.js (depr.) | 213 | 98.6 | 93.0 | 100.0 |
| src/routing/registry.js | 26 | 100.0 | 100.0 | 100.0 |
| src/routing/router.js | 34 | 100.0 | 100.0 | 100.0 |
| src/routing/routers/curved.js | 38 | 100.0 | 50.0 | 50.0 |
| src/routing/routers/orthogonal.js | 51 | 100.0 | 75.0 | 50.0 |
| src/routing/routers/straight.js | 26 | 100.0 | 100.0 | 50.0 |
| src/routing/snap-container-anchors.js | 123 | 100.0 | 81.5 | 100.0 |
| src/routing/snap-endpoints.js | 76 | 100.0 | 92.6 | 100.0 |
| src/routing/snap-resolver.js | 183 | 97.8 | 91.0 | 100.0 |
| src/shapes/circle.js | 53 | 58.5 | 100.0 | 28.6 |
| src/shapes/diamond.js | 47 | 63.8 | 100.0 | 14.3 |
| src/shapes/index.js | 34 | 100.0 | 100.0 | 100.0 |
| src/shapes/polygon.js | 32 | 87.5 | 100.0 | 14.3 |
| src/shapes/rect.js | 101 | 99.0 | 76.5 | 100.0 |
| src/shapes/star.js | 31 | 87.1 | 100.0 | 14.3 |
| src/store.js | 203 | 95.6 | 81.5 | 75.0 |
| src/ui/action-fab.js **(não importado)** | 95 | 0.0 | 0 | 0 |
| src/ui/context-menu.js **(não importado)** | 74 | 0.0 | 0 | 0 |
| src/ui/menu-button.js **(não importado)** | 44 | 0.0 | 0 | 0 |
| src/version.js | 5 | 100.0 | 100.0 | — |
| src/viewport.js | 26 | 100.0 | 100.0 | 100.0 |

## 5. Matriz features × testes (E2E por leitura dos specs, sem executar)
| Feature | Unit (arquivos) | E2E: objetivo principal | E2E: incidental | Lacuna observada |
|---|---|---|---|---|
| F-0001 dsl-to-diagram | parser, ir, integration (pipeline copiado) | 01, 03, 11 | todos (setDSL), 13 | pipeline.js real 0% unit |
| F-0002 layout-adapters | registry, adapter, custom, live (35), off, compile-world (7) | 05 | 03, 06, 09, 13 (só custom/off) | **v2 sem E2E**; drag v2 0%; tag forces sem teste de efeito |
| F-0003 edge-routers | registry, router, 3 routers + snap/clip/face | 05 | 11 (todo router), 13 (3 routers) | load() de cada router nunca chamado (funções 50%) |
| F-0004 containers-hierarchy | unified-model, drill, collapse-filter | 11, 12 | 06 (drill/drag container), 09 | descendantLeaves 0% unit |
| F-0005 collision-layers | collision-attrs, collision, postpass, obstacle-route | 09, 18 | 03, 05, 06, 15 | — |
| F-0006 layer-filter | layers, layer-filter | 09 | — | — |
| F-0007 selection-gestures | **nenhum** | 12 | 06 (double-tap drill) | só E2E; gestures.js/ui 0% unit |
| F-0008 viewport-pan-zoom | viewport | 06 | 07 (pan/pinch), 15 | — |
| F-0009 interactive-drag | live.test.js | 06 (5 testes, só v1) | — | drag no v2 sem teste nenhum |
| F-0010 editor-tabs-highlight | editor, yaml-highlight | 03 | 07 (drawer), 08 (aba persiste) | overlay de highlight sem E2E; editor.js 61,5% |
| F-0011 structured-config | config-schema, config | 10 | 03, 09 (placeholder), 20 | config-editor.js 0% unit |
| F-0012 themes | **nenhum** | 02 | 01, 08 | só E2E |
| F-0013 persistence | store | 08 | 02, 04, 12 (collapse efêmero) | — |
| F-0014 splitter | **nenhum** | 04 (só desktop) | — | só E2E (wiring.js 0%) |
| F-0015 import-export | dsl-io, download | 20 | — | — |
| F-0016 edge-endpoint-styles | edge-end-styles, endpoints-attr | **nenhum** | nenhum (exemplo `containers` não é carregado) | **sem E2E** |
| F-0017 physics-routing (depr.) | 19 arquivos, 158 testes | 14, 18, 19 | 17 | oráculos fracos no 19; `assert.ok(true)` no pipeline-opt-ins |
| F-0018 debug-overlay-export | debug-export | 15, 17 | — | collision-debug.js 12,8% unit |
| F-0019 mobile-layout | **nenhum** | 07 (mobile-only) | suíte inteira no projeto mobile-chromium (04 pulado) | só E2E |

Nenhuma feature fica sem teste nenhum (unit + E2E). F-0016 não tem E2E. F-0007, F-0012, F-0014 e F-0019 não têm unit.

Densidade de asserts E2E (expects/testes estáticos): 19-perimeter 5/5 (só contagem), 13-geometry 3/1 (loop de 6 combinações), 09 59/19, 12 38/14. 43 `waitForTimeout` no total. CI com retries=1.

## 6. Os 10 arquivos mais críticos com menor cobertura
Critério: centralidade = 1 + tFanIn (módulos que dependem dele, transitivo) + tFanOut (módulos que ele alcança). Complexidade = pontos de decisão estáticos (if/for/while/case/catch/?:/&&/||/??). Risco = centralidade × pontos de decisão em linhas não cobertas. Excluídos: routing/physics deprecated e main.js.
| # | arquivo | linhas | centralidade (in/out) | decisões | decisões não cobertas | linhas % | branches % (V8) / branches não cobertos | risco |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | src/app/pipeline.js | 310 | 63 (2/60) | 47 | 47 | 0.0 | não importado | 2961 |
| 2 | src/app/wiring.js | 190 | 41 (2/38) | 36 | 36 | 0.0 | não importado | 1476 |
| 3 | src/layout/adapters/live/index.js | 550 | 27 (5/21) | 127 | 23 | 86.7 | 75.7 / 34 | 621 |
| 4 | src/app/boot.js | 160 | 87 (1/85) | 6 | 6 | 0.0 | não importado | 522 |
| 5 | src/app/gestures.js | 418 | 5 (2/2) | 89 | 89 | 0.0 | não importado | 445 |
| 6 | src/layout/compile-world.js (v2) | 318 | 17 (6/10) | 89 | 25 | 81.4 | 74.7 / 21 | 425 |
| 7 | src/renderer/collision-debug.js | 258 | 5 (3/1) | 66 | 65 | 12.8 | 66.7 / 1 | 325 |
| 8 | src/controls/config-editor.js | 317 | 4 (2/1) | 54 | 54 | 0.0 | não importado | 216 |
| 9 | src/dsl/ancestry.js | 61 | 13 (12/0) | 14 | 8 | 67.2 | 100 / 0 | 104 |
| 10 | src/layout/adapters/live/collision-waypoints.js | 397 | 12 (6/5) | 98 | 4 | 94.0 | 80.3 / 24 | 48 |

Referência (críticos e bem cobertos): anchor-utils 99,7%/93,4%; obstacle-route 100%/93,2%; ir.js 96,2%/86,7% (32 branches não cobertos); parser 94,1%/80,8% (19).

## 7. Spike de viabilidade (fora do repo)
`scratchpad/eco/testes/spike-pipeline/pipeline.spike.test.mjs`: 3 testes (custom+orthogonal, layer filter, live v2 via config) com tests/dom-mock.js e deps mockadas. 3/3 passam, e pipeline.js vai de 0% para **79,03% linhas / 29,63% branches / 46,67% funções**.

#### Q1-01 · Orquestrador src/app/pipeline.js com 0% unit; integration.test.js usa uma cópia própria do pipeline que pode divergir do real (alta, esforço P)

- **Evidência:** lcov.info não tem SF para src/app/pipeline.js (310 linhas, 47 pontos de decisão, centralidade 63 = maior entre os arquivos com lógica). tests/integration.test.js:2 diz testar 'the pipeline as wired in main.js', mas as linhas 14-22 definem um pipeline() próprio que pula o que o real faz: applyLayerFilter/applyCollapseFilter (pipeline.js:97-99), seedPositions/seedAlpha/seedLabelBBoxes (121-154), branch de engine (187-217), gates P8 clipAnchors/snapContainerExternal (222-236), graphSig/bindStoreSubscriber (270-291). Spike em scratchpad/eco/testes/spike-pipeline/pipeline.spike.test.mjs: 3 testes passaram e pipeline.js foi a 79,03% de linhas / 29,63% branches (spike-pipeline/out.txt).
- **Detalhe:** createPipeline(deps) já recebe todas as deps por injeção (pipeline.js:31-37) e a única importação bare é `yaml`, que o Node resolve pelo node_modules. Não há barreira técnica.
- **Recomendação:** Criar tests/app/pipeline.test.js que importe createPipeline com deps mockadas (store, renderer, controles) e tests/dom-mock.js, como no spike. Fazer integration.test.js usar o pipeline real em vez de reimplementar. Cobrir: layer/collapse filter, seed de continuidade, engine physics vs algebraic, gates P8 (legacy:false) e o rerender disparado por graphSig.

#### Q1-02 · Motor v2 (candidato a default) com cobertura parcial, sem nenhum E2E e sem teste de contrato de paridade v1/v2 (alta, esforço M)

- **Evidência:** src/layout/compile-world.js: 81,4% linhas, 74,7% branches, 67,9% funções. Sem cobertura: 260-300 (session.update drag/release, base do F-0009 no v2), 153-157 (constraints), 119-122 (tag buckets), 246-252 (loop rAF). `grep engine: v2` em e2e/ não acha nada. Só tests/layout/compile-world.test.js usa v2 (7 testes chamando startLayoutV2 direto; adapter.start com live.engine:'v2' não é testado). compile-world.js tem 0 ocorrências de seedPositions/reportLabelBBox/labelBBoxes/edgeWaypoints; live/index.js tem 7; pipeline.js:121-154,215,254 consome esses campos. O typedef LayoutSession em src/layout/adapter.js não declara alpha/reportLabelBBox/labelBBoxes/edgeWaypoints. Testes: src/physics 39 + compile-world 7 = 46, contra 158 do routing deprecated.
- **Recomendação:** Antes de decidir v2 como default: (1) uma bateria de invariantes parametrizada por engine (v1 e v2), com sem-overlap por collision layer, pin, container contém filhos, drag/release, continuidade por seed e label bbox; (2) formalizar no typedef LayoutSession os campos opcionais que o pipeline consome e testar o contrato; (3) acrescentar live+v2 ao e2e/13-geometry-invariants e um drag v2 no e2e/06.

#### Q1-03 · src/physics: 98,6% de linhas esconde 76,9% de branches; guardas, clamps e casos de constraint nunca exercitados (media, esforço P)

- **Evidência:** Branches: constraints/index.js 46,2% (casos 'rect'/'circle' nas linhas 82-83 nunca entram; clamps 32-33, 72-74 só num lado); connectivity-spring.js 50%; tag-forces.js 53,3% (bucket ausente 27/45, auto-par 48); solver.js 63,6% com kick() e set alpha nunca chamados (FNDA:0); integrator.js 76,2% (clamp de velocidade negativa 45-46). O guard `if (!world.alive[slot])` nunca fica falso em nenhum arquivo, ou seja, slots mortos/despawn nunca são testados. physics/registry.js: registerContributor/registerField/getField com FNDA:0, e o módulo não é alcançável a partir de src/main.js (só tests/physics/solver.test.js o importa).
- **Recomendação:** Testes de tabela ou de propriedade por contributor e constraint, cobrindo os dois lados de cada clamp, slot morto, kick/reheat e velocidade negativa. Decidir se physics/registry.js entra no compile-world ou sai (hoje é API de extensão sem uso). Como o motor é o foco de pesquisa do projeto, exigir branches ≥ 90% em src/physics.

#### Q1-04 · Camada de interação/UI (1.615 linhas) só coberta por E2E, e a cobertura do E2E não é medida (media, esforço M)

- **Evidência:** Sem nenhum import em teste unit: gestures.js 418 linhas / 89 pontos de decisão (o arquivo mais ramificado sem cobertura), config-editor.js 317/54, wiring.js 190/36, boot.js 160, ui/action-fab.js 95, ui/context-menu.js 74, ui/menu-button.js 44, main.js 7. F-0007, F-0012, F-0014 e F-0019 não têm nenhum teste unit (manifest features/*.md: tests só e2e). Playwright tem page.coverage.startJSCoverage, só em Chromium (node_modules/playwright-core/types/types.d.ts:18883-18934), e não é usado.
- **Recomendação:** (1) Coletar cobertura JS do E2E (Chromium) com page.coverage + v8-to-istanbul e fundir com o lcov unit, para ter um número real por arquivo. (2) Extrair a máquina de estados de gestos (tap/double-tap/drag/pinch) de gestures.js para uma função pura testável em node. (3) Testes do config-editor com dom-mock.

#### Q1-05 · F-0016 (edge-endpoint-styles) sem nenhum teste E2E (media, esforço P)

- **Evidência:** `grep -nE 'startStyle|endStyle|marker'` em e2e/*.spec.js não acha nada (os matches 'arrow' são 'keyboard arrows' em 04 e 'narrows' em 09). O exemplo que usa startStyle/endStyle é `containers` (src/dsl/examples.js:198-207); o default é `quad` (store.js:30) e e2e/13 só carrega `intro` (13:26). O manifest F-0016 lista só testes unit (edge-end-styles.test.js, endpoints-attr.test.js).
- **Recomendação:** Acrescentar a e2e/11 ou e2e/13 um caso que carregue o exemplo `containers` (ou uma DSL mínima com endStyle: filledArrow) e verifique o <marker>/path de ponta no SVG, nos dois projetos.

#### Q1-06 · Forças por tag (attractTo/repelFrom) e constraint parent-bounds do live v1 sem teste de efeito (media, esforço P)

- **Evidência:** README.md:105 e :195 prometem efeito visível no layout live. live/index.js 296-322 (loop de attractTo/repelFrom) e 413-425 (parent-bounds) não estão cobertos. tests/dsl/ir.test.js:213-218 só testa o parse. e2e/13-geometry-invariants.spec.js:19-21 exclui live e `forces` de propósito, e nenhum spec usa attractTo/repelFrom.
- **Recomendação:** Teste unit com 3 nós: um com attractTo:{t:1} tem de terminar mais perto do grupo t do que sem a força; o mesmo para repelFrom e parent-bounds. Os mesmos testes servem como paridade v1/v2 (ver Q1-02).

#### Q1-07 · Oráculos fracos em testes existentes: parecem cobrir, não verificam (media, esforço M)

- **Evidência:** e2e/19-perimeter-rail-redesign.spec.js: 5 testes, 5 expects, que só conferem o número de arestas ou um atributo do IR (ex.: :44 `expect(edges).toBe(4)`), enquanto os títulos prometem 'anchors deslizam pelos perímetros' / 'separam via BBox'. snap() grava PNG em screenshots-redesign/ sem comparar (19:15-20). tests/routing/pipeline-opt-ins.test.js:34-35 tem `void flagged; assert.ok(true)`. e2e/13 roda 1 exemplo × {custom,off} × 3 routers = 6 combinações, sem live. 43 waitForTimeout nos specs (06 tem 14) e playwright.config retries: CI ? 1 : 0, o que pode esconder flakiness.
- **Recomendação:** Trocar o oráculo do e2e/19 por invariantes geométricos (reusar e2e/invariants.js, já testado a 99,4% por tests/e2e-invariants.test.js) ou por toHaveScreenshot. Remover ou reescrever o assert.ok(true). Trocar sleeps fixos por espera de 'end'/alpha < alphaMin exposto em window.

#### Q1-08 · O routing deprecated infla as métricas: 19,8% dos testes e 16,4% do código vão sumir na Fase 4 (baixa, esforço P)

- **Evidência:** tests/routing/physics/: 19 arquivos, 158 de 797 testes (contagem por diretório com --test-reporter=tap). src/routing/physics: 1.952 linhas com 98,1% de cobertura. A média efetiva cai de 80,7% para 77,3% sem ele (per-sub.md).
- **Recomendação:** Reportar cobertura já excluindo src/routing/physics (--test-coverage-exclude). Antes de remover, converter os cenários de regressão comportamental (fission, fusion, perimeter-clamp, snap-selection, hard-fission) em specs agnósticas de engine, para servirem de aceite da Fase 4.

#### Q1-09 · Shapes não-rect meio implementadas e quase sem teste (baixa, esforço P)

- **Evidência:** Funções %: circle 28,6%, diamond 14,3%, polygon 14,3%, star 14,3% (bbox, boundaryHitFromAngle, vertices... com FNDA:0). Só existe tests/shapes/rect.test.js. O atributo `shape` é aceito (src/dsl/attr-set.js:60, src/dsl/ir.js:275) e consumido por snap-resolver.js:35, mas `grep shape` em src/renderer/nodes.js não acha nada (o nó é desenhado sempre como rect). Nenhuma feature do Manifest cobre shapes.
- **Recomendação:** Decidir se shapes é feature (criar F-NNNN + render + testes) ou código dormente a remover. Se ficar, testar boundaryHit*/namedAnchors de cada forma, que alimentam o snap de âncoras.

#### Q1-10 · CI não mede nem exige cobertura (baixa, esforço P)

- **Evidência:** .github/workflows/deploy-tensegrams.yml:31 roda `node --test $(find tests -name '*.test.js')` sem --experimental-test-coverage. package.json não tem script de coverage. O Node 22 já suporta --test-coverage-lines/branches/functions e --test-coverage-exclude (node --help).
- **Recomendação:** Acrescentar ao job test: --experimental-test-coverage --test-coverage-exclude='tests/**' --test-coverage-exclude='src/routing/physics/**' e thresholds iniciais conservadores (ex.: lines 80, branches 80). Lembrando que o Node não conta arquivos não importados (ver Q1-01/Q1-04), então o threshold sozinho não pega módulos sem teste.

#### Q1-11 · Arquivos de lógica pura importantes com trechos sem teste: ancestry.descendantLeaves, collision-debug (baixa, esforço P)

- **Evidência:** src/dsl/ancestry.js:40-60 (descendantLeaves, usado no drag de container) tem 0% unit; o arquivo é importado transitivamente por 12 módulos. src/renderer/collision-debug.js tem 12,8% linhas / 14,3% funções (renderCollisionDebugOverlay FNDA:0), coberto só pelo e2e/15. src/editor.js tem 61,5% (overlay de highlight 76-91 sem cobertura), e nenhum E2E verifica o highlight (grep 'highlight' em e2e/ não acha nada).
- **Recomendação:** Testes unit baratos com dom-mock para descendantLeaves (árvore aninhada) e para renderCollisionDebugOverlay (estrutura do SVG gerado). Um assert de .editor-highlight no e2e/03.

#### Q1-12 · Números de referência divergentes: baseline do dossiê e api declarada no Manifest (info, esforço P)

- **Evidência:** O dossiê diz 83 arquivos de teste; `find tests -name '*.test.js' | wc -l` = 78 (79 com tests/dom-mock.js). A soma por diretório bate com 797 testes. F-0001 declara `api: src/app/pipeline.js::runPipeline` (.feat-memory/manifest/features/F-0001-dsl-to-diagram.md:10), mas esse símbolo não existe: o export é createPipeline (pipeline.js:31) e `grep runPipeline src tests` não acha nada.
- **Recomendação:** Corrigir a contagem no dossiê/relatórios e o campo api do F-0001 (createPipeline). Considerar uma checagem no `feat-memory audit` que valide se os símbolos `api:` existem.

## Apêndice B · Mutation testing (16 de 30 mutantes mortos)

Teste de mutação da suíte unit do Tensegrams, feito no worktree isolado /home/user/tensegrams/.claude/worktrees/wf_3456ef24-350-1. Antes de editar, confirmei que o toplevel não é /home/user/tensegrams. Linha de base verde: 797/797 testes em 78 arquivos, cerca de 6 s (o dossiê fala em 83 arquivos; o `find` retorna 78, tanto no repo principal quanto no worktree).

Método: 30 mutações de linha única, distribuídas por 23 arquivos dos módulos centrais. Um harness em Node (scratchpad/mutrun.mjs) aplicava cada mutação por substituição exata de string, com unicidade e linha conferidas antes. Depois rodava a suíte inteira (`node --test --test-concurrency=2`), classificava pelo conteúdo do TAP (`# pass`/`# fail`) e pelo exit code, e revertia com `git checkout -- <arquivo>`, conferindo `git status` a cada passo. Nenhum mutante foi descartado como equivalente: rodei uma sonda comparando original e mutante (scratchpad/probes.mjs + proberun.mjs) para cada um dos 14 sobreviventes, e todos mostraram diferença mensurável. Limpeza final: symlink removido e `git status --porcelain` vazio (confirmado).

RESULTADO: taxa de mutação geral de 16/30 = 53,3%. Por subsistema: DSL 100%; physics 62,5%; live 50%; routing 43%; compile-world + layout/collision 25%; pipeline e renderer 0%.

Por que os mutantes sobrevivem:
1. **Cobertura assimétrica.** O teste verifica um eixo ou sentido só, e o bug entra pelo outro:
   - waypoint com fuga só em y (M12);
   - velocityCap só em +x (M15);
   - edgeEdgePair testa 1 das 4 combinações de endpoint compartilhado (M09);
   - T de cruzamento em uma orientação só (M25);
   - roteador ortogonal checa só o sourceAnchor (M28).
2. **Asserções fracas, só de "contém" ou "não sobrepõe".** O frame do container no v2 pode deslocar 22 px porque pad=24 é maior que o header (M07). O teste de pad da colisão não tem força competidora, e a inércia leva os corpos além do contrato (M16).
3. **Knobs públicos nunca testados fora do default:** `substeps` (M18), peso de colisão 1 no v2 (M06), cenário com 2+ obstáculos (M24).
4. **Zero cobertura:** nenhum teste unit importa src/app/pipeline.js (M29), e a posição do label nunca é verificada (M30).
5. **Otimalidade do A\* não testada:** só se checa "não cruza o obstáculo" (M23).

Bug pré-existente encontrado ao ler o código (não é mutante): no motor v2, `src/physics/solver.js:42` fixa um piso em `alpha = Math.max(alphaMin, ...)`, enquanto `src/layout/compile-world.js:240/244` testa `alpha < cfg.alphaMin`. Com qualquer corpo móvel, o evento 'end' nunca é emitido e o loop de requestAnimationFrame nunca para (CPU contínua no navegador). Sonda scratchpad/v2end.mjs: 5000 ticks, ended=false, alpha=0.003. O único teste de 'end' no v2 (tests/layout/compile-world.test.js:86) usa uma cena toda pinada.

Lacuna de paridade v1/v2, relevante para a decisão pendente de tornar o v2 o default: no v2, containers com filhos não são corpos (`compile-world.js:73-74`). Por isso uma folha estrangeira com a mesma nodeLayer fica dentro do frame do container: o v2 dá overlap=true, o v1 dá false (sonda scratchpad/extra-probes.mjs). Consequência: os checks de ancestral do pairFilter (`compile-world.js:105-111`) são código morto entre corpos. Além disso, o v2 não passa velocityCap (o v1 tem maxVel=32), o que torna M15 latente hoje.

Artefatos, todos em /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/: mutants.json (specs), mutrun.mjs, mut-results.json (resultado por mutante, com os testes que falharam), probes.mjs, proberun.mjs, probe-results.json, extra-probes.mjs, v2end.mjs.

Mortos, com o teste que matou:
- M01 parser canonicalEdgeKey: "decoration written as [b, a]…"
- M02 parser off-by-one: 4 falhas
- M03 ir clamp: "weight > 1 clamped to 1"
- M04 ir _hasChildIntent: 18 falhas
- M05 config array: "a non-map config is rejected"
- M08 computeSplit invertido: 9 falhas
- M10 sinal do atrator central do live
- M11 2*pad no hardSeparatePair: "PADDED BBoxes … do NOT overlap"
- M14 ordem do damping
- M17 eixo da colisão
- M19 spatial-grid cx1: 6 falhas
- M20 world grow
- M21 parent-bounds header
- M22 midPoint
- M26 face-select
- M27 snap-endpoints

| Subsistema | Arquivos (mortos/mutantes) | Mutantes | Mortos | Sobreviventes | Taxa |
|---|---|---|---|---|---|
| src/dsl | parser.js 2/2 · ir.js 2/2 · config.js 1/1 | 5 | 5 | 0 | 100% |
| src/physics | integrator.js 1/2 · collision.js 1/2 · solver.js 0/1 · spatial-grid.js 1/1 · world.js 1/1 · constraints/index.js 1/1 | 8 | 5 | 3 | 62,5% |
| src/layout/adapters/live | index.js 1/1 · collision-resolution.js 1/1 · collision-waypoints.js 0/1 · pins.js 0/1 | 4 | 2 | 2 | 50% |
| src/routing | geometry.js 1/1 · obstacle-route.js 0/2 · crossings.js 0/1 · face-select.js 1/1 · snap-endpoints.js 1/1 · routers/orthogonal.js 0/1 | 7 | 3 | 4 | 42,9% |
| src/layout (compile-world + collision) | compile-world.js 0/2 · collision.js 1/2 | 4 | 1 | 3 | 25% |
| src/app/pipeline.js | pipeline.js 0/1 (nenhum teste unit importa o módulo) | 1 | 0 | 1 | 0% |
| src/renderer/edges.js | edges.js 0/1 | 1 | 0 | 1 | 0% |
| **Total** | 23 arquivos | **30** | **16** | **14** | **53,3%** |

Equivalentes descartados: 0. Os 14 sobreviventes mostraram diferença mensurável em sonda original vs mutante.

### Sobreviventes

- `src/layout/compile-world.js:92` — `Math.max(MASS_EPS, 1 - maxWeight(n.nodeCollision))` → `1 - maxWeight(n.nodeCollision)` (piso de massa removido). **Efeito:** No v2, um nó com `nodeLayers: {g: 1}` fica com invMass 0 e congela na semente do círculo. Sonda: original anda 37,97 px (160,-15 → 122,-15); mutante anda 0. Viola o D-massa (peso 1 deve ficar pesado, não imóvel). Se todos os nós tiverem peso 1, alpha0 vira 0 e o diagrama nunca anima. **Teste sugerido:** tests/layout/compile-world.test.js: cena com a {nodeLayers:{g:1}} e b {nodeLayers:{g:0}}; após N ticks, assert que `a` se afastou da posição inicial (> 1 px) e que b cedeu mais que a.
- `src/layout/compile-world.js:207` — `y: minY - pad - HEADER` → `y: minY - pad` (header esquecido no rect do container com filhos). **Efeito:** O frame do container no v2 desce 22 px: a faixa de título fica sobre o primeiro filho e sobram 46 px vazios embaixo. Sonda: folga topo/base 46/24 no original e 24/46 no mutante. O teste atual só checa 'filho dentro do frame', o que passa porque pad=24 é maior que header=22. **Teste sugerido:** compile-world.test.js 'container deriva rect…': assert exato frame.y === min(filho.y) - pad - 22 e frame.y+height === max(filho.y+h) + pad; ou teste de paridade com o computeContainerRects do v1.
- `src/layout/collision.js:129` — remove o termo `a.target === b.source ||` da exclusão de endpoint compartilhado em edgeEdgePair. **Efeito:** Arestas em cadeia (a→b, b→c) com edgeLayers comum deixam de ser excluídas. Sonda: edgeEdgePair retorna 'COLIDE' em vez de null. O A* e os waypoints passam a tratar a vizinha como obstáculo e desviam/tremem junto ao nó comum, exatamente o que o comentário da linha 128 quer evitar. **Teste sugerido:** tests/layout/collision.test.js 'edges sharing an endpoint are excluded': parametrizar as 4 combinações (s=s, s=t, t=s, t=t). Hoje só s=s ([a,b] x [a,c]) é testada.
- `src/layout/adapters/live/collision-waypoints.js:207` — `strip.wvx[j] += pen.x * pair.frac.edge * k` → `-=` (sinal invertido na força em x). **Efeito:** Um waypoint dentro de um nó alto (fuga mais curta horizontal) é empurrado mais para dentro. Sonda: wvx +3,75 → -3,75. A aresta passa a atravessar o nó obstáculo. O teste atual só exercita fuga em y. **Teste sugerido:** collision-waypoints.test.js: blocker 40x300, waypoint 5 px à direita do centro; assert wvx[0] > 0 e wvy[0] === 0 (espelho em x do teste 'waypoint dentro de blocker').
- `src/layout/adapters/live/pins.js:44` — remove `if (leaves[i].pinned) continue;` em unfreezeOthersAfterRelease. **Efeito:** No modo frozen (o default), arrastar e soltar QUALQUER outro nó apaga o fx/fy dos nós com pin da DSL, que então derivam para o centro. Sonda: p com pin [300,300] termina em (-38,4; 3,7). **Teste sugerido:** tests/layout/adapters/live.test.js, bloco 'frozen mode': cena com p {pin:[300,300]} + a,b,c; drag e release de b; runUntilSettled; assert p em (300,300). Opcional: teste unit direto de pins.js, que hoje não tem nenhum.
- `src/physics/integrator.js:46` — `if (vy > cap) vy = cap; else if (vy < -cap) vy = -cap;` → `if (vy > cap) vy = cap;`. **Efeito:** velocityCap fica assimétrico: velocidade negativa em y sem limite (sonda: vy -1000 em vez de -16). Hoje é LATENTE, porque nenhum chamador de produção passa velocityCap (o v2 não liga o equivalente ao maxVel=32 do v1). Passa a afetar o diagrama quando essa paridade for ligada: explosões verticais no seed. **Teste sugerido:** tests/physics/integrator.test.js 'velocityCap limita a velocidade': testar os 4 sentidos (+x, -x, +y, -y), não só +x.
- `src/physics/collision.js:62` — `const sx = HALF_W_a + HALF_W_b + 2 * pad` → `+ pad` (contrato da padded BBox no eixo x). **Efeito:** Com força competidora (atrator central), o gap de equilíbrio em x cai de 36 para 28 (sonda). Nós lado a lado ficam com metade do respiro, e o comportamento diverge do eixo y e do v1. O teste atual não tem força competidora: a inércia empurra os corpos além do contrato e mascara o bug. **Teste sugerido:** collision.test.js 'contrato de pad': adicionar um atrator central fraco (ou usar solver + central) e assert gap >= 2*half + 2*pad - eps E gap <= esse valor + 1 (convergência ao contrato), nos eixos x e y.
- `src/physics/solver.js:33` — `const dt = baseDt / substeps;` → `const dt = baseDt;`. **Efeito:** Com `live: {engine: v2, substeps: 4}` (knob público), cada tick integra 4 vezes o tempo. Sonda: x após 1 tick = 40 em vez de 10. A animação fica 4 vezes mais rápida e perde a estabilidade, que era o motivo do sub-stepping. **Teste sugerido:** tests/physics/solver.test.js: mesmo mundo (corpo com vx=10, sem forças, damping 1) com substeps 1 e 4; assert deslocamento idêntico após 1 tick.
- `src/routing/obstacle-route.js:174` — `inDir !== -1 && inDir !== d ? TURN_PENALTY : 0` → `inDir === d` (penaliza seguir reto). **Efeito:** O A* passa a premiar curvas: desvios em escada. Sonda com 3 obstáculos: 4 curvas e 6 vértices no mutante, contra 3 curvas e 5 vértices no original. As rotas ficam visualmente mais tortas nos modos custom/off e nas sementes do live. **Teste sugerido:** obstacle-route.test.js: cenário com vários caminhos de mesmo comprimento; assert que hananRoute devolve o de menos curvas (ex.: path.length === 5 para o obstáculo único 80..120 x -50..50).
- `src/routing/obstacle-route.js:50` — `obstacles.some(o => segmentHitsRect(...))` → `obstacles.every(...)`. **Efeito:** Com 2+ nós da mesma nodeLayer, dos quais só um está no caminho, a aresta não desvia e atravessa o nó. Sonda: desviou=true, 5 pontos → desviou=false, 2 pontos. Os testes atuais têm sempre 1 obstáculo, caso em que some e every coincidem. **Teste sugerido:** obstacle-route.test.js: aresta com nodeLayers [w], nó 'blk' no caminho e nó 'far' fora, ambos [w]; assert que a rota desvia e nenhum segmento cruza blk.
- `src/routing/crossings.js:49` — `v.c > h.lo + eps && v.c < h.hi - eps` → `v.c > h.lo - eps && v.c < h.hi + eps`. **Efeito:** Um T em que a HORIZONTAL termina sobre a vertical, e também um roçar sub-pixel, passam a contar como cruzamento. Sonda: 0 → 1. A métrica infla e o face-select faz flips de face desnecessários, reroteando arestas que não cruzam. O teste de T atual só cobre a vertical terminando na horizontal. **Teste sugerido:** tests/routing/crossings.test.js: T simétrico (horizontal [0,50]→[50,50] com vertical x=50) → 0; e horizontal terminando 0,4 px além da vertical → 0.
- `src/routing/routers/orthogonal.js:38` — `y: dy >= 0 ? t.y : t.y + t.height` → `dy >= 0 ? t.y + t.height : t.y` (face do alvo trocada). **Efeito:** Na geometria vertical-dominante, a aresta termina na face de BAIXO do alvo (y=540 em vez de 500): atravessa o nó alvo e a seta aparece de dentro dele. Sonda: targetAnchor (80,500) → (80,540). O teste 'vertical-dominant' só verifica o sourceAnchor. **Teste sugerido:** tests/routing/routers/orthogonal.test.js 'vertical-dominant geometry exits top/bottom': também assert targetAnchor.y === 500 (face de cima do alvo); e o caso simétrico, alvo acima (dy < 0).
- `src/app/pipeline.js:214` — `orthogonal: store.state.routerId === 'orthogonal'` → `!==`. **Efeito:** Com o roteador ortogonal, o live e waypoints, o reshape deixa de manhattanizar e surgem segmentos DIAGONAIS. Sonda no applyObstacleRouting com o flag que o pipeline passa: 0 → 2 diagonais. O roteador straight passa a ganhar escadas. Nenhum teste unit importa src/app/pipeline.js. **Teste sugerido:** Extrair a montagem das opções de roteamento do tick (flags orthogonal/legacy/clip/snap) para uma função pura (ex.: `routingOptsFor(state, mergedOpts, session)`) e testá-la; ou um teste de integração do pipeline com tests/dom-mock.js, com router ortogonal + waypoint e assert de todos os segmentos axis-aligned.
- `src/renderer/edges.js:36` — `label.setAttribute('y', mid.y - 4)` → `mid.y + 4`. **Efeito:** O label da aresta é desenhado ABAIXO da linha (sonda: y=104 contra linha em 100; original 96) e fica sobre o traço. O posicionamento do label nunca é verificado. **Teste sugerido:** tests/renderer/edges.test.js: com points [(0,100),(200,100)] e label 'L', assert text.x === 100 e text.y === 96 (midPoint - 4). Idealmente também para polilinha de 4 pontos.

## Apêndice C · Qualidade dos testes

A suíte unitária é rápida (5,3 s em paralelo, 11,6 s serial) e determinística: os 797 testes passam, e `src/` não usa Math.random. Também é bem escrita no micro: 73% das asserções são equal/deepEqual; há um teste diferencial (grid comparado com força bruta) e um teste contrastivo (controlador P comparado com PI); e os detectores do oráculo geométrico têm testes próprios, com casos positivos e negativos. O problema está no macro: a suíte testa casos pontuais da implementação atual e não os invariantes que vão importar nas próximas decisões.

Evidências principais, todas medidas nesta sessão:
(1) Ao reaplicar em v2 a suíte de contrato do adapter live (35 testes, que hoje só roda em v1), 8 falham. O v2 ignora `seedPositions`: compile-world.js não referencia o campo, e o pipeline passa esse seed a cada edição. Também falham pin snap-back, container×folha e kill-switch. A decisão de tornar o v2 o default não tem nenhum teste que a sustente.
(2) O oráculo geométrico mais forte (e2e/invariants.js, B6/B7/B8) não gateia nada. Só é chamado por `npm run debug:assert`, fora do CI. A spec 13 aplica uma versão reduzida a um único exemplo.
(3) Um spike de property-based testing com fast-check (devDependency, sem conflito com o ADR-0006) rodou 5 propriedades em cerca de 1,6 s:
- Achou um bug real: o router ortogonal, depois do pós-processamento, emite um segmento diagonal quando os centros dos nós diferem ≤0,5 px (DUP_TOL em anchor-utils.js:290).
- Também detectou em 3 casos uma regressão simulada (nodePad ignorado no v2). Os testes atuais não veem essa regressão, porque usam nodePad 12, que é igual ao default.
(4) Vários testes não podem falhar ou afirmam mais do que o título promete: `assert.ok(true)`, "aceita config sem crash", as screenshots da spec 19 sem comparação e os gates P8 do pipeline, que nunca são exercitados.
(5) Os limiares de física são frouxos mesmo havendo oráculo analítico. O resíduo P teórico é 6,667 e o teste só exige que seja >1. A mola converge em 40,000, mas o teste aceita <80 ou <120. E "settled" significa só o fim do cronograma de alpha (439 ticks fixos), não equilíbrio físico.
(6) src/app/pipeline.js (o orquestrador) e outros 1.624 linhas de `src/` nunca são carregados pelos testes unitários. Além disso, integration.test.js reimplementa o pipeline. Cobertura de linhas: 93,3% nos arquivos carregados e 80,7% contando os que nunca carregam.
(7) Legado: o routing físico deprecated responde por 158 testes (19,8%) e 2.951 linhas (27,3% das linhas de teste). Somando o layout v1, a razão entre testes de legado e testes do motor novo é de cerca de 212:46. Uns 35 testes do legado codificam regras de domínio que devem ser portadas como invariantes; o resto é mecânica descartável.
(8) E2E: 49 `waitForTimeout` fixos esperando a simulação assentar, sem nenhum sinal de convergência exposto. `retries:1` no CI, sem `failOnFlakyTests`, esconde flakiness. Não há snapshot de pixel no gate: o único teste por pixel está em e2e-prod e é manual, embora tenha nascido justamente de um bug que passou nos checks só de DOM.

#### Q2-01 · Motor v2 sem testes de contrato: 8 dos 35 testes do adapter live falham quando reaplicados ao v2 (alta, esforço M)

- **Evidência:** Todo o arquivo tests/layout/adapters/live.test.js foi rodado com o wrapper live.engine='v2' (script em testes/v2-parity/live-v2.test.mjs). Resultado: 27 passam e 8 falham.
- 'release of a DSL-pinned node snaps back to its pin': actual 999, expected 10.
- 'kill-switch live.collision=false'.
- 'sibling containers sharing a layer separate'.
- 'foreign leaf is pushed out of a container'.
- 4 testes de warm restart. Exemplo: seed x=100 deu 110; alpha inicial ficou 1 em vez de <=0.5.
A causa do warm restart está verificada: `grep seed src/layout/compile-world.js` não retorna nada, e src/app/pipeline.js:121-156 injeta live.seedPositions a cada rerender, então o v2 'reexplode' a cada edição.
O v2 tem só 7 testes (tests/layout/compile-world.test.js). Nenhum spec E2E usa live.engine v2: `grep -rn v2 e2e` volta vazio.
- **Detalhe:** Parte das falhas pode ser diferença intencional; kill-switch e knobs exclusivos do v1 são candidatos. Mas seedPositions, pin snap-back e container×folha são comportamento de produto usado pelo pipeline. Hoje nada impede virar o default com essas regressões.
- **Recomendação:** Parametrizar live.test.js por engine (um loop sobre ['v1','v2'] em volta dos describes). Onde a diferença for intencional, marcar com test.skip e o motivo, por exemplo quando um knob só existe no v1. Tornar essa suíte verde em v2 o critério objetivo da decisão pendente de mudar o default. Acrescentar ao menos 1 spec E2E com live.engine: v2.

#### Q2-02 · O oráculo geométrico forte (B6/B7/B8) não gateia nada; a spec 13 cobre só 1 exemplo, e um bug real passou (alta, esforço M)

- **Evidência:** assertGeometryInvariants (e2e/invariants.js:24) só é chamado em e2e/debug-snapshot.js:121, exposto como `npm run debug:assert` (package.json:16), que não roda no CI (.github/workflows/deploy-tensegrams.yml:29,47). Os testes unitários (tests/e2e-invariants.test.js) testam o detector, não o produto.
e2e/13-geometry-invariants.spec.js:26-28 checa apenas perímetro e ausência de diagonal, com EXAMPLES=['intro'] e layouts custom/off.
O PBT (testes/pbt/pbt-pipeline.test.mjs) achou uma diagonal na saída ortogonal pós-clip. Reprodução mínima (testes/pbt/repro-min.mjs): a:{pin:[0,200],size:[40,40]}, b:{pin:[0.5,0],size:[40,40]} dá [[20,200],[20,120],[20.5,40]]. Com dx=0.5 o resultado é DIAGONAL; com dx>=1 está ok.
Causa: simplifyCollinear em src/routing/anchor-utils.js:290-300 descarta o ponto com DUP_TOL=0.5 e não realinha o vizinho. O comentário em :287-289 mostra que essa constante de produção foi calibrada pela tolerância do teste.
- **Detalhe:** Visualmente a diagonal é sub-pixel, mas no layout live nós empilhados com centros a <0,5 px de distância são comuns, porque as posições são float. O ponto principal é outro: o invariante que o projeto declarou (a spec 13 usa tolerância 0.01) é violado, e nenhum gate detectaria isso.
- **Recomendação:** (a) Chamar assertGeometryInvariants dentro da spec 13 e ampliar a matriz para todos os __examples__, incluindo live com espera por convergência (ver Q2-09). (b) Levar os mesmos invariantes para o nível unitário, como propriedade sobre a cadeia router → applyObstacleRouting → clipAnchors → snapContainer (a spec 13 é só uma amostra). (c) Restringir o B8 a polilinhas: em curvas ele dá falso positivo, porque pontos de controle colineares são legítimos, como o PBT mostrou para `curved`. (d) Corrigir o dedup para realinhar o vizinho, ou aplicar o DUP_TOL só a pontos com as duas coordenadas iguais.

#### Q2-03 · Não há property-based testing; o spike mostra custo baixo e ganho alto (alta, esforço M)

- **Evidência:** Nenhum teste gera entradas; a única exceção é o LCG semeado em tests/physics/spatial-grid.test.js:43. Spike com fast-check 3 em testes/pbt/ (devDependency, que não afeta o ADR-0006):
- P1: parse+buildIR é total em 1000 documentos aleatórios, sem lançar exceção, com diagnósticos {line>=0, msg} bem-formados e determinísticos.
- P2: o IR é fiel ao grafo gerado e [a,b] ≡ [b,a] (ADR-0003).
- P3: routers. Achou o bug do Q2-02 com 69 casos.
- P4: v1 e v2 sem overlap padded com pad aleatório de 0 a 20.
Tempo total: 1,57 s de wall.
Mutação simulada: passar nodePad sob uma chave ignorada (equivale a remover compile-world.js:67) faz o P4 v2 falhar em 3 casos. A suíte atual não detecta essa regressão, porque compile-world.test.js:30,60,129 usa nodePad 12, igual ao default collisionPadding 12 (compile-world.js:42), e só verifica overlap sem pad (:15-18).
- **Detalhe:** As propriedades do spike cabem em cerca de 150 linhas e custam menos de 2 s, contra 5,3 s da suíte inteira. Para a Fase 4, invariantes de domínio escritos como propriedades são a rede de segurança natural contra a troca de implementação.
- **Recomendação:** Adotar fast-check como devDependency e começar pelas áreas com melhor retorno: (1) pós-processamento de routing (âncora no perímetro, ausência de diagonal no ortogonal, B6/B7/B8); (2) layout v2 (sem overlap padded, pin fixo, filho dentro do container, convergência); (3) parser/IR (totalidade, linhas dos diagnósticos, canonicidade de arestas); (4) colisão física com massas e posições aleatórias (força igual e oposta, pinado imóvel). O integrador rende menos: os testes analíticos atuais já bastam. Fixar a seed no CI e registrá-la na falha.

#### Q2-04 · Testes que nunca podem falhar ou cujo título promete mais do que a asserção verifica (media, esforço P)

- **Evidência:** - tests/routing/pipeline-opt-ins.test.js:34-35: `void flagged; assert.ok(true)`.
- pipeline-opt-ins.test.js:63-81: o título diz testar os gates `algebraic.legacy` (clip, spacing, snap), mas o teste chama runPhysicsRouter, que não lê essas flags (`grep legacy src/routing/physics` só mostra 'legacy pin'). Os gates vivem apenas em src/app/pipeline.js:229-243, que nenhum teste carrega.
- tests/routing/physics/phase4.test.js:106-138: 3 testes do tipo 'aceita config sem crash' com assert.ok(get('e1')).
- tests/layout/compile-world.test.js:122: o título diz 'nenhum contributor de mola é adicionado', mas o teste só verifica ausência de overlap. Em :82-83 há doesNotThrow com asserção truthy. Em :86, 'emite tick e end' só checa o end.
- e2e/19-perimeter-rail-redesign.spec.js: os 5 testes tiram screenshot sem comparar com nada (:18-22) e só verificam a contagem de arestas do IR ou o parse (:43,71,94,117,139), então não falham por comportamento físico.
- tests/physics/collision.test.js:96: o laço sobre _acc passa vacuamente se o Map estiver vazio.
- phase5-curved.test.js:177: 'valor default = 6' é um detector de mudança.
- tests/integration.test.js:141-157 ('route cleanly') só exige ≥2 pontos, o que passa mesmo com applyObstacleRouting desligado. Rodando o cenário (testes/integ-blk.mjs), straight e curved desviam (5 pontos) e o orthogonal não desvia (2 pontos). A diferença entre routers não foi investigada.
- **Recomendação:** Remover ou reescrever: substituir 'sem crash' por uma asserção de efeito, por exemplo segmentos cruzando o obstáculo = 0 (existe segmentHitsRect em src/routing/obstacle-route.js:217). Testar os gates P8 com createPipeline e fakes. Na spec 19, comparar uma métrica geométrica (cruzamentos, âncoras no perímetro) em vez de só tirar screenshot. Em loops sobre coleções internas, afirmar primeiro que a coleção não está vazia.

#### Q2-05 · Limiares mágicos e frouxos em testes de física, mesmo com oráculo analítico disponível; 'settled' é só cronograma de alpha (media, esforço P)

- **Evidência:** Medido em testes/margins.mjs e testes/margins2.mjs:
- tests/physics/collision.test.js:76 exige `residualP > 1`. O equilíbrio analítico do P puro é PULL/Kp = 2/0.3 = 6,667, e o valor medido é exatamente 6,667.
- tests/physics/solver.test.js:59 exige `d1 < 80` para rest=40; medido 40,000.
- tests/layout/compile-world.test.js:119 exige `dOn < 120` para rest=40; medido 40,00.
- tests/layout/adapters/live.test.js:251 usa `< 40` sem justificativa. Em :650 usa `gap(wide) > gap(tight) + 50`, quando o esperado é cerca de 2·Δpad = 172.
- testes/determinism.mjs: em v1 e v2, todos os exemplos 'assentam' em exatamente 439 ticks, que é ln(0.005)/ln(1-0.012), com alphaDecay em compile-world.js:45. Ou seja, runUntilSettled para pelo cronograma e não pelo equilíbrio, e nenhum teste mede velocidade ou força residual.
- **Detalhe:** Limiares 2 a 3 vezes acima do valor real deixam passar regressões de calibração, por exemplo um rest length dobrado. Isso importa porque a calibração do v2 ainda é descrita como 'provisória'.
- **Recomendação:** Derivar tolerâncias do equilíbrio analítico, com constantes nomeadas: assert |pen - PULL/Kp| < 0.05 e |d - rest| < 1. Acrescentar um invariante de repouso (max|v| < ε e overlap padded <= tol depois de settle), que também serve de critério para a Fase 4. Documentar a origem de cada limiar que sobrar.

#### Q2-06 · O orquestrador src/app/pipeline.js não é testado em unidade; integration.test.js reimplementa o pipeline (media, esforço M)

- **Evidência:** Cobertura medida com `node --test --experimental-test-coverage`. Os arquivos a seguir nunca são carregados pelos testes unitários: src/app/pipeline.js (310 linhas), src/app/gestures.js (418), src/app/boot.js (160), src/app/wiring.js (190), src/controls/config-editor.js (317) e src/ui/* (213), somando 1.624 linhas. A cobertura de linhas de src é 93,3% nos arquivos carregados e 80,7% incluindo os não carregados (testes/cov-parse.mjs).
tests/integration.test.js:2 diz 'tests the pipeline as wired in main.js', mas :14-22 reimplementa uma versão reduzida, sem layer filter, collapse, clipAnchors, snapContainer, seeds nem o branch de engine de pipeline.js:151-243. Existe risco de deriva silenciosa.
- **Recomendação:** createPipeline(deps) recebe as dependências por injeção (pipeline.js:31-37), então dá para testá-lo com tests/dom-mock.js e fakes de store e renderer. Cobrir: o branch de engine, os gates P8, o warm restart (seeds repassados) e o graphSig (pipeline.js:269-274). Apagar a reimplementação em integration.test.js e usar o pipeline real.

#### Q2-07 · Diagnósticos da DSL: mensagens verificadas, linhas quase nunca; cerca de 10 sites de erro sem nenhum teste (media, esforço M)

- **Evidência:** As mensagens são verificadas por regex (por exemplo tests/dsl/ir.test.js:58-392). A única asserção sobre a linha de um erro é tests/dsl/parser.test.js:24 (`line >= 1`).
Medido em testes/diag-lines.mjs:
- connections malformada na linha 3 é reportada em L1 (baseLine do cabeçalho, src/dsl/parser.js:193-208).
- options.bogus é reportado em L0 (src/dsl/ir.js:62).
- id de nó inválido é reportado em L0 (parser.js:113).
Sites nunca executados, segundo a cobertura: parser.js:113-115, 124-126, 193-195, 202-208; ir.js:396-398, 430-432, 526-528, 640-642, 651-652.
Positivo: o PBT P1 confirmou em 1000 documentos que parse+buildIR não lança exceção e que os diagnósticos são bem-formados.
- **Recomendação:** Criar um teste table-driven com {fonte, linha esperada, regex da mensagem} para cada site de diagnóstico (cerca de 40). Acrescentar a propriedade de que, quando o nó YAML existe, 1 <= line <= nLinhas. Tratar L0 e linha do cabeçalho como bugs de precisão a corrigir, porque o editor mostra 'L{n}:' (pipeline.js:73).

#### Q2-08 · Peso do legado: o routing físico deprecated é 27% das linhas de teste; cerca de 35 testes codificam regras de domínio a portar (media, esforço M)

- **Evidência:** Medido por arquivo (testes/per-file.tsv).
- tests/routing/physics: 19 arquivos, 158 testes (19,8% de 797), 2.951 linhas (27,3% das 10.808 linhas de *.test.js), cerca de 2,9 s de CPU somada.
- Também dependem do engine físico antigo: tests/routing/pipeline-opt-ins.test.js (3 testes) e os E2E 14, 18, 19 e parte do 17 (`grep 'engine: physics' e2e`).
- O layout v1 (live.test, collision-waypoints, collision-resolution) soma 54 testes e 1.240 linhas.
- O motor novo (tests/physics + compile-world) tem 46 testes e 646 linhas. Razão legado:novo de cerca de 212:46.
A PORTAR como invariantes de domínio:
- âncora converge ao ponto do perímetro mais próximo do edgeCenter, e o snap tem precedência (edge-central.test.js:89-152);
- endpoints no mesmo nó não se repelem, e em nós diferentes sem layer comum também não (endpoint-bbox-bbox.test.js:41-73);
- source, target e ancestral nunca repelem a própria aresta (node-repulsion-layers.test.js:66; phase3.test.js:151,169);
- rota já válida permanece estável, com round-trip ≤0,5 px (phase2.test.js:220; phase3.test.js:226; phase4.test.js:57; phase5-trigger.test.js:36);
- mesma edgeLayer descruza e layers disjuntas preservam o cruzamento, a 'REGRA DO USUÁRIO' (phase3c.test.js:61,154,169,178; e2e/14);
- nenhuma penetração em nó alheio, com contagem de segmentos limitada (hard-fission.test.js:53-84; e2e/18:46-93);
- âncora permanece no perímetro (phase3.test.js:243);
- vários endpoints podem compartilhar um snap (snap-selection.test.js:52).
A DESCARTAR: scaffold, mecânica de split, fusão e cooldown (phase5-*), hooks de warmStart (phase4.test.js:106-138), strokeWidth e constantes.
- **Recomendação:** Antes de remover src/routing/physics na Fase 4, reescrever esses cerca de 35 testes como invariantes independentes de implementação, contra a API do motor unificado. De preferência escrevê-los como propriedades (Q2-03) e usá-los como critério de aceite da Fase 4. Manter as métricas de produção countSharedLayerCrossings (src/routing/crossings.js) e foreignCoreCrossings (e2e/18:46) como oráculos. Mover a segunda parte da spec 14, que é lógica pura executada no navegador (e2e/14:85-120), para teste unitário.

#### Q2-09 · E2E com risco de flakiness: sleeps fixos esperando a simulação e retry que esconde falha (media, esforço M)

- **Evidência:** - 49 chamadas `waitForTimeout`, que somam cerca de 52 s literais por projeto, sem contar os helpers (e2e/helpers.js:10,21,33,38,43 rodam em quase todo teste). A espera pela convergência do live é sempre um sleep fixo: e2e/09-overlap-and-context.spec.js:54 (2500), :91 (3000); e2e/06-interaction.spec.js:169 (3000), :312 (5500); e2e/19:40-133 (1500×5).
- Nenhum sinal de convergência é exposto: src/app/boot.js:141-160 publica só __store__, __examples__, __currentIR__ e __currentLayout__, sem session nem alpha.
- playwright.config.js:10 usa `retries: process.env.CI ? 1 : 0` sem failOnFlakyTests, que existe na versão instalada 1.56.1 (node_modules/playwright/types/test.d.ts:1212).
- playwright.config.js:8 justifica a execução sequencial com 'deterministic golden snapshots', que não existem.
- Todos os specs rodam em chromium e mobile-chromium, inclusive os de física.
- Só e2e/20 usa expect.poll (:49,63).
- **Detalhe:** Não rodei o E2E, conforme as regras do dossiê. A avaliação de flakiness é estática; os sleeps dependem da velocidade da CPU do runner.
- **Recomendação:** Expor window.__currentSession__, ou uma promise `settled` resolvida quando alpha < alphaMin, e trocar os sleeps por expect.poll ou waitForFunction. Ligar `failOnFlakyTests: !!process.env.CI`. Rodar specs de física e geometria só no projeto chromium e deixar o mobile para layout e gestos. Corrigir o comentário sobre golden snapshots.

#### Q2-10 · Oráculos E2E fracos em pontos específicos e nenhum teste por pixel no gate (media, esforço P)

- **Evidência:** - e2e/06-interaction.spec.js:187-194: o `onPerimeter` usa OU entre |t.x-b.x|<eps, |t.x-(b.x+w)|<eps etc. sem checar se a outra coordenada está dentro do vão, então um ponto na reta da face, mas longe do retângulo, passa. A versão correta está em e2e/13:67-73.
- e2e/05-layouts-and-routers.spec.js:18-19 e :113-114 verificam só `d.length > 8` no DOM.
- e2e-prod/edges-render.spec.js:5-11 documenta um bug real (aresta invisível por <mask> 0x0) que passava nos checks só de DOM. Esse teste por pixel roda apenas manualmente contra produção (playwright.config.prod.js), fora do CI.
- Não há toHaveScreenshot nem golden em e2e/ nem em tests/.
- **Recomendação:** Reusar o onPerimeter da spec 13 num helper compartilhado. Trazer a contagem de pixels do e2e-prod para o E2E local, rodando contra o servidor local, e incluí-la no gate. Em vez de snapshots de pixel, que são frágeis com física, usar 'métricas douradas' por cena canônica (overlaps, cruzamentos, comprimento médio de aresta, ticks até convergir) com tolerância.

#### Q2-11 · Os 24 cenários do playground (com métricas) são uma implementação paralela sem teste; oráculos prontos desperdiçados (baixa, esforço M)

- **Evidência:** playground/physics-playground.html:135 é um <script> clássico, sem import de src/. Os comentários :176 e :196 dizem 'espelha src/physics/collision.js', então é código duplicado. Os cenários já trazem métricas objetivas: resíduo (:361), overlap (:404), cruzamentos (:633,771,810), erro ortogonal (:696). `grep -rln playground tests e2e` volta vazio.
- **Recomendação:** Extrair os cenários e as métricas para fixtures de teste que rodem contra src/physics, com limiares por métrica (golden metrics). Eles servem de base de regressão para a Fase 4 (routing no motor unificado) e eliminam a deriva entre o playground e o produto.

#### Q2-12 · Tempo da suíte: bom no total, com cerca de 2,3 s de espera ociosa por timer real (baixa, esforço P)

- **Evidência:** Paralelo: 797 testes em 5,30 s de wall. Serial: 11,6 s. Por arquivo (testes/per-file.tsv), tests/app/dsl-io.test.js leva 1,18 s com 12 testes e tests/app/download.test.js leva 1,10 s com 4. A causa é o `setTimeout(() => URL.revokeObjectURL(url), 1000)` real em src/app/download.js:16, que mantém o processo vivo.
Distribuição de testes e linhas:
- dsl: 139 testes / 1.080 linhas;
- layout: 140 / 2.406;
- routing algébrico: 138 / 1.956;
- routing/physics (deprecated): 158 / 2.951;
- physics (motor novo): 39 / 512;
- controls: 44;
- renderer: 42;
- app: 20;
- shapes: 20;
- raiz: 57.
- **Recomendação:** Usar `mock.timers.enable({ apis: ['setTimeout'] })` de node:test nesses dois arquivos. Com o PBT (menos de 2 s), a suíte continuaria abaixo de 8 s.

#### Q2-13 · Testes de física acoplados ao layout AoS bruto do world (baixa, esforço P)

- **Evidência:** 55 acessos `w.data[s * STRIDE + X]` em tests/physics e tests/layout (`grep -o 'STRIDE +'`). src/physics/world.js exporta apenas createWorld, addBody, removeBody, handleOf, isAlive, forEachBody e clearForces, sem getters. O acoplamento a detalhes privados no resto é baixo: 1 `_acc` (collision.test.js:96) e alguns `_cx`/`_cy` em testes do v1.
- **Recomendação:** Criar helpers de teste, ou exportar getters (pos(w,s), vel(w,s), force(w,s)), para que uma mudança de layout de memória (SoA, Float64) não quebre toda a suíte do motor.

