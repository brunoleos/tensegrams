# Trilha 4 · DSL e parsing

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito:** Adotar D1 (front YAML via AST + schema declarativo único, em etapas) e D4 (não adotar ajv/monaco-yaml); spike adicional para D2 (CodeMirror 6); rejeitar D3 (sintaxe TGL) e D5 (importador Mermaid). Antes de qualquer proposta, corrigir 11 bugs de esforço P, começando pelos 3 que derrubam o app: exceções no parse (alias/toString), U+2028 no destacador e pin fora do Float32 no motor v2. ADRs: manter 0002 e 0004, emendar 0003 e 0008, revisitar 0007, e criar um ADR novo para o schema único.

Adoto 2 das 5 propostas (D1 e D4), peço spike para 1 (D2) e rejeito 2 (D3 e D5). Antes delas vêm 11 bugs, todos de esforço pequeno, e 3 deles derrubam o app.

### Decisões

| Proposta | Decisão | Evidência decisiva |
|---|---|---|
| D1 front AST + schema único | adotar, em etapas | "bem diagnosticado" vai de 79,1% a 97,9% em 2.880 casos; o patch local chega a 80,1% |
| D2 CodeMirror 6 | spike adicional | com 200 nós, patch P e CM6 ficam no piso de 33 ms; com 3000, 167 contra 34 ms |
| D3 sintaxe TGL | rejeitar | reintroduz a tipagem implícita; ganho real de 1,8× sobre o YAML incremental |
| D4 sem ajv nem monaco-yaml | adotar | mesma detecção (97,9%), mais ruído (1,22 contra 1,12 diagnóstico por mutação), ajv só CommonJS |
| D5 importador Mermaid | rejeitar | 74,1% de importação real, não 87,8%; 1,7 nó por bloco |

O D1 entra em 3 etapas. Primeiro vem o patch mínimo do defensor (defensor/ppatch), que zera CRASH (22→0) e PROTO (9→0) sem regressão. Depois vêm os avisos na UI e, por fim, o schema único evoluindo o parser.js, sem front paralelo.

O ganho do D1 generaliza: o defensor mediu 97,6% numa semente nova (424242). O failsafe muda a semântica de documentos salvos. Por isso o D1 exige antes `options.format` (P1-16) e avisos para E07 e W05.

### Alegações contestadas que verifiquei

**Desempenho do D1.** Rodei juiz/bench-uk.mjs com a máquina ociosa (load 0,22). A IR sai idêntica nas três variantes.

| Nós | repo (ms) | repo + uniqueKeys:false (ms) | S1 (ms) |
|---|---|---|---|
| 200 | 50,6 | 38,0 | 38,9 |
| 1000 | 243,5 | 208,1 | 223,3 |
| 3000 | 1.006,8 | 653,2 | 732,0 |

O defensor acerta: o ganho vem da flag, não do front. Com 3000 nós, o S1 é 12% mais lento que a flag sozinha.

**Regressões do S1.** `compare.mjs repo s1` dá 78 casos consertados e 2 piorados, omitidos no resumo do desafiante. E07 aceita o discriminador `true` calado, e W05 aceita `nodeLayers: [1, 2]` sem aviso. A métrica de 97,9% conta aviso como diagnóstico, mas pipeline.js:80 só exibe erros.

**Tipagem da TGL.** defensor/tgl-probe.mjs confirma que `label: 1.10` vira "1.1". `a -> b : passo #1` descarta o statement, e `viewLayers: [1, 2]` some sem aviso. A causa é `scalar()` em spikes/s3-peggy/tgl.peggy:5-9.

**Comparador do D3.** O YAML incremental por bloco leva 30,8 ms com 3000 nós; a TGL incremental, 17,5 ms. A vantagem é de 1,8×, não de 42×. Somando o buildIR, a TGL vai a 149,6 ms, dominada pelo O(E²) de ir.js:125-126.

**Editor.** Rerodei juiz/bench-editor.mjs no Chromium via setContent, com mediana de 15 teclas.

| Variante | 200 nós (ms/tecla) | 3000 nós (ms/tecla) | 3000 nós, parte síncrona (ms) |
|---|---|---|---|
| atual, reatribuindo value | 116,7 | 1.844 | 447 |
| atual, digitação real | 83,4 | 1.133 | 378 |
| patch P (defensor) | 33,3 | 166,8 | 34 |
| CM6 (desafiante) | 33,6 | 33,7 | 4,4 |

O piso de 2 rAF é 33,3 ms. O viés de método existe (1,6×), mas o editor atual segue 34× pior que o CM6 com 3000 nós. Com menos de 200 nós, o patch P já atinge o piso.

O spike do D2 deve medir o que ninguém mediu: carga a frio de 15 módulos via importmap e IME no mobile (F-0019). Também deve eliminar o segundo parse completo do lint (spikes/s4-cm6/dsl-cm.mjs:10).

**Métrica do D5.** juiz/mermaid-recount.mjs mostra que 114 dos 331 "ok" são cabeçalhos `flowchart`. Outros 22 são linhas ignoradas com aviso. Sem eles, 74,1% dos statements entram na IR.

### Bugs viram prioridades

Reproduzi 8 linhas da tabela com juiz/probe-p0.mjs no HEAD 5bb9b8d. Do P2-05 conferi só a conversão para Infinity e o laço sem limite, sem rodar os 45 s. O(E²) e ids com barra invertida vêm da auditoria e do fuzzer.

| Prioridade | Bug | Evidência | Esforço |
|---|---|---|---|
| 1 | parse lança com alias, alias circular e `{toString: 1}` | parser.js:42; ReferenceError, RangeError, TypeError | P |
| 2 | destacador lança com U+2028; o import persiste e o boot falha a cada reload | yaml-highlight.js:22 | P |
| 3 | `pin: [1e39, 0]` vira Infinity no Float32 e trava o v2 | spatial-grid.js:47-54 | P |
| 4 | avisos nunca exibidos: 856 de 2.858 entradas com painel vazio | pipeline.js:80 | P |
| 5 | erro YAML transitório zera a cena (0 nós) | parser.js:37 | P |
| 6 | NaN silencioso: constraint sem `value`, config `nodePad: abc` | ir.js:645-648; config.js:36 | P |
| 9 | id com barra vertical colide e a decoração vaza para outra aresta | parser.js:141-144 | P |
| 9 | id com barra invertida duplica `<g>` a cada paint | ensure-el.js:11,24-26 | P |
| 10 | paralelas O(E²): buildIR cai de 125 para 18 ms com Set | ir.js:125-126 | P |
| 12 | ciclo de parent: `n` declarado primeiro perde o parent legítimo | ir.js:294-302 | P |
| 14 | pesos 2 e 3 do exemplo `forces` viram 1 sem aviso | examples.js:246,251; ir.js:631-636 | P |

Os itens 1 a 3 derrubam o app e vêm antes da Fase 4. O item 3 bloqueia tornar o v2 o default.

### Implicações para os ADRs

| ADR | Ação | Motivo |
|---|---|---|
| 0002 | manter | a IR não tem `kind`; resta o código morto `_isContainerSyntax` |
| 0003 | emendar | auto-laço sem semântica; decoração invertida ambígua; a chave canônica não pode usar separador textual |
| 0004 | manter, reforçado | habilita o parse incremental por bloco: 30,8 contra 1.087 ms com 3000 nós |
| 0007 | revisitar | 9 subchaves de `options.routing` na DSL; config sem validação; `live.engine` fora do schema |
| 0008 | emendar | o YAML fica; leitura via AST com failsafe e versão de formato; "um só parser" sustenta rejeitar a TGL |

Proponho um ADR novo: schema declarativo único de atributos da DSL e da config. Ele alimenta validação, tabela do README e autocompletar, e formaliza o contrato da IR do ADR-0013. Se o spike aprovar o CM6, os 283 KB gzip exigem registro contra o ADR-0006.

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Blindar parse/buildIR/rerender/boot contra exceções (aplicar o patch mínimo do defensor) | alto | P | parser.js:42 (toJS sem try/catch) lança com alias não resolvido (label: *Auth*), alias circular (RangeError no unwrap, parser.js:228) e {toString: 1} (TypeError, 11 pontos em ir.js). Reproduzi os 3 com juiz/probe-p0.mjs. O rerender não aguardado (pipeline.js:283) gera rejeição sem feedback, e o boot.js:134 falha com DSL persistida. O defensor/ppatch zera CRASH (22→0) e PROTO (9→0) sem regressão no mesmo harness. |
| 2 | Corrigir o destacador para U+2028/U+2029/\r e agendar o onChange antes do refresh | alto | P | yaml-highlight.js:22 usa /^(\s*)(.*)$/, que devolve null com terminadores Unicode e lança TypeError (reproduzido). O editor para de propagar edições; via import o texto é persistido e o boot falha a cada reload até alguém limpar o localStorage (fuzzer P2-04, chromium-editor.txt). A correção é trocar a regex por [^]* e pôr try/catch no refreshOverlay. |
| 3 | Limitar coordenadas e tamanhos à faixa do Float32 no IR e proteger o buildGrid contra não finitos | alto | P | pin [1e39, 0] passa em ir.js:259-260 (isFinite em float64), vira Infinity no World Float32 e o laço de spatial-grid.js:47-54 não termina: 43–50 s e 1,8–2,7 GB até RangeError (fuzzer P2-05). É pré-condição para tornar o v2 o default na Fase 4. |
| 4 | Exibir os warnings da DSL e da config na UI, por severidade e com linha | alto | P | pipeline.js:80 só mostra fullIR.errors. Com isso, 26 dos 29 sites de diagnóstico do ir.js (inclusive todo didYouMean) ficam invisíveis, e 856 de 2.858 entradas geradas têm painel vazio. Reproduzi: 'a: {lable: API}' dá 0 erros e 1 warning descartado. Sem isso, D1 e o schema único não chegam ao usuário. Adicionar um E2E que digita 'labl:'. |
| 5 | Manter o último IR/sessão válidos quando houver erro sintático YAML | alto | P | parser.js:37 devolve IR vazia em qualquer erro YAML: reproduzi 0 nós com uma aspa não fechada. Com debounce de 150 ms, cada pausa na digitação zera a física e destrói a continuidade (harness-pipeline.mjs: 'continuidade preservada? false'). Isso viola F-0001 A5, o README:42 e a identidade de diagrama vivo (ADR-0012). |
| 6 | Validar numéricos da DSL e tipos da config contra o schema (inclui live.engine) | alto | P | constraint sem value gera NaN nas posições (reproduzido: value null/NaN; ir.js:645-648). A config não é validada (config.js:36): nodePad: abc leva NaN ao layout e às rotas. config-schema.js não tem live.engine, que liga o motor v2, então um typo roda o v1 em silêncio e contamina o experimento central. Pôr também um isFinite na fronteira IR→layout. |
| 7 | Transformar o oráculo e o corpus do fuzzer em testes de regressão da suíte | medio | M | fuzz/oracle.mjs já verifica invariantes da IR, linha ≥ 1 e poluição de protótipo, e o corpus/failures tem 220 entradas minimizadas. Hoje nada disso roda no CI. Isso protege as prioridades 1–6 e o futuro D1 (property test: parse nunca lança; todo diagnóstico tem posição). |
| 8 | D1: evoluir o parser.js para leitura via AST com schema failsafe e schema declarativo único de atributos | alto | M | Validação dispersa e crua: 64 de 96 combinações inválidas passam em silêncio, 115 diagnósticos sem linha, label 1.10 → '1.1' (reproduzido). O S1 leva o 'bem diagnosticado' de 79,1% a 97,9% (97,6% fora da amostra). Condições: options.format antes de mudar a semântica, aviso nas regressões E07/W05, validação saindo do buildIR e o mesmo schema gerando a tabela do README e o autocompletar. |
| 9 | Chave canônica de aresta estruturada e CSS.escape no ensureEl | medio | P | canonicalEdgeKey concatena com '\|' (parser.js:141-144). Reproduzi a decoração de '? [a, "b\|c"]' vazando para a aresta ["a\|b", c] com 0 avisos. ensure-el.js:11/24-26 só escapa aspas: id 'a\' duplica <g> a cada paint e id com \n lança SyntaxError em todo paint (fuzzer, Chromium). |
| 10 | Ganhos rápidos de desempenho: Set para paralelas, uniqueKeys:false com checagem própria de duplicatas e memoização do fullIR por string | medio | P | ir.js:125-126 é O(E²): buildIR com 3000 nós cai de 125 para 18 ms com Set (bench-ir.mjs). uniqueKeys:false corta o parse de 1006,8 para 653,2 ms com 3000 nós (juiz/bench-uk.mjs), mas exige detecção própria de chave duplicada. Toggles de layer e config hoje reparseiam a DSL (graphSig, pipeline.js:270-273). |
| 11 | Aplicar o patch P no editor (overlay incremental por linha) | medio | P | O custo por tecla com 200 nós cai de 83,4 para 33,3 ms (piso), igual ao CM6, e com 3000 nós cai de 1.133 para 166,8 ms (juiz/bench-editor.rerun.json). São ~15 linhas, sem dependência nova, e o patch também corrige o U+2028. Resolve o tamanho típico de pesquisa (<200 nós) sem trocar o editor. |
| 12 | Reescrever a detecção de ciclo em parent (DFS por cores, quebra determinística, mensagem com o caminho) | medio | P | ir.js:294-302 marca ciclo ao revisitar qualquer nó e apaga _parentRaw dos já processados. Reproduzi: com 'n: {parent: a}' declarado antes do ciclo a↔b, n perde o parent legítimo e sai 1 warning a mais; declarado depois, fica correto. A hierarquia depende da ordem dos blocos. |
| 13 | Avisar 'sem efeito' nas chaves da DSL lidas só pelo routing físico deprecated ou por ninguém, e removê-las na Fase 4 | medio | M | Cerca de 13 chaves (9 subchaves de options.routing, shape/snap/snapGroups/snapAngles/anchors/style/endpoints) são aceitas em silêncio. options.routing.engine na DSL não tem efeito, porque o pipeline lê da config (pipeline.js:187,222). Isso viola o ADR-0007 e vira código morto quando src/routing/physics sair. |
| 14 | Corrigir o exemplo forces, o README da chave composta e decidir a semântica do auto-laço | baixo | P | examples.js:246,251 usam pesos 3 e 2, que addWeight (ir.js:631-636) grampeia em 1 sem aviso (reproduzido). O README diz que '? e : exigem linhas separadas', mas '[a, b]: {…}' funciona (fuzzer E25). [a, a] é aceito e os roteadores desenham geometria degenerada (P1-11). A semântica deve ir para o ADR-0003. |
| 15 | Spike do CodeMirror 6 condicionado a alvo acima de 1000 nós | baixo | M | O CM6 só vence com documentos grandes (33,7 contra 166,8 ms por tecla com 3000 nós). Medir carga a frio de 15 módulos (283 KB gzip) via importmap no GitHub Pages, IME/mobile (F-0019), migração do E2E acoplado ao textarea (e2e/helpers.js:19,32) e lint reaproveitando o parse do pipeline. |

### ADRs candidatas desta trilha

- **Frontend da DSL via AST do yaml com schema failsafe e schema declarativo único de atributos** (confiança alta; supersede nenhum; emenda ADR-0008 (leitura/semântica) e ADR-0007 (config de fato fechada e tipada)). A DSL continua em YAML (ADR-0008), mas é lida pela AST do Document com schema failsafe e uniqueKeys:false (com checagem própria de duplicatas), sem toJS. Um objeto SCHEMA único (tipo, limites, doc, status stable/experimental/deprecated, consumidor) gera validação com {line, col, severity, code}, a tabela do README e o autocompletar, para a DSL e para a config. O parse nunca lança; aliases têm orçamento.
- **Versão de formato no documento DSL (options.format)** (confiança media; supersede nenhum; emenda ADR-0008). Aceitar options.format (opcional na leitura, sempre emitido no export e na persistência). Mudanças semânticas de leitura só valem para format ≥ N, com aviso/migração explícitos para documentos antigos.
- **Borda robusta do pipeline: erro de DSL nunca apaga a cena e todo diagnóstico é visível** (confiança alta; supersede nenhum). Invariantes do pipeline: (1) parse/buildIR nunca lançam, e exceções viram diagnóstico com posição; (2) com erro sintático, o último IR válido e a sessão permanecem (evolução: descartar só os blocos de topo afetados); (3) errors e warnings são exibidos por severidade e com linha; (4) nenhum valor não finito ou fora da faixa Float32 atravessa a fronteira IR→layout. As invariantes viram testes de propriedade a partir do oráculo do fuzzer.
- **Emenda ao ADR-0003: auto-laço, decoração invertida e chave canônica estruturada** (confiança media; supersede nenhum; emenda ADR-0003). Chave canônica estruturada (tupla, sem separador textual). Aviso quando a decoração usa a ordem inversa e define start/endStyle. Semântica explícita para o auto-laço (aviso agora; laço como corpo de aresta na Fase 4). Registrar que a ordem em connections é o sinal de rank para adapters layered.

### Sugestões de evolução do processo desta trilha

- `DSL-BL-01` (new-adr) → .feat-memory/decisions/ (novo ADR): Leitura da DSL via AST + failsafe + schema declarativo único (D1 adotado); emenda os ADRs 0007 e 0008.
- `DSL-BL-02` (new-adr) → .feat-memory/decisions/ (novo ADR, emenda ADR-0008): Versão de formato no documento (options.format) antes de mudar a semântica de leitura; P1-16.
- `DSL-BL-03` (new-rule) → tests/dsl/ (novo teste de propriedade) + AGENTS.md: Invariante testada: parse/buildIR nunca lançam, todo diagnóstico tem line ≥ 1 e aparece na UI, e nenhum número não finito ou fora do Float32 cruza IR→layout. O oráculo do fuzzer (fuzz/oracle.mjs) vira teste de propriedade.
- `DSL-BL-04` (doc-gap) → README.md; src/dsl/examples.js: O README afirma que '? e : exigem linhas separadas', mas '[a, b]: {…}' funciona (fuzzer E25). Faltam 8 chaves aceitas nas tabelas de atributos. O exemplo containers emite 2 avisos.
- `DSL-BL-05` (doc-gap) → .feat-memory/manifest/features/F-0001-*.md: O F-0001 declara api src/app/pipeline.js::runPipeline, que não existe (o export é createPipeline). O critério A5 ('erro não quebra a cena') é falso hoje (parser.js:37).
- `DSL-BL-06` (doc-gap) → src/dsl/examples.js; README.md (seção de forças): O exemplo forces usa pesos 3 e 2 (examples.js:246,251), grampeados em 1 por addWeight (ir.js:631-636) sem aviso. É preciso decidir se o peso é [0,1] ou livre e documentar.
- `DSL-BL-07` (new-adr) → .feat-memory/decisions/0003-edges-non-directed.md: Emenda ao ADR-0003: auto-laço, decoração invertida, chave canônica estruturada e ordem como sinal de rank para adapters layered.

### Fontes

- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/cache-completo.json
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dossie.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/juiz/bench-uk.mjs (repo x uniqueKeys:false x S1; IR idêntica)
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/juiz/bench-editor.mjs + bench-editor.rerun.json (Chromium via setContent)
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/juiz/probe-p0.mjs (reprodução dos bugs no HEAD 5bb9b8d)
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/juiz/mermaid-recount.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/juiz/compare-repo-s1.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/juiz/incr-yaml.out e incr-tgl.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/defensor/tgl-probe.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/spikes/harness/compare2.mjs e defensor/harness/compare2.mjs (repo, ppatch, s1, s2)
- /home/user/tensegrams/src/app/pipeline.js:80,283
- /home/user/tensegrams/src/dsl/parser.js:33-42,141-144
- /home/user/tensegrams/src/dsl/ir.js:125-126,294-302,631-648
- /home/user/tensegrams/src/controls/yaml-highlight.js:22
- /home/user/tensegrams/src/physics/spatial-grid.js:40-57
- /home/user/tensegrams/src/dsl/examples.js:246,251
- /home/user/tensegrams/.feat-memory/decisions/0002-unified-two-concept-model.md
- /home/user/tensegrams/.feat-memory/decisions/0003-edges-non-directed.md
- /home/user/tensegrams/.feat-memory/decisions/0004-hierarchy-by-reference.md
- /home/user/tensegrams/.feat-memory/decisions/0007-dsl-vs-config-separation.md
- /home/user/tensegrams/.feat-memory/decisions/0008-yaml-hard-cut-v1-v2.md
- https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/flowchart.md (cópia local em spikes/s5-mermaid/flowchart.md, usada na recontagem)

## Apêndice A · Propostas, réplicas e decisões

#### D1 · Frontend YAML via AST do Document + schema declarativo único (failsafe, sem toJS)

- **Substitui:** src/dsl/parser.js (toJS + schema core + índice de linhas só no topo) e a validação dispersa em src/dsl/ir.js (String()/Number() crus, line 0) + src/dsl/attr-set.js; buildIR continua como construtor da IR
- **Proposta:** Um objeto SCHEMA (spikes/s1-schema-ast/schema.mjs, 102 linhas) descreve cada atributo: tipo (text/number/enum/ref/tags/weights/pair/variant/any), limites, doc, status e consumidor. Um front (front.mjs, ~480 linhas) lê a AST da lib `yaml` com schema failsafe e uniqueKeys:false, e nunca chama toJS. Ele:
- resolve alias com orçamento, sem lançar exceção (billion laughs, ciclo e `*Auth*` com dica de aspas);
- valida por schema e emite {line, col, endLine, endCol, severity, code, msg} em pt-BR;
- traduz os códigos de erro do yaml;
- detecta ciclos de parent por DFS com o caminho completo;
- lê pin/size por nome;
- aceita merge `<<`;
- avisa sobre ids NFC/NFD, ids com espaços, peso 0 implícito em attractTo e a chave compacta `? [a,b]: {}`;
- em erro sintático descarta só os itens de topo cujo range cruza o erro.
O mesmo schema gera a tabela do README (docTable) e os itens de autocompletar (completions). Mantém o contrato {options, connections, nodes, edges, errors, warnings}.
- **Evidência do desafiante:** Harness: spikes/harness/run-alt.mjs, compare.mjs, compare2.mjs e noise.mjs; saídas em spikes/harness/out/{repo,s1}.json. Resultado:
- gerados 'bem diagnosticados': 2279/2880 (79,1%) → 2820/2880 (97,9%); os 60 restantes são semântica intencional;
- à mão só-DSL limpos: 61/150 → 137/150;
- CRASH: gerados 22→0, à mão 15→0; PROTO 9→0; DIAG_RUIM 117→0;
- diagnósticos sem linha: 115/13.429 → 0/16.859;
- mutações diagnosticadas: 523→878.
Consertados (78 casos à mão): H05-07, E01, E03, E05, E08-10, E16-17, E22, E24, E26-27, E30, I02-03, I06-07, L02-L12, N01-N17, W02-W12, C01-C08, A01-A10, O02-O07, Y01, Y03, Y04*, Y08, Y09, Y20, X02.
Mutação textual equivalente (s3-peggy/mutate.mjs, 1000 casos): cena preservada quando há erro 25,6% → 91,6%; erros com texto do yaml em inglês 96% → 0%; diagnósticos com coluna 0% → 83,9%.
Suíte do repo numa árvore-sombra (spikes/s1-compat, 13 arquivos, 214 testes): 209 passam. As 5 falhas são deliberadas: 4 exigem 0 avisos para chaves só lidas pelo roteamento físico deprecated (ir.test.js:271, :283, :326, :370) e 1 exige que o parser não normalize 'on' (parser.test.js:29).
Persistem, fora do parser: H08 (buildCollisionResolver ~2,9 s), K07 (config) e E13-E15 ("|" agora é erro explícito; separar paralelas exige 1 linha no canonicalEdgeKey).
- **Spike:** Prototipado em spikes/s1-schema-ast/ (front.mjs, schema.mjs, smoke.mjs, bench.mjs, parse-adapter.mjs). Medições:
- IR idêntica ao repo em documentos válidos de 200/1000/3000 nós (irIgual=true);
- parse com 200 nós: 34,2→36,7 ms; com 3000 nós: 960→589 ms (uniqueKeys:false; máquina carregada, load 2,9-3,8);
- p99 por caso do fuzz: 10,2→10,0 ms;
- build ESM minificado de front+schema: 22,1 KB bruto / 8,2 KB gzip, contra 5,3 KB gzip de parser+ir atuais; zero dependência nova.
- **Encaixe nas restrições:** ADR-0006 respeitado (JS puro, só `yaml`). ADR-0008 mantido: continua YAML, com failsafe como mudança de semântica. ids e labels numéricos viram texto, o que resolve P1-05. `viewLayers: [1]` passa a ser tag "1" e `[a,b,true]` vira discriminador "true", ambos listados como intencionais. Implementa as recomendações centrais da auditoria (P1-03, P1-05, P1-06, P1-09, P1-14) e do fuzzer (P2-02, P2-03, P2-08, P2-09, P2-12, P2-13, P2-15). Não resolve P1-01/P2-01: os avisos continuam invisíveis até o pipeline.js:80 exibir warnings. Serve de pré-requisito do D2.
- **Ganho:** Todas as classes CRASH/PROTO/DIAG_RUIM do corpus zeradas, com posição e coluna. Uma única fonte para validação, doc e autocompletar. O exemplo `forces` passa a mostrar que usa pesos 3 e 2 grampeados em 1 (examples.js:246, :251).
- **Custo:** M (~600 linhas incluindo o schema). Ajustar 5 testes. Decidir o destino das chaves deprecated do F-0017 junto com a Fase 4.
- **Risco:** Mudança de semântica do failsafe em documentos existentes (tags ou discriminadores numéricos e booleanos). Avisos "sem efeito" podem ser vistos como ruído até a Fase 4 remover as chaves. O front duplica parte das checagens do buildIR, que deveria ser enxugado depois.
- **Réplica do defensor (aceitar_com_condicoes):** CONCEDO o núcleo: a evidência do desafiante se sustenta e generaliza. Rodei de novo tudo que ele mediu e acrescentei um controle fora da amostra. Não abro mão de quatro condições, porque o ganho visível ao usuário está superestimado e o escopo proposto é maior que o necessário.

(1) GANHO SUPERESTIMADO NA BORDA. A métrica "bem diagnosticado" (harness/compare2.mjs) conta um aviso (warning) como diagnóstico. Só que o pipeline.js:80 exibe apenas `fullIR.errors`, e o próprio desafiante admite que o D1 não resolve P1-01/P2-01. Das 878 mutações que o S1 diagnostica, a maioria continua invisível na UI até alguém mudar essa linha. Por isso a ordem certa é exibir os warnings primeiro (esforço P, independente do D1). Sem isso, o D1 é invisível para o usuário.

(2) METADE DO GANHO SAI COM ~30 LINHAS NO parser.js/ir.js ATUAIS. Montei um patch mínimo de endurecimento: try/catch no toJS com posição do alias, unwrap com guarda de ciclo e defineProperty, e helpers S_/N_ no lugar de String()/Number() crus em ir.js. Ele fica em defensor/ppatch/dsl e passou pelo MESMO harness e corpus (corpusIgualAoFuzzer: true):
- CRASH nos gerados: 22→0; PROTO: 9→0;
- CRASH à mão: 15→0; PROTO: 3→0;
- 17 casos à mão consertados (H05-07, L02-L12, N13, N14, W07, A05, Y01, Y04) e 0 piorados.
O "bem diagnosticado", porém, só vai de 79,1% para 80,1%. A conclusão honesta: CRASH e PROTO não justificam reescrever o parser, mas SILENCIO e DIAG_RUIM (os 97,9%) exigem de fato uma validação guiada por schema. Aqui a evidência do desafiante é superior.

(3) CONDIÇÃO DE ARQUITETURA. O front S1 tem ~480 linhas e duplica checagens do buildIR (o risco é admitido). O ruído sobe de 1,00 para 1,12 diagnóstico por mutação (noise.mjs), em parte por aviso duplo. Adotar como evolução do parser.js, movendo a validação do buildIR para o schema (o ir.js:62 com line 0 fixo mostra que ela precisa sair de lá), e não como um segundo front paralelo.

(4) SEMÂNTICA DO FAILSAFE. O S1 tem duas regressões à mão que o resumo omitiu:
- E07: `[a, b, true]` vira discriminador "true" sem aviso;
- W05: `nodeLayers: [1, 2]` vira tags "1"/"2" sem aviso.
Além delas, 60 casos mudam de sentido por design. O ADR-0008 (0008-yaml-hard-cut-v1-v2.md:31-35) já registrou que um corte silencioso fez usuários perderem diagramas. Mudar a semântica de documentos salvos exige antes a versão de formato do P1-16.

O ganho de desempenho (960→589 ms com 3000 nós) NÃO é mérito do D1: vem do `uniqueKeys:false`, flag disponível ao parser atual (auditor: 808,8→528,5 ms no parseDocument). Com 200 nós o S1 é até um pouco mais lento (34,2→36,7 ms). Evidência: Reexecução dos números do desafiante: `node compare2.mjs repo s1 s2` deu 79,1% → 97,9% (residual 0). `node noise.mjs` deu repo 1,00, s1 1,12 e s2 1,22 diagnóstico por mutação.

Controle fora da amostra, com semente nova (SEED=424242) em cópia do harness em /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/defensor/harness (out/repo-s424242.json e out/s1-s424242.json): repo 80,8%, s1 97,6%, residual 0, ruído 1,11. O ganho generaliza, com a ressalva de que os operadores de mutação são os mesmos que o S1 já conhecia.

Patch mínimo: /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/defensor/ppatch/dsl/{parser.js,ir.js}, avaliado com FRONT/IRMOD (defensor/harness/oracle.mjs:11). Resultado em out/ppatch.json: gerados {SILENCIO 455, DIAG_RUIM 125, CRASH 0, PROTO 0}; à mão 78/150 limpos, contra 61 do repo e 137 do S1.

`node compare.mjs repo s1` lista piorados E07 e W05 e 11 que persistem: H08, E13-15, E21, E23, E29, E31, I08, I09 e K07.

Suíte completa na árvore-sombra (node --test --test-concurrency=1 em spikes/s1-compat): 783 testes, 777 passam. As 5 falhas deliberadas estão em ir.test.js:271, :283, :326, :370 e parser.test.js:29. A sexta falha, e2e-invariants.test.js, é artefato do ambiente, porque a árvore-sombra não tem e2e/. Saída em defensor/s1compat.tap.

Confirmei o achado lateral: examples.js:246 (`repelFrom: { anel: 3 }`) e :251 (`attractTo: { anel: 2 }`), com o grampo em ir.js:631-636 (addWeight). É uma correção de 1 linha ou de documentação, independente do D1.
- **Decisão do juiz: adotar.** Evidência de validação superior e reproduzida: compare2.mjs dá 79,1% → 97,9% de 'bem diagnosticado' em 2.880 casos, e o defensor confirmou 97,6% com a semente 424242; o patch local sem schema só chega a 80,1% (reexecutei). Adoção em etapas e com condições: (1) patch mínimo de CRASH/PROTO primeiro; (2) exibir warnings na UI (pipeline.js:80), sem o que o ganho fica invisível; (3) evoluir o parser.js movendo a validação do buildIR para o schema, sem front paralelo (o ruído sobe de 1,00 para 1,12 diagnóstico/mutação); (4) introduzir options.format antes da mudança semântica do failsafe e emitir aviso nas regressões E07/W05, que o resumo do desafiante omitiu (confirmei em compare.mjs repo s1). O ganho de desempenho NÃO conta a favor do D1: medi repo 1006,8 ms, repo+uniqueKeys:false 653,2 ms e S1 732,0 ms com 3000 nós (juiz/bench-uk.mjs).

#### D2 · Editor CodeMirror 6 (ESM via importmap) com lint no gutter e autocompletar vindos do schema único

- **Substitui:** src/editor.js (textarea + overlay com innerHTML do documento inteiro a cada tecla) e src/controls/yaml-highlight.js
- **Proposta:** Editor CM6 mínimo: lineNumbers, history, keymaps, syntaxHighlighting, @codemirror/lang-yaml (Lezer), lintGutter e autocompletion. O linter chama parseDSL (D1) com delay de 150 ms e converte line/col em offsets. O autocompletar é contextual: sobe a árvore Lezer até o Pair de topo, com fallback por indentação, e sugere atributos de nó ou de aresta a partir de SCHEMA, rebaixando os deprecated. Isso resolve de uma vez: os diagnósticos ficam visíveis e posicionados no gutter (P1-01), o custo do highlight por tecla (P1-08) e o crash de U+2028 (P2-04).
- **Evidência do desafiante:** Chromium headless via page.setContent, sem servidor (spikes/s4-cm6/chromium-bench.mjs e chromium-check.mjs), mesmo documento para os dois editores. Custo por tecla até o 2º rAF:
- editor atual: 99,2 ms com 200 nós; 1.656 ms com 3000 nós (427 ms síncronos);
- CM6: 33,6 ms com 200 nós e 33,4 ms com 3000 nós (5,5-9,3 ms síncronos), ou seja, constante.
U+2028: o editor atual dá pageerror "Cannot read properties of null (reading '1')" e onChange não é chamado (reproduz P2-04). O CM6 não lança erro e o doc fica com 3 linhas.
Lint no gutter: 'L3 connections[1]: precisa ter 2 ou 3 elementos', 'L5 atributo desconhecido "lable" — você quis dizer "label"?', 'L6 a.size…'.
Autocompletar: dentro de nó sugere atributos de nó; dentro de `? [a, b]` com prefixo 'e' sugere edgeLayers, endStyle e endpoints.
Todos os 18 pacotes instalados têm type=module e exports.import=dist/index.js (listagem em node_modules). Fonte (lezer.codemirror.net/docs/guide, aberta): o Lezer 'will proceed through any text… and come up with a tree' e reusa fragmentos, mas uma edição que muda o sentido do resto força reparse amplo.
- **Spike:** Prototipado em spikes/s4-cm6/ (dsl-cm.mjs, editor-min.mjs, incr.mjs, chromium-*.mjs). Tamanho da configuração mínima:
- minificada: 384 KB bruto / 126 KB gzip;
- SEM bundler, que é o cenário do ADR-0006 (15 arquivos dist/ não minificados): 1.148 KB bruto / 283 KB gzip, 15 entradas de importmap;
- com basicSetup: 142 KB gzip minificado.
Comparação: o editor atual tem ~7,7 KB (editor.js + yaml-highlight.js) e a lib yaml tem 30 KB gzip.
@lezer/yaml em Node com 3000 nós (480 KB de texto): parse completo 130 ms; incremental com 1 edição 78 ms (só 1,7× melhor). O ganho no editor vem do parse sob demanda na viewport, não do incremental.
- **Encaixe nas restrições:** Compatível com o ADR-0006: ESM puro, carregável por importmap apontando para node_modules/<pkg>/dist/index.js, sem bundler. Mas o runtime passa de 1 para 16 pacotes e o peso transferido cresce ~10× (de ~30 para ~283 KB gzip sem minificar). Se o custo pesar, o importmap pode apontar para um único build minificado gerado por scripts/build-dist.js (126 KB gzip), o que é um desvio parcial do espírito do ADR-0006 e precisa ser registrado em ADR. Os E2E do editor (F-0010) precisarão ser reescritos.
- **Ganho:** Latência por tecla deixa de depender do tamanho do documento (1,6 s → 33 ms com 3000 nós). Diagnósticos visíveis e clicáveis. Autocompletar e documentação a partir do schema. Fim da classe de bugs do overlay (U+2028, XSS-surface do innerHTML).
- **Custo:** M/G: trocar o editor, estilos, integração com store/persistência/export e E2E de edição e highlight.
- **Risco:** Peso de runtime e número de módulos. O E2E existente depende do textarea. IME e mobile (F-0019) precisam de validação manual. Dependência de manutenção de um terceiro.
- **Réplica do defensor (rejeitar):** O ganho do CM6 está superestimado por dois vieses do benchmark, e a alternativa barata resolve o caso típico do projeto.

(a) VIÉS DE METODOLOGIA. O bench (s4-cm6/chromium-bench.mjs) mede o editor atual reatribuindo `ta.value` com o documento inteiro a cada tecla. Isso força o textarea a refazer o layout de todo o texto, o que não acontece na digitação real, enquanto o CM6 recebe uma transação incremental. Refiz com o caminho nativo de digitação (`document.execCommand('insertText')`). Com 3000 nós, o próprio textarea sem highlight cai de 375 ms (reatribuição) para 50 ms (digitação real).

(b) O "33 ms constante" é o piso da medição (2 rAF ≈ 2×16,7 ms), não o custo do editor.

(c) PATCH P NO EDITOR ATUAL (~15 linhas). Overlay incremental por linha (diff de prefixo e sufixo, atualizando só as linhas alteradas) mais a correção da regex `[^]*` do P2-04. Por tecla até o frame, contra CM6 33 ms:
- 200 nós: 81→33,3 ms, igual ao CM6;
- 1000 nós: 363→50 ms;
- 3000 nós: 1147→150 ms.
O U+2028 deixa de lançar. O CM6 só vence de verdade acima de ~1000 nós, e o auditor classifica <200 nós como o tamanho típico de pesquisa (P1-08).

(d) O LINT DO CM6 ACRESCENTA UM SEGUNDO PARSE COMPLETO. O linter do spike (dsl-cm.mjs) chama `parseDSL(doc.toString())` inteiro 150 ms depois da última tecla, no main thread: ~589 ms com 3000 nós pelo próprio bench do S1. Esse custo se soma ao parse do pipeline e fica fora do bench, porque as 15 teclas vêm a cada ~33 ms e o linter nunca dispara.

(e) CUSTO VERSUS RESTRIÇÕES:
- o runtime passa de 1 para 16 pacotes;
- o peso vai de ~30 para 283 KB gzip sem minificar (~10×);
- a saída "build minificado único" contradiz o ADR-0006 (0006-no-bundler-esm-importmap.md:42-44), que rejeitou versionar cópia buildada de dependência.
O F-0019 (mobile e IME) precisaria de validação manual. Para um projeto cujo valor central é o motor físico, isso é gasto de atenção fora do núcleo.

Posso aceitar o CM6 no futuro, SE o alvo passar a incluir diagramas com mais de 1000 nós. Até lá o caminho é o patch P, mais warnings no gutter do próprio overlay usando as posições que o D1 produz. Evidência: Patch: /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/defensor/editor/a2.bundle.js, derivado de spikes/s4-cm6/a.bundle.js.

Bench de digitação real: defensor/editor/bench-a4.mjs (mesmo Chromium via page.setContent, mesmo gen.mjs, 15 teclas, mediana até o 2º rAF):

| Variante | 200 nós | 1000 nós | 3000 nós |
|---|---|---|---|
| atual | 81,1 ms (sync 23,1) | 363,2 ms | 1146,9 ms (sync 373,5) |
| patchP | 33,3 ms (sync 2,5) | 50,1 ms | 150,0 ms (sync 29,8) |
| semHighlight | 33,3 ms | 33,3 ms | 50,0 ms |

No patchP, o texto do overlay bate com o do textarea (overlayFiel: true) e não há pageErrors. O atual reproduz o pageError "Cannot read properties of null (reading '1')" do P2-04.

Mesmo patch com o método do desafiante (bench-a3.mjs, reatribuindo ta.value): semHighlight com 3000 nós 375,3 ms e com 1000 nós 151,2 ms, ou seja, o custo vem do método de medição.

Linter no main thread: spikes/s4-cm6/dsl-cm.mjs, `linter((view) => { const res = parseDSL(doc.toString()) ... }, { delay: 150 })`.

Acoplamento do E2E ao textarea, pelo grep: e2e/helpers.js:19 e :32 (fill), 20-import-export.spec.js:50 e 07-mobile.spec.js:21. A migração é moderada, não trivial.
- **Decisão do juiz: spike_adicional.** Bench rerodado (juiz/bench-editor.rerun.json): com 200 nós, o patch P do defensor (33,3 ms) e o CM6 (33,6 ms) empatam no piso de 2 rAF (33,3 ms); com 3000 nós o CM6 vence (33,7 contra 166,8 ms; 4,4 contra 34 ms síncronos). O viés de método alegado pelo defensor existe (reatribuição 1.844 contra digitação real 1.133 ms), mas não inverte o resultado em documentos grandes. Faltam medir: carga a frio de 15 módulos (283 KB gzip não minificados) via importmap, IME/mobile (F-0019) e lint sem segundo parse completo (dsl-cm.mjs:10 chama parseDSL(doc.toString())). Adotar o patch P agora; retomar o CM6 se o alvo passar de ~1000 nós.

#### D3 · Sintaxe concisa TGL (Peggy, orientada a linha) como segundo frontend da MESMA IR

- **Substitui:** Não substitui o YAML canônico; é um frontend adicional ao lado de src/dsl/parser.js. Elimina a chave composta `? [a, b]` (gotcha documentado no README e em P1-13/P2-13) ao pôr a decoração inline na aresta.
- **Proposta:** Sintaxe: `@title "X"` para opções; `id "Label" {attrs}` para nós; linhas indentadas `chave: valor` como atributos do statement acima; `a -> b #2 : rótulo {attrs}` para arestas, com operadores `--` (sem ponta), `->`, `<-` e `<->` mapeados para start/endStyle (ADR-0003 preservado: a direção continua posicional); `a -- b -- c` para cadeias. Os valores são um subconjunto de fluxo YAML. A unidade de parse é o bloco (cabeçalho + linhas indentadas), parseado isoladamente e com cache por texto. Isso dá recuperação de erro local por construção (resolve P1-02/P2-14 na gramática) e parse incremental barato. O parser Peggy é gerado como ESM (format 'es'), sem imports.
- **Evidência do desafiante:** Round-trip YAML → TGL → buildIR (spikes/s3-peggy/roundtrip.mjs, emit.mjs): IR idêntica, inclusive o texto dos avisos, em quad, intro, containers, forces e nos sintéticos de 200/1000/3000 nós. Concisão (linhas / caracteres sem comentários):
- quad 27→17 / 399→259;
- intro 21→12 / 336→235;
- containers 79→53 / 1549→1087;
- forces 37→26 / 739→596;
- 3000 nós 487→404 KB.
Mutação textual equivalente (mutate.mjs, 1000 casos, mesmos operadores e sementes): 0 exceções; cena preservada quando há erro 100% (repo-YAML 25,6%, S1 91,6%); 0% de mensagens em inglês.
O mutador achou e eu corrigi um bug real: tab literal entre aspas fazia o JSON.parse da ação lançar.
Mensagens posicionadas com dica, por exemplo:
- 'L1:30 sintaxe: esperado …"}"… encontrado fim da linha — "}" não fechado';
- '? [a, b]' → 'na TGL a decoração é inline: "a -> b : rótulo {…}"'.
Limitações medidas: 47,8% dos diagnósticos têm coluna e 0,5% têm linha 0, ambos herdados dos avisos do buildIR (ir.js:62 usa line 0 fixo), o que mostra que a validação precisa sair do buildIR e ser neutra em relação ao frontend. A TGL é mais estrita: 50% das mutações geram erro, contra 33% no YAML.
- **Spike:** Prototipado em spikes/s3-peggy/ (tgl.peggy ~40 linhas, tgl-parser.mjs gerado com 46 KB, tgl-front.mjs, emit.mjs, bench.mjs, mutate.mjs). Parse com 200/1000/3000 nós:
- YAML do repo: 47 / 237 / 881 ms;
- TGL a frio: 27 / 52 / 143 ms;
- TGL incremental com 1 edição: 1,3 / 7,3 / 21 ms (42× mais rápido que o YAML com 3000 nós);
- TGL incremental + buildIR: 5 / 28 / 142 ms (o O(E²) do P1-08 domina).
Build minificado de parser + front: 16,4 KB bruto / 5,5 KB gzip, zero dependências.
Não prototipado: gramática Lezer da TGL, que daria highlight e parse incremental no CM6 (D2) com a mesma gramática.
- **Encaixe nas restrições:** ADR-0006: ok (ESM gerado, versionado como arquivo, sem dependência de runtime; o peggy é só dev). ADR-0008 é contestado apenas parcialmente: o YAML continua canônico, e a TGL entra como frontend experimental por extensão ou cabeçalho, o que exigiria emendar o ADR-0008 ('YAML canônico + frontends alternativos para a mesma IR'). ADR-0003/0004 preservados: parent por referência (atributo) e direção posicional. Encaixa na ambição de pesquisa: um formato mais rápido de digitar favorece a iteração com diagramas vivos.
- **Ganho:** Digitação e leitura mais rápidas (30-40% menos linhas). Erro local nunca apaga a cena. Incremental de 21 ms com 3000 nós. Elimina a chave composta, que também é o obstáculo para ferramentas baseadas em JSON Schema (ver D4).
- **Custo:** M: gramática e front (~200 linhas), conversores YAML↔TGL (o emissor já existe), seletor de formato na UI e na persistência, e a mesma validação por schema do D1, adaptada a uma árvore de valores posicionados.
- **Risco:** Dois formatos para manter e documentar. Divergência sutil de semântica entre eles, mitigada por um teste de propriedade round-trip (o spike já tem o oráculo). Mensagens do Peggy listam 'expected' técnicos, que precisam de curadoria.
- **Réplica do defensor (rejeitar):** (1) VIOLA A RAZÃO EXPLÍCITA DO ADR-0008. O ADR rejeitou justamente "dois parsers, regras de coerção bidirecionais… custo permanente" (0008-yaml-hard-cut-v1-v2.md:16-19) e fixou "Um só formato, um só parser" (:31). Não se trata de emendar um detalhe: é reverter a decisão.

(2) A TGL REINTRODUZ O PROBLEMA QUE O D1 CORRIGE. A gramática (tgl.peggy, função `scalar`) converte números e booleanos implicitamente, como o schema core do YAML. Testei:
- `label: 1.10` vira "1.1", o mesmo bug do P1-05;
- `a -> b : passo #1` dá erro de sintaxe e o statement é descartado, porque `#` no rótulo vira discriminador ou comentário (um gotcha novo no lugar da chave composta);
- `viewLayers: [1, 2]` some sem aviso.

(3) GANHO DE DESEMPENHO SUPERESTIMADO. Os 21 ms com 3000 nós foram comparados com o parse YAML COMPLETO (881 ms). O comparador justo é o parse YAML incremental por bloco de topo, que o ADR-0004 já habilita: o spike do auditor mede 31,6 ms (P1-19). A vantagem real é de ~1,5×, não 42×, e com o buildIR somado (O(E²), 142 ms) o total é dominado pelo buildIR.

(4) A preservação da cena cai para 91,6% sob o S1, que mantém o formato. Os 8 pontos restantes não pagam um segundo formato. A concisão (30-40% menos linhas) é real, mas é ergonomia, não o eixo de pesquisa (a física).

(5) A TGL é mais estrita: 50% das mutações geram erro, contra 33% no YAML. Isso dá mais erros transitórios durante a digitação.

Se a curiosidade de pesquisa pesar, o lugar certo é o playground/ como experimento isolado, sem entrar na UI, na persistência nem no import. Evidência: ADR: /home/user/tensegrams/.feat-memory/decisions/0008-yaml-hard-cut-v1-v2.md:16-19 e :31.

Sonda: /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/dsl/defensor/tgl-probe.mjs (parse do spikes/s3-peggy/tgl-front.mjs seguido de buildIR do repo). Saída:
- 'label num attr => nodes [["a","1.1",null]]';
- 'label aresta com # => nodes [] … errs ["sintaxe: esperado identificador, encontrado \"1\"" ×2]';
- 'viewLayers num => … warns []'.

Gramática: spikes/s3-peggy/tgl.peggy, `function scalar(s) { if (NUM.test(s)) return Number(s); if (s === 'true') return true; …}`.

Comparador incremental: tabela 'Protótipos medidos' do auditor em cache-parcial.json (incremental com 1 edição e 3000 nós = 31,6 ms; parse completo = 970,5 ms).
- **Decisão do juiz: rejeitar.** Verifiquei 2 alegações do defensor. (a) A TGL reintroduz a tipagem implícita: defensor/tgl-probe.mjs dá label 1.10 → '1.1', 'a -> b : passo #1' descarta o statement e viewLayers [1, 2] some sem aviso (scalar() em tgl.peggy:5-9). (b) O ganho de desempenho real é de 1,8×, não de 42×: YAML incremental por bloco 30,8 ms contra TGL incremental 17,5 ms com 3000 nós; com buildIR a TGL vai a 149,6 ms. A proposta contraria o 'um só formato, um só parser' do ADR-0008 (0008:31), e a concisão é ergonomia, não o eixo de pesquisa (física). Se houver curiosidade, cabe no playground/, fora da UI e da persistência.

#### D4 · NÃO adotar ajv/JSON Schema como motor de validação nem monaco-yaml; gerar JSON Schema só como artefato derivado do schema único

- **Substitui:** Candidato 'validação declarativa por JSON Schema (ajv) + monaco-yaml/yaml-language-server' sugerido no briefing
- **Proposta:** Implementei um gerador SCHEMA→JSON Schema (draft-07 + discriminator) e um front em que a validação de atributos de nó e aresta é feita por ajv (coerceTypes, allErrors, mensagens pt-BR via ajv-i18n), com erro posicionado por instancePath→AST e uma camada manual para o que o JSON Schema não expressa. Rodei no mesmo harness. Conclusão: o JSON Schema não paga a si mesmo aqui. A chave composta não é representável em JSON, e o grampo, o split de CSV, o par por nome, as referências, os ciclos e o didYouMean continuam manuais. O que resta de valor (editores externos) se obtém exportando o JSON Schema gerado do SCHEMA do D1 como arquivo estático (por exemplo, para o plugin YAML do VS Code), sem dependência de runtime.
- **Evidência do desafiante:** Front S2 no harness (out/s2.json):
- bem diagnosticados 97,9%, igual ao S1 (879 contra 878 mutações diagnosticadas); à mão, 131/150 contra 137/150 do S1;
- regressões de conteúdo de mensagem: W04, W06 (dica do gotcha `[top:0.5]` perdida: 'não deve ser valido segundo o schema em "not"'), C03 ('o valor da tag "type" deve estar no oneOf');
- silêncio novo em W12: coerceTypes transforma `~` em "" num campo string;
- ruído de 1,22 diagnóstico por mutação contra 1,12; ≥2 diagnósticos em 19% das mutações contra 10%, por causa dos ramos de anyOf ('deve ser null' ao lado do erro real).
O ajv 8.20 tem main=dist/ajv.js em CommonJS e nenhum campo module/exports ESM (package.json lido), então não entra via importmap.
yaml-language-server 1.24 (spikes/yls/probe.cjs):
- trata `? [a, b]` e `[c, d]` como nós: dentro da decoração sugere parent, size e pin, e não sinaliza `snap: sometimes`;
- mensagens em inglês e sem sugestão ('Property lable is not allowed.').
Fontes abertas: o README do monaco-yaml diz 'not being able to use it without a bundler' e que o worker é obrigatório (github.com/remcohaszing/monaco-yaml); ajv.js.org/standalone.html diz que o standalone evita o construtor Function exigido sob CSP e que o runtime pode ser embutido com esbuild.
- **Spike:** Prototipado em spikes/s2-ajv/ (jsonschema.mjs, front-ajv.mjs, standalone.mjs) e spikes/yls/. Tamanhos:
- validadores standalone ESM de nó e aresta: 99,6 KB gerados, autocontidos, 65 KB minificados / 6,6 KB gzip;
- ajv completo + i18n: 39 KB + 1,4 KB gzip;
- language service do yaml-language-server para navegador (sem Monaco, builtins de Node externos): 1,13 MB / 312 KB gzip.
7 construções não expressáveis em JSON Schema, listadas por jsonschema.mjs (LOST).
- **Encaixe nas restrições:** O ajv em runtime violaria o ADR-0006 (CommonJS + new Function); o standalone exige um passo de codegen versionado. monaco-yaml exige bundler, o que é incompatível com o ADR-0006. O artefato JSON Schema exportado não tem custo de runtime.
- **Ganho:** Evita uma dependência que não melhora a detecção e piora mensagens e ruído. Preserva o valor de ferramentas externas via arquivo gerado.
- **Custo:** P: exportar o JSON Schema gerado (o gerador já existe, ~50 linhas).
- **Risco:** O JSON Schema exportado mente sobre as decorações (chave composta). Documentar isso, ou torná-lo exato só depois de adotar a decoração inline (D3).
- **Réplica do defensor (aceitar_com_condicoes):** CONCEDO integralmente a parte principal, que coincide com o status quo: não adotar ajv nem monaco-yaml. A evidência dele é boa:
- as mensagens pioram (W04, W06, C03);
- surge um silêncio novo (W12, coerceTypes);
- o ruído sobe para 1,22 diagnóstico por mutação;
- o ajv é CommonJS com new Function, e o monaco-yaml exige bundler, o que conflita com o ADR-0006.

Ressalvo apenas o "artefato JSON Schema exportado". A própria sonda do desafiante mostra que o yaml-language-server trata `? [a, b]` como NÓ e sugere parent/size/pin dentro da decoração. Publicar esse schema daria ao usuário de VS Code autocompletar e validação ERRADOS nas decorações: um artefato que mente é pior do que nenhum. Condição: não publicar enquanto a decoração não for representável. Se for publicado, que seja marcado como experimental e sem as decorações. Evidência: Números do S2 reproduzidos: `node compare2.mjs repo s1 s2` dá s2 97,9%, igual ao S1. `node noise.mjs` dá s2 1,22 diagnóstico por mutação, com histograma {1: 712, 2: 145, 3: 22}, contra s1 {1: 789, 2: 78, …}.

Saídas da sonda do yaml-language-server em spikes/yls/{repo,s1,s2}.json e probe.cjs. Não reexecutei o yls; a afirmação sobre `? [a, b]` vem do relato do desafiante.

Tamanhos por gzip -9 em spikes/sizes: ajv-full.min.js 38.952 B; s2-standalone.min.js 6.602 B; yls.min.js 311.927 B.

ADR-0006 em .feat-memory/decisions/0006-no-bundler-esm-importmap.md:23-24 e :42-44.
- **Decisão do juiz: adotar.** Desafiante e defensor concordam, e os números reproduzem: compare2.mjs dá s2 97,9%, igual ao S1, sem ganho de detecção; o ruído é de 1,22 contra 1,12 diagnóstico por mutação; há regressões de mensagem (W04, W06, C03) e silêncio novo (W12). O ajv 8.20 é CommonJS com new Function, e o monaco-yaml exige bundler, o que conflita com o ADR-0006. Condição do defensor aceita: não publicar o JSON Schema derivado enquanto a chave composta das decorações não for representável, pois o yaml-language-server sugere atributos de nó dentro de '? [a, b]' (relato do desafiante, não reexecutado por mim).

#### D5 · Frontends de importação (Mermaid flowchart → IR) para trazer diagramas existentes à física

- **Substitui:** Nada existente; hoje o F-0015 (import/export) só aceita a própria DSL YAML
- **Proposta:** Importador de um subconjunto do flowchart do Mermaid para a mesma shape do buildIR:
- nós com as formas [..] (..) {..} ((..)) [(..)] etc., com label;
- arestas --> --- -.-> ==> --o, com rótulo |x| ou `-- x -->`;
- cadeias, `A & B --> C`, subgraph/end como parent (ADR-0004 por referência);
- paralelas repetidas recebem discriminador automático;
- style/classDef/click/linkStyle/direction são ignorados com aviso.
Valor de pesquisa: um corpus público de diagramas reais para experimentar o motor físico (tensegridade) em topologias que não foram escritas para ele.
- **Evidência do desafiante:** Documentação oficial baixada de https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/src/docs/syntax/flowchart.md (36.849 bytes, 114 blocos flowchart/graph). spikes/s5-mermaid/run.mjs: 331/377 statements importados (87,8%), 90/114 blocos 100% importados, 0 exceções, 192 nós e 65 arestas na IR. Um exemplo com subgraph, rótulos |q| e `-- HTTPS -->`, cilindro e círculo gerou parents e labels corretos, com 0 erros.
- **Spike:** Prototipado em spikes/s5-mermaid/mermaid-front.mjs (~70 linhas, regex por statement, sem dependência). Medido apenas o que está acima; a fidelidade visual (formas, estilos) não foi avaliada, porque o Tensegrams não tem essas formas no pipeline padrão.
- **Encaixe nas restrições:** Zero dependência, ESM puro. Não toca ADRs: é importação para a IR, e o YAML continua canônico (o import pode emitir YAML ou TGL via emissor, como no D3). A direção do Mermaid vira posicional, como no ADR-0003; os 13% não suportados são exatamente o que o Tensegrams não modela (estilos e cliques).
- **Ganho:** Barreira de entrada baixa (colar Mermaid e ver o diagrama ganhar vida) e corpus de teste realista para o motor v2 e a Fase 4.
- **Custo:** P/M: robustecer o importador (a gramática real do Mermaid é grande) e integrar ao import do F-0015.
- **Risco:** Expectativa de fidelidade ao Mermaid (formas, direção LR/TD viram só sugestão). Manter compatibilidade com a evolução da sintaxe do Mermaid.
- **Réplica do defensor (rejeitar):** (1) A MÉTRICA É AUTODECLARADA. "87,8% dos statements importados" vem de `p.stats.ok`, contado pelo próprio importador quando uma regex casa (run.mjs). Não há oráculo que compare com o que o Mermaid renderiza.

(2) A FIDELIDADE NÃO FOI MEDIDA E JÁ SE VÊ PERDA. No exemplo do spike, `web -.-> cdn & api` sai como `filledArrow` comum, sem o traço pontilhado.

(3) O "CORPUS REALISTA" NÃO É REALISTA. Os 114 blocos da documentação são snippets de sintaxe: 192 nós e 65 arestas no total, ~1,7 nó e ~0,6 aresta por bloco. Não servem para exercitar o motor físico nem a Fase 4. Um gerador sintético como o gen.mjs, que já existe, cobre melhor a escala.

(4) CUSTO REAL SUBESTIMADO. A gramática do Mermaid é grande e evolui; ~50 linhas de regex dão uma importação parcial que gera expectativa de fidelidade (formas, direção LR/TD). Isso cria um contrato de compatibilidade externo num projeto de pesquisa cujo próximo passo declarado é a Fase 4 (routing no motor unificado).

Concedo o custo baixo e a zero dependência. Se for feito, deve ser um script em tools/ ou playground/ que emite YAML canônico, sem integrar ao F-0015. Evidência: Reexecutei `node spikes/s5-mermaid/run.mjs`: {blocosFlowchart: 114, blocos100pct: 90, statements: 377, statementsImportados: 331, pct: '87.8%', excecoes: 0, nosTotal: 192, arestasTotal: 65}.

No exemplo, as arestas saem 'web-api"HTTPS"/filledArrow … web-cdn/filledArrow web-api/filledArrow': o `-.->` pontilhado vira seta comum.

Métrica em run.mjs: `S += p.stats.stmts; OK += p.stats.ok`, autodeclarada pelo mermaid-front.mjs (51 linhas pelo wc -l, e não ~70).
- **Decisão do juiz: rejeitar.** A métrica é autodeclarada e inflada: recontei em juiz/mermaid-recount.mjs, e dos 331 statements 'ok', 114 são cabeçalhos 'flowchart/graph' e 22 são linhas ignoradas com aviso (style/classDef/click) contadas como ok. A importação real de conteúdo é de 74,1%, não de 87,8%. O corpus tem 192 nós em 114 blocos (~1,7 por bloco), inútil para exercitar o motor físico. Há perda de fidelidade já visível (-.-> vira filledArrow). Aceitável no máximo como script em tools/ que emite YAML canônico, fora do F-0015.

## Apêndice B · Auditoria da DSL

Auditoria da DSL e do parsing (src/dsl/*, pipeline.js, dsl-io.js, tests/dsl). O núcleo é limpo: o parser (YAML → shape) e o buildIR (shape → IR) são puros, a IR é JS puro e não carrega objetos da lib `yaml`, os ids de aresta são canônicos e estáveis, as paralelas têm regras claras e o fuzz com 20.665 documentos mutados não quebrou nenhuma invariante estrutural (endpoints e parents existem, sem ciclos, ids únicos). Os testes de DSL (151) passam, com 96% de cobertura de linhas.

O problema está na borda com o usuário. Achei 3 falhas de severidade alta, todas reproduzidas:

- **Avisos invisíveis (P1-01).** Os warnings nunca chegam à UI: `pipeline.js:80` mostra só os erros. Isso vale para 26 dos 29 diagnósticos do `ir.js`, incluindo todos os "você quis dizer…?".
- **Erro de digitação apaga a cena (P1-02).** Basta um erro YAML passageiro no meio da digitação (debounce de 150 ms) para a IR ficar vazia. A cena é apagada e a continuidade do layout se perde, o que contradiz o F-0001 A5 e o README.
- **Parse que lança exceção (P1-03).** `parse()` lança exceção com alias não resolvido; um rótulo como `label: *Auth*` já basta. O `rerender` falha sem nenhuma mensagem de erro.

Há ainda um bug de ordem na detecção de ciclos em `parent`, tipagem implícita do YAML corrompendo rótulos e rejeitando ids numéricos, NaN silencioso em `constraint`, diagnósticos sem coluna (7 sites com linha 0 e 6 que apontam para o cabeçalho `connections:`) e uma divisão confusa entre DSL e config em `options.routing`. Parte dessa superfície da DSL só é lida pelo roteamento físico deprecated, e outra parte não é lida por ninguém.

**Desempenho.** A lib `yaml` responde por cerca de 90% do custo. Com 1000 nós o parse mais a IR leva cerca de 255 ms, e com 3000 nós cerca de 1,1 s por mudança; o highlight, que roda a cada tecla sem debounce, leva 29 a 101 ms. Três protótipos medidos dão caminhos baratos:
- trocar o teste de paralelas por um Set: `buildIR` com 3000 nós cai de 125 para 18 ms;
- parse incremental por bloco de topo, que o ADR-0004 torna trivial: 32 ms contra 970 ms com 3000 nós, IR equivalente;
- `schema: 'failsafe'`: corrige rótulos e ids numéricos, com 134 de 139 testes passando.

**ADRs:**
- **0002** é sólido e o código o respeita. Resta código morto: `_isContainerSyntax`.
- **0003** vale, com ressalvas: a chave canônica colide quando o id contém `|`, a decoração invertida `[b,a]` é ambígua, e layouts em camadas futuros terão de usar a ordem do par como direção de fato.
- **0004** é o mais forte: permite reparent trivial e parse incremental. O custo está nos ciclos e typos de `parent`, mal diagnosticados hoje.
- **0007** tem princípio correto, mas a execução o viola: há knobs de ajuste fino na DSL (`options.routing`), a config não tem validação e o schema está defasado (falta `live.engine`, a chave que liga o motor v2).
- **0008**: YAML é adequado ao público, mas os custos foram subestimados (tipagem implícita, chave composta, alias, desempenho 14 a 24 vezes pior que o js-yaml) e o documento não tem versão de formato.

Recomendação central: manter o YAML, ler pela AST do Document com o schema failsafe (ganha linha e coluna, rótulos fiéis e nenhuma exceção), guardar o último IR válido quando houver erro, exibir os avisos por severidade e unificar os atributos num schema declarativo único.

### Desempenho do parse (Node 22, mediana; CPU compartilhada, load avg ~3,8 em 4 CPUs, portanto são limites superiores)

| Nós gerados | Nós na IR | Arestas na IR | Linhas | KB | parse (ms) | buildIR (ms) | parse+IR (ms) | p95 (ms) | highlight por tecla (ms) |
|---|---|---|---|---|---|---|---|---|---|
| 200 | 220 | 318 | 1.911 | 30 | 37,0 | 1,4 | 38,6 | 80,2 | 5,6 |
| 1000 | 1.100 | 1.599 | 9.544 | 155 | 234,4 | 17,1 | 254,8 | 325,7 | 29,2 |
| 3000 | 3.300 | 4.798 | 28.623 | 480 | 964,7 | 135,4 | 1.091,5 | 1.506,1 | 101,1 |

### Decomposição do custo do `yaml` 2.9 (ms)

| N | parseDocument | com uniqueKeys:false | toJS | JSON.parse (referência) |
|---|---|---|---|---|
| 200 | 41,9 | 38,7 | 1,7 | 0,47 |
| 1000 | 225,0 | 166,7 | 4,8 | 2,07 |
| 3000 | 808,8 | 528,5 | 15,6 | 6,24 |

### Protótipos medidos (ms)

| N | buildIR atual | buildIR com Set (P1-08) | parse completo | incremental, 1 edição (P1-19) | js-yaml load (P1-18) |
|---|---|---|---|---|---|
| 200 | 2,4 | 1,1 | 54,6 | 2,0 | 4,1 |
| 1000 | 15,8 | 3,5 | 255,9 | 9,9 | 16,9 |
| 3000 | 124,6 | 18,4 | 970,5 | 31,6 | 37,6 (mas quebra `? [a,b]`) |

### Qualidade e robustez

| Métrica | Valor |
|---|---|
| Testes unitários de DSL (tests/dsl + dsl-io) | 151 de 151 passando |
| Cobertura src/dsl (linhas / branches) | 96,4% / 83,5% (ir.js 95,3/84,5; parser.js 93,0/78,4) |
| Fuzz (25 s) | 20.665 documentos; 498 exceções (2,4%, todas alias); 14.164 com erro YAML (a cena é apagada); 16 NaN em constraint; 0 violações estruturais |
| Sites de diagnóstico (parser + ir) | 44; 7 com linha 0 fixa; 6 apontando o cabeçalho `connections:`; 0 com coluna |
| Warnings exibidos na UI | 0 de 26 sites de warning do ir.js (pipeline.js:80 só mostra errors) |
| Spike `schema: 'failsafe'` | 134 de 139 testes passam; as 5 falhas estão só nos testes de passthrough 'verbatim' |
| Chaves da DSL sem efeito no pipeline padrão | cerca de 13 (options.routing.* e attrs shape/snap/snapGroups/snapAngles/anchors/style/endpoints) |

### Veredito dos ADRs

| ADR | Veredito |
|---|---|
| 0002 Node/Edge | Manter. O código o respeita; resta `_isContainerSyntax` morto. |
| 0003 Não-direcionadas | Manter com emenda: a chave canônica colide com `\|`, a decoração invertida é ambígua e layouts em camadas usarão a ordem como direção. |
| 0004 Parent por referência | Manter; é o mais valioso. Corrigir o detector de ciclo e exibir os typos. |
| 0007 DSL × Config | Princípio certo, execução violada: `options.routing` está na DSL, a config não é validada e o schema está defasado. |
| 0008 YAML e hard cut | Manter o YAML com failsafe e AST; custos subestimados (tipagem, alias, desempenho); adicionar versão de formato. |

#### P1-01 · Warnings da DSL nunca chegam à UI (didYouMean invisível) (alta, esforço P)

- **Evidência:** src/app/pipeline.js:80 `showErrors([...fullIR.errors, ...configResult.errors])` — `fullIR.warnings` é ignorado. `grep warnings src` fora do src/dsl só acha src/app/debug-export.js:63 (debug pack). Em src/dsl/ir.js há 29 sites de diagnóstico: só 3 são `ir.errors.push` (ir.js:111,128,138); os outros 26 são warnings: atributo desconhecido com didYouMean, parent desconhecido, ciclo em parent, decoração órfã, nodeLayers paradoxal, `[tag:weight]` etc. Os warnings do próprio YAML (parser.js:36, ex. 'Unresolved tag') também somem.
- **Detalhe:** Todo o investimento em diagnóstico amigável (diagnostics.js, 8+ chamadas a didYouMean) é invisível para o usuário. Um typo em `labl:` ou `parent: bakend` simplesmente não tem efeito, e nada é exibido. Nenhum teste E2E cobre a exibição de warnings.
- **Recomendação:** Exibir warnings na barra com severidade distinta (cor e ícone), mostrando a contagem e uma lista expansível em vez de uma linha única truncada (style.css:557-566 usa nowrap e ellipsis). Idealmente, marcar as linhas no gutter do editor e permitir clicar para saltar à linha. Adicionar um E2E que digita `labl:` e espera a sugestão visível.

#### P1-02 · Erro YAML transitório apaga a cena e destrói a continuidade do layout (viola F-0001 A5) (alta, esforço P)

- **Evidência:** parser.js:37 devolve emptyOk em qualquer erro YAML → buildIR produz IR vazia → pipeline.js:124-155 para a sessão e inicia outra com 0 nós → renderer remove os nós obsoletos (src/renderer/nodes.js:34-36). Harness headless (eco/dsl/harness-pipeline.mjs): renders por nº de nós '…,3,3,0,3,3…'. Após corrigir o YAML: 'continuidade preservada? false' (posições a/b/c voltam ao círculo inicial (re-explosão)); no controle, com edição válida direta: 'true'. Isso contradiz F-0001 A5 ('o erro aparece… sem quebrar a cena já renderizada'), os 'Limites conhecidos' ('o último render válido permanece') e o README:42. O E2E e2e/20-import-export.spec.js:67-77 só checa que `svg#canvas` está anexado.
- **Detalhe:** Com debounce de 150 ms (editor.js:16,37), qualquer pausa no meio de `? [a, b` dispara o apagão. É o pior caso para a identidade 'diagrama vivo' (ADR-0012): cada erro de digitação zera o estado físico. A lib `yaml` recupera documento parcial: em 4 variantes de erro, 10 ou 11 dos 11 itens de topo sobrevivem (eco/dsl/recovery.mjs).
- **Recomendação:** (1) Se `parse` tiver erros de YAML, NÃO reiniciar a sessão: manter o último fullIR/sessão válido e só mostrar o erro. (2) Evolução: usar o documento parcial e excluir apenas os itens de topo cujo range cruza o erro. (3) Criar um E2E que digita YAML quebrado e confirma que o nº de `[data-id]` e as posições persistem.

#### P1-03 · parse() lança em alias não resolvido (ex.: `label: *Auth*`) → rerender rejeita sem feedback (alta, esforço P)

- **Evidência:** parser.js:42 `doc.toJS({ mapAsMap: true })` sem try/catch. eco/dsl/probe4.mjs: `a: *x` → THROW ReferenceError 'Unresolved alias'; alias bomb → THROW 'Excessive alias count'. eco/dsl/harness-alias.mjs: com `label: *Auth*`, `rerender REJEITOU … | barra de erros = ""`. Em bindStoreSubscriber (pipeline.js:283), `rerender()` não é aguardado, o que gera uma promise rejeitada sem tratamento. Fuzz (eco/dsl/fuzz.mjs): 498 de 20.665 documentos mutados (2,4%) lançam, todos por alias.
- **Detalhe:** Ênfase estilo markdown em label (`*texto*`) é plausível para usuários. A cena fica congelada no estado anterior sem nenhuma indicação de erro. Só o dsl-io.validateDSL (dsl-io.js:28-33) captura a exceção, e apenas no import.
- **Recomendação:** Envolver toJS em try/catch, convertendo a exceção em `{line, msg}` com a posição do alias (via visit na AST). Adicionar teste unitário em tests/dsl/parser.test.js para `*x` e para o alias bomb. Envolver `rerender()` num catch que chame showErrors.

#### P1-04 · Detecção de ciclo em parent: falso positivo dependente da ordem de declaração e mensagem sem o ciclo (media, esforço P)

- **Evidência:** ir.js:294-302: o loop marca ciclo se revisitar QUALQUER nó (`visited` inclui intermediários), não apenas `n`. Além disso, `_parentRaw` é apagado dos nós já processados (ir.js:287,291,310), então o resultado depende da ordem. eco/dsl/probe.mjs, 'rho-cycle n first' (n→a, a→b, b→a): `n` perde o parent legítimo `a` e gera 2 warnings de ciclo (n e a); com `n` declarado por último, `n<a` fica correto e há 1 warning. No '3-cycle', a mensagem cita só "a", sem o caminho a→b→c→a. O teste existente (tests/dsl/ir.test.js:174-181) cobre só o 2-ciclo.
- **Detalhe:** O resultado final é sempre acíclico: o fuzz não violou essa invariante em 20k documentos. O defeito é semântico: um nó fora do ciclo é arrancado do container, e o aviso (invisível, ver P1-01) aponta o nó errado. Reordenar blocos muda a hierarquia.
- **Recomendação:** Primeiro montar o grafo completo de parent e detectar os ciclos (DFS por cores/Tarjan). Depois quebrar uma aresta por ciclo de forma determinística (ex.: a do último nó declarado no ciclo) e emitir 'ciclo em parent: a → b → c → a' com as linhas. Testes: rho, auto-parent e 3-ciclo com as duas ordens.

#### P1-05 · Tipagem implícita do YAML corrompe labels e rejeita ids numéricos (media, esforço P)

- **Evidência:** parser.js:33 usa `schema: 'core'`. Probes: `label: 1.10` → "1.1"; `label: 0x1F` → "31"; `label: 1e3` → "1000"; `label: #1 destaque` → comentário, e o label vira o id. `connections: - [1, 2]` → erro 'from e to devem ser ids (strings)' (parser.js:201-203); o bloco `1:` → 'id de nó inválido: 1' na linha 0 (parser.js:112-114). Spike eco/dsl/failsafe/ (parser com `schema: 'failsafe'`): 134 de 139 testes de tests/dsl passam; as 5 falhas são só testes de passthrough 'verbatim' (options.routing.*, node snap/anchors) e um teste que exige booleano no parser. Com failsafe: `label: 1.10` → "1.10", `[1, 2]`/`[2, 404]` viram arestas válidas, e size/pin continuam numéricos (o IR já faz Number()).
- **Detalhe:** Diagramas com passos numerados, versões ('1.10') ou códigos HTTP são casos comuns. O ir.js:598-608 já precisou de um remendo para outro gotcha YAML (`[tag:weight]`), sinal de que o custo do YAML cru vaza para a DSL.
- **Recomendação:** Adotar `schema: 'failsafe'` no parser da DSL, com coerção tipada no buildIR (onde já existe Number()/parseBool). Alternativa: ler `scalar.source` para label/id via AST. Ajustar os 5 testes de passthrough, que devem virar validação tipada.

#### P1-06 · Diagnósticos só com linha (sem coluna), muitos com linha 0 ou apontando o cabeçalho (media, esforço M)

- **Evidência:** Em parser.js + ir.js há 44 sites de diagnóstico. 7 usam `line: 0` fixo (ex.: ir.js:62 options desconhecido, parser.js:94 chave composta inválida, parser.js:113 id inválido). Os 6 erros de `connections[i]` usam `line: baseLine`, a linha do cabeçalho (parser.js:193-209). Probe 'conn lines': a aresta duplicada na linha 4 e o item de aridade errada na linha 5 aparecem ambos como L1. Warnings de atributo usam a linha da chave do nó, não a do atributo. config.js:29,33 não dá linha. As mensagens do YAML vêm em inglês e multilinha ('Map keys must be unique at line 4, column 1:\n\n…'), exibidas numa barra de 11px, nowrap e ellipsis (style.css:557-566). Não há códigos de diagnóstico estáveis.
- **Detalhe:** Com linha 0, pipeline.js:72 omite o prefixo `L…`, e o usuário não sabe onde está o problema.
- **Recomendação:** Ler pela AST do Document (pair.key.range, item.range, com LineCounter.linePos) para emitir {line, col, endLine, endCol, severity, code}. Traduzir/resumir as mensagens da lib `yaml` usando `err.code`. Criar uma lista clicável que posiciona o cursor.

#### P1-07 · options.routing e attrs da DSL: split-brain com a config, no-ops silenciosos e dependência do engine deprecated (viola ADR-0007) (media, esforço M)

- **Evidência:** A DSL aceita 9 subchaves em options.routing (attr-set.js:130-140; ir.js:480-521), mas o pipeline lê `engine` e `algebraic` da CONFIG (pipeline.js:187,222), e physics/index.js:93-101 lê central/endpointBBox/physics de `opts.routing` (config). Na DSL, portanto, `options.routing.engine: physics` é aceito sem warning (o teste tests/dsl/ir.test.js:271-276 garante isso) e não tem efeito. `fission/fusion/edgePad/snap` (via ir.meta) e os attrs `shape`, `snap`, `snapGroups`, edge `style` e `endpoints` só têm consumidores em src/routing/physics/* e snap-*.js, usados apenas por ele (deprecated, F-0017). `snapAngles` e `anchors` não têm consumidor algum (grep vazio): `anchors: whatever` passa sem warning. Nada disso está no README (tabelas em README.md:~95-120). ADR-0007 manda knobs de 'feel' para a config, mas fission.threshold, fusion.manhattanK, central.k e physics.aStarMidLoop estão na DSL.
- **Detalhe:** Quando a Fase 4 remover src/routing/physics, cerca de 13 chaves da DSL viram código morto aceito em silêncio. Há ainda o nome `snap` com semântica distinta em nó (lista de pontos) e em aresta (on/off/inherit).
- **Recomendação:** Curto prazo: emitir warning 'sem efeito no engine atual' para as chaves consumidas só pelo engine deprecated ou por ninguém, e rejeitar options.routing.engine/algebraic na DSL com dica de mover para a config. Na Fase 4: remover junto com src/routing/physics, levar os knobs de ajuste para a config e manter na DSL só a semântica (ex.: `shape`, se o motor novo usar).

#### P1-08 · Reparse completo por mudança, buildIR O(E²), highlight sem debounce e reparse em toggles de UI (media, esforço M)

- **Evidência:** editor.js:34-37: debounce de 150 ms para onChange, mas `refreshOverlay()` (highlight da doc inteira + innerHTML) roda a cada tecla. pipeline.js:76-77 reparseia a DSL inteira sempre que graphSig muda, e graphSig inclui viewState, hiddenLayers, collapsed, config e layout (pipeline.js:270-273); logo, alternar um chip de layer também reparseia. Bench (eco/dsl/bench.mjs, mediana): parse+IR = 38,6 / 254,8 / 1091,5 ms para 200/1000/3000 nós; highlight = 5,6 / 29,2 / 101,1 ms por tecla. A lib yaml responde por ~90% do custo (bench-yaml.mjs), e `uniqueKeys` pesa ~35% com 3000 nós (808,8 → 528,5 ms). ir.js:125-126 faz `[...edgeByCanonical.keys()].some(startsWith)` a cada conexão sem discriminador, o que é O(E²): buildIR 124,6 → 18,4 ms com um Set (bench-ir.mjs, IR idêntica).
- **Detalhe:** Para o tamanho típico de pesquisa (menos de 200 nós) o custo é aceitável (~40 ms). Com 1000 nós ou mais, a digitação fica travada. Não há diff de IR: toda edição reinicia a sessão de layout, e o warm-start por seedPositions mitiga só as posições.
- **Recomendação:** (1) Trocar o teste de paralelas por um Set `seenWithKey` (1 linha). (2) Memoizar fullIR por string da DSL, para que toggles de UI e config não reparseiem (verificar antes que projectIR e os filtros não mutam a IR). (3) Parse incremental por bloco de topo (ver P1-19; spike 30× mais rápido). (4) Highlight em rAF, só nas linhas visíveis. (5) Futuro: diff de IR por id estável para o motor v2 aplicar patch no World em vez de reiniciar.

#### P1-09 · constraint/size/pin/padding inválidos passam em silêncio; constraint sem campo gera NaN nas posições (media, esforço P)

- **Evidência:** ir.js:645-648 faz `Number(v.value)` etc. sem validar. Com `constraint: {type: axis-x}` (sem value), eco/dsl/probe3.mjs dá posições `["a",null,-24]`, ou seja x = NaN, no layout live v1 e v2. O fuzz achou 16 casos de constraint-NaN. `size: [abc, 10]` altera só a altura, e `pin: [1]` e `padding: xx` são ignorados, todos sem warning (probe 'label types'). Campos extras em constraint também são ignorados sem aviso.
- **Detalhe:** Um typo (`valeu:`) corrompe a simulação física sem nenhum diagnóstico. O NaN chega ao SVG.
- **Recomendação:** Validar os campos obrigatórios por tipo de constraint (value; x,y,w,h; r) e todos os numéricos com warning e didYouMean. Descartar a constraint inválida em vez de propagar NaN. Adicionar uma asserção 'isFinite' na fronteira IR→layout.

#### P1-10 · Chave canônica de aresta ambígua quando id contém '|' (baixa, esforço P)

- **Evidência:** parser.js:141-144 monta `${a}|${b}|${key}`. Em eco/dsl/probe.mjs, `[a, b, c]` e `["a|b", c]` produzem 'aresta duplicada [a|b, c]' falso; `[x, "y|z"]` e `["x|y", z]` também colidem. Em probe2.mjs, `[a, "b|c"]` seguido de `[a, b]` gera o falso erro '[a, b] sem discriminador conflita com paralelas' via startsWith (ir.js:125). Os ids de aresta (`e:a|b|c`) ficam ambíguos no DOM e no debug.
- **Detalhe:** É um caso raro, mas ids são texto livre (probe: 'Serviço de Pagamento', 'db:primary' são aceitos).
- **Recomendação:** Usar um separador impossível (\u0000) ou JSON.stringify([min,max,key]) para a chave interna e manter um id de exibição separado. Outra opção: proibir '|' em ids com erro explícito.

#### P1-11 · Self-loop [a, a] aceito sem aviso, mas roteadores produzem geometria degenerada (baixa, esforço P)

- **Evidência:** ir.js:104-149 não trata a == b. eco/dsl/probe3.mjs: straight → [{70,24},{70,24}] (comprimento zero, invisível); curved → 4 pontos iguais; orthogonal → segmento que atravessa o centro do nó ([140,24]→…→[0,24]).
- **Detalhe:** O usuário declara uma aresta que some ou é desenhada errada, sem diagnóstico.
- **Recomendação:** Decidir a semântica: emitir warning 'self-loop não suportado', ou implementar o laço no renderer/motor (na Fase 4 cabe como corpo de aresta com endpoints no mesmo perímetro). Registrar a decisão no ADR-0003.

#### P1-12 · Typos em ids viram nós fantasmas ou parents perdidos sem sugestão (baixa, esforço P)

- **Evidência:** Probe 'edge typo': `- [apii, cache]` com `api` declarado cria o nó `apii` com 0 warnings (ir.js:104-106, por design; README: nós implícitos). `parent: bakend` gera 'parent desconhecido' sem didYouMean (ir.js:290), embora a infra exista (diagnostics.js:47). A decoração órfã `? [a, b]` com só `[a,b,1]` declarada não sugere a forma com discriminador (ir.js:155-161). Heurística avaliada (eco/dsl/typo-heur.mjs): os 4 exemplos embutidos têm 0 nós implícitos, logo nenhum falso positivo ali (amostra pequena).
- **Recomendação:** Aplicar didYouMean em parent e na decoração órfã. Emitir um aviso de severidade 'info' para nó implícito usado 1 única vez e a ≤ len/4 de distância de um id declarado.

#### P1-13 · Gotchas de forma com mensagens crípticas ou silêncio (chave composta compacta, decoração escalar, snap/onHidden) (baixa, esforço P)

- **Evidência:** Probe 'compact composite': `? [a, b]: {label: x}`, o gotcha que o próprio README documenta, vira 'id de nó inválido: {}' na linha 0 (parser.js:112-114). A decoração `: hello` é ignorada sem aviso (parser.js:98 mapToObject → {}), enquanto um nó escalar gera erro (parser.js:119-121). `snap: maybe` / `onHidden: bogus` caem no default sem warning (ir.js:362-363), inconsistente com startStyle (ir.js:461-470, que avisa com didYouMean). O discriminador objeto em decoração vira '[object Object]' com linha 0.
- **Recomendação:** Detectar chave-mapa cujo único par tem chave-sequência e emitir a dica 'use `? [a, b]` e `: {...}` em linhas separadas'. Validar o valor da decoração e os enums com o mesmo helper de startStyle. Estudar a forma inline `- [api, db, {label: …}]` (P1-19).

#### P1-14 · Contrato da IR não formalizado; resíduos e passthrough cru de YAML na IR (baixa, esforço M)

- **Evidência:** `GraphIR` é citado em typedefs (src/layout/adapter.js:12, src/routing/router.js:8), mas nunca é definido (grep @typedef). Na IR final (eco/dsl, inspeção): as arestas mantêm `_line` e os nós perdem (ir.js:319), de modo que nó não mapeia de volta para a fonte. `meta.direction: 'LR'` não é lido em lugar nenhum. `_isContainerSyntax` é morto (ensureNode nunca recebe explicitContainer=true: ir.js:91,105,106). O ternário com ramos idênticos em ir.js:329 também é código morto. O comentário ir.js:190 ('importar buildAncestors criaria ciclo') é falso, pois ancestry.js não tem imports. Valores crus do YAML passam sem tipo (node.snap/snapGroups/anchors, meta.routing.fission/fusion/snap). Adicionar um atributo exige editar attr-set.js, o switch em ir.js e o README à mão, e isso já divergiu: 8 chaves aceitas não estão no README.
- **Detalhe:** A IR é a interface de plugin do ADR-0013. Sem contrato, cada adapter/router assume campos por convenção.
- **Recomendação:** Criar um schema declarativo único de atributos ({tipo, default, validador, doc, status: stable|experimental|deprecated, consumidor}) que gere a validação, a tabela do README e a autocompleção do highlight. Definir o typedef JSDoc do GraphIR (ou JSON Schema estático, sem dep de runtime). Manter a posição de origem (linha/coluna) de nós e arestas num campo `src` documentado, útil para clicar no canvas e saltar ao texto.

#### P1-15 · Config sem validação e schema defasado: typo em `live.engine` roda v1 em silêncio (media, esforço P)

- **Evidência:** config.js:36 `out.options = parsed`, sem validar chaves nem tipos. src/controls/config-schema.js não tem `live.engine` (flag do motor v2, live/index.js:52), `live.connectivitySpring` (compile-world.js:54,137) nem `routing.*` (pipeline.js:187,222); grep 'engine|routing' no schema volta vazio. O ADR-0007 afirma que 'o espaço de config é fechado e tipado'. F-0001 declara `api: src/app/pipeline.js::runPipeline`, mas a função não existe (o export é createPipeline).
- **Detalhe:** Para um projeto de pesquisa cujo experimento central é o cutover v1→v2, um `live: {engin: v2}` roda v1 sem nenhum sinal, e isso contamina as comparações.
- **Recomendação:** Validar a config contra o SCHEMA: chaves desconhecidas continuam preservadas, mas geram warning com didYouMean. Adicionar live.engine, live.connectivitySpring e routing.engine/algebraic ao schema. Corrigir o contrato do F-0001.

#### P1-16 · ADR-0008: hard cut sem versão de formato no documento (baixa, esforço P)

- **Evidência:** A versão existe só na chave de storage `tensegrams:dsl-v2` (ADR-0008). Não há `version` em OPTION_KEYS (attr-set.js:121-125), e os .yaml exportados (dsl-io.js:17-19) não carregam versão. O próprio ADR registra que 'um usuário com diagrama v1 salvo o perderia silenciosamente'.
- **Recomendação:** Aceitar `options.format: 2` (opcional hoje, emitido no export) para que um futuro v3 detecte o formato e dê mensagem ou migração, em vez de outro corte silencioso.

#### P1-17 · ADR-0003: ambiguidade de decoração invertida e implicações para layouts em camadas (info, esforço P)

- **Evidência:** Com `connections: [a, b]` e `? [b, a]: {startStyle: diamond}`, a decoração chega à mesma aresta (canônica) e o diamond é desenhado em `a`, o primeiro da CONNECTION, embora na linha da decoração `b` venha primeiro (ir.js:152-164, 333-334). src/layout/registry.js:10-12 prevê 'dagre / elk' (descritor `layered: false`); sem direção semântica, esses adapters terão de usar a ordem posicional como direção de fato.
- **Recomendação:** Emitir um warning quando a decoração usar a ordem inversa da connection e definir start/endStyle. Emendar as Consequências do ADR-0003: 'a ordem em connections é o sinal de rank para adapters layered'.

#### P1-18 · Alternativas de parser avaliadas: js-yaml é 14–24× mais rápido mas quebra chaves compostas; manter `yaml` via AST (info, esforço M)

- **Evidência:** eco/dsl/spike-libs/jsyaml.mjs (js-yaml 4.3.2, tem build ESM dist/js-yaml.mjs, importável via importmap): 4,1 / 16,9 / 37,6 ms contra 56,2 / 248,8 / 897,7 ms do yaml 2.9 (200/1000/3000 nós). Porém `? [a, b]` é achatado para string e colide com a chave "a,b" ('duplicated mapping key (5:1)'), e não há posições por nó. A lib `yaml` recupera documento parcial com erro (recovery.mjs). Gramáticas próprias (Lezer/Ohm/Chevrotain) não foram verificadas; contrariariam o ADR-0008.
- **Recomendação:** Manter `yaml` (ADR-0008), mas ler via Document/AST com schema failsafe, try/catch no toJS e uniqueKeys:false com checagem própria de duplicatas (−35% com 3000 nós). Trocar para js-yaml só faria sentido se a DSL abandonasse a chave composta, por exemplo com a decoração inline `- [api, db, {label: queries}]`, que também elimina o gotcha mais documentado (README 'Sintaxe da chave composta').

#### P1-19 · Oportunidade: parse incremental por bloco de topo (habilitado pelo ADR-0004) (info, esforço M)

- **Evidência:** eco/dsl/incremental.mjs divide o texto em blocos que começam na coluna 0, parseia cada bloco isoladamente com cache por texto e faz fallback para o parse completo se houver &/*. Com 1 edição de label: 2,0 / 9,9 / 31,6 ms contra 54,6 / 255,9 / 970,5 ms do parse completo (200/1000/3000 nós), com 1 bloco reparseado e 4801 em cache. A IR é equivalente em ambos os casos (assinatura de nós, labels, parents, layers, nodeCollision, arestas e erros; lança exceção se divergir). O cold start com 3000 nós também é mais rápido (576 contra 970 ms), porque evita o custo superlinear de uniqueKeys.
- **Detalhe:** Só é possível porque a hierarquia é por referência (ADR-0004): os blocos de topo são independentes. Limitações do spike: âncoras/aliases entre blocos (fallback), documentos com `---` e sequências de `connections` na coluna 0 (tratadas pela regra de início de bloco).
- **Recomendação:** Se o alvo incluir diagramas com mais de 500 nós, implementar no parser com testes de equivalência (property test: incremental ≡ completo) e combinar com a memoização de P1-08. Os mesmos blocos servem de unidade para o diff de IR.

## Apêndice C · Fuzzer adversarial

Fuzzer adversarial do parser da DSL e do parser de config (P2). O harness Node importa o código real por file://, isto é, parser.js, ir.js e config.js, mais o pipeline sem DOM: IR → layout "off" → router "straight" → obstacle/clip/snap, igual ao src/app/pipeline.js. Rodei 157 casos escritos à mão e 2.880 entradas geradas a partir de src/dsl/examples.js: 1.680 por mutação dirigida no modelo, com oráculo diferencial, e 1.200 por mutação textual. Cada caso roda num worker com limite de 1 s (acima disso conta como TRAVAMENTO) e corte duro de 5 a 15 s. Também medi o impacto real das falhas no app: o createPipeline de verdade com stubs de DOM, e o editor e o renderer reais dentro do Chromium, sem servidor e sem E2E.

Resultado geral. Não achei poluição GLOBAL de protótipo; o oráculo compara, caso a caso, as chaves próprias dos protótipos de Object, Array, Map, Function e String. Também não achei XSS no destacador de sintaxe (3.045 entradas). Em compensação o parser tem cinco problemas de robustez que derrubam o app:
- objetos com toString ou valueOf não chamáveis (11 pontos em ir.js e parser.js);
- billion laughs;
- alias circular;
- U+2028 no editor, que trava a edição e, se o texto vier por import, impede o boot a cada reload;
- pin fora da faixa do Float32, que trava o motor v2 por cerca de 45 a 50 s com 1,8 a 2,7 GB de heap.

O maior achado de SILÊNCIO é sistêmico: nenhum aviso (warning) da IR chega à UI. O pipeline.js:80 mostra só os erros, então typo de atributo, parent inexistente, ciclo, decoração órfã e estilo inválido ficam todos invisíveis. No corpus gerado, 856 das 2.858 entradas que não quebraram tinham só avisos, ou seja, painel de erros vazio para o usuário.

Os diagnósticos saem com linha 0 ou na linha errada (117 casos gerados, 16 assinaturas). Das 96 combinações de valor inválido que gerei, 64 são aceitas sem nenhum aviso. A chave canônica de aresta usa o separador "|" e colide, causando falsa duplicata e decoração que vaza para outra aresta. O config não valida tipos: `nodePad: abc` vira NaN nas posições e nas rotas.

Não modifiquei nada no repo: git status limpo, HEAD 5bb9b8d.

Casos à mão: 157 (≥40 exigidos), dos quais 95 com ao menos 1 falha: SILENCIO 61, DIAG_RUIM 39, CRASH 15, PROTO 4, TRAVAMENTO 1.
Gerados: 2.880 (≥2.000 exigidos; seed 20260930), sendo 1.680 por mutação de modelo e 1.200 textuais. Deles, 606 com falha, em 100 assinaturas distintas: CRASH 2, DIAG_RUIM 16, PROTO 2, SILENCIO 80. Por caso: SILENCIO 467, DIAG_RUIM 117, CRASH 22, PROTO 9. Latência por caso: p50 1,1 ms, p95 5,2 ms, p99 10,2 ms, máx. 27 ms; tempo total cerca de 5 s com 2 workers.
Matriz diferencial: 64 de 96 combinações de valor inválido aceitas sem diagnóstico.
Avisos invisíveis: 856 de 2.858 entradas geradas só com avisos, ou seja, painel de erros vazio.
Destacador: 3.045 entradas, 0 XSS, 3 caracteres que o derrubam (\r, U+2028, U+2029).
Chromium: o id `a\` gera +1 <g> por paint; o id com \n lança SyntaxError em todo paint.
Motor v2 com pin [1e39, 0]: 43 s, 2,7 GB e RangeError.
Escalonamento de buildIR: 230 ms com 8k arestas e 1.255 ms com 16k (quadrático).
Poluição global de protótipo: 0.
Repo intocado (git status vazio, HEAD 5bb9b8d). E2E não executado; o Chromium foi usado só via page.setContent, sem servidor nem porta.

#### P2-01 · Avisos (warnings) da IR nunca chegam à UI: todo diagnóstico 'soft' é invisível (alta, esforço P)

- **Evidência:** src/app/pipeline.js:80 `showErrors([...fullIR.errors, ...configResult.errors])`: ir.warnings nunca é exibido. Fora de src/dsl, `warnings` só aparece em src/app/debug-export.js:63. Rodei o createPipeline real (fuzz/warnings-ui.mjs → results/warnings-ui.txt): os casos typo de atributo, parent inexistente, ciclo de parent, decoração órfã, endStyle inválido e tag YAML desconhecida dão todos '0 erro(s), 1 aviso(s) -> painel #errors: ""'. O controle (aresta duplicada, que é erro) aparece. No corpus gerado: 1.665 avisos, e 856 das 2.858 entradas só tinham avisos, então o painel fica vazio. O exemplo embutido 'containers' emite 2 avisos que ninguém vê. ENTRADA MÍNIMA: `a: {lable: API}` gera o aviso 'atributo desconhecido em "a": lable (você quis dizer "label"?)', que é descartado.
- **Detalhe:** Na prática isso transforma em SILÊNCIO boa parte dos casos que o harness classificou como 'diagnosticados por aviso'. Não há histórico git para saber se já foram exibidos: há só o commit inicial 1f4c0b2.
- **Recomendação:** Mostrar os warnings no painel com severidade visual distinta (ou num contador/aba 'avisos'), com a linha. Cobrir com teste de pipeline e um E2E. Sem isso, o didYouMean e a detecção de ciclo e de órfã não servem ao usuário.

#### P2-02 · CRASH: valores-objeto com toString/valueOf não chamável derrubam parse()/buildIR(); o app fica com o diagrama velho e o painel vazio (alta, esforço P)

- **Evidência:** TypeError 'Cannot convert object to primitive value' em 11 pontos (stack em results/hand.json). Em buildIR: title (ir.js:65), label (ir.js:251), parent (ir.js:252), padding (ir.js:262), shape (ir.js:275), label de aresta (ir.js:358), snap (ir.js:362), start/endStyle (ir.js:462), size/pin (ir.js:558) e constraint (ir.js:645). Em parse: parser.js:94 (`items.join`) e canonicalEdgeKey (parser.js:143). No fuzz gerado: 22 casos, 2 assinaturas. Impacto no app (fuzz/app-impact.mjs → results/app-impact.txt): 'rerender rejeitou="TypeError…" | painel de erros="" | novos renders=0 | IR em tela ainda tem 2 nó(s)'. O pipeline.js:283 chama `rerender()` sem catch (rejeição não tratada), e o boot.js:134 faz `await pipeline.rerender()`, então uma DSL persistida desse tipo faz o boot falhar e o main.js:3-7 só registra no console. ENTRADAS MÍNIMAS: `a: {label: {toString: 1}}` e `? [a, b, {toString: 1}]
: {}`.
- **Recomendação:** (1) Envolver parse+buildIR no rerender e no boot em try/catch, convertendo a exceção num erro de diagnóstico com linha. (2) Criar um helper toText/toNum que só aceita escalares e emite aviso para mapa ou lista, no lugar de String() e Number() crus. (3) Validar o tipo do discriminador também na chave composta.

#### P2-03 · CRASH YAML: billion laughs e alias circular escapam do parser (doc.toJS e unwrap sem proteção) (alta, esforço P)

- **Evidência:** parser.js:42 `doc.toJS({ mapAsMap: true })` não tem try/catch. O limite maxAliasCount do yaml 2.9.0 lança ReferenceError 'Excessive alias count indicates a resource exhaustion attack' (node_modules/yaml/dist/nodes/Alias.js:74-76). O unwrap recursivo (parser.js:228-235) estoura a pilha com estruturas circulares: 'RangeError: Maximum call stack size exceeded at unwrap (src/dsl/parser.js:228:16)'. Casos Y01, Y04, Y04b e Y04c em results/hand.json. No app, o rerender rejeita e o painel fica vazio (results/app-impact.txt). ENTRADA MÍNIMA (circular): `a: &x {label: L, viewLayers: [*x]}`. Billion laughs: corpus/hand/Y01.yaml, 10 linhas, `lol1: &a1 [*a0 ×9]` até `lol9`. O config (config.js:25-31) captura o mesmo erro corretamente (K04).
- **Recomendação:** Envolver o toJS em try/catch, transformando a exceção num erro 'YAML inválido' com linha. No unwrap, usar um WeakSet de visitados e profundidade máxima e rejeitar ciclos com erro. Considerar maxAliasCount menor e explícito.

#### P2-04 · U+2028/U+2029 (e \r cru) derrubam o destacador de sintaxe: o editor para de propagar edições e um import pode impedir o boot a cada reload (alta, esforço P)

- **Evidência:** yaml-highlight.js:22-23: `line.match(/^(\s*)(.*)$/)` devolve null quando a linha contém \r, U+2028 ou U+2029 (o `.` não casa terminadores), e `m[1]` lança TypeError (results/highlight.txt: '" " CRASH', '" " CRASH', '"\r" CRASH'). No Chromium, com o editor real (fuzz/chromium-editor.mjs → results/chromium-editor.txt): CRLF é normalizado pelo textarea, mas U+2028 é preservado. Nesse caso `setValueU2028: LANÇOU…`, `onChangeAposEdicaoComU2028: 1` (a edição não chega ao store, pois editor.js:35 lança antes do setTimeout de editor.js:37), o overlay fica velho e o boot simulado lança. Caminho que persiste o texto: wiring.js:117-123 chama applyImport → store.setDSL(text), que salva no localStorage, e só depois editor.setValue(text), que lança. No reload, boot.js:33 `editor.setValue(store.state.dsl)` lança, o boot falha e o main.js só registra no console; repete até alguém limpar o localStorage. O parser aceita o texto normalmente (caso X01, sem diagnóstico). ENTRADA MÍNIMA: `a: {label: "x<U+2028>y"}` (com o caractere literal U+2028), importada via arquivo.
- **Recomendação:** Trocar a regex por `/^(\s*)([^]*)$/` ou por um split em /\r\n|\r|\n| | /. Pôr try/catch no refreshOverlay (se falhar, mostrar o texto escapado) e agendar o onChange ANTES do refresh. Adicionar um teste unitário com U+2028.

#### P2-05 · Pin fora da faixa Float32 é aceito e trava o motor v2 (loop infinito no spatial grid, ~45–50 s, ~2 GB, RangeError) (alta, esforço P)

- **Evidência:** O parser só testa Number.isFinite em float64 (ir.js:259-260). O mundo do motor é Float32 (src/physics/world.js:2-16), então x+halfW vira Infinity, cx0 = cx1 = Infinity e o `for (let cx = cx0; cx <= cx1; cx++)` (src/physics/spatial-grid.js:47-54) nunca termina, empurrando no mesmo bucket. Medido (fuzz/v2-pin2.mjs → results/v2-pin2.txt): `[3.4e38, 0]` deu 'RangeError Invalid array length após 50184 ms; heap usado 1826 MB'; `[1e39, 0]` deu 43063 ms e 2715 MB. O stack de results/v2-pin.txt mostra buildGrid (spatial-grid.js:54) ← collision.js:48. O v1 não trava. ENTRADA MÍNIMA: DSL `connections:\n  - [a, b]\na: {nodeLayers: [n], pin: [1e39, 0]}\nb: {nodeLayers: [n]}` + config `live:\n  engine: v2` (corpus/hand/N16.yaml e N16.config.yaml).
- **Detalhe:** Hoje só ocorre atrás da flag live.engine: v2, mas o dossiê aponta a decisão pendente de tornar o v2 default.
- **Recomendação:** No parser: rejeitar com aviso coordenadas e tamanhos fora de ±1e7 (ou da faixa Float32). No motor: guardar contra limites não finitos no buildGrid (pular o corpo ou limitar o número de células). Importante antes de tornar o v2 default na Fase 4.

#### P2-06 · Colisão de identidade de aresta pelo separador '|' (falsa duplicata, falso conflito de paralelas, decoração vazando) (media, esforço P)

- **Evidência:** canonicalEdgeKey concatena com '|' (parser.js:141-144) e o id da aresta é `e:${canonical}` (ir.js:329). O conflito de paralelas usa `k.startsWith(base + '|')` (ir.js:125-126). Casos: E13 `[a, "b|c"]` + `[a, b, c]` dá 'aresta duplicada [a, b, c]'; E14 `["a|b", c]` + `[a, "b|c"]` (4 nós distintos) dá 1 aresta e erro de duplicata; E15 `[a, "b|x"]` + `[a, b]` dá '[a, b] sem discriminador conflita com paralelas já declaradas'. E16 é a decoração que vaza em SILÊNCIO. ENTRADA MÍNIMA (E16): `connections:\n  - ["a|b", c]\n? [a, "b|c"]\n: {label: VAZOU}`: o label vai para a aresta ["a|b", c] e não sai aviso de órfã.
- **Recomendação:** Construir a chave canônica com JSON.stringify([min, max, key]) ou com o separador \u0000, e derivar o id da aresta da tupla. Alternativa: proibir '|' em ids com erro claro. Adicionar testes de ids com separador.

#### P2-07 · Ids com barra invertida ou quebra de linha são aceitos e quebram o renderer (DOM duplicado a cada paint / SyntaxError) (media, esforço P)

- **Evidência:** ensure-el.js:11 monta `:scope > g[data-id="${escapeAttr(id)}"]` e escapeAttr (ensure-el.js:24-26) só escapa aspas. Rodei renderNodes real + ensureEl no Chromium (fuzz/chromium-render.mjs → results/chromium-render.txt): id `a\` dá '<g> por paint: 2,3,4,5,6,7,8,9,10,11' (o reap de nodes.js:35-36 não remove porque dataset.id está vivo; no live, que pinta a cada tick, cresce sem limite); id `a\nb` dá 'SyntaxError: … is not a valid selector' em todo paint. O controle fica em 2,2,2,… Mais ids em results/chromium-ids.txt: `a\b` também duplica e `a\"]` lança. O parser aceita os dois sem diagnóstico (casos I10 e I11). ENTRADA MÍNIMA: `connections:\n  - [a\, b]`.
- **Recomendação:** Usar CSS.escape(id) no seletor, ou manter um Map id→elemento por grupo em vez de querySelector. No parser, avisar sobre ids com caracteres de controle ou de quebra.

#### P2-08 · Forma-objeto tolerada de size/pin ignora os nomes das chaves: {y, x} e {h, w} trocam os eixos em silêncio (media, esforço P)

- **Evidência:** applyPair (ir.js:561-568) usa `Object.keys(v)` na ordem de declaração e ignora os nomes. Caso N08: `pin: {y: 5, x: 100}` vira pinned {x: 5, y: 100}. Caso N07: `size: {h: 20, w: 300}` vira width 20 e height 300. Qualquer par de chaves é aceito, por exemplo `{a: 1, b: 2}`. Nos gerados: `no.pin=objeto {y,x}` 5/5 e `no.size=objeto {h,w}` 3/3 silenciosos (results/matriz.txt). ENTRADA MÍNIMA: `a: {pin: {y: 5, x: 100}}`.
- **Recomendação:** Na forma-objeto, ler explicitamente x/y ou w/h (width/height) e avisar sobre chaves desconhecidas. Ou remover a forma-objeto, que não está documentada no README.

#### P2-09 · Coerções silenciosas: 64 de 96 combinações de valor inválido passam sem nenhum diagnóstico (media, esforço M)

- **Evidência:** Oráculo diferencial (fuzz/matrix.mjs → results/matriz.txt e matriz-silencio.json). Aceitos em silêncio em 100% das ocorrências: aresta.snap e aresta.onHidden inválidos (ir.js:362-363 caem em 'inherit'/'omit'); options.snapContainerAnchor 'maybe' vira true (parseBool, ir.js:547-554); options.routing.engine 'warp' e fission string (ir.js:516-518); routing.central.k<0 descartado (ir.js:501,539-540); label e title mapa ou lista viram '[object Object]' ou '1,2'; padding 'abc', -5, [5], true e '' viram 24, -5, 5, 1 e 0 (ir.js:262); size/pin inválidos ignorados; pesos grampeados em [0,1] (ir.js:631-636, incluindo attractTo {hub: 50} → 1); attractTo como lista vira força 0; peso não numérico faz a tag sumir (W03); viewLayers [1, true, ~, ok] vira ['ok'] (ir.js:573); constraint sem campos vira NaN (ir.js:645-648); parent: [b] vira 'b' (ir.js:252). Sempre diagnosticados: 32 combinações (endpoints, style, start/endStyle, constraint.type, nodeLayers string e outras). ENTRADA MÍNIMA: `connections:\n  - [a, b]\n? [a, b]\n: {snap: sometimes, onHidden: hide}`.
- **Recomendação:** Validação guiada por schema único (tabela atributo → validador → aviso com linha e valor recebido), reaproveitando attr-set.js e config-schema.js. Priorizar os valores com semântica: snap, onHidden, snapContainerAnchor, engine e constraint.

#### P2-10 · Valores aceitos sem aviso quebram o layout adiante (NaN, retângulos negativos, bounds infinitos) (media, esforço P)

- **Evidência:** No pipeline sem DOM off+straight (results/hand.json): N03/N04, size negativo ou zero, dão 'retângulos com largura/altura ≤ 0 chegam ao router'; N09, pins ±1.7e308, dão 'bounds não-finito {width: null}' e '1 arestas roteadas com pontos NaN/Infinity'. No live v1/v2 (fuzz/live-adiante.mjs → results/live-adiante.txt): `constraint: {type: axis-x}` sem value dá x=null (NaN) nos dois motores, e `padding: -500` num container dá width -860 e height -930. ENTRADA MÍNIMA: `connections:\n  - [a, b]\na: {nodeLayers: [n], constraint: {type: axis-x}}\nb: {nodeLayers: [n]}` (corpus/hand/N17.yaml).
- **Recomendação:** No IR, exigir números finitos e positivos para size, padding ≥ 0, r > 0 e os campos obrigatórios de constraint, emitindo aviso e caindo no default. Nos adapters, sanear NaN e Infinity antes de publicar posições.

#### P2-11 · Config sem validação de tipos (NaN chega ao layout) e com linha de erro deslocada pelo trim() (media, esforço P)

- **Evidência:** config.js:22 `trim()` antes do parse (config.js:27). Caso K05: um config com 3 linhas em branco iniciais reporta 'line 3' para um erro que está na linha 6. Os erros de config não têm o campo `line` (config.js:29,33). parseConfig devolve o objeto cru (config.js:36). Caso K07: `collision: {nodePad: abc}` passa sem erro e resulta em '2 retângulos com NaN/Infinity após layout off' e '1 arestas roteadas com pontos NaN/Infinity'. Caso K09: uma tag desconhecida (`live: !foo {…}`) só gera YAMLWarning no console (results/run.log), sem erro na UI. ENTRADA MÍNIMA: config `collision: {nodePad: abc}` + DSL `connections:\n  - [a, b]\na: {nodeLayers: [n]}\nb: {nodeLayers: [n]}`.
- **Recomendação:** Parsear sem trim (ou compensar o offset) e usar parseDocument para ter linha e warnings. Validar contra o config-schema.js que já existe (tipos, min e max), avisando e caindo no default.

#### P2-12 · Diagnósticos sem posição (line 0) ou na linha errada (media, esforço M)

- **Evidência:** Nos gerados: 117 casos, 16 assinaturas (results/gen-aggregate.json). Linha 0: id de nó inválido (parser.js:113; I06–I09), chave de aresta inválida (parser.js:94; E21), options e routing (ir.js:62, 483-534; O06). Linha do bloco em vez do item: todo item de connections recebe baseLine (parser.js:186-209). E27 `connections:\n  - [a, b]\n  - [b, c]\n  - [c]` aponta L1 em vez de L4, e o mesmo vale para E03 e E05, já que edge._line é a linha de 'connections:'. Decoração duplicada aponta a 1ª ocorrência (indexTopLines guarda só o primeiro token, parser.js:164,170; E26 L3 em vez de L5). Atributo desconhecido aponta a linha do bloco (ir.js:244-246; A10 L1 em vez de L3). O aviso de nodeLayers 'paradoxal' do exemplo containers aponta L9 (connections:), mas a decoração está na linha 96-97 do exemplo. ENTRADA MÍNIMA: `connections:\n  - [a, b]\n  - [b, c]\n  - [c]`.
- **Recomendação:** Guardar a posição de cada nó do AST (item de sequência, chave de atributo, chave composta) num índice por caminho, e propagar para connections, decorações e atributos. Exigir line ≥ 1 em teste de propriedade: o oráculo checkDiagnostics de fuzz/oracle.mjs pode virar teste.

#### P2-13 · Mensagens inúteis ou enganosas em casos documentados e comuns (media, esforço P)

- **Evidência:** E24 é o gotcha que o próprio README (seção 'Sintaxe da chave composta') documenta. `? [a, b]: {label: X}` gera 'id de nó inválido: {}' com line=0 (parser.js:112-113 faz JSON.stringify de um Map). Outras mensagens ruins: '[object Object]' em 'parent desconhecido em "a": [object Object]' (H06) e 'decoração [a, b, [object Object]]' (E22); 'constraint.type desconhecido em orbit1: "undefined"' para o typo `typ:` (failures/DIAG_RUIM-f5d67460.yaml); decoração com discriminador booleano só gera 'órfã' (E23), embora connections rejeite; ids numéricos sem sugestão de aspas (E29); merge key `<<` gera só 'atributo desconhecido: <<' (Y09); erros do yaml em inglês ('Map keys must be unique'). ENTRADA MÍNIMA: `connections:\n  - [a, b]\n? [a, b]: {label: X}`.
- **Recomendação:** Detectar a chave-mapa no topo e sugerir '? [a, b]' e ':' em linhas separadas. Formatar os valores recebidos por tipo ('recebido: mapa'). Tratar a ausência de type como 'falta "type"'. Traduzir e resumir os códigos de erro do yaml.

#### P2-14 · Um erro YAML local descarta o documento inteiro (canvas vazio a cada erro transitório) (media, esforço M)

- **Evidência:** parser.js:37 `if (errors.length) return emptyOk(errors, warnings)`. Controle em results/app-impact.txt: '[erro YAML comum] … IR em tela ainda tem 0 nó(s)'. Y08: uma chave duplicada zera o diagrama (0 nós, 0 arestas). Y20: `connections:\n  - [a, b]\na: {label: A}\nb: {label: "sem fechar}` dá 0 nós. ENTRADA MÍNIMA: `a: {label: A}\nb: {label: "sem fechar}`.
- **Detalhe:** Achado de UX. Pode se sobrepor ao trabalho de outro agente da trilha dsl sobre o warm-start após erro transitório (eco/dsl/harness-pipeline.mjs).
- **Recomendação:** Manter o último IR válido na tela enquanto houver erro sintático, ou usar o documento parcial que o yaml devolve (doc.contents existe mesmo com errors) para recuperar os nós que parsearam.

#### P2-15 · Poluição de protótipo LOCAL via chave __proto__ (nenhuma global encontrada) (baixa, esforço P)

- **Evidência:** mapToObject e unwrap fazem `out[String(k)] = …` num `{}` (parser.js:221, 231), e a chave `__proto__` troca o protótipo do objeto. C06: `a: {constraint: {__proto__: {type: rect, x: 0, y: 0, w: 10, h: 10}}}` aplica a constraint rect lida pela cadeia de protótipo em parseConstraint (ir.js:643). `backend:\n  __proto__: [infra]` faz attrs herdar de Array e os atributos somem em silêncio (failures/PROTO-c79f9928.yaml). O config-editor.js:294-299 clone() tem o mesmo padrão: fuzz/cfg-clone.mjs → 'clone.live (herdado): {"damping":0.99} | protótipo trocado: true | global poluído: undefined'. No fuzz, 3.037 casos com checagem de Reflect.ownKeys dos protótipos globais: 0 poluições globais. ENTRADA MÍNIMA: `a: {constraint: {__proto__: {type: rect, x: 0, y: 0, w: 10, h: 10}}}`.
- **Recomendação:** Usar Object.create(null) ou Object.defineProperty no unwrap e no clone (como o próprio yaml faz em addPairToJSMap), ou rejeitar a chave `__proto__` com aviso.

#### P2-16 · Complexidade quadrática em buildIR, na ancestralidade e no destacador (travamentos em entradas grandes) (baixa, esforço P)

- **Evidência:** fuzz/scaling.mjs → results/scaling.txt. Arestas sem discriminador: buildIR leva 36, 96, 230 e 1255 ms para E = 2k, 4k, 8k e 16k. Com discriminador, 63 e 110 ms para 8k e 16k, o que isola o culpado: o spread de todas as chaves por aresta em ir.js:125-126. Cadeia de parent com D=4000: buildIR 891 ms, buildAncestors 904 ms, buildCollisionResolver 2633 ms (roda a cada rerender, pipeline.js:163). O caso H08 (3.000 níveis) passou do limite de 1 s. No destacador, que roda a cada tecla sem debounce (editor.js:35), a linha 'a: '+'1'×n+'x' leva 10, 24, 94 e 415 ms para n = 2k, 4k, 8k e 16k (results/highlight.txt). ENTRADA MÍNIMA (destacador): `a: 111…1x` (16.000 dígitos).
- **Recomendação:** Indexar as paralelas por base (Map base → contagem). Calcular os ancestrais com memoização. No destacador, usar regex com sticky/lastIndex em vez de text.slice(i).match, e aplicar debounce ao overlay.

#### P2-17 · Aceitações estruturais silenciosas (auto-laço, [a,b,~], decoração escalar, alias duplicado, nó 'options', homóglifos) (baixa, esforço M)

- **Evidência:** Auto-laço `[a, a]` aceito sem aviso (41 casos gerados; o straight produz uma rota de comprimento 0, router.js:22). `[a, b, ~]` é tratado como `[a, b]` (E08). Discriminadores "" e .nan são aceitos (E09, E10). Decoração com valor escalar é descartada sem aviso (parser.js:98, 217-219), enquanto um nó escalar gera erro (E30). Chave duplicada via alias (`&k a: {…}` + `*k : {…}`) sobrescreve sem erro, porque o uniqueKeys do yaml não compara Alias e o Map deduplica (Y03). Um nó 'options' criado por connections não pode ser configurado: o bloco vira options globais (E31; rename para 'options'/'connections' em 19 gerados). NFC/NFD e espaços viram nós distintos (I02, I03). Um typo em connections cria nó fantasma (E01). CR isolado dá 0 nós, e o import grava o texto cru no store (wiring.js:117-119) enquanto o textarea normaliza (X02). ENTRADA MÍNIMA: `connections:\n  - [a, b]\n? [a, b]\n: rotulo-solto`.
- **Recomendação:** Tratar cada caso como aviso visível (após P2-01): auto-laço, 3º item nulo, decoração não-mapa, id reservado usado em connections, nó implícito a distância de Levenshtein ≤ 2 de um nó declarado. Normalizar ids em NFC ou avisar. Normalizar as quebras de linha no import.

#### P2-18 · README incorreto sobre chave composta; exemplo 'containers' emite avisos (info, esforço P)

- **Evidência:** O README.md, na seção 'Sintaxe da chave composta', diz que 'YAML 1.2 exige ? e : em linhas separadas'. Porém a chave de fluxo implícita `[a, b]: {label: FUNCIONA}` funciona: E25 aplica o label em e:a|b, sem diagnóstico. O que falha é só `? [a, b]: {…}` na mesma linha. O exemplo embutido containers (src/dsl/examples.js:91+) gera 2 avisos 'necessidade geométrica' para `? [worker, api]\n: { label: callback, nodeLayers: [topo] }`. ENTRADA MÍNIMA: `connections:\n  - [a, b]\n[a, b]: {label: X}`.
- **Recomendação:** Corrigir o README, documentando a forma curta `[a, b]: {...}` e a razão real do gotcha. Remover o nodeLayers redundante do exemplo showcase.

