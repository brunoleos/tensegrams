# Trilha 3 · Estratégia: objetivo, valor e futuro

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito (valor e objetivo):** Valor de pesquisa hoje: 2 de 5. Há instrumento (27 cenários) e uma pergunta falsificável (I1/I2), mas nenhum resultado registrado. A hipótese central (Fase 4, reciprocidade aresta→nó) não foi testada, e o repositório está parado há 96 dias. Valor como produto: 1 de 5. Definição do objetivo: 1,5 de 5. Nenhum artefato do repo menciona pesquisa, experimento ou hipótese; "tensegridade" aparece uma única vez (ADR-0012:20).

**Veredito (futuro):** Das 45 ideias restam 36 grupos após a deduplicação. O top 10 é liderado pelo cabo só-tração, com 18 de 20 pontos: com protensão 0,5, ele baixa os cruzamentos de 775 para 601 a N=120, mas não chega aos 326 do d3-force. Quatro dos dez são mudanças de até ~20 linhas que confirmei em spikes: o warm-start no v2 baixa o deslocamento de 70,2 para 27,7 px, e o `<=` faz o `end` disparar no tick 481. Três alegações de reaproveitamento estavam erradas: o compile-world não consome o registry de física, o menu de contexto só abre para containers, e a cápsula existe só no enum.

## Valor do projeto e qualidade da definição do objetivo

Sob a ambição declarada de pesquisa, o Tensegrams vale hoje **2 de 5**: há instrumento e pergunta falsificável, mas nenhum resultado registrado. Sob a hipótese produto, vale **1 de 5**. A definição do objetivo recebe **1,5 de 5**.

### Valor: advogado x cético, alegações reabertas

| Alegação | Lado | O que conferi | Efeito no veredito |
|---|---|---|---|
| Sandbox com cenários e status de decisão | advogado | `grep -c SCN.push` = 27; META em playground/physics-playground.html:827-835 dá 12 decididos, 7 decisivos, 8 abertos | Instrumento real |
| Warm-restart preserva o mapa mental melhor que dagre | advogado | mm-fair.out: nós movidos >50 px = 0,08/0,20/0,00 contra 0,33/0,39/0,28; em >20 px, n=20 empata (0,65 x 0,62) | Parcial |
| Controlador PI entra em ciclo-limite | advogado | pi-2body-b.out: Ki 0,04 e 1 substep oscila entre 20,48 e 24,98 px (alvo 24) | Pergunta aberta legítima |
| Layout cego à topologia | cético | live/index.js:125-127 ("never reads ir.edges"); exp1.out: 0,000000 px em custom, v1 e v2 | Confirmado |
| Cruzamentos muito acima dos baselines | cético | exp3.out, N=120/E=159: v1 2.547, v2+mola 775, d3-force 326, ELK layered 267, WebCoLa 122 | Confirmado |
| Motor v2 nunca assenta | cético | solver.js:42 prende alpha em alphaMin; compile-world.js:240 exige `alpha < alphaMin`; :244 reagenda o rAF | Bug confirmado por leitura |

O advogado acerta o nicho: nenhum sistema verificado junta DSL textual, mundo físico único e arestas-corpo com reciprocidade. Mas essa combinação só existe no plano da Fase 4. O último commit de motor é 3b8692e (2026-06-06), e o repositório está parado há 96 dias.

O argumento do mapa mental enfraquece quando cruzado com o cético. A estabilidade do v1 vem de ignorar as arestas e cobra dependência de histórico: 64,59 px após editar e desfazer (exp1.out). Com a mola ligada, +1 nó move 24 de 30 nós (exp5.out).

Há prior art direto e não citado. Dwyer, Marriott e Wybrow (2008) já fazem layout interativo com restrições e preservação de topologia (eceasst.org/index.php/eceasst/article/view/1475, resumo aberto). O vis-network põe um "invisible support node" por aresta na física (visjs.github.io/vis-network/docs/network/edges.html, aberto).

Como produto, o default `custom` + `orthogonal` (src/store.js:32-33) sobrepõe nós: 1.816 pares a N=120 (exp3.out). Não há export SVG/PNG nem CLI.

### O gap entre o que se lê e o que se pretende

`grep -rniE "pesquisa|experiment|research|hipótese"` em README.md, AGENTS.md, index.html e .feat-memory/ devolve zero linhas. "Tensegridade" aparece uma única vez, em ADR-0012:20. A ambição declarada não está escrita em nenhum artefato.

| Dimensão | O que a documentação faz crer | O que o mantenedor pretende | Evidência |
|---|---|---|---|
| Natureza | Ferramenta de diagramação | Experimento em diagramas vivos | README.md:3; index.html:8 |
| Diferencial | Layout e routing plugáveis | Física unificada, arestas em tensão | README.md:191 ("arestas são passivas") x ADR-0012:19-20 |
| Roadmap | Editor estruturado da DSL, presets de ponta | Fase 4: arestas como corpos | README.md:387-389 x STATE apagado em 5bb9b8d |
| Sucesso | Suíte verde | Go/no-go da unificação | README.md:385 x playground:776, sem limiares |
| Trabalho em voo | Nada acionável | Motor v2 e virada do default | UNRELEASED.md: uma linha, nenhuma F-NNNN |

| Dimensão | Lente produto, cega (0–5) | Lente pesquisa (0–5) | Motivo |
|---|---|---|---|
| Clareza | 2 | 1 | Pergunta de pesquisa só em playground:741 |
| Consistência | 2 | 2 | ADR-0011:33-35 deixa o integral fora; compile-world.js:42 liga Ki 0,04 |
| Mensurabilidade | 1 | 1 | I2 mede, mas sem limiar de aprovação |
| Delimitação | 2 | 2 | ADRs rejeitam alternativas; Fase 4 sem plano no repo |
| Diferenciação | 2 | 1 | Nenhuma seção de trabalhos relacionados |

**Nota final: 1,5 de 5.** Não é zero porque a matéria-prima existe: ADR-0012, cenários I1/I2 e métricas no sandbox.

### Carta de pesquisa (pronta para README/ADR)

**Pergunta central.** Um único mundo físico, com nós como escoras e arestas como cabos, gera diagramas legíveis e estáveis em tempo real, sem rotas prescritas?

| Hipótese | Métrica (unidade) | Hoje | Limiar de GO |
|---|---|---|---|
| H1: reciprocidade aresta→nó reduz cruzamentos frente a layout→routing | cruzamentos, N=120/E=159 (contagem) | 775 (v2+mola) | ≤ 326 (d3-force); meta ≤ 183 (1,5× WebCoLa) |
| H2: não-cruzamento por tendência cabe no quadro | física, 100 nós + 150 arestas × 6 corners (ms/tick) | 13,4 em Node (scale2.out) | ≤ 8 no navegador |
| H3: física contínua preserva o mapa mental sem memória espúria | deriva após editar e desfazer (px); nós movidos >50 px por +1 nó, com mola (%) | 64,59 px; com mola, não medido | ≤ 5 px; ≤ 20% |
| H4: cabos só-tração estabilizam melhor que molas simétricas | resíduo após arrasto (px); tempo até `end` (s) | mola empurra se d<rest (connectivity-spring.js:27); v2 sem `end` | ≤ 10 px; ≤ 5 s (WCAG 2.2.2) |

**Perguntas de pesquisa.** RQ1: quanto a reciprocidade reduz cruzamentos? RQ2: que rigidez equilibra cruzamentos residuais e ms/tick? RQ3: warm start sem deriva é viável com arestas ativas? RQ4: contato P, PI ou XPBD (cenários C3 e B1)?

**Baselines.** d3-force, WebCoLa e ELK layered, com seeds fixas, num harness headless versionado. São dependências só de desenvolvimento, logo não ferem o ADR-0006.

**Não-objetivos.** Adoção e paridade com Mermaid ou D2. Export, CLI e embed. Garantia combinatória de não-cruzamento (ADR-0012). Layouts em camadas como identidade. DSL como contrato público. Estudo com usuários antes de fechar H1–H3.

**Experimento concluído quando:**
- H1–H4 tiverem GO ou NO-GO com números, script e seed versionados, registrados em ADR.
- Em GO: v2 vira default, `src/routing/physics` sai e ADR-0012 supersede ADR-0009.
- Em NO-GO: o resultado negativo fica registrado, o algébrico permanece e o mantenedor decide arquivar ou pivotar.
- Timebox sugerido por mim, não pelo mantenedor: 2026-12-31.

## Brainstorming e futuro

Das 45 ideias restam 36 grupos após a deduplicação, e o top 10 é liderado pelo cabo só-tração, com 18 de 20 pontos. Quatro dos dez são mudanças de até ~20 linhas que destravam o resto. Três alegações de reaproveitamento de código estavam erradas.

### Alegações de reaproveitamento conferidas

- `registerContributor` e `buildContributors` só aparecem em tests/physics/solver.test.js. O compile-world monta os contributors à mão (src/layout/compile-world.js:128-144). Cabo, force zoo e campos exigem ligação direta, não o registry.
- O menu de contexto só abre para containers (src/ui/context-menu.js:31). "Cortar aresta" pede um menu novo.
- O I1 alega reaproveitar o World (world.js:29-33), mas `CAPSULE` existe só no enum. Não há narrow-phase de cápsula, então portar o I1 custa mais que "M".
- Confirmadas: o v2 não lê `seedPositions` (grep "seed" em compile-world.js = 0 linhas). O config-schema não expõe knob do v2. O render headless é determinístico: sha256 4919c96c… idêntico em 3 execuções.

### Spikes de confirmação

| Mudança (script em convergente/) | Métrica (unidade) | Repo hoje | Com a mudança |
|---|---|---|---|
| Warm-start no v2, ~15 linhas (cw-warm.mjs) | deslocamento médio após +1 nó, n=20, 5 grafos (px) | 70,2 (v2); 187,7 (v2+mola) | 27,7; 27,0 |
| idem | nós movidos >50 px (%) | 60; 98 | 20; 6 |
| `<` → `<=` em compile-world.js:240/244 (cw-end.mjs) | tick do evento `end` (tick) | nunca, em 2.000 | 481 |
| Cabo só-tração (cw-cable.mjs) | cruzamentos N=120/E=159 (contagem) | 775 (mola) | 727; 601 com protensão 0,5 |
| idem | cruzamentos N=60/E=79 (contagem) | 173 | 105 com protensão 0,3 |

São 481 ticks, cerca de 8 s a 60 fps, acima do limiar de 5 s da H4. O cabo ainda não alcança o d3-force (326, spike/exp3.out), então a H1 segue aberta. Cada tamanho usa uma única seed.

### Top 10

Notas: V = valor para a pesquisa, A = alinhamento ao ADR-0012, N = novidade, F = facilidade. Origem: P = produto-experiência, R = pesquisa-moonshot, E = ecossistema-alcance. Ordem pela soma; empate por V, depois F.

| # | Ideia (origem) | V (0–5) | A (0–5) | N (0–5) | F (0–5) | Σ (0–20) | Por que entra | Primeiro passo |
|---|---|---|---|---|---|---|---|---|
| 1 | Cabo só-tração + protensão (R3) | 5 | 5 | 3 | 5 | 18 | Torna a tensegridade literal; a mola atual empurra (connectivity-spring.js:27) | `live.edgeModel: cable` e `prestress` em compile-world.js:137-144 |
| 2 | Repouso honesto (P6+R2) | 5 | 4 | 2 | 5 | 16 | Sem `end` não se mede o tempo até assentar (H4), e o rAF nunca para | `<=` em :240/:244 e teste com corpo livre |
| 3 | Warm-start + temperatura local (R5+P5) | 5 | 4 | 3 | 4 | 16 | Fecha H3 e habilita qualquer transição | Honrar `seedPositions` em compile-world.js:84-91 |
| 4 | Raio-X de forças e frustração (P4+R8) | 4 | 5 | 3 | 4 | 16 | Mostra cabo × escora e explica o #1 | SVG estático de tensão e `_acc` (collision.js:96) |
| 5 | SVG animado SMIL (E2) | 3 | 5 | 4 | 4 | 16 | Exportação portátil da dinâmica; exceção prevista na carta | Arestas no spike render.mjs, parando no `end` |
| 6 | I1 no motor real (R13) | 5 | 5 | 3 | 2 | 15 | É o go/no-go da Fase 4 | Narrow-phase de segmento e I1 (playground:740) com seed |
| 7 | Energia como observável (R1) | 4 | 4 | 3 | 4 | 15 | ρ(E, stress) de 0,77 a 0,95 (pesquisa/energy.out) | `energy()` em central, mola e colisão P |
| 8 | Análise modal (R7) | 3 | 5 | 5 | 2 | 15 | Liga o diagrama à teoria de rigidez de tensegridades | Hessiana por diferenças finitas sobre o E do #7 |
| 9 | TensegraBench (R4+E8) | 5 | 3 | 3 | 3 | 14 | Evidência reprodutível; baselines só em dev | `bench/` com seeds e JSON por grafo e engine |
| 10 | `length`/`stiffness` por aresta (P15) | 4 | 4 | 2 | 4 | 14 | compile-world.js:141 aplica o mesmo `rest` a todas | EDGE_ATTRS (attr-set.js:67) e ADR-0007 decide DSL × config |

### Cemitério

| Ideia (origem) | V (0–5) | A (0–5) | N (0–5) | F (0–5) | Σ (0–20) | Razão |
|---|---|---|---|---|---|---|
| Playground público (E11) | 3 | 4 | 3 | 4 | 14 | Publica vereditos provisórios; fazer após o #6 |
| E se? cortar cabos (P14) | 3 | 4 | 4 | 3 | 14 | Depende do #3 e de mola calibrada |
| Telemetria move forças (R12+E14) | 3 | 5 | 5 | 1 | 14 | Esforço G; quebra determinismo e ADR-0007 |
| Sonificação (P13) | 2 | 5 | 4 | 3 | 14 | Sinal sem métrica; o #4 cobre o diagnóstico |
| Estudo perceptual de vivacidade (R15) | 2 | 5 | 5 | 2 | 14 | Não-objetivo da carta até H1–H3; descritores vão ao #9 |
| Duas mãos, multi-toque (P10) | 2 | 4 | 3 | 4 | 13 | Demonstração, não medição |
| Force zoo (E10) | 3 | 4 | 4 | 2 | 13 | Congela o ABI do World antes da Fase 4 |
| Arrastar grava na DSL (P1+R11) | 3 | 3 | 3 | 3 | 12 | Produto; o inverso é mal-posto; depende do #3 |
| Trace, replay e undo (E3+P8) | 4 | 3 | 3 | 2 | 12 | O #9 com seeds cobre a reprodutibilidade |
| Réplicas e tempering (R6) | 3 | 3 | 4 | 2 | 12 | Exige E confiável (#7) e Worker |
| Calibração Pareto (R9) | 4 | 3 | 2 | 3 | 12 | Prematura antes de #2, #3 e #9 |
| Paper/pôster (E12) | 4 | 4 | 3 | 1 | 12 | É resultado; sem H1–H4 não há tese |
| Cenas e storytelling (P7+E13) | 2 | 4 | 3 | 2 | 11 | Produto de apresentação; depende do #3 |
| Link vivo e embed (P9+E4) | 2 | 2 | 1 | 5 | 10 | Barato, mas produto congelado pela carta |
| Web Component (E5) | 1 | 3 | 2 | 3 | 9 | Importmap do `yaml` e globais `window.__*` (boot.js:145-154) |
| Action "diagram diff" (E7) | 3 | 2 | 2 | 2 | 9 | Regressão por SHA cabe no #9 |
| Campos de legibilidade (R10) | 3 | 1 | 2 | 3 | 9 | Stress par-a-par é atração global, vetada pelo ADR-0010 |
| Worker/WebGPU (R14) | 3 | 3 | 2 | 1 | 9 | Otimizar antes do GO do I1; teto já medido (scale2.out) |
| CLI + Kroki (E1) | 3 | 1 | 1 | 3 | 8 | Headless já roda por import direto |
| Gestos semânticos (P2) | 1 | 3 | 2 | 2 | 8 | Intenção ambígua, sem undo |
| Mesa compartilhada (P11) | 1 | 3 | 4 | 0 | 8 | Física não é CRDT; Yjs fere o ADR-0006 |
| Navegação acessível (P12) | 1 | 2 | 2 | 3 | 8 | Produto; reduced-motion vai para o #2 |
| Seleção cruzada (P3) | 1 | 1 | 1 | 4 | 7 | Conforto de editor, alheio à física |
| Importadores Mermaid/D2 (E9) | 2 | 1 | 1 | 3 | 7 | Alcance de mercado, não pesquisa |
| Servidor MCP (E15) | 1 | 1 | 2 | 3 | 7 | DSL ainda instável (ADR-0008, Fase 4) |
| Obsidian/VS Code (E6) | 0 | 1 | 1 | 3 | 5 | Adoção pura, manutenção alta |

### Sequência sugerida

1. Publicar a carta de pesquisa do veredito; ela fixa os limiares.
2. Fazer #2 e #3 num PR pequeno. Destravam tempo até `end`, H3 e toda transição.
3. Montar o #9 com o #7 como métrica. Destrava calibração e réplicas.
4. Rodar #1 e #10 no harness, com o #4 para ler os resultados. Fecham H4 e dão o primeiro número de H1.
5. Executar o #6. GO abre a Fase 4; NO-GO fica registrado.
6. Em paralelo à Fase 4: #5 como figura e #8 como leitura modal.
7. Só após H1–H4: paper, playground público e telemetria.

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Publicar a carta de pesquisa no README e num ADR | alto | P | Zero ocorrências de pesquisa/experimento/hipótese em README, AGENTS.md, index.html e .feat-memory. O leitor acredita estar diante de uma ferramenta de diagramação (README.md:3), não de um experimento. A carta fecha o gap de objetivo e dá critério de saída à Fase 4. |
| 2 | Corrigir a quiescência do motor v2 antes de qualquer medição | alto | P | solver.js:42 prende alpha em alphaMin e compile-world.js:240 exige alpha < alphaMin, então 'end' nunca dispara e o loop rAF (:244) não para (exp1c.out). Sem isso, H2 e H4 (ms/tick e tempo até assentar) não podem ser medidas, e o v2 viola a WCAG 2.2.2. O teste em tests/layout/compile-world.test.js:94 só cobre cena toda pinada. |
| 3 | Versionar um harness headless de avaliação com baselines externos | alto | M | Os ADRs dizem 'provado em sandbox', mas não há script nem saída reprodutível. Os spikes do ecossistema (exp3, exp5, scale2, mm-fair) já provam que é viável comparar com d3-force, WebCoLa e ELK. Como dependência só de desenvolvimento, o harness não fere o ADR-0006. |
| 4 | Reescrever o plano da Fase 4 com critério de saída e registrar uma F-NNNN do motor unificado | alto | M | O STATE com o roadmap foi apagado em 5bb9b8d. O UNRELEASED tem uma linha e nenhuma feature. src/physics e compile-world não têm feature no Manifest. Sem plano nem critério, a aposta central segue parada há 96 dias. |
| 5 | Rodar H4 barato antes das arestas-corpo: mola de conectividade como cabo só-tração | medio | P | A mola atual empurra quando d < rest (connectivity-spring.js:27), ou seja, não é cabo. Ligada, ela já derruba cruzamentos de 2.447 para 775 a N=120 (exp3.out). Tornar a mola só-tração testa a metáfora da tensegridade com poucas linhas, antes do custo da Fase 4. |
| 6 | Adicionar seção de trabalhos relacionados e usar o prior art como baseline | medio | P | Dwyer/Marriott/Wybrow 2008 (layout interativo com restrições e preservação de topologia, resumo aberto) e o vis-network 'dynamic' (support node na física, doc aberta) são vizinhos diretos. O repo não cita nenhum deles. Sem isso, a diferenciação sob a lente de pesquisa fica em 1/5. |
| 7 | Congelar investimento de produto até H1-H3 fecharem | medio | P | Sob a ambição declarada, export, CLI e embed não respondem à pergunta de pesquisa. A exceção útil é exportar SVG como figura de resultado. O default custom + orthogonal (store.js:32-33) pode continuar como está, desde que o README diga que a física é o objeto de estudo. |
| 101 | Um PR pequeno com repouso honesto (<=) e warm-start no v2 | alto | P | São cerca de 20 linhas ao todo. Hoje o `end` nunca dispara (compile-world.js:240/244); com `<=` ele dispara no tick 481 (end-fix.out). Honrar seedPositions baixa o deslocamento após uma edição de 70,2 para 27,7 px, e de 187,7 para 27,0 px com a mola (mm-warm.out). Sem essas duas mudanças, H3, H4 e toda ideia de transição ficam bloqueadas. |
| 102 | Versionar o harness bench/ com a energia E(x) como métrica | alto | M | Toda decisão de física precisa de script, seed e saída reprodutíveis. A energia correlaciona com o stress (ρ de 0,77 a 0,95, pesquisa/energy.out) e serve de critério de repouso e de função objetivo. Os baselines entram só como dependência de desenvolvimento (ADR-0006 intacto). |
| 103 | Cabo só-tração com protensão atrás de `live.edgeModel` | alto | P | A mola atual empurra quando d < rest (connectivity-spring.js:27), então não é cabo. No mesmo harness do exp3, o cabo com protensão 0,5 baixa os cruzamentos de 775 para 601 a N=120, e de 173 para 105 a N=60 com protensão 0,3 (cable-h1.out). É o teste mais barato da metáfora. A ligação vai direto em compile-world.js:137-144, porque o registry não é consumido. |
| 104 | Aceitar `length`/`stiffness` por aresta | medio | P | compile-world.js:141 aplica o mesmo edgeRestLength a todas as arestas, mas o contributor já aceita rest por aresta (connectivity-spring.js:26). É pré-requisito para experimentos de H1 com semântica, e o ADR-0007 precisa decidir se o atributo mora na DSL ou na config. |
| 105 | Raio-X de tensão e compressão como diagnóstico dos experimentos | medio | M | O sinal de k(d−rest) classifica cada aresta como cabo ou escora (spike-force-lens.out.txt), e o acumulador PI já está exposto como `_acc` (collision.js:96). Serve para interpretar o resultado do cabo antes de integrar ao renderer. |
| 106 | Portar o I1 para o motor real, incluindo narrow-phase de segmento | alto | G | O I1 é o go/no-go da Fase 4 (playground:740, META 'decisivo'). CAPSULE existe só no enum (world.js:29), então o custo é maior que o declarado. O scale2.out já indica 13,4 ms/tick para 100 nós + 150 arestas × 6 corners. |
| 107 | Fazer o compile-world consumir o registry de física, ou corrigir o comentário | baixo | P | registry.js:1-3 promete contributors plugáveis em runtime, mas só tests/physics/solver.test.js usa buildContributors. Três ideias (cabo, force zoo, campos) presumiram esse caminho. |

### ADRs candidatas desta trilha

- **Tensegrams é um experimento de pesquisa: carta com hipóteses, métricas e critério de conclusão** (confiança media). Adotar uma carta de pesquisa. Pergunta central: um único mundo físico, com nós-escora e arestas-cabo, gera diagramas legíveis e estáveis em tempo real? Hipóteses: H1 cruzamentos (N=120/E=159) ≤ 326, meta ≤ 183; H2 ≤ 8 ms/tick com 100 nós + 150 arestas × 6 corners; H3 deriva ≤ 5 px após editar e desfazer e ≤ 20% dos nós movidos >50 px por +1 nó com mola ligada; H4 resíduo ≤ 10 px após arrasto e 'end' ≤ 5 s. Baselines: d3-force, WebCoLa e ELK layered, com seeds fixas, só como dev-dependency. Não-objetivos: adoção, paridade com Mermaid/D2, export/CLI/embed, garantia combinatória de não-cruzamento, layouts em camadas como identidade, DSL como contrato público. Concluído = GO/NO-GO por hipótese, com script e seed versionados. GO: v2 vira default, src/routing/physics sai, ADR-0012 supersede ADR-0009. NO-GO: registrar resultado negativo e decidir arquivar ou pivotar. Timebox sugerido: 2026-12-31.
- **Dependências de avaliação (baselines) são dev-only e não ferem o ADR-0006** (confiança media). Permitir baselines externos apenas como devDependencies de um harness headless versionado (por exemplo, bench/), executado em Node com seeds fixas. Eles nunca entram no importmap nem no dist/. O ADR-0006 continua valendo integralmente para o runtime.

### Sugestões de evolução do processo desta trilha

- `readme-proposito-pesquisa` (doc-gap) → README.md (seção 'Propósito e hipóteses' no topo, derivada da carta de pesquisa): README.md:3 descreve o projeto como ferramenta de diagramação; zero ocorrências de pesquisa/experimento/hipótese no repo, contra a ambição declarada do mantenedor.
- `carta-pesquisa-adr` (new-adr) → .feat-memory/decisions/ (novo ADR com a carta de pesquisa): Não há hipóteses, limiares de go/no-go nem critério de 'experimento concluído'; o I2 (playground:776) mede sem aprovar.
- `feature-motor-unificado` (doc-gap) → .feat-memory/manifest/features/ (F-0020 motor unificado / layout v2) e changelog/UNRELEASED.md: src/physics e compile-world.js não têm F-NNNN no Manifest; o UNRELEASED.md cita só ADRs, então o conjunto ativo (ADR-0043) sai vazio de features.
- `plano-fase4-reescrito` (doc-gap) → .feat-memory/ (plano da Fase 4 com critério de saída ligado às hipóteses H1-H4): O plano de rearquitetura (Fase 4, D-massa/D-PI, princípios #1-#7) não está no repo; o STATE com o roadmap foi apagado em 5bb9b8d.
- `trabalhos-relacionados` (doc-gap) → README.md ou docs/related-work.md: Nenhuma citação de Dunnart/Dwyer-Marriott-Wybrow 2008, WebCoLa, vis-network dynamic ou FDEB, que são vizinhos diretos e baselines naturais.
- `evidencia-sandbox-reprodutivel` (new-rule) → AGENTS.md (regra: decisão de física cita script + seed + saída versionados): ADR-0010:35 e ADR-0011 afirmam 'provado em sandbox'/'medido' sem script nem saída versionados; o playground é interativo.
- `adr-0011-drift-pi` (doc-gap) → .feat-memory/decisions/0011 ou compile-world.js (reconciliar): ADR-0011:33-35 deixa o termo integral fora do default, mas compile-world.js:42 liga collisionKi 0,04; o audit de 113ef70 reportou 0 drift.
- `quiescencia-v2` (heuristic-fix) → tests/layout/compile-world.test.js (teste de 'end' com cena livre): Os helpers de settle dos testes usam limiar 0,005 e o único teste de 'end' pina a cena toda (tests/layout/compile-world.test.js:94), o que mascarou o 'end' que nunca dispara no v2 (solver.js:42 x compile-world.js:240).

### Fontes

- /home/user/tensegrams/README.md:1-3,191,383-389
- /home/user/tensegrams/index.html:8
- /home/user/tensegrams/src/store.js:28-35
- /home/user/tensegrams/src/layout/adapters/live/index.js:120-130
- /home/user/tensegrams/src/physics/solver.js:19-46
- /home/user/tensegrams/src/layout/compile-world.js:36-56,160-167,228-250
- /home/user/tensegrams/src/physics/collision.js:55-75
- /home/user/tensegrams/src/physics/contributors/connectivity-spring.js:15-35
- /home/user/tensegrams/.feat-memory/decisions/0012-edges-driven-by-force-tendencies.md (integral)
- /home/user/tensegrams/.feat-memory/decisions/0011-force-zone-linear-zone-x-zone.md:28-36
- /home/user/tensegrams/.feat-memory/decisions/0009-physics-routing-opt-in.md:1-30
- /home/user/tensegrams/.feat-memory/changelog/UNRELEASED.md
- /home/user/tensegrams/.feat-memory/suggestions.md
- /home/user/tensegrams/playground/physics-playground.html:741,776,827-835 (grep -c SCN.push = 27)
- git log --date=short (13 commits; último 5bb9b8d em 2026-06-26; último de motor 3b8692e em 2026-06-06)
- grep -rniE 'pesquisa|experiment|research|hipótese' README.md AGENTS.md index.html .feat-memory -> 0 linhas
- grep -rni tensegr (fora de node_modules/.git) -> conceito só em ADR-0012:20
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/exp1.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/exp1c.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/exp3.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/exp5.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/pi-2body-b.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/scale2.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/mentalmap/mm-fair.out
- https://eceasst.org/index.php/eceasst/article/view/1475 (aberto: Dwyer, Marriott, Wybrow 2008, 'Interactive, Constraint-based Layout of Engineering Diagrams'; o resumo não menciona 'rubber bands')
- https://visjs.github.io/vis-network/docs/network/edges.html (aberto: 'invisible support node ... part of the physics simulation')
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/juiz/report.md (rascunho desta seção)

### ADRs candidatas desta trilha

- **O motor v2 honra o warm-start (seedPositions/seedAlpha) como o v1** (confiança alta). O contrato de sessão dos adapters inclui o warm-start. O v2 posiciona nós com seed na posição anterior e nasce cada nó novo no centróide dos vizinhos já posicionados. O alpha inicial passa a ser max(seedAlpha, alphaKick). Um teste de contrato comum a v1 e v2 cobre isso. A temperatura por corpo fica como evolução.
- **Arestas como cabos só-tração com protensão (edgeModel: cable)** (confiança media). Adicionar `live.edgeModel: spring\|cable` e `live.prestress` (rest = L0·(1−p)), opt-in até a H4 ter GO. Colisão continua como escora só-compressão. A escolha do default fica para o resultado do harness com seeds múltiplas.
- **Critério de repouso do v2: alpha <= alphaMin, depois energia cinética e força residual** (confiança alta). Usar `<=` já, com um teste de cena com corpo livre. Em seguida, repouso = KE < ε e ‖F‖ < δ por N ticks. 'Respirar' (oscilação limitada) passa a ser opção explícita e 'congelar' é o default. prefers-reduced-motion pinta direto o estado final.

### Sugestões de evolução do processo desta trilha

- `v2-warm-start-contrato` (heuristic-fix) → tests/layout/ (teste de contrato de adapter: editar a DSL não desloca nós existentes em t=0): O v2 ignora seedPositions (compile-world.js:84-91), mas não há teste de contrato comum v1/v2 que pegue isso. O spike mm-warm.out mostra 70,2 contra 27,7 px com um patch de ~15 linhas.
- `registry-fisica-nao-consumido` (doc-gap) → src/physics/registry.js (comentário) ou src/layout/compile-world.js (consumir buildContributors): src/physics/registry.js:1-3 promete contributors plugáveis em runtime, mas compile-world.js:128-144 monta a lista à mão. Só tests/physics/solver.test.js chama buildContributors.
- `cenarios-playground-27` (doc-gap) → dossiê do ecossistema / README (contagem de cenários): O dossiê e duas ideias citam 24 cenários, mas grep -c 'SCN.push' playground/physics-playground.html = 27 (A1..I2).
- `ideia-reuso-cita-consumidor` (new-rule) → prompt dos geradores do ecossistema (exigir citar o call site que consome a API, não só a definição): Três ideias alegaram reaproveitar código cuja API existe mas não tem consumidor real (registry de física; menu de contexto só para containers, context-menu.js:31; CAPSULE só no enum, world.js:29).
- `edge-model-cable` (new-adr) → .feat-memory/decisions/ (ADR edgeModel: cable + prestress): A mola bilateral empurra (connectivity-spring.js:27). O cabo só-tração com protensão 0,5 baixa os cruzamentos de 775 para 601 a N=120 (cable-h1.out).

### Fontes

- /home/user/tensegrams/src/layout/compile-world.js:1-60,84-91,128-144,160-169,235-244,259-305
- /home/user/tensegrams/src/physics/solver.js:13,37-50
- /home/user/tensegrams/src/physics/registry.js:1-60
- /home/user/tensegrams/src/physics/world.js:1-45,119
- /home/user/tensegrams/src/physics/collision.js:9-10,36,41,73-96
- /home/user/tensegrams/src/physics/contributors/connectivity-spring.js:1-34
- /home/user/tensegrams/src/physics/contributors/tag-forces.js:25-60
- /home/user/tensegrams/src/layout/adapters/live/index.js:107-151,124-127,366
- /home/user/tensegrams/src/app/pipeline.js:31-37,116-154,170-243
- /home/user/tensegrams/src/app/gestures.js:1-15,66-80,271-277
- /home/user/tensegrams/src/store.js:29-35,106,132-139
- /home/user/tensegrams/src/ui/context-menu.js:31
- /home/user/tensegrams/src/dsl/attr-set.js:6-10,49,67
- /home/user/tensegrams/src/app/boot.js:145-154
- /home/user/tensegrams/scripts/build-dist.js:34
- /home/user/tensegrams/tests/layout/compile-world.test.js:85-95
- /home/user/tensegrams/playground/physics-playground.html:321-775 (27 SCN.push), 825-840 (META, NOTES_KEY)
- /home/user/tensegrams/.feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md
- /home/user/tensegrams/.feat-memory/decisions/0012-edges-driven-by-force-tendencies.md
- grep -rln 'registerContributor|buildContributors' src tests -> só src/physics/registry.js e tests/physics/solver.test.js
- grep -n -i seed src/layout/compile-world.js -> 0 linhas
- grep -n 'engine|collisionKi|substeps|connectivitySpring|edgeSpring' src/controls/config-schema.js -> 0 linhas
- grep -rn prefers-reduced-motion src index.html style.css -> 0 linhas
- node spike-headless/render.mjs quad --layout=live --engine=v2 (3x) -> sha256 4919c96c5ec75b94... idêntico, 482 ticks
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/convergente/mm-warm.mjs + mm-warm.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/convergente/end-fix.mjs + end-fix.out (cw-end.mjs)
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/convergente/cable-h1.mjs + cable-h1.out (cw-cable.mjs)
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/convergente/report.md
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/pesquisa/energy.out, bench.out, mentalmap.out, endcheck.out, drift.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/produto-ux/spike-v2-warmstart.out.txt, spike-v2-drag.out.txt, spike-force-lens.out.txt, spike-share-url.out.txt, spike-v2-end.out.txt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/spike/exp3.out, exp5.out, scale2.out
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/estrategia/mentalmap/mm-fair.out

## Apêndice A · Objetivo reconstruído às cegas (sem dossiê, sem a resposta do mantenedor)

Reconstrução cega do objetivo do Tensegrams, feita só com o que está no repositório: README.md, AGENTS.md, index.html, package.json, .feat-memory/ (manifest F-0001..F-0019, ADR-0001..0013, changelog, e o STATE.md e o checkpoint removidos, recuperados do git), playground/physics-playground.html, registries, pipeline.js, compile-world.js, examples.js, attr-set.js, e2e/ e o git log. Também rodei a suíte unit para conferir números: 797/797 verde em 78 arquivos.

O QUE É (EXPLÍCITO, README l.3): uma "SPA standalone para desenhar diagramas via DSL em YAML, com auto-layout e auto-routing pluggáveis". O "o quê" está muito bem documentado: DSL, atributos, gestos, persistência e 19 features com critérios EARS. O "porquê", o "para quem" e o "contra quem" não estão escritos em lugar nenhum.

A identidade real aparece em poucas frases espalhadas:
- ADR-0012: "o movimento orgânico/vivo é central à identidade do projeto (tensegridade)".
- ADR-0009, texto original: o solver físico é "a feature de ouro do projeto".
- Playground, cenário I1: "a aposta central do engine v2: nós e arestas no MESMO mundo físico".

INFERIDO: hoje o projeto é mais um veículo de P&D sobre layout e roteamento físicos, mantido por uma pessoa com agentes de IA, do que um produto. Também parece servir de laboratório (dogfooding) da metodologia feat-memory do mesmo autor. A governança de engenharia é pesada: gates, 13 ADRs e 19 features com EARS. Em contraste, a definição de produto é quase nula: não há problema, persona, métrica de sucesso nem posicionamento escritos.

Há deriva séria entre artefatos:
- O README ainda descreve o modelo de forças que foi superado (atrator central único, arestas passivas, algébrico como default).
- O AGENTS.md aponta para caminhos que não existem mais (.agent-memory/, STATE.md).
- Os roadmaps do README e da memória divergem.
- A "aposta central" (src/physics e o motor v2) não tem feature no Manifest nem aparece no README.

Notas da definição do objetivo: clareza 2, consistência 2, mensurabilidade 1, delimitação 2, diferenciação 2.

| Critério | Nota (0–5) |
|---|---|
| Clareza | 2 |
| Consistência | 2 |
| Mensurabilidade | 1 |
| Delimitação | 2 |
| Diferenciação | 2 |

CLAREZA 2/5: o QUE o sistema faz está excelente (README detalhado, 19 features com EARS, DSL documentada). Mas o OBJETIVO (problema, para quem, por quê) não está escrito em nenhum artefato. A frase que mais se aproxima de uma visão ('movimento orgânico/vivo é central à identidade do projeto (tensegridade)') está num parêntese do ADR-0012. O README abre com uma descrição técnica, não com propósito. O leitor precisa garimpar ADRs, playground e o histórico git (STATE.md apagado) para inferir a direção.

CONSISTÊNCIA 2/5: o núcleo semântico (DSL, 2 conceitos, arestas não-direcionadas, parent:) é coerente em todos os artefatos. A narrativa estratégica diverge bastante:
(a) O README e F-0002/F-0005 descrevem o modelo de forças superado pelo ADR-0010/0012.
(b) O README e F-0003/F-0017 A4 chamam o algébrico de 'default', contra a atualização do ADR-0009.
(c) Os números de teste do README estão desatualizados (751 contra 797 reais).
(d) O AGENTS.md referencia .agent-memory/ e STATE.md, que não existem.
(e) Os roadmaps do README (editor de DSL, presets) e da memória (Fase 4) são diferentes.
(f) A identidade físico-cêntrica convive com 'sem default privilegiado', defaults estáticos e planos de dagre/elk.
(g) Os números de ADR colidem entre o projeto e o feat-memory.

MENSURABILIDADE 1/5: há muita mensurabilidade de ENGENHARIA (EARS, invariantes geométricos com tolerância em px, gate de CI, SHA de deploy). Mas não há um único critério de sucesso do OBJETIVO: nada de uso, adoção, tempo-para-diagrama ou qualidade estética com alvo. O go/no-go do playground I2 lista as métricas (ms/tick, ticks até assentar, cruzamentos) e a escala ('dezenas a ~centena de nós'), mas sem limiares. A virada para v2 depende de 'validação de performance' sem números. Recebe 1 e não 0 porque as métricas certas estão identificadas, só não têm meta.

DELIMITAÇÃO 2/5: o escopo DENTRO está bem inventariado (Manifest), e há exclusões técnicas bem justificadas nas 'Alternativas rejeitadas' dos ADRs. Faltam non-goals de produto: export de imagem, colaboração, embedding/CLI, tipos de diagrama, escala e i18n não são mencionados. A Fase 4, que é o trabalho em voo, não tem escopo nem critério de saída no repo (o plano citado está ausente). A superfície da DSL no código é maior que a documentada.

DIFERENCIAÇÃO 2/5: há matéria-prima forte de diferenciação: modelo mínimo Node/Edge, colisão declarativa por camadas com pesos, atratores, arestas como corpos físicos, tensegridade. Os ADRs contrastam genericamente com 'editores de diagrama' e 'muitos formatos'. Mas não há nenhum posicionamento contra alternativas concretas (Mermaid, D2, Graphviz, PlantUML, Structurizr, draw.io, ELK). E o diferencial central (física unificada, movimento vivo) não chega ao usuário por padrão: o default é custom + orthogonal e o v2 fica atrás de uma flag não documentada.

**Problema:** EXPLÍCITO. Não existe um "problem statement" de produto. O que há são problemas de DESIGN, registrados no contexto dos ADRs:
- (a) Editores de diagrama "acumulam tipos de elemento" e "forçam o usuário a escolher o tipo antecipadamente" (ADR-0002, Contexto).
- (b) Formatos em que a aresta carrega direção "obrigam o usuário a pensar em sentido mesmo quando o desenho não precisa" (ADR-0003).
- (c) Aninhar YAML "acopla a declaração de atributos à posição na árvore" e dificulta o reparent (ADR-0004).
- (d) Modelos de mola clássicos "produzem layouts imprevisíveis e difíceis de controlar declarativamente" (ADR-0005, superseded, histórico).
- (e) Um toolchain de bundler é "desproporcional" para uma SPA com uma única dependência (ADR-0006).
- (f) Misturar knobs semânticos e de "feel" confunde o que é portável (ADR-0007).

O valor por feature aparece em F-0001: "Escrever um diagrama em YAML ... e ver o SVG renderizar ao vivo ... sem passo de build".

INFERIDO. Há dois problemas sobrepostos:
- (1) Problema de usuário: produzir e explorar diagramas, sobretudo de arquitetura de software (os exemplos em src/dsl/examples.js usam API, API Gateway, Postgres, Redis, Worker, Queue), a partir de texto. O layout deve ser automático, mas controlável por regras declarativas (colisão por camadas com pesos, atratores, constraints, pins), em vez de posicionamento manual ou algoritmo opaco. Inclui navegar hierarquia e camadas (drill-in, colapso, filtro por tag).
- (2) Problema de pesquisa do mantenedor: provar que UMA simulação física única resolve layout e roteamento juntos, com não-sobreposição e não-cruzamento como "tendências", e dá movimento orgânico e interativo. É o foco declarado da "Fase 4" (STATE.md no histórico, commit 5bb9b8d^) e dos 24 cenários do playground, com go/no-go de densidade no cenário I2.

O problema (2) é o que efetivamente orienta o trabalho recente (commits bab6b3f..113ef70). O problema (1) está atendido pelas features "shipped".

**Público:** EXPLÍCITO (pouquíssimo):
- "Usuário" genérico nos EARS.
- "Projeto de uso interno/inicial" (ADR-0008, Contexto).
- "A edição manual é o caso de uso central" (ADR-0008, alternativas rejeitadas).
- Um único "mantenedor" (ADR-0001, ADR-0012).
- "O projeto é desenvolvido com assistência de agentes" (ADR-0001).
- UI em pt-BR (index.html: lang="pt-br", todos os rótulos em português).
- Suporte a desktop e mobile (F-0019, projeto Playwright Pixel 7).

INFERIDO:
- (1) Público primário: o próprio mantenedor e, no máximo, um time próximo. Evidências: "uso interno/inicial"; package.json "private": true; nenhum LICENSE; o hard-cut v1→v2 aceitou perder diagramas salvos "porque o conteúdo é facilmente recriável".
- (2) Persona implícita: desenvolvedor ou arquiteto de software lusófono, fluente em YAML avançado (a chave composta `? [a, b]` com `:` em outra linha é sintaxe pouco conhecida e o README precisa explicá-la) e confortável com conceitos de física/forças (pesos, pads, damping, attractTo).
- (3) Público secundário: agentes de IA. O AGENTS.md é a constituição; o debug pack JSON é "matéria-prima dos specs de regressão" (F-0018); a telemetria do feat-memory está ligada (.meta.yaml).

Não há persona, segmento ou contexto de uso descrito em nenhum artefato.

**Proposta de valor:** EXPLÍCITO (espalhado e nunca formulado como proposta):
- DSL YAML com preview ao vivo e sem build (README, F-0001).
- Modelo mínimo de dois conceitos, Node/Edge, em que o container é derivado da topologia (ADR-0002).
- Arestas não-direcionadas, com a direção só como decoração de ponta (ADR-0003).
- Hierarquia por referência `parent:` (ADR-0004).
- Colisão declarada inline por camadas e pesos (README "Collision layers", F-0005).
- Separação DSL semântica vs Config de "feel" (ADR-0007).
- Layout e router como plugins ortogonais (ADR-0013).
- Drill-in, colapso e filtro por camadas (F-0004, F-0006).
- Identidade física: "o movimento orgânico/vivo é central à identidade do projeto (tensegridade), não um nice-to-have" (ADR-0012); o solver físico é "a feature de ouro" (ADR-0009, texto original).

INFERIDO. O diferencial pretendido é "diagramas como estruturas de tensegridade": um único mundo físico em que nós se repelem (compressão) e atratores e arestas puxam (tensão). O autor controla o layout pela semântica declarada (quem colide com quem, quem atrai quem, restrições), não por coordenadas nem por um algoritmo caixa-preta. O resultado é vivo e interativo (arrastar e re-negociar).

Esse diferencial NÃO chega ao usuário por padrão:
- O default é layout `custom` (estático) + router `orthogonal` algébrico (src/store.js l.32-33).
- O motor unificado v2 fica atrás de uma flag não documentada, `live.engine: 'v2'` (src/layout/adapters/live/index.js l.50-52), ausente do README e do schema de config.

Não há nenhuma comparação com alternativas (Mermaid, Graphviz, D2, PlantUML, Structurizr, draw.io, ELK). O único aceno é o comentário "dagre / elk land here in future phases" em src/layout/registry.js.

**Tipo de projeto:** EXPLÍCITO:
- "Projeto de uso interno/inicial" (ADR-0008).
- package.json "private": true; sem LICENSE.
- Deploy público no GitHub Pages de conta pessoal (brunoleos.github.io/tensegrams, em AGENTS.md lição 5 e e2e-prod).
- Um mantenedor; desenvolvimento assistido por agentes (ADR-0001).

INFERIDO: é um híbrido, e a documentação não diz qual é a prioridade.
- (a) Ferramenta pessoal/interna de diagramação (as features F-0001..F-0019 estão "shipped").
- (b) Projeto de PESQUISA aplicada em layout e roteamento físicos, que hoje domina a agenda. Evidências: sandbox com 24 cenários e métricas; ADRs decididos por experimento ("provado em sandbox"); linguagem de "aposta central" e "go/no-go"; Fases 1-4 de rearquitetura.
- (c) Banco de prova e vitrine da metodologia feat-memory/agent-memory do mesmo autor. Evidências: AGENTS.md aponta para github.com/brunoleos/feat-memory; migrações sucessivas agent-memory 0.13 → feat-memory 1.3.1 → 2.1.0; telemetry_enabled: true; ADR-0001 é meta.

Não é um produto no sentido de mercado: não há usuários, métricas, posicionamento, licença nem export do diagrama como SVG/PNG para uso final. A única imagem exportável vai dentro do debug pack (src/app/debug-export.js l.32-44).

**Perguntas que a documentação não responde:**

- Quem é o usuário-alvo primário (o próprio mantenedor, um time interno, a comunidade de devs em geral)? Qual persona, contexto e frequência de uso?
- Qual problema concreto o Tensegrams resolve MELHOR que Mermaid, D2, Graphviz, PlantUML, Structurizr, draw.io ou ELK? Por que alguém trocaria de ferramenta?
- O projeto é primariamente produto/ferramenta, pesquisa em layout físico, ou banco de prova da metodologia feat-memory? Quando esses objetivos conflitam, qual prevalece?
- Qual é o artefato final que o usuário leva embora? Hoje não há export SVG/PNG do diagrama, só YAML e o debug pack. Onde o diagrama é consumido (docs, apresentações, exploração interativa)?
- Como se concilia 'o movimento orgânico é central à identidade' (ADR-0012) com 'sem default privilegiado' (ADR-0009, atualização), com os defaults estáticos custom + orthogonal e com a intenção de plugins dagre/elk (src/layout/registry.js)?
- Quais são os limiares quantitativos do go/no-go da unificação e da virada do default para v2: ms/tick, ticks até assentar, nº de cruzamentos, N de nós e arestas suportado?
- Onde está o plano de rearquitetura citado no código e nos commits ('Fase 4', 'D-massa', 'D-PI', princípios #1–#7)? Qual o escopo, o critério de saída e o horizonte da Fase 4?
- Qual é o roadmap canônico: o do README (editor estruturado da DSL, presets de ponta) ou o da memória (Fase 4 do motor físico, remoção de src/routing/physics)?
- Que tipos de diagrama estão no escopo (arquitetura de sistemas, fluxos, ER, mapas conceituais, sequência) e quais estão explicitamente fora?
- Como 'qualidade de layout/roteamento' é definida objetivamente (cruzamentos, dobras, comprimento, sobreposição, estabilidade temporal) e com quais metas?
- Colaboração, compartilhamento por URL, embedding em Markdown/docs e uso headless/CLI estão dentro ou fora do escopo?
- A DSL é um contrato público estável? A justificativa do hard-cut ('uso interno/inicial', ADR-0008) ainda vale, dado o deploy público no GitHub Pages?
- O público é só lusófono (UI pt-BR) ou há intenção de internacionalizar?
- Como o `attractTo` por tag (atração corpo→corpo em tag-forces.js) se reconcilia com o ADR-0010 ('corpos apenas se repelem; aceita-se perder atração par-a-par')?
- O que significa 'sucesso' do projeto em 6 a 12 meses: diagramas reais produzidos, usuários, publicação/paper sobre o motor, maturidade do feat-memory?

## Apêndice B · Contradições (20)

Confrontei o objetivo reconstruído com o código, os testes, a memória (ADRs, Manifest e o STATE recuperado do git) e o histórico. Quase tudo que o reconstrutor apontou se confirma. Há, porém, uma correção de enquadramento importante e várias contradições que ele não viu.

CORREÇÃO DE ENQUADRAMENTO. O reconstrutor trata o README como "desatualizado" frente aos ADR-0010/0011/0012. Na verdade o README descreve com fidelidade o código que roda por padrão: live/index.js l.124-126 diz "Edges exert NO force... The simulation never reads ir.edges". Quem descreve como presente algo que não existe são os ADRs e o commit 113ef70.
- 113ef70 afirma "Confirmado em código: arestas exercem força (molas de conectividade + colisão capsule×rect no motor unificado)".
- Colisão capsule não existe. SHAPE.CAPSULE é só um enum (world.js l.29), a narrow-phase é AABB×AABB (collision.js l.2), e o próprio STATE da mesma época lista "arestas como corpos capsule" como trabalho da Fase 4.
- A mola de conectividade é opt-in, com default false (compile-world.js l.54).

Isso não é deriva de documentação, é premissa falsa. E foi com base nela que se superou o ADR-0005 ("arestas passivas").

TESE CENTRAL DAS CONTRADIÇÕES. A identidade declarada ("tensegridade", "movimento vivo", "feature de ouro") está fora de tudo o que o usuário toca:
- A palavra "tensegridade" aparece uma única vez no repositório, no ADR-0012 l.20. Não aparece no README, na UI nem no código.
- O default é custom (estático) + orthogonal (algébrico).
- As arestas não exercem tensão nenhuma por padrão. É uma "tensegridade sem cabos".
- O motor v2 fica atrás de uma flag ausente do README e do schema de config.
- O exemplo "forces" só é acessível por window.__examples__.
- A suíte de invariantes geométricos pula o layout live de propósito.

ESFORÇO. O maior subsistema do repositório é exatamente o que foi declarado descartável: o routing físico legado, F-0017 deprecated. São cerca de 2,8 mil linhas de src (23,5%), cerca de 3,8 mil linhas de teste unit (34%) e 3 specs E2E, e todo esse código continua obrigatório no gate de push. A "aposta central", o motor v2, tem cerca de 1,0 mil linhas de src (8,5%), cerca de 650 linhas de teste e nenhum E2E.

Depois da Fase 3 (2026-06-06) não entrou nenhuma linha de engine, só ADRs, playground e migração de metodologia. O último commit é de 2026-06-26, ou seja, 96 dias parado até hoje. Entre as adições posteriores ao commit inicial, governança e memória somam cerca de 2,8 mil linhas, contra cerca de 0,4 mil de valor ao usuário.

GOVERNANÇA. Os ADRs de física descrevem um modelo que o código contradiz em pontos verificáveis:
- PI ligado por default, contra o ADR-0011.
- Pad global, e não por elemento.
- Container derivado, e não corpo + atrator-região.
- Peso 1 que deixa de ser imóvel.
- attractTo corpo-a-corpo.

Mesmo assim o audit registra "0 drift, cobertura 100%". O Manifest contradiz os próprios testes de contrato: F-0009 A1 promete "vira pin onde caiu", enquanto live.test.js l.430 garante o oposto. E a migração para feat-memory 2.1.0 apagou o STATE.md, que era o único registro do roadmap (Fase 4, virada do default). O que sobrou foi um UNRELEASED de uma linha, sem nenhuma F-NNNN.

Nada foi modificado no repositório. Não escrevi arquivos.

#### Premissa falsa usada para superar o ADR-0005: 'arestas exercem força... colisão capsule×rect no motor unificado' (impacto alto)

- **Lado A:** O commit 113ef70 (2026-06-25) justifica o supersede do ADR-0005 ('arestas passivas') assim: 'Confirmado em código: arestas exercem força (molas de conectividade + colisão capsule×rect no motor unificado)'. O ADR-0012 decide 'arestas são objetos físicos... cápsulas derivadas dos corners'.
- **Lado B:** No código não há colisão capsule. A mola de conectividade existe, mas vem desligada por padrão. O STATE da mesma época trata edges-as-bodies como trabalho FUTURO.
- **Evidência:** - src/physics/world.js l.29: SHAPE.CAPSULE é só um enum.
- src/physics/collision.js l.2: 'narrow-phase (AABB×AABB)'; em todo o src, 'capsule' só aparece nesse enum.
- compile-world.js l.54: connectivitySpring: false.
- Commit 2a8c80d: 'The reciprocal edge->node axis needs edges-as-bodies and lands in Fase 4'.
- STATE.md (git show 5bb9b8d^): Next = 'Fase 4... arestas como corpos capsule no mesmo World dos nós'.
- live/index.js l.124-126: 'Edges exert NO force — they are purely passive in this model'.

#### 'Tensegridade' sem tensão: as arestas (os 'cabos') não exercem força em nenhum caminho default (impacto alto)

- **Lado A:** O nome Tensegrams e o ADR-0012 ('o movimento orgânico/vivo é central à identidade do projeto (tensegridade)') implicam, por INFERÊNCIA, nós em compressão e ARESTAS em tensão.
- **Lado B:** No v1 (live, custom, off) as arestas são passivas por construção. No v2 a tensão (connectivitySpring) é opt-in, e desligá-la foi escolhido para 'preservar o modelo atrator-central'. A única atração default é o atrator central, que puxa tudo para (0,0), coisa que não é tensegridade.
- **Evidência:** - live/index.js l.124-126: 'The simulation never reads ir.edges'.
- compile-world.js l.51-54: 'Default OFF preserva o modelo atrator-central'.
- physics/registry.js l.38: connectivity com defaultEnabled: false.
- README l.191: 'As arestas são passivas (nunca exercem força)'.
- grep -ri 'tensegr' fora de node_modules: 1 ocorrência (ADR-0012 l.20).

#### A identidade declarada está invisível ao usuário: defaults estáticos, flag não documentada, demo inacessível (impacto alto)

- **Lado A:** ADR-0012: movimento vivo 'central à identidade... não um nice-to-have'. ADR-0009 (texto original): o solver físico é 'a feature de ouro'. Playground I1: o v2 é 'a aposta central'.
- **Lado B:** O default é custom (estático) + orthogonal (algébrico). O v2 só liga com live.engine: 'v2', que não está no README nem no schema do editor estruturado. O exemplo 'forces', único que demonstra física, não tem seletor na UI. O exemplo default ('quad') é um fixture de regressão com nós A/B/C/D. O título da UI é 'DSL & visualizador'.
- **Evidência:** - src/store.js l.30-33: dsl: EXAMPLES.quad; layoutId: 'custom'; routerId: 'orthogonal'.
- live/index.js l.48-52: a flag.
- controls/config-schema.js: sem 'engine', 'connectivitySpring' nem 'routing.*'.
- app/boot.js l.148: window.__examples__ é o único acesso a intro/containers/forces.
- examples.js l.11-14: quad é 'Cenário canônico pra observar: contorno de nós alheios...'.
- index.html l.8: título 'Tensegrams — DSL & visualizador'.

#### O maior esforço do repositório está no subsistema declarado descartável (F-0017), que ainda pesa no gate de push (impacto alto)

- **Lado A:** ADR-0009 (atualização) e F-0017: src/routing/physics está deprecated, 'não será promovido a padrão' e 'será removido' quando a Fase 4 chegar.
- **Lado B:** É o maior bloco de código e de testes do repo, a Fase 4 não começou, e o AGENTS.md obriga unit + E2E verdes (incluindo esses specs) antes de todo push.
- **Evidência:** - src/routing/physics: 1.952 LOC.
- Módulos consumidos só por ele: face-select 190, crossings 107, snap-endpoints 76, snap-resolver 183, src/shapes 298 (total de cerca de 2,8 mil LOC, 23,5% dos 11.934 LOC de src).
- Testes: tests/routing/physics 2.951 linhas + 838 dos helpers (cerca de 34% das 11.040 linhas unit). Contagem aproximada de chamadas test(): 158 no legado contra 46 no v2 (tests/physics + compile-world).
- E2E: 14-edge-crossings, 18-foreign-node-detour e 19-perimeter-rail-redesign (402 linhas) testam só o engine deprecated. Nenhum spec E2E cobre live.engine: v2.

#### O ADR-0012 rejeita 'híbrido A* + waypoints', e é exatamente o que o layout live em produção faz (impacto alto)

- **Lado A:** ADR-0012, Alternativas rejeitadas: 'Híbrido A* + suavização de waypoints: idem — a rota continuaria prescrita, não emergente'. O modelo aceito (cadeias de corners, cápsulas, anti-cruzamento) não existe no motor unificado.
- **Lado B:** O único caminho 'vivo' de arestas que o usuário alcança (layout live v1) é declaradamente híbrido A* + física. A forma 'por força' que existe (F-0017) está deprecated. A forma aceita não foi implementada.
- **Evidência:** - src/layout/adapters/live/collision-waypoints.js l.1: 'Edge waypoints for the live force sim — HYBRID A* + physics'.
- l.3-7: N waypoints determinado por A* (hananRoute), cada vértice vira semente.
- src/physics/: não há arestas como corpos (compile-world.js só cria corpos de nós, l.71-102).

#### ADR-0011 contradiz o código do motor v2, que foi escrito ANTES dele e não foi reconciliado (impacto medio)

- **Lado A:** ADR-0011 (2026-06-10) decide: (1) zona de força (pad) POR ELEMENTO; (2) gate zona×zona com pads assimétricos (gap < padA + padB); (3) perfil linear só P, 'antídotos conhecidos (termo integral, projeção) ficam fora do default'.
- **Lado B:** O motor v2 (commit bab6b3f, 2026-06-06) usa pad GLOBAL único e o controlador PI (termo integral) LIGADO por padrão, justamente para 'zerar overlap residual'. O world não tem campo de pad por corpo.
- **Evidência:** - src/physics/collision.js l.9-12 (PI 'Substitui o passe de separação dura'), l.36 Ki = 0.05 default e l.62-63 sx = hw_a + hw_b + 2*pad (pad global).
- compile-world.js l.42: collisionKi: 0.04.
- world.js l.17-26: stride de 9 campos, sem pad.
- O commit 113ef70 'reconcilia ADRs do motor físico com o código' reporta 'audit: 0 drift'.

#### O modelo de container do ADR-0010 não é o implementado, e o próprio playground admite isso (impacto medio)

- **Lado A:** ADR-0010: 'um container é um corpo que repele peers E hospeda um atrator-região para os filhos'; 'conter = atrator-região'.
- **Lado B:** No v2, container com filhos NÃO é corpo: o retângulo é derivado do bbox dos filhos, como no v1. Logo não repele peers nem contém. O playground chama o modelo derivado de 'modelo atual do produto'.
- **Evidência:** - compile-world.js l.9-10: 'containers com filhos derivam o rect dos descendentes, como no live legado'.
- l.73-74 e l.191-212: derivação em 3 passes.
- playground/physics-playground.html, cenário F5: 'DERIVADA (modelo atual do produto): o rect do container é o bbox dos filhos + padding — arrastar um filho para fora ESTICA o container (sem contenção...)'.

#### 'Corpos apenas se repelem' (ADR-0010) contra attractTo corpo-a-corpo no motor v2 (impacto medio)

- **Lado A:** ADR-0010: 'toda atração vem de atratores'; 'Atração corpo-corpo todos-com-todos: degenerada (provado em sandbox)'; 'aceita-se perder atração par-a-par nativa'.
- **Lado B:** O v2 portou a atração par-a-par por tag (∝ 1/d) entre todos os corpos que carregam a tag. Dentro de um grupo, é o todos-com-todos que o ADR diz ter provado degenerado. Além disso, a tag usada é a de VISIBILIDADE (viewLayers), misturando filtro de visão com física.
- **Evidência:** - src/physics/contributors/tag-forces.js l.23-38: soma sobre todos os slots da tag, com f = kAttract·str·alpha/d.
- compile-world.js l.113-126: 'tag-forces sobre viewLayers (como no live legado)'.
- examples.js ('forces'): drifter com attractTo: { anel: 2 }, onde 'anel' é uma viewLayer.

#### Trocar o engine (knob de Config) muda a SEMÂNTICA da DSL, e a DSL carrega knobs do engine deprecated (ADR-0007 violado nos dois sentidos) (impacto medio)

- **Lado A:** ADR-0007: DSL = significado portável; Config = só 'feel' ('muda o significado → DSL; muda só o feel → config'). README l.310: peso 1 = 'immovable'; fracX = pesoY/(pesoX+pesoY).
- **Lado B:** (a) live.engine: v2, que vive na config, redefine os pesos de nodeLayers da DSL: invMass = max(0.05, 1−peso), 'peso 1 fica pesado, não imóvel'. Para os pesos (0.5, 0), a divisão deixa de ser 0/1 e passa a 1/3 contra 2/3. (b) A DSL aceita options.routing.{fission, fusion, snap, central.k, physics.aStarMidLoop...}, knobs de baixo nível que só o engine deprecated consome.
- **Evidência:** - compile-world.js l.11-12, l.35 e l.92.
- src/physics/collision.js l.4-7: 'Não há mais frac/computeSplit — a razão de cedência É a razão de massas'.
- src/dsl/attr-set.js l.6-47: OPTION_KEYS inclui 'routing' com esses subkeys.
- grep 'meta.routing': consumido só em src/routing/physics/.

#### O Manifest contradiz os próprios testes de contrato (drag 'vira pin') (impacto medio)

- **Lado A:** F-0009 (user_value, A1, Comportamento e Limites) e README l.369-370 dizem: 'no release, o nó solto vira pin onde caiu'; 'Apenas o último nó solto fica fixo'. O comentário de pins.js l.4-6 diz o mesmo.
- **Lado B:** O código e os testes listados como contrato do próprio F-0009 garantem o contrário: nada fica pinado no release. O help da UI também não fala em pin.
- **Evidência:** - tests/layout/adapters/live.test.js l.430: 'on release, the dropped body re-enters the sim (no drop-point pin)'.
- l.479: 'nothing stays pinned'.
- live/index.js l.31-34: 'nothing stays pinned at the drop point'.
- config-schema.js l.34-36.
- O Manifest foi gerado por 'EARS acceptance derived from E2E/unit test assertions' (commit 89a85d6).

#### Três posições incompatíveis sobre 'default' do engine (impacto medio)

- **Lado A:** A atualização do ADR-0009 diz 'Não há default privilegiado por design'; o algébrico seria 'fallback pragmático transitório'. O corpo do mesmo ADR-0009 diz 'há intenção de tornar o solver físico o padrão'.
- **Lado B:** O STATE (apagado) registrava 'Decisão pendente: flipar o default de layout para v2' e 'NÃO flipar agora' (113ef70). O código tem defaults fixos. F-0003, F-0017 A4 e README l.334 afirmam 'o default permanece o roteador algébrico'. O registry anuncia 'dagre / elk land here in future phases', planners determinísticos que o ADR-0012 rejeita como modelo ('viola o requisito de tendências').
- **Evidência:** - .feat-memory/decisions/0009 (cabeçalho contra 'Direção conhecida').
- src/store.js l.32-33.
- src/app/pipeline.js l.187: engine || 'algebraic'.
- src/layout/registry.js l.9-11.
- F-0017 A4.

#### O ADR de identidade está amarrado a uma feature marcada para morrer; o que ele decide não tem feature (impacto medio)

- **Lado A:** O ADR-0012 é a decisão identitária do projeto.
- **Lado B:** O único vínculo do ADR-0012 no Manifest é o F-0017 (deprecated, a ser removido). Não existe F-NNNN para o motor unificado, para o layout v2 nem para a Fase 4. O UNRELEASED, que pela regra ADR-0043 define o conjunto ativo, só cita ADRs e nenhuma feature.
- **Evidência:** - decisions/INDEX.md: ADR-0012 → F-0017.
- manifest/INDEX.md: 19 features, nenhuma para src/physics ou compile-world.
- changelog/UNRELEASED.md: '- Foco herdado do STATE: ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013'.

#### Decisões 'provadas em sandbox' contra a decisão central tomada por decreto e sem critério de saída; depois disso, 96 dias parado (impacto alto)

- **Lado A:** ADR-0010 e ADR-0011 foram decididos por medição ('provado em sandbox', 'medido'). O playground I2 se apresenta como 'O teste que consagra ou mata a unificação'.
- **Lado B:** O ADR-0012 inverteu por requisito do mantenedor a recomendação do architecture-critic ('rotear por A*'). Os riscos apontados (custo do narrow-phase, fissão/fusão) viraram 'desafios de engenharia' sem limiar. O I2 mede ms/tick e cruzamentos, mas não define aprovação. O título promete '~centenas' enquanto o slider vai até 120 e o texto fala em 'dezenas a ~centena'. Nenhum commit de engine desde 2026-06-06; último commit em 2026-06-26.
- **Evidência:** - ADR-0012, Contexto.
- playground I2 (l.775-776): params nodes max 120, sem thresholds.
- git log: 3b8692e (06-06) é o último commit com código de engine; 5bb9b8d (06-26) é o último commit, 96 dias antes de 2026-09-30.

#### Arquitetura de plugins ortogonais (ADR-0013) contra a tese de unificação e contra a implementação por flags (impacto medio)

- **Lado A:** ADR-0013: 'Layout e routing são ortogonais: qualquer combinação layout×router funciona'; 'Solvers físicos... são plugins dentro desta arquitetura, não exceções a ela'.
- **Lado B:** A tese do v2 (playground I1) exige acoplamento: 'Sem reciprocidade = routing como pós-processo (v1); com = unificação de verdade'. Na prática nenhum solver físico é plugin registrado: o routing físico é um if em pipeline.js e o v2 é uma flag dentro do adapter live. Já existe um gancho de acoplamento não documentado (caps.providesRouting, session.routedEdges), o que tornaria o seletor de router irrelevante.
- **Evidência:** - src/routing/registry.js: só straight, orthogonal e curved.
- src/app/pipeline.js l.179 (session.routedEdges || router.route) e l.187-207 (branch engine).
- live/index.js l.50.
- layout/registry.js l.14-16: providesRouting: false.

#### Governança auditada como 'limpa' convive com deriva semântica ampla e com uma constituição que aponta para caminhos inexistentes (impacto medio)

- **Lado A:** Os commits 89a85d6 e 113ef70 dizem 'Audit clean: schema 1.00, coverage 100%, 0 drift'. O ADR-0001 justifica a metodologia porque 'o porquê vivia só na cabeça do mantenedor'.
- **Lado B:** Há pelo menos 9 derivas semânticas verificadas nesta análise (itens acima). O frontmatter do AGENTS.md aponta para ./.agent-memory/{manifest/INDEX.md, STATE.md} e agent-memory v0.13.0, que não existem. O .meta.yaml diz 'Schema documentado em ADR-0013', que é um ADR do feat-memory, não o ADR-0013 do projeto. O plano que rege a Fase 4 ('plano de rearquitetura', 'D-massa/D-PI', 'princípios #1–#7') não está no repositório.
- **Evidência:** - AGENTS.md l.24-27 contra o bloco feat-memory 2.1.0 (l.107+).
- .feat-memory/.meta.yaml.
- compile-world.js l.19-21 (cita um plano ausente).
- Commit bab6b3f: 'Applies brainstorm principles #1...#7'.

#### A migração de metodologia destruiu o único registro do roadmap (impacto medio)

- **Lado A:** ADR-0001: 'Agentes retomam trabalho lendo STATE.md + Manifest'. AGENTS.md: a retomada começa pelo UNRELEASED.
- **Lado B:** O commit 5bb9b8d apagou STATE.md e o checkpoint. O 'Next' (Fase 4 com arestas-cápsula, remover src/routing/physics, decidir a virada do default para v2) e o 'Decisão registrada: NÃO flipar' sumiram. O UNRELEASED ficou com uma linha sem conteúdo acionável. O roadmap do README ('editor estruturado para a DSL', 'mais presets de ponta') é outro e não recebeu nenhum trabalho.
- **Evidência:** - git show 5bb9b8d --stat: STATE.md -29 e checkpoint -20.
- git show 5bb9b8d^:.feat-memory/STATE.md.
- README l.387-389.

#### O gate de 'suíte completa' é reportado com a contagem só do unit, e a identidade (live) fica fora dos invariantes (impacto medio)

- **Lado A:** AGENTS.md C1: 'suíte completa verde (unit + E2E nos 2 projetos)'. Os invariantes geométricos são o critério objetivo de qualidade (e2e/13).
- **Lado B:** Os commits das Fases 1-3 relatam 'Full suite 794/794', '796/796' e '797/797', que é a contagem do unit (o E2E tem 240 specs). O E2E não cobre o v2. O spec de invariantes exclui o layout live de propósito: 'live depends on simulation convergence... skipped'.
- **Evidência:** - Mensagens dos commits 992e5ca, 2a8c80d e 3b8692e.
- README l.385: '233 specs ativos + 7 skip (240)'.
- e2e/13-geometry-invariants.spec.js l.16-27: LAYOUTS = ['custom', 'off'].

#### Superfície da DSL aceita e não entregue: shape, snapAngles e anchors (impacto baixo)

- **Lado A:** A DSL aceita (sem warning) node shape: circle|diamond|polygon|star, snapAngles e anchors. O README lista src/shapes/{rect,circle,diamond,polygon,star}.
- **Lado B:** O renderer sempre desenha retângulo arredondado. src/shapes só é usado pelo snap-resolver do routing deprecated. snapAngles e anchors são gravados no IR e nunca lidos. Nenhuma feature do Manifest cobre shapes (e o audit diz 'cobertura 100%').
- **Evidência:** - src/dsl/attr-set.js l.60-64.
- src/renderer/nodes.js l.51-53: sempre createSvgEl('rect') com rx=6.
- grep: src/shapes é importado apenas em src/routing/snap-resolver.js.
- src/dsl/ir.js l.278-279 (sem outros consumidores).

#### LOD configurável (README/ADR-0007) contra LOD fixo (F-0008/código) (impacto baixo)

- **Lado A:** O README l.293 e o ADR-0007 listam 'thresholds de LOD' entre os knobs da Config.
- **Lado B:** O F-0008 declara os limiares 'fixos no renderer, não configuráveis'. O código usa constantes, e o schema da Config não tem LOD.
- **Evidência:** - src/renderer/index.js l.8-10: LOD_HIDE_LABELS_BELOW = 0.4 e LOD_SIMPLE_BELOW = 0.18.
- F-0008 l.48.
- controls/config-schema.js: sem entrada de LOD.

#### Comentário e código divergem dentro do mesmo arquivo sobre aresta empurrar nó (impacto baixo)

- **Lado A:** O cabeçalho de collision-waypoints.js (l.14-16) diz 'Node repel... impulso em velocidade, com contra-push no nó'. O playground I1 diz que o v1 é 'routing passivo'.
- **Lado B:** O laço real diz 'APENAS o waypoint se move — nós são intocáveis pelo roteamento'. Já o B2 (label de aresta contra nó) empurra o NÓ por padrão (collision.labels = true). Ou seja, nem 'arestas nunca exercem força' (README l.191) é integralmente verdade no v1.
- **Evidência:** - src/layout/adapters/live/collision-waypoints.js l.14-16 contra l.195-197 e l.252-256 ('we push the NODE away').
- config-schema.js l.45: labels default true.

## Apêndice C · Advogado do valor

O valor do Tensegrams está em ser um laboratório de pesquisa. Como mais um diagrams-as-code ele vale pouco, e é na pesquisa que o caso fica forte. Ele ocupa uma interseção que a literatura e o mercado deixaram vazia: DSL textual → mundo físico unificado e contínuo, no navegador e sem dependências. Nesse mundo, nós são corpos que só se repelem, toda atração vem de atratores ou de acoplamentos declarados (ADR-0010), e, na Fase 4, as arestas passam a ser cadeias de corpos que empurram os nós de volta (reciprocidade). Cada vizinho resolve só uma fatia do problema:
- Dunnart/libavoid e o topology-preserving layout (Dwyer/Marriott/Wybrow) usam restrições duras, não tendências. O Dunnart é um protótipo desktop em Qt, marcado como "alpha".
- WebCoLa usa otimização por restrições, com o roteamento como passo posterior.
- vis-network tem física ao vivo, mas usa um único "support node" por aresta, sem contornar obstáculos nem ter semântica de contêiner.
- FDEB (Holten) e Finkel–Tamassia modelam arestas como pontos com molas, mas não num editor vivo com layout recíproco.
- PrEd/ImPrEd repelem nó×aresta como pós-processamento.

A aposta do ADR-0012 é que o não-cruzamento e o contorno de obstáculos podem ser TENDÊNCIAS contínuas em vez de garantias combinatórias. É uma hipótese falsificável, com baselines claros para comparar, e não encontrei quem a tenha testado nesse formato. É o que dá ao projeto uma pergunta de pesquisa própria.

O valor já demonstrável hoje, com evidência:
1. **Instrumento experimental de verdade.** São 27 cenários reproduzíveis com métricas; 12 estão "decididos", 7 "decisivos" e 8 "abertos". Os ADRs citam medições e resultados negativos.
2. **Mapa mental mais estável que o de um layout em camadas.** Medi isso: ao adicionar um nó, o warm-restart deslocou mais de 50 px 0–20% dos nós pré-existentes, contra 28–39% no dagre.
3. **Agenda de perguntas baratas de responder:** solver único (I1/I2), PI vs XPBD no contato, tensegridade formal (cabos só-tração e escoras só-compressão) e ganho de "vivo + manipulação direta" em compreensão (Tversky et al.).

Como produto, o valor é secundário e hoje frágil. Não há export SVG/PNG. O layout v1 ignora as arestas e o v2 não tem warm-restart. Ainda assim, há um diferencial que nenhum concorrente verificado oferece: semântica física declarável na DSL (nodeLayers com peso→massa, attractTo/repelFrom, pin, constraint) com layout contínuo e estável sob edição.

Condição honesta para o caso se sustentar: o valor de pesquisa só se realiza se a Fase 4 for medida contra esses baselines (contagem de cruzamentos, deslocamento, ms/tick). Sem essa medição, o projeto continua sendo uma intuição bem instrumentada.

- **Nicho de pesquisa real: o projeto une 4 linhas da literatura que existem separadas (layout por força/restrição, roteamento de conectores, arestas como partículas, desenho dinâmico/mapa mental) num único simulador contínuo alimentado por DSL. Não encontrei sistema que faça as quatro coisas por tendências de força num editor vivo.** (alta) — Vizinhos verificados em páginas abertas:
- Dunnart (github.com/mjwybrow/dunnart): 'continuous network layout' + 'object-avoiding poly-line connector routing' via libavoid/libcola, mas é 'alpha software', em Qt/desktop e usa restrições duras.
- libavoid (adaptagrams.org): C++; não encontrei menção de port JS/WASM na página.
- WebCoLa (ialab.it.monash.edu/webcola): 'constraint-based optimization', roteamento opcional, bom abaixo de ~100 nós.
- vis-network (docs edges.html): 'dynamic' = 'an invisible support node guiding the shape. This node is part of the physics simulation', ou seja, 1 ponto por aresta, sem contorno de obstáculo.
- FDEB (github.com/vasturiano/d3.ForceBundle): arestas subdivididas em pontos com molas, só para bundling, com os nós fixos.
- Finkel–Tamassia (survey Kobourov, ar5iv 1201.3011, seç. 9): dummy vertices como pontos de controle de Bézier.
- PrEd/ImPrEd (mesmo survey, texto extraído das linhas 515–523): 'adds a repulsive force between (node, edge) pairs' como pós-processamento.

No repo: ADR-0012:24-32 (cadeia de corners, cápsulas, anti-cruzamento por repulsão, 'Não-cruzamento é tendência').

NÃO VERIFICADO por página aberta: o artigo 'Topology Preserving Constrained Graph Layout' (bridges.monash deu 503; academia e core deram 403). Só vi o resumo da busca ('connectors ... act like impervious rubber-bands', tempo real até ~100 nós). É o vizinho mais próximo da Fase 4 e deve virar o baseline.
- **A tese do 'solver único' é uma pergunta de pesquisa explícita e falsificável: nós e arestas no mesmo mundo, com reciprocidade aresta→nó, em vez do pipeline clássico layout→roteamento. E o motor já foi desenhado para ela (formas cápsula/ponto, DOF de trilho, free-list para fissão/fusão de corpos).** (alta) — - playground/physics-playground.html:740 (I1): 'A aposta central do engine v2: nós e arestas no MESMO mundo físico ... Sem reciprocidade = routing como pós-processo (v1); com = unificação de verdade'.
- playground:775 (I2): 'O teste que consagra ou mata a unificação'.
- src/physics/collision.js:4-8: 'O "edge empurra nó" (#4) é só uma colisão normal entre um corpo-segmento e um corpo-nó'.
- src/physics/world.js:13-14 (free-list/geração para fissão/fusão) e :27-33 (SHAPE RECT/POINT/CAPSULE; DOF FREE2/RAIL1/FIXED0).
- src/physics/solver.js:1-12 (schedule com contributors/topology/constraints: 'layout e routing apenas montam schedules diferentes sobre o MESMO World').
- Os concorrentes de produto separam as fases: ELK integra o libavoid para roteamento como etapa própria (eclipse.dev/elk/reference/algorithms.html); D2/Mermaid usam dagre/ELK (d2lang.com/tour/layouts, mermaid.js.org/config/layouts.html).
- **O projeto já funciona como instrumento experimental rigoroso: sandbox com cenários reproduzíveis, métricas e status de decisão; ADRs que registram alternativas rejeitadas POR MEDIÇÃO, inclusive resultados negativos. Construí-lo já gerou conhecimento: atração todos-com-todos degenera, penalidade é ruim para restrições, fissão/fusão dinâmica explode em cascata, perfil linear é mais estável que 1/d.** (alta) — - `grep -c 'SCN.push' playground/physics-playground.html` = 27 cenários. O dossiê diz 24; o arquivo tem 27.
- META em playground:827-835: 12 'decidido', 7 'decisivo', 8 'aberto'.
- PRNG com seed (mulberry32) em playground:146; sparklines e aba 'Conclusão' com veredito persistido (playground:991, 1099).
- ADR-0010:35 ('Atração corpo-corpo todos-com-todos: degenerada (provado em sandbox)').
- ADR-0011:39-44 (constante → chatter medido; barreira 1/d explode sem sub-stepping).
- playground:348 (B1: 'penalidade ... foi DESCARTADA para constraints — instável se rígida, resíduo se mole').
- playground:638 (G3: fissão/fusão dinâmica 'é o mecanismo que no engine v1 explodiu em cascata de shelves').
- ADR-0012:14-20 registra uma revisão adversarial (architecture-critic) e a decisão consciente do mantenedor.
- **O layout contínuo com warm-restart preserva o mapa mental sob edição da DSL bem melhor que um layout em camadas recalculado do zero, que é o modelo de Mermaid e D2. O problema é central no desenho de grafos dinâmicos (legibilidade × mapa mental), e aqui foi MEDIDO.** (media) — Código:
- src/app/pipeline.js:116-150 (snapshot das posições vira seedPositions da nova sessão).
- src/layout/adapters/live/index.js:143-152 (warm restart com alpha limitado ao kick, 'readjusts smoothly instead of re-exploding').

Spike meu (mentalmap/mm-fair.out): +1 nó/+1 aresta, centróide alinhado, fração de nós pré-existentes deslocados >50px:

| n | live-warm | dagre (40 edições) |
|---|---|---|
| 12 | 0,08 | 0,33 |
| 20 | 0,20 | 0,39 |
| 30 | 0,00 | 0,28 |

- Em >20px o resultado é misto (n=20: 0,65 no live vs 0,62 no dagre).
- mm-dist.out: no dagre, 47–60% das edições movem mais da metade dos nós >5px; o p90 do deslocamento médio fica entre 116 e 324 px.
- mm.out: warm tem deslocamento médio/máx de 9–26 / 22–66 px; cold, 49–92 / 154–205 px.

Caveats honestos:
- O v1 ignora as arestas (live/index.js:125-127, 'Edges exert NO force'). Por isso o resultado do live é idêntico para todas as seeds do mesmo n: na prática é uma amostra só por tamanho.
- O v2 (compile-world.js) não implementa seedPositions (grep vazio).

Fundamento: survey Kobourov (ar5iv 1201.3011, seç. 10), 'readability of the individual layouts' × 'mental map preservation ... often contradictory'.
- **'Tensegridade' pode deixar de ser metáfora e virar modelo formal, com lastro na teoria de rigidez. O motor já separa compressão de tração: corpos só se repelem (escoras) e a atração vem de atratores e arestas (cabos). Tornar as arestas cabos SÓ-TRAÇÃO e a colisão escora SÓ-COMPRESSÃO abre perguntas novas: diagramas 'rígidos por tensegridade' respiram e voltam ao lugar após um arrasto?** (media) — - A colisão já é só-compressão: src/physics/collision.js:68 (separados → sem força).
- A mola de conectividade ainda NÃO é cabo: src/physics/contributors/connectivity-spring.js:27 (f = k·(d−rest), que empurra quando d<rest).
- A palavra 'tensegridade' aparece uma única vez no repo (ADR-0012:20; grep -rni tensegr). O conceito é identidade declarada, mas está subarticulado.

Teoria, em páginas abertas:
- Jordán, Recski e Szabadka (egres.elte.hu/www/tr-07-08.html): 'Tensegrity frameworks ... consist of bars, cables, and struts, which provide upper and/or lower bounds for the distance'. Um grafo é tensegridade rígida só com cabos e escoras sse for redundantemente rígido.
- Pietroni et al., SIGGRAPH Asia 2017 (opus.lib.uts.edu.au/handle/10453/127807): 'struts and cables, held rigid by continuous tension'. Usa otimização baseada em posição, a mesma família do XPBD comparado no cenário B1 (playground:347-348).
- **O contato com controlador PI (termo integral) é uma ideia pouco usual e gera uma pergunta de pesquisa legítima. O spike mostrou que ela ainda NÃO está resolvida, o que é valor de pesquisa, não defeito escondido. Motores de jogo usam correção proporcional (Baumgarte).** (media) — - src/physics/collision.js:9-12 afirma que o integral 'zera o overlap residual'.

Meu spike (spike/pi-2body-b.out), 2 corpos sob atrator central constante, alvo de gap 24 px:
- Só P assenta em 21,96 px (erro de regime de 2 px, como o ADR-0011 prevê).
- PI (Ki .04) entra em ciclo-limite entre 20,48 e 24,98 px com 1 substep, e entre 21,98 e 24 com 4 substeps.
- Hipótese: o anti-windup que zera o acumulador na separação (collision.js:68) causa 'hunting'.

Com N corpos e carga sustentada (spike/pi-vs-p2.out, N=30), o PI termina com mais overlap visual (22,17 contra 9,36 px) e KE alta (1,7e3 contra 8e-10).

Contexto:
- O cenário C3 já está marcado 'aberto' (playground:830).
- Inconsistência de governança: o ADR-0011:31-35 diz que o 'termo integral ... fica fora do default', mas o compile-world.js:41-42 tem collisionKi: 0.04 no default do v2.
- Baumgarte: 'the position error is fed back into the velocity constraint' (nova-physics.readthedocs.io).
- **A viabilidade de tempo real da Fase 4 é mensurável e barata de decidir (o go/no-go do I2). Os números preliminares indicam 'apertado mas plausível' na escala-alvo, e há gargalos identificáveis. Isso torna a aposta de pesquisa tratável.** (media) — Spike/scale2.out (motor real src/physics, corners inicializados ao longo da aresta, 2 substeps, Node/V8):
- 50 nós + 75 arestas × 6 corners (500 corpos): 5,1 ms/tick.
- 100 nós + 150 arestas × 6 (1000 corpos): 13,4 ms/tick.
- 100 nós × 10 corners (1600 corpos): 19,7 ms/tick.
- 2000 corpos: 41 ms/tick.

Gargalo provável: a grade uniforme usa cellSize = 2·(maxHalf+pad) (src/physics/spatial-grid.js:35). Com nós de 120 px e corners de 6 px, os corners se amontoam na mesma célula. A saída conhecida é grade hierárquica ou por escala, ou pular pares da mesma cadeia.

Só nós (spike/pi-vs-p.out, compressão forte): 0,24 ms/tick com 100 corpos e 2,9 ms com 400.

Comparação: o WebCoLa declara bom desempenho abaixo de ~100 nós (ialab.it.monash.edu/webcola). Não medi no navegador.
- **Há um ângulo de pesquisa em IHC que o projeto está bem posicionado para testar: a literatura diz que as vantagens atribuídas à animação costumam vir da INTERATIVIDADE. O Tensegrams é interatividade-primeiro (arrasto frozen/flow, pin ao soltar, reajuste suave). Dá para desenhar um estudo 'estático × animado × animado+manipulação direta' com o mesmo diagrama.** (media) — - Tversky, Morrison e Betrancourt 2002, IJHCS (PDF aberto em hci.stanford.edu, texto extraído): 'In cases where animated graphics seem superior to static ones, scrutiny reveals lack of equivalence ... the animated graphics convey more information or involve interactivity' e 'Judicious use of interactivity may overcome both these disadvantages'.
- Manifest F-0009 (acceptance A1–A5: drag, pin no release, modo flow).
- src/layout/adapters/live/index.js:143-152 (reajuste suave sob edição).
- Não há estudo com usuários no repo (não verifiquei nenhum): é oportunidade, não resultado.
- **A qualidade de engenharia faz dele um artefato de pesquisa reprodutível e aberto: sem dependência de física, sem bundler, deploy público funcionando, suíte grande. Qualquer revisor abre uma URL e reproduz; um fork é trivial.** (media) — - package.json:22-24 (única dependência: yaml); node_modules/yaml/browser = 504K (du).
- Deploy: `curl https://brunoleos.github.io/tensegrams/` → 200; `src/version.js` = '5bb9b8d' = `git rev-parse --short HEAD`.
- Rodei `node --test --test-concurrency=1 tests/routing/physics/*.test.js tests/physics/*.test.js tests/layout/compile-world.test.js` → 204 testes, 204 pass, 0 fail (estrategia/tests-physics.out).
- O dossiê reporta 797/797 no unit.
- O ADR-0006 mantém o runtime mínimo.
- O routing físico anterior (F-0017, deprecated) já provou o conceito de aresta-como-corpos com fissão/fusão e anti-cruzamento, coberto por 19 arquivos de teste (ls tests/routing/physics | wc -l).
- **Como produto (secundário), o diferencial é semântica FÍSICA declarável na DSL somada a layout contínuo e estável sob edição. Nenhum concorrente verificado expõe colisão por camadas com peso, atração/repulsão por tag e restrições de movimento como vocabulário do diagrama.** (baixa) — - README.md (tabela 'Atributos de nó': nodeLayers lista/mapa com peso, attractTo/repelFrom, pin, constraint axis/rect/circle/parent-bounds; arestas com nodeLayers/edgeLayers para desvio e bundling).
- compile-world.js:88 (peso de colisão → massa: invMass = max(EPS, 1 − maxWeight)).
- Concorrentes, em páginas abertas:
  - D2: dagre/ELK/TALA; 'animação' = SVG animado de composição de boards (d2lang.com/tour/composition).
  - Mermaid: dagre/ELK/cose-bilkent/tidy-tree, sem animação documentada (mermaid.js.org/config/layouts.html).
  - PlantUML: Graphviz dot ou Smetana.
  - Graphviz: motores batch (dot, neato, fdp, sfdp…).
  - draw.io: layouts aplicados sob demanda.
  - Excalidraw/tldraw: canvas manual, sem auto-layout ou física documentados.
  - LikeC4/Structurizr: 'live' = preview que atualiza, não física.

Fragilidades reais:
- Sem export SVG/PNG (grep por export de svg em src/ não achou nada; só import/export de YAML, F-0015).
- v1 ignora arestas.
- Sem ecossistema nem release tagueado.
- **Existe uma agenda de pesquisa concreta, ancorada nos cenários 'decisivo'/'aberto' do próprio sandbox, com métricas já instrumentadas. Construir o projeto responde perguntas que produtos comerciais não têm incentivo para investigar.** (media) — - RQ1: o solver único com reciprocidade reduz cruzamentos e deslocamento em relação ao layout→roteamento em 2 fases, a ~100 nós em tempo real? (I1/I2 'decisivo', playground:740/775; métricas de cruzamentos já existem: countChainCrossings, playground:633/771.)
- RQ2: não-cruzamento como tendência gera quantos cruzamentos residuais em função da rigidez, comparado a libavoid/PrEd? (G2 'decisivo', playground:605-606.)
- RQ3: ortogonalidade é restrição discreta; dobra, snap ou híbrido? (G4 'decisivo', playground:668.)
- RQ4: contato P × PI × XPBD sob carga (C3 'aberto', B1 'decisivo'; ciclo-limite do PI no meu spike).
- RQ5: contêiner como campo (região atratora + SDF) × geometria derivada (F5 'decisivo', playground:543; o compile-world usa hoje a derivada, 'a costura frágil').
- RQ6: tensegridade formal (cabos só-tração) melhora estabilidade e retorno após arrasto?
- RQ7: 'vivo + manipulação direta' melhora compreensão (Tversky)?
- Os atratores path/region do ADR-0010 ainda não existem em src/physics (grep region/attractor vazio); só no playground (F2/F3).

| Sistema | Entrada | Layout | Roteamento de arestas | Movimento contínuo ("vivo") | Arestas como corpos físicos | Física declarável na DSL | Entrega | Fonte |
|---|---|---|---|---|---|---|---|---|
| **Tensegrams (hoje)** | DSL YAML + config YAML | atrator central + colisão PI por camadas + forças por tag (v1; v2 atrás de flag); mola de conectividade opt-in | algébrico straight/orthogonal/curved + obstacle-aware; físico anterior (deprecated) com fissão/fusão | Sim (live, warm-restart sob edição, drag frozen/flow) | Só no routing físico deprecated (F-0017) | **Sim**: nodeLayers com peso→massa, attractTo/repelFrom, pin, constraint, edgeLayers | ESM no navegador, dep. única `yaml`, GitHub Pages | repo (README, ADR-0010..0013, src/physics) |
| **Tensegrams (Fase 4, planejada)** | idem | mundo único nós+arestas, reciprocidade aresta→nó | cadeia de corners 2-DOF, cápsulas, anti-cruzamento por repulsão | Sim | **Sim, com reciprocidade** | idem | idem | ADR-0012; playground I1/I2 |
| Mermaid | DSL textual | dagre, ELK (bundled), cose-bilkent (força), tidy-tree | do motor de layout | Não documentado | Não | Não | JS no navegador | mermaid.js.org/config/layouts.html |
| D2 | DSL textual | dagre (default), ELK, TALA (proprietário do time D2) | do motor | "SVG animado" = sequência de boards (composição) | Não | Não (TALA: travar posição) | CLI Go / web | d2lang.com/tour/layouts, /tour/composition |
| PlantUML | DSL textual | Graphviz dot ou Smetana (port Java) | do dot | Não | Não | Não | Java | plantuml.com/graphviz-dot |
| Structurizr | DSL de modelo (C4) | múltiplas views de 1 modelo (motor não verificado) | não verificado | Não | Não | Não | Java/web | docs.structurizr.com |
| LikeC4 | DSL de modelo | não verificado | não verificado | preview que atualiza ao editar (não é física) | Não | Não | TS/CLI/VSCode | notes.dsebastien.net (LikeC4) |
| Graphviz | DOT | dot, neato (mola), fdp, sfdp, circo, twopi… (batch) | splines do motor | Não | Não | Parcial (atributos de motor) | C, batch | graphviz.org/docs/layouts |
| ELK | grafo (API) | layered, force, stress, radial… | integra libavoid como etapa | Não | Não | Não (opções de algoritmo) | Java (elkjs não verificado) | eclipse.dev/elk/reference/algorithms.html |
| Excalidraw | canvas manual | manual (auto-layout não documentado no README) | manual | Não | Não | Não | web/npm | github.com/excalidraw/excalidraw |
| tldraw | SDK de canvas | alinhar/distribuir | bindings (não verificado) | Não | Não | Não | React SDK | tldraw.dev |
| draw.io | GUI | layouts aplicados sob demanda (árvore, orgânico, circular, flow) | GUI | Não verificado (parece ser aplicação única) | Não | Não | web/desktop | drawio.com/doc/faq/apply-layouts |
| vis-network | API JS | física ao vivo (barnesHut, forceAtlas2, repulsion…) | smooth "dynamic": **1 support node invisível na física** | Sim | Parcial (1 ponto por aresta, sem contorno/ortogonal) | Não (API) | JS | visjs.github.io/vis-network/docs/network/physics.html, edges.html |
| d3-force | API JS | integrador Verlet de partículas, colisão | não | Sim | Não | Não | JS | github.com/d3/d3-force |
| WebCoLa (pesquisa→lib) | API JS | otimização por restrições (overlap, grupos, flow) | opcional, evita nós | Sim (interativo, estável) | Não (roteamento é passo posterior) | Via API de restrições | JS | ialab.it.monash.edu/webcola |
| Dunnart + libavoid/libcola (pesquisa) | GUI | layout contínuo por restrições | poly-line/ortogonal, evita objetos, incremental | Sim | Conectores como "rubber bands" (artigo 2008: **não verificado por página aberta**) | Não (GUI) | C++/Qt, "alpha" | github.com/mjwybrow/dunnart; adaptagrams.org/documentation/libavoid.html |
| FDEB (Holten & van Wijk) | grafo | nós fixos | pontos de subdivisão + molas + atração entre arestas compatíveis (bundling) | Iterativo, não é editor | Sim (só para bundling) | Não | algoritmo | github.com/vasturiano/d3.ForceBundle |
| PrEd / ImPrEd | desenho existente | Fruchterman-Reingold + repulsão nó×aresta | preserva cruzamentos | Pós-processo | Não | Não | algoritmo | survey Kobourov (ar5iv 1201.3011) |
| Penrose (CMU) | notação matemática + estilo | otimização → galeria de candidatos | do estilo | Não | Não | Estilo declarativo (não é física) | web | cmu.edu news 2020 |

**Como ler a tabela.** Nenhuma linha verificada combina ao mesmo tempo DSL textual, movimento contínuo, arestas como corpos com reciprocidade e semântica física declarável. Esse é o nicho do Tensegrams, mas hoje ele só é ocupado por inteiro no plano (Fase 4). Os vizinhos de pesquisa mais próximos são Dunnart/topology-preserving (restrições duras) e vis-network "dynamic" (1 ponto por aresta). São esses os baselines contra os quais a Fase 4 deve ser medida.

## Apêndice D · Cético do valor

Como pesquisa, o Tensegrams hoje não produz conhecimento verificável nem demonstra novidade. A ideia central (layout "vivo" com restrições, arestas como corpos movidos por força, anti-cruzamento por repulsão) já existe na literatura e em ferramentas de 2008 a 2021: Dunnart e o layout restrito que preserva topologia (conectores como "elásticos"), FDEB (arestas como molas subdivididas), WebCoLa, arestas dinâmicas do vis-network, InteractiveOrganicLayout do yFiles e fCoSE. O repo não cita nenhuma dessas referências, não declara hipóteses, não guarda resultados de experimento e não se compara com nenhum baseline.

Medi o que existe:
- **O layout ignora as arestas.** Nos três modos default (custom, live v1, live v2), trocar 10 arestas por 2 arestas diferentes desloca os nós 0,000000 px (exp1.out).
- **Cruzamentos muito acima dos baselines.** Com 120 nós: 2.547 cruzamentos no live v1, contra 122 no WebCoLa e 267 no ELK layered (exp3.out). Segundo Purchase (1997), cruzamentos são a estética que mais afeta a compreensão.
- **A saída depende do histórico de edição.** O mesmo texto YAML, depois de editar e desfazer, gera um layout até 64,6 px diferente (exp1.out). No cold start, acrescentar 1 nó move 13 a 24 dos 30 nós; no ELK, 0 de 30 (exp5.out).
- **O motor v2 nunca para.** O evento 'end' nunca dispara, então o loop de animação roda para sempre (exp1c.out).
- **A física está fora da experiência padrão.** O default da UI é estático e algébrico (store.js:32-33).

Como produto, faz menos que Mermaid, D2, Graphviz, ELK e Ilograph. É 3 a 4 vezes mais verboso que D2 e Mermaid. Não tem CLI, nem exportação de SVG ou PNG, nem embed, nem posições versionáveis. Não respeita reduced-motion. A física é desvantagem justamente onde diagrams-as-code mais precisa: reprodutibilidade, estabilidade, diffs e acessibilidade.

O custo de oportunidade é alto. Metade do código físico já escrito (1.952 linhas, mais 2.951 de teste) está deprecated. A Fase 4 nem tem plano no repo. Não houve commits em 3 meses.

O que sobra de potencialmente original é estreito: pesos assimétricos de colisão declarados na DSL ("quem cede") e aresta-cadeia interativa junto com camadas de colisão. Isso só vira pesquisa com hipóteses pré-registradas, medidas contra WebCoLa, d3-force e ELK (e, idealmente, ImPrEd e Dunnart).

Não verifiquei:
- o E2E nem o comportamento visual no navegador (rAF): inferi do código e de ticks headless;
- a compreensão humana;
- a representatividade dos grafos, que são aleatórios; os parâmetros de d3-force e WebCoLa são meus, sem tuning;
- a página do ImPrEd (403), por isso não a uso como fonte.

- **PESQUISA: não há novidade demonstrada, é reinvenção de técnicas estabelecidas, e o repo não conhece essa literatura. A ideia mais próxima da Fase 4 (arestas como corpos, conectores que 'encolhem' contornando obstáculos, layout contínuo durante a edição, com não-sobreposição e contenção) existe desde 2008. Arestas como cadeias de partículas com molas existem desde 2009. Layout vivo com restrições de grupo, alinhamento e não-overlap também já existe.** (alta) — Prior art aberto:
- Dunnart: tem 'constraint-based geometric placement tools (alignment, distribution, separation, non-overlap, and page containment), automatic object-avoiding poly-line connector routing, and continuous network layout' (github.com/mjwybrow/dunnart).
- Dwyer, Marriott e Wybrow 2008, algoritmo de layout restrito que preserva topologia usado no Dunnart (eceasst.org/.../1475).
- FDEB: 'edges are modeled as flexible springs that can attract each other' (research.tue.nl, Holten e van Wijk 2009).
- vis-network: 'When using dynamic, the edges will have an invisible support node guiding the shape. This node is part of the physics simulation' (visjs.github.io/.../edges.html).
- WebCoLa: alinhamento, agrupamento e não-overlap, 'much more stable in interactive applications (no jitter)', com roteamento opcional de arestas (ialab.it.monash.edu/webcola).
- yFiles InteractiveOrganicLayout: layout atualizado continuamente enquanto o usuário arrasta (docs.yworks.com).
- fCoSE 2.0 (2021): restrições incrementais 'while maintaining the user's mental map'.

No repo, grep por webcola, cola, elkjs, dagre, d3-force, fruchterman, kamada, dunnart, imPrEd e holten encontra só src/layout/registry.js:10 ('dagre / elk land here in future phases'), src/layout/adapter.js:4 e playground/physics-playground.html:638 ('estilo Holten'). Não há seção de trabalhos relacionados.
- **PESQUISA: o experimento não está estruturado para gerar conhecimento verificável. Não há hipóteses, métricas de sucesso registradas, baselines nem resultados persistidos. As decisões centrais são fixadas por requisito do mantenedor, e o critério de sucesso (não-cruzamento como 'tendência') é infalsificável.** (alta) — - grep por 'hipótese|hypothes|benchmark|baseline' em .feat-memory e src: nenhuma hipótese. O único 'baseline' está em ADR-0009:63, onde o algébrico é chamado de 'baseline determinístico'.
- ADR-0010:35 afirma 'degenerada (provado em sandbox)', mas o sandbox é interativo (HUD, playground:121). Não há execução, dado ou script reprodutível que sustente o 'provado'.
- ADR-0012:18-19: 'O mantenedor fixou como requisito'. ADR-0012:29: não-cruzamento é 'tendência ajustável por rigidez, não garantia combinatória — aceito por design'.
- O dossiê diz que o plano da Fase 4 'não está no repo'.
- O commit inicial 1f4c0b2 traz 25.897 linhas de uma vez: a trilha de experimentos anterior não está no git.

Contraponto honesto: o playground tem métricas por cenário (resíduo em playground:361, overlap em :404, área em :574, contagem de cruzamentos em :606), e o ADR-0011:17 relata comparação de perfis C1–C5. É evidência de exploração, mas não de conhecimento publicável ou replicável.
- **PESQUISA/PRODUTO: nos modos default, o layout é cego à topologia. As arestas não exercem força, então a 'tensegridade' não tem membros de tração. Isso produz uma ordem de grandeza mais cruzamentos que os baselines, e cruzamentos são a estética que mais importa para a compreensão.** (alta) — Código: src/layout/adapters/live/index.js:125-126, 'Edges exert NO force — ... The simulation never reads `ir.edges`'. A mola de conectividade só existe no v2 e é opt-in (compile-world.js, cfg.connectivitySpring, default off).

Exp1 (spike/exp1-topologia-historia.mjs → exp1.out), exemplo 'containers' com as 10 arestas trocadas por 2 arestas diferentes:
- deslocamento máximo = 0,000000 px no custom, no live v1 e no live v2;
- só o v2 com connectivitySpring reage (123,5 px).

Exp3 (exp3.out), arestas retas, mesma nodeLayer, cruzamentos:

| N / E | live v1 | live v2 | v2 + connSpring | d3-force | WebCoLa | ELK layered |
|---|---|---|---|---|---|---|
| 60 / 79 | 649 | 525 | 173 | 141 | 39 | 37 |
| 120 / 159 | 2.547 | 2.447 | 775 | 326 | 122 | 267 |

Entre os modos do Tensegrams, 'nbr3' (fração das arestas cujos extremos estão entre os 3 vizinhos mais próximos) vai de 0,02 a 0,08 em N=120, contra 0,23 no WebCoLa e 0,34 no ELK layered.

Purchase 1997: 'reducing the number of edge crosses is by far the most important aesthetic' (research.monash.edu).

Ressalvas: os grafos são aleatórios, e os parâmetros de d3-force e WebCoLa são meus, sem tuning.
- **PRODUTO/IDENTIDADE: a experiência padrão não contém a identidade declarada. O default é estático e algébrico. Além disso, o layout estático default deixa nós sobrepostos já com 10 nós, e sem nodeLayers tudo empilha no centro por design.** (alta) — - src/store.js:32-33: layoutId 'custom', routerId 'orthogonal'.
- custom/index.js:1-7: 'Every leaf node is placed centered on the board origin ... the collision post-pass is then the ONLY thing that spreads nodes apart'.
- collision-postpass.js:18: passes = 4.
- examples.js:66: 'Sem layer de colisão declarada, os nós empilham no centro'.

Exp3b (exp3b.out), sobreposições no custom com todos os nós na mesma layer:
- N=10: 8 pares sobrepostos, pior penetração 25,7 px;
- N=20: 34 pares;
- N=30: 92 pares;
- 6 nós sem nodeLayers: 11 pares.

No Exp3, o custom com N=120 tem 1.816 pares sobrepostos.

Para ver a física é preciso trocar para Live e ligar live.engine: 'v2' na config. O routing físico novo (Fase 4) ainda não existe.
- **PRODUTO (diagrams-as-code): o resultado não é função pura do texto. Há um dilema sem saída. Com warm start (o que a app faz), o layout depende do histórico de edição. Com cold start, qualquer edição mínima reembaralha o diagrama. Nos dois casos, git e revisão de diff perdem sentido, e não há artefato de imagem nem posições versionáveis.** (alta) — O pipeline semeia a nova sessão com as posições da anterior: src/app/pipeline.js:116-153 e live/index.js:107-115, 149-152.

Exp2 (exp1.out):
- texto idêntico depois de 'adicionar nó e desfazer': o layout difere até 64,59 px;
- depois de 'mudar label e voltar': 53,79 px;
- cold versus cold: 0,000000 px (o cold start é determinístico, mas a app só o mostra na primeira renderização).

Exp5 (exp5.out), acrescentar 1 folha a um grafo de 30 nós, contando os nós que movem mais de 10% do diâmetro:

| motor | nós movidos |
|---|---|
| custom | 13/30 |
| live v1 | 13/30 |
| live v2 | 16/30 |
| v2 + connSpring | 24/30 |
| d3-force | 27/30 |
| ELK layered | 0/30 (deslocamento médio 0,4%) |

Não há exportação de SVG ou PNG do diagrama para o usuário: download.js só baixa texto, e o PNG existe apenas dentro do 'Debug pack' (debug-export.js:1-3, 19-45). Posições só persistem via `pin` manual.

Comparação: o Graphviz neato, por padrão, usa 'the same seed ... so the initial placement is repeatable' (graphviz.org/docs/attrs/start).
- **ENGENHARIA DA TESE FÍSICA: o caminho físico tem se mostrado frágil e caro. O routing físico já foi tentado e está deprecated. Mesmo ele depende de correções algébricas por default. O motor v2 nunca termina a animação. O live v1, que é o engine default do Live, não escala dentro do orçamento de frame.** (media) — - F-0017 está deprecated (2026-06-18): 1.952 linhas em src/routing/physics e 2.951 linhas de teste serão removidas.
- playground:638: '... é o mecanismo que no engine v1 explodiu em cascata de shelves'.
- pipeline.js:218-237: clip e snap algébricos com default TRUE ('legacy') também sob routing.engine: physics.
- Bug do v2: src/physics/solver.js:42 limita alpha em alphaMin (`Math.max(alphaMin, …)`), mas compile-world.js:240 só emite 'end' se alpha < alphaMin, e o :244 reagenda o rAF enquanto alpha >= alphaMin.
- Exp1c (exp1c.out): o v1 emite 'end' no tick 482; o v2 não emite 'end' em 20.000 ticks (alpha=0,003). No navegador isso é um loop rAF infinito.
- O teste que cobre 'end' só usa cena toda pinada (tests/layout/compile-world.test.js:94), e os helpers de settle usam 0,005, o que mascara o bug.
- Exp4 (exp4.out), live v1: 3,37 ms/tick com N=60, 12,27 ms/tick com N=120 e 45,95 ms/tick com N=250, só no layout. O d3-force faz 300 ticks completos com N=120 (link + carga + colisão) em 152 ms, cerca de 0,5 ms/tick (exp3.out). O v2 é rápido (0,35 a 1,37 ms/tick), mas não é o default.
- **PRODUTO/ACESSIBILIDADE e evidência sobre o valor de 'vivo': o movimento automático dura mais que 5 s (ou para sempre, no v2), sem reduced-motion e sem semântica acessível no SVG. E a literatura não sustenta que animação e preservação de mapa mental melhorem a compreensão. A proposta central de valor ('vivo') não tem base empírica, e o projeto não a testa.** (media) — - grep por 'prefers-reduced-motion|reducedMotion' em src, style.css e index.html: vazio.
- grep por aria-, role e title em src/renderer: vazio.
- Settle do live v1: ln(0,003)/ln(1−0,012) ≈ 481 ticks, cerca de 8,0 s a 60 fps (calculado; o Exp1c confirma end no tick 482). O v2 nunca para.
- WCAG 2.2.2 (nível A): 'For any moving ... information that (1) starts automatically, (2) lasts more than five seconds ... there is a mechanism for the user to pause, stop, or hide it' (w3.org/WAI/WCAG20/Understanding/pause-stop-hide.html).
- Tversky, Morrison e Betrancourt 2002: 'the research on the efficacy of animated over static graphics is not encouraging ... animated graphics convey more information or involve interactivity' (PDF aberto e extraído).
- Archambault, Purchase e Pinaud 2011: 'small multiples gave significantly faster performance than animation' e 'Preserving the mental map ... had little influence in terms of error rate and response time' (research.monash.edu).

Ressalva: o critério 2.2.2 admite exceção quando o movimento é 'essential'.
- **PRODUTO/ADOÇÃO: a DSL é 3 a 4 vezes mais verbosa que as alternativas e exige declarar a separação explicitamente. Não há CLI, lib, exportação nem embed, e o ecossistema já oferece renderização nativa no GitHub, múltiplos engines e diagramas YAML interativos.** (media) — Exemplo 'containers' (medido): 79 linhas significativas e 1.549 bytes sem comentários, das quais 19 são só nodeLayers/viewLayers. As traduções equivalentes, escritas por mim, estão em spike/equiv.d2 (21 linhas, 473 bytes) e spike/equiv.mmd (17 linhas, 425 bytes). Ressalva: o Mermaid não tem equivalente a viewLayers.

No projeto:
- package.json:3 tem "private": true, e não há bin nem exports: não há CLI nem lib;
- não há embed;
- rodar localmente exige servidor HTTP (README).

No ecossistema:
- GitHub renderiza Mermaid nativamente: 'You can create diagrams in Markdown using four different syntaxes: mermaid, geoJSON, topoJSON, and ASCII STL' (docs.github.com);
- D2 troca de engine com --layout dagre|elk|tala (d2lang.com/tour/layouts);
- Ilograph oferece diagramas interativos multi-perspectiva em linguagem declarativa. Os exemplos são em sintaxe YAML (ilograph.com/blog/posts/idl-1), e 'Each perspective ... gives a unique view' (ilograph.com/docs/spec), análogo a viewLayers.
- **CUSTO DE OPORTUNIDADE: o esforço foi para infraestrutura, governança e uma primeira tentativa física que será descartada, e não para a pergunta de pesquisa. Um caminho mais barato e compatível com o ADR-0006 seria envolver d3-force ou WebCoLa e estudar só o delta novo (pesos de colisão, aresta-cadeia) contra esses baselines.** (media) — - git log: 13 commits, todos entre 2026-06-02 e 2026-06-26. Hoje é 2026-09-30: 3 meses sem commits.
- Linhas contadas: .feat-memory 1.908 e skills 497, contra 4.285 linhas de código físico (src/physics, src/routing/physics, live/*, compile-world). Dessas, 1.952 estão deprecated.
- O v1 do live reimplementa a semântica de resfriamento do d3-force. Tem alpha, alphaDecay e alphaMin (live/index.js:28-29), e o doc do d3 diz 'alpha is roughly analogous to temperature in simulated annealing' e define os ticks como ⌈log(alphaMin)/log(1−alphaDecay)⌉ (github.com/d3/d3 docs). A diferença é que o live v1 não tem forceLink nem forceManyBody.
- d3-force 3.0.0 é "type": "module", ISC, com 12 KB minificado: carregável via importmap. WebCoLa é MIT com 80 KB (medido em spike/node_modules). O ELK tem 1,6 MB, é EPL/GPL e não é ESM.

**Tabela 1: o que já existe e faz o mesmo (ou mais).** "Verif." indica que abri a fonte ou medi.

| Ferramenta | Layout usa a topologia? | Layout vivo/contínuo | Arestas como física | Restrições (grupo, alinhamento, não-overlap) | Reprodutível a partir do texto | Saída versionável, CLI, embed | Evidência |
|---|---|---|---|---|---|---|---|
| **Tensegrams (default: custom + orthogonal)** | **Não** (0 px de diferença ao trocar as arestas) | Não | Não | Só não-overlap por camadas; falha com N≥10 | Cold sim; na app **não** (histórico de edição) | Não tem CLI, export nem embed | exp1, exp2, exp3b; store.js:32 |
| **Tensegrams (live v2 + connectivitySpring, opt-in)** | Parcial | Sim, mas **nunca para** ('end' nunca dispara) | Ainda não (Fase 4 sem plano) | Camadas com pesos (possível diferencial), pin, constraint | Não (warm start) | Idem | exp1c, exp3 |
| d3-force | Sim (forceLink) | Sim (alpha/annealing) | Não | Colisão; o resto se programa | Cold determinístico; instável (27/30 nós movem) | Lib ESM de 12 KB | Verif. (doc + exp3, exp5) |
| WebCoLa | Sim | Sim ('no jitter') | Roteamento opcional | Alinhamento, grupos, não-overlap | Converge a ótimo local | Lib MIT | Verif. (site + exp3: 39 e 122 cruzamentos) |
| Dunnart (Monash, 2008) | Sim | Sim ('continuous network layout') | Conectores que preservam topologia ('rubber bands') | Alinhamento, distribuição, separação, não-overlap, contenção | Não verificado | Editor desktop, GPLv2 | Verif. (GitHub + ECEASST) |
| yFiles InteractiveOrganicLayout | Sim | Sim (time slices durante o drag) | Não verificado | Não verificado | Não verificado | Comercial | Verif. (docs) |
| vis-network | Sim | Sim (physics) | **Sim** ('invisible support node ... part of the physics simulation') | Limitadas | Não verificado | Lib | Verif. (docs) |
| FDEB (Holten e van Wijk, 2009) | Não se aplica (bundling) | Iterativo offline | **Sim** (arestas como molas subdivididas) | Não | Não verificado | Algoritmo | Verif. (TU/e) |
| fCoSE (Cytoscape.js) | Sim (compound) | Incremental, preserva o mapa mental | Não | Fixo, alinhamento, posicionamento relativo | Não verificado | Lib | Verif. (blog 2.0) |
| ELK layered | Sim | Não | Roteamento algorítmico | Hierarquia, portas | **Estável** (0/30 nós movem) | Lib, D2 | Verif. (exp3, exp5) |
| D2 | Sim (dagre, ELK, TALA) | Não | Não | Containers | Não verificado | CLI, SVG | Verif. (d2lang layouts) |
| Mermaid | Sim | Não | Não | Subgraphs | Não verificado | Nativo no GitHub | Verif. (docs.github) |
| Graphviz neato | Sim | Não | Não | Limitadas | **Sim** (seed fixa por padrão) | CLI | Verif. (attrs/start) |
| Ilograph | Não verificado | Interativo (perspectivas) | Não verificado | Hierarquia | Não verificado | SaaS/app | Verif. (spec, blog IDL) |

**Tabela 2: métricas que medi** (arestas retas, todos os nós na mesma layer, grafos aleatórios com seed fixa; parâmetros de d3-force e WebCoLa meus, sem tuning).

| Motor | Cruzamentos N=60 | Cruzamentos N=120 | Overlaps N=120 | Nós movidos por +1 nó (de 30) | Custo |
|---|---|---|---|---|---|
| Tensegrams custom (default) | 539 | 2.583 | **1.816** | 13 | 13 ms |
| Tensegrams live v1 | 649 | 2.547 | 0 | 13 | 12,3 ms/tick com N=120; 46 ms/tick com N=250 |
| Tensegrams live v2 | 525 | 2.447 | 0 | 16 | 0,35 ms/tick; nunca emite 'end' |
| Tensegrams v2 + connSpring | 173 | 775 | 0 | 24 | 139 ms |
| d3-force | 141 | 326 | 0 | 27 | 152 ms (300 ticks) |
| WebCoLa | **39** | **122** | 0 | não medido | 260 ms |
| ELK layered | **37** | 267 | 0 | **0** | 180 ms |

**Ressalvas honestas.** O que pode ser original: pesos assimétricos de colisão na DSL, a combinação DSL-texto + física viva sem dependências, e aresta-cadeia interativa com camadas de colisão. Isso ainda não foi isolado nem comparado com nada. Para refutar este caso, o projeto precisaria de:
- hipóteses escritas antes dos experimentos;
- um harness headless que compare contra d3-force, WebCoLa e ELK por cruzamentos, stress, estabilidade e tempo;
- um estudo pequeno com usuários sobre "vivo vs estático".

Não rodei o E2E. Não observei a app no navegador: o loop rAF infinito do v2 foi inferido do código e de ticks headless. A página do ImPrEd (2011) retornou 403 e não foi usada como evidência.

## Apêndice E · Ideias brutas dos geradores

### Lente produto-experiencia

- **Arrastar é editar: o gesto grava na DSL por emenda cirúrgica** (esforço M, novidade media) — Quando o usuário solta um nó, o app grava `pin: [x, y]` no YAML, ou atualiza o pin que já existe. A emenda usa os ranges do AST do `yaml` e toca só no trecho alterado: comentários, ordem das chaves e estilo das coleções flow continuam byte-idênticos. Um toggle no FAB escolhe o que o soltar significa: 'fixar aqui' (pin duro) ou 'prefiro aqui' (atrator-ponto macio, coerente com o ADR-0010). O canvas vira superfície de edição e não só de visualização, na linha de Sketch-n-Sketch (arXiv:1507.02988, aberto). Primeiro passo: Portar o writePin do spike para src/dsl/writeback.js como funções puras, com testes node:test cobrindo nó em bloco, pin já existente, nó inexistente e flow map (este com fallback). Chamar em releaseDrag (src/app/gestures.js:271) atrás da flag de config `live.writeback: true`, gravando via store.setDSL (src/store.js:106).
- **Gestos semânticos: a física como editor estrutural** (esforço M, novidade media) — Gestos que mudam o significado do diagrama, não só a posição, sempre traduzidos em edição cirúrgica da DSL. Soltar um nó dentro de um container grava `parent:`. Arrastar um nó e encostá-lo em outro por ~600 ms cria `- [a, b]` em connections; antes de confirmar, uma mola aparece esticada entre os dois. Sacudir um nó (3 reversões rápidas) remove o pin. Double-tap no fundo cria um nó novo naquele ponto. A física dá o feedback tátil: o container 'aceita' o nó puxando-o para dentro, e a aresta nova nasce como mola. Primeiro passo: Fazer só 'soltar dentro de container → parent:'. Em endSingle (src/app/gestures.js:249), testar o rect do container sob o ponteiro usando currentLayout.containers e gravar `parent: <id>` com o writer por range da ideia 1. Durante o drag, destacar o container-alvo com uma classe CSS.
- **Seleção cruzada DSL <-> canvas** (esforço P, novidade baixa) — Tocar num nó leva o cursor do editor ao bloco dele e pisca as linhas correspondentes. Mover o cursor no YAML faz o nó ou a aresta correspondente pulsar no canvas. Erros e warnings com 'L<n>' ficam clicáveis e acendem o elemento culpado. É a ponte mínima para o usuário formar o modelo mental entre texto e forma. Primeiro passo: Expor lineOf(id) a partir do AST em pipeline.rerender. No subscriber de seleção (bindStoreSubscriber em pipeline.js), chamar um novo editor.revealLine(n) com setSelectionRange + scrollTop. No sentido inverso, um listener de cursor no textarea mapeia a linha para o id e chama store.setSelected.
- **Raio-X de tensegridade: ver as forças e perguntar 'por que este nó está aqui?'** (esforço M, novidade alta) — Um modo lente sobre o canvas. Em cada nó, desenha uma seta por contributor (central, tags, colisão, mola) com a paleta do playground. Cada aresta-mola ganha cor por tração (cabo) ou compressão (escora), que é a leitura literal de tensegridade. No hover, o nó explica sua posição, por exemplo: 'puxado pelo centro 31%, empurrado por colisão com Auth 42%, mola com DB 27%'. A física deixa de ser caixa-preta e vira argumento. Primeiro passo: Mover o instrument() do spike para src/physics/lens.js e aplicá-lo em compile-world.js quando `live.lens: true`. Expor session.lens e desenhar as setas num <g class='force-lens'> ao lado do collision-debug. Adicionar um checkbox 'Forças' junto ao de BBoxes (index.html:48).
- **Transições com significado: o diff da DSL vira coreografia** (esforço M, novidade media) — Cada edição vira uma animação que conta o que mudou. O nó novo nasce no centróide dos vizinhos (ou do container-pai) e infla. O nó removido desinfla, e as molas que o seguravam relaxam de forma visível. A aresta nova cresce do source até o target. Mudar um label faz crossfade sem mover nada. As transições são em estágios, como em Heer & Robertson 2007: primeiro a estrutura, depois a acomodação física. Primeiro passo: Honrar cfg.seedPositions/seedAlpha em startLayoutV2 com a mesma regra do v1 (live/index.js:107-152) e semear o nó novo no centróide dos vizinhos já posicionados. Adicionar um teste de caracterização 'editar a DSL não desloca nós existentes em t=0', reaproveitando o spike.
- **Repouso honesto: energia visível, fim da simulação e movimento reduzido** (esforço P, novidade baixa) — O diagrama precisa saber parar e mostrar que parou. Um medidor pequeno de energia (alpha mais energia cinética) esvazia até indicar 'em repouso'. A simulação dorme de fato quando assenta. Para quem tem prefers-reduced-motion, o app mostra direto o estado final, calculado com N ticks síncronos (possível porque o motor é determinístico), e usa crossfade no lugar do movimento. Primeiro passo: Corrigir o critério de repouso do v2 (alpha <= alphaMin, ou um limiar de energia cinética), com teste para uma cena com corpo móvel. No boot, checar matchMedia('(prefers-reduced-motion: reduce)'): se ativo, rodar a sessão headless até o 'end' e pintar só o quadro final.
- **Cenas e modo apresentação: narrar o sistema com física** (esforço M, novidade media) — Uma lista `options.scenes` na DSL. Cada cena define camadas visíveis, container em foco, nós destacados e um texto curto. No modo apresentação (tecla P, setas ←/→), a física faz a troca de cena: camadas somem ou voltam e os nós restantes se reacomodam animados. A narrativa 'monolito → serviços' vira movimento. Uma segunda aba, via BroadcastChannel nativo, pode servir de visão do apresentador com notas. Primeiro passo: Aceitar `options.scenes: [{title, hide: [layers], focus: id, highlight: [ids]}]` em attr-set.js e ir.js. Ligar ←/→ em onKeyDown (src/app/gestures.js:344) para aplicar a cena i com store.setHiddenLayers e store.setFocusedContainer (src/store.js:132,138), mais um overlay com o título da cena.
- **Linha do tempo: undo, replay determinístico e gravação** (esforço G, novidade media) — Registrar um log de eventos: edições da DSL como diffs e gestos de drag/release, indexados por tick. Com isso vêm undo/redo (inexistentes hoje), um scrubber para rever como o diagrama evoluiu e a exportação dessa evolução como vídeo (MediaRecorder) ou sequência de quadros. Serve para apresentar e também para a pesquisa: reproduzir exatamente um comportamento físico estranho a partir do log. Primeiro passo: Criar src/app/timeline.js que intercepta store.setDSL e session.update (drag/release) num array em memória. Ctrl+Z e Ctrl+Shift+Z, fora do editor, restauram a DSL anterior. Teste unitário: aplicar o log headless reproduz posições idênticas.
- **Link vivo: compartilhar e embutir sem servidor** (esforço P, novidade baixa) — Um botão 'Copiar link' que põe DSL e config comprimidas no fragmento da URL (#d=...). Um modo `#embed` só de leitura (sem editor, com pan/zoom/drag) para iframes em READMEs, wikis e slides. Exportação SVG/PNG para quem precisa de algo estático. Cada link é também um experimento reproduzível. Primeiro passo: No boot (src/app/boot.js), se houver `#d=`, descomprimir e usar como DSL inicial, sem sobrescrever o localStorage até o usuário editar. Um botão gera o link. Com `#embed`, uma classe no body esconde o painel do editor.
- **Duas mãos: esticar a estrutura com multi-toque** (esforço P, novidade media) — Cada dedo que pousa num nó agarra aquele nó. Com dois dedos em dois nós, o usuário estica o diagrama como uma estrutura de tensegridade e sente as molas resistirem. A pinça continua valendo quando o segundo dedo cai no fundo. No desktop, Alt+clique prende um nó como segunda mão. É a experiência tátil que separa um diagrama movido por física de um desenho. Primeiro passo: Em onPointerDown (src/app/gestures.js:66), quando pointers.size === 2 e o alvo é um nó, abrir um segundo drag por pointerId (Map pointerId→drag) em vez de chamar startPinch. tickDrag passa a enviar o array de todos os drags ativos.
- **Mesa compartilhada: colaboração com mãos remotas no mesmo mundo físico** (esforço G, novidade alta) — Várias pessoas no mesmo diagrama: o texto da DSL é sincronizado e, além dos cursores de texto, aparecem 'mãos' remotas. Quando alguém arrasta um nó, os outros veem a mão e a estrutura se mexer. Duas pessoas puxando pontas opostas negociam o layout fisicamente. Há também um modo sala de aula: o professor segura um nó e os alunos observam as forças. Primeiro passo: Prova local com BroadcastChannel nativo entre duas abas do mesmo navegador. Cada aba publica {dsl, drags ativos com cor}; a outra aplica a DSL e injeta os drags remotos via session.update. Medir se a física converge com duas fontes de verdade.
- **Navegação estrutural acessível: o diagrama pelo teclado e pelo leitor de tela** (esforço M, novidade media) — Tab entra no diagrama. As setas percorrem vizinhos pelas arestas, não pela posição, que a física muda. Enter faz drill no container e Esc sobe um nível. O leitor de tela anuncia, por exemplo: 'API, dentro de Backend, 3 conexões: DB (queries), Cache (hot reads)'. Uma alternativa textual sempre sincronizada (lista hierárquica) serve também a quem não consegue acompanhar movimento. Primeiro passo: Sem biblioteca: em renderNodes, pôr role='button', tabindex e aria-label (label, pai e grau) em cada g.node, mais uma região aria-live que anuncia a seleção. Em onKeyDown (src/app/gestures.js:344), as setas movem a seleção para o próximo vizinho segundo ir.edges.
- **Ouvir a tensão: sonificação da física** (esforço M, novidade alta) — Cada aresta-mola vira uma corda: a altura sobe com a tração e o timbre fica abafado na compressão. O assentamento do layout soa como um acorde que se resolve, e arrastar um nó faz as cordas ligadas a ele gemerem. Serve como canal acessível (ideia 12), como feedback de pesquisa (ouvir oscilação ou instabilidade antes de vê-la) e como marca sensorial do projeto. Primeiro passo: Protótipo isolado sobre o cenário G5 'Aresta-mola' do playground (playground/physics-playground.html:703): um OscillatorNode por mola, com frequência = f0·(1 + tensão/rest) e ganho proporcional a \|velocidade\|, ligado por um botão (o navegador exige gesto para tocar áudio).
- **E se?: cortar cabos para revelar acoplamento** (esforço M, novidade alta) — Um modo de investigação: cortar temporariamente uma aresta ou arrancar um nó, sem editar a DSL, e deixar a física mostrar o impacto. O grupo que se solta e deriva é o que dependia daquilo. Reforçar uma aresta (mola mais rígida) mostra o que é puxado junto. Uma pergunta de arquitetura como 'o que acontece se o Redis cair?' vira um experimento físico. Um botão 'cristalizar' pode então propor containers (`parent:`) para os grupos que emergirem. Primeiro passo: Ação 'Cortar (temporário)' no menu de contexto (src/ui/context-menu.js:33) que adiciona o id a um Set efêmero cutEdges/cutNodes no store. Aplicar esse Set como filtro depois do applyCollapseFilter na pipeline, forçando connectivitySpring ligado nesse modo. 'Restaurar' limpa o Set.
- **Física com semântica e dados vivos: o diagrama deforma sob carga** (esforço M, novidade alta) — Atributos de domínio viram propriedades físicas. O peso de colisão já vira massa hoje; a proposta acrescenta `length` e `stiffness` por aresta, que viram comprimento de repouso e rigidez da mola. Opcionalmente, um bloco `data:` liga essas grandezas a números externos: JSON por URL ou sliders de 'simular carga'. Com métricas reais (tráfego, latência), o diagrama da arquitetura se contrai onde o acoplamento está quente e afrouxa onde o tráfego cai: um mapa vivo, não um desenho. Primeiro passo: Adicionar os atributos de aresta `length` e `stiffness` na DSL (EDGE_ATTRS em src/dsl/attr-set.js:67 e em ir.js) e repassá-los por aresta em compile-world.js:141. Depois, um slider temporário no painel que multiplica a rigidez das arestas de uma tag, para ver o diagrama respirar com a carga.

### Lente pesquisa-moonshot

- **Energia como observável de primeira classe: E(x) mede a qualidade do layout** (esforço P, novidade media) — Cada contributor de src/physics passa a expor `energy(world)` ao lado de `apply` (central: ½k\|x−c\|²; mola: ½k(L−rest)²; colisão: só o termo P ½Kp·pen²; tag-attract: k·s·ln d). O solver soma E_pot e KE a cada tick e isso vira: (a) HUD/sparkline no app e no playground, (b) critério de repouso, (c) função objetivo para as ideias de calibração, réplicas e análise modal. Os termos não conservativos ficam separados e com nome: a integral do PI (src/physics/collision.js:76-80) e as tag-forces, que são unilaterais (só escrevem no corpo i: src/physics/contributors/tag-forces.js:36 e :55, violando a 3ª lei). Com isso 'energia = qualidade' passa a ser uma hipótese testável e deixa de ser metáfora. Primeiro passo: Num harness fora do repo, adicionar `energy()` a createCentral, createConnectivitySpring e createCollision (só o termo P), rodar os 4 EXAMPLES (src/dsl/examples.js) e 20 grafos semeados e salvar E(t), KE(t), stress e cruzamentos em JSON. Critério de sucesso: ρ(E, stress) > 0,7 também nos exemplos do produto.
- **Repouso como propriedade dinâmica: critério por KE/‖F‖, ciclo-limite do PI e 'respiração' controlada** (esforço P, novidade media) — Estudar o v2 como sistema dinâmico. O assentamento deixa de ser 'alpha < alphaMin' e passa a ser KE < ε e ‖F_residual‖ < δ durante N ticks. Além disso: montar o diagrama de fases do laço PI+atrator central com 2 corpos (quando surge o ciclo-limite, efeito de anti-windup e de vazamento da integral) e transformar a oscilação residual numa escolha estética explícita. A opção 'respirar' é uma oscilação de amplitude limitada e parametrizável, que expressa o 'vivo' do ADR-0012. A opção 'congelar' é o repouso real. Primeiro passo: Reaproveitar os spikes endcheck.mjs, settle.mjs e drift.mjs (pasta pesquisa/) como teste de caracterização. Instrumentar KE e ‖F‖ por tick, plotar o retrato de fase de 2 corpos em contato sob atrator central variando Ki e accMax e propor a regra de repouso. Entregável: 1 página de notas com gráficos e uma proposta de ADR sobre 'repouso vs respiração'.
- **Tensegridade literal: cabos só-tração, escoras só-compressão e protensão como knob único** (esforço P, novidade alta) — Dar ao nome do projeto um modelo físico. Arestas viram cabos unilaterais: só puxam quando esticadas e ficam frouxas quando comprimidas. As zonas de colisão já são escoras só de compressão (a colisão só repele). Um parâmetro global de protensão p ∈ [0,1] encurta o rest de todos os cabos (rest = L0·(1−p)), de modo que a rigidez percebida no drag, a compacidade e a 'tensão visível' vêm de um único botão com significado físico. Fica aberto também o caminho para form-finding de verdade (Force Density Method, que resolve o equilíbrio de redes de cabos com um único sistema linear) como 'pré-solve' antes da animação. Primeiro passo: Promover o `createCable` do spike (energy.mjs, cerca de 15 linhas) a contributor registrável via registerContributor (src/physics/registry.js:19) num worktree de experimento, com a flag `live.edgeModel: spring\|cable` e o knob `prestress`. Criar o cenário G6 no playground comparando mola, cabo e cabo com protensão sob drag.
- **TensegraBench: benchmark reprodutível e publicável contra layouts clássicos** (esforço M, novidade media) — Harness headless em Node, sem tocar no runtime do app (ADR-0006 intacto), que roda v1, v2-central, v2-spring, v2-cable (e depois v2 com arestas-cadeia) contra d3-force, WebCola, ELK (stress/layered), Graphviz neato/sfdp (WASM) e ForceAtlas2. O corpus combina os exemplos do produto, grafos sintéticos semeados e um subconjunto dos Rome graphs. Métricas estáticas: stress normalizado, cruzamentos, CV de comprimento de aresta, overlap, compacidade e resolução angular. Métricas dinâmicas: tempo até o repouso, deslocamento por edição e fidelidade de mudança. Saída em JSON versionado mais uma página de resultados. É a base empírica para um short paper ou pôster (ex.: GD) sobre 'layout vivo por forças unilaterais'. Primeiro passo: Transformar bench.mjs num diretório `bench/` do spike com seeds fixas, saída JSON por (grafo, engine) e adaptadores para d3-force, WebCola e ELK; publicar a primeira tabela com os 4 exemplos e 30 grafos sintéticos (n de 10 a 100). Em paralelo, localizar um espelho acessível dos Rome graphs.
- **Mapa mental sob edição ao vivo: warm-start e temperatura local (alpha por corpo)** (esforço P, novidade alta) — Trocar o alpha global (um escalar no solver) por temperatura por corpo, guardada num array paralelo no World. Numa edição do DSL, só aquecem os nós novos ou alterados e sua vizinhança de k saltos; o resto do diagrama continua frio e estável. Corpos novos 'nascem quentes' e leves, corpos removidos 'evaporam' (a massa vai a 0 antes de sair). O resultado é medido com métricas de preservação do mapa mental e de fidelidade de mudança (distance- e cluster-change faithfulness). Primeiro passo: No harness, (1) portar o warm-start do v1 para o v2 e (2) adicionar `world.temp: Float32Array`, com central, mola e tags multiplicando pela temperatura local e aquecimento por BFS de k saltos a partir do diff do IR. Rodar de novo o mentalmap.mjs e mirar menos de 26 px de deslocamento médio com qualidade estática igual.
- **Réplicas guiadas por energia: multi-start e parallel tempering com 'fantasmas' das alternativas** (esforço M, novidade alta) — Rodar K mundos silenciosos em paralelo (num Web Worker, sem dependência nova) a partir de inícios e temperaturas diferentes, trocando configurações entre réplicas no estilo parallel tempering. O mundo visível transita suavemente, por física e não por teletransporte, para a bacia de menor energia. O lado 'moonshot' na UI: mostrar as 2 ou 3 melhores bacias como fantasmas translúcidos que o usuário pode escolher, fazendo dos mínimos locais uma ferramenta de exploração em vez de um defeito escondido. Primeiro passo: Runner headless com K=8 réplicas, troca de temperatura a cada 50 ticks e critério de Metropolis sobre E. Medir o ganho de stress e cruzamentos contra o custo em ms nos 4 exemplos e em 30 grafos sintéticos, e fazer um protótipo estático (SVG) de 'fantasmas' para 1 exemplo.
- **Análise modal: modos moles como mapa da ambiguidade do diagrama** (esforço M, novidade alta) — No equilíbrio, calcular a Hessiana de E (diferenças finitas; n ≤ 50 cabe fácil) e seus autovetores. Autovalores perto de zero são modos moles: direções em que o diagrama pode se mover sem custo, isto é, onde o layout está indeciso ou subdeterminado. Usos: (a) animar o modo mais mole como uma 'vibração' do diagrama, o vivo com significado físico; (b) destacar os nós que dominam esses modos e sugerir pin, constraint ou atrator; (c) ligar à teoria de rigidez de tensegridades (matriz de stress PSD de Connelly; rigidez universal) para certificar quando o diagrama está 'travado'. Primeiro passo: Com o E(x) da ideia da energia como observável, escrever em Node uma Hessiana por diferenças finitas e um autossolver de Jacobi (cerca de 60 linhas, sem dependência). Rodar nos EXAMPLES quad, containers e forces, listar os 5 modos mais moles com os nós dominantes e renderizar 1 SVG por modo com setas.
- **Mapa de frustração: tensão e integral do PI visíveis como diagnóstico** (esforço P, novidade media) — Tornar legível onde o diagrama está 'brigando consigo mesmo'. Cada aresta ganha traço ou cor proporcional à tensão (k·extensão; com cabos, 0 quando frouxa). Cada contato mostra o acumulador integral do PI, que indica onde a colisão precisou de 'força extra' contra uma força concorrente. Cada nó mostra a força residual no repouso. Com isso a semântica 'tensão = acoplamento' vira instrumento: a pessoa vê quais relações do DSL estão frustradas e pode mudar pesos, layers ou pins. Primeiro passo: No harness, exportar por tick {edgeId: tensão} e {parKey: acc.v} de uma sessão v2+spring nos exemplos e gerar SVG estático com espessura e cor proporcionais. Validar com o mantenedor se a leitura ajuda a entender o layout antes de pensar em integrar ao renderer.
- **Calibração automática com frente de Pareto para destravar o 'v2 como default'** (esforço M, novidade media) — Tratar os cerca de 13 knobs do v2 (src/layout/compile-world.js:37-57: center, damping, collisionK/Ki, padding, tag*, alpha*, substeps, edgeSpring, edgeRestLength) como espaço de busca. Usar otimização caixa-preta (random search e depois CMA-ES ou TPE, em Node) contra o corpus do TensegraBench, com objetivo multicritério: stress, cruzamentos, tempo até o repouso, deslocamento por edição e overlap. O produto é uma frente de Pareto e 2 ou 3 presets ('compacto', 'legível', 'vivo') com evidência, em vez de calibração a olho. Primeiro passo: Random search com 100 configurações × 10 grafos (cerca de 2 minutos de CPU), objetivo escalar provisório igual a stress + 0,01·cruzamentos + penalidade de não-repouso. Salvar as configurações não dominadas em JSON e comparar com os DEFAULTS atuais.
- **Campos de legibilidade: critérios estéticos como contributors de força** (esforço M, novidade media) — Levar a ideia do (GD)² (qualquer critério de legibilidade suave pode ser otimizado por gradiente) para dentro do motor vivo. Cada critério vira um campo registrável (registerField, em src/physics/registry.js:41) cuja força é −∇critério: stress por distância no grafo, resolução angular nos nós, ângulo de cruzamento, razão de aspecto e alinhamento. O usuário liga e desliga 'leis físicas de legibilidade' pela config, e o diagrama se reorganiza ao vivo a cada campo ativado. Primeiro passo: Implementar o campo `stress` (molas par a par com rest = L·dist_grafo e peso d⁻², amostrado para n > 50) e o campo `angular-resolution` no harness; rodar o bench.mjs com o campo ligado e desligado e medir o delta de stress e cruzamentos contra o custo por tick.
- **Física inversa: o arraste do usuário vira DSL (atrator, pin ou constraint inferido)** (esforço M, novidade alta) — Fechar o laço DSL ↔ física. Quando o usuário solta um nó onde quer, em vez de o corpo voltar à simulação e 'cair' de volta, o sistema resolve o problema inverso: quais parâmetros mínimos (um atrator-ponto, um attractTo por tag, um constraint axis ou rect, ou um peso de mola) tornam essa posição um equilíbrio (∇E(x_user; θ) = 0)? A resposta aparece como sugestão de YAML aplicável. O layout deixa de ser escravo das forças e passa a ser aprendido por demonstração. Primeiro passo: Em Node: sessão v2 no exemplo `forces`, simular um drag e soltura de 1 nó e calcular a força residual e o atrator-ponto mínimo que zera essa força; emitir o trecho YAML correspondente (`attractTo`, ou um `pin` quando a força for grande demais). Validar que, reaplicado, o nó assenta a menos de 5 px da posição solta.
- **Diagramas vivos ligados a telemetria: tensão = tráfego, massa = carga, temperatura = erros** (esforço M, novidade alta) — Ligar os parâmetros físicos a sinais externos ao vivo. A rigidez ou tensão do cabo acompanha o tráfego da aresta (RPS), o rest length acompanha a latência, a massa do nó acompanha a carga e a temperatura local (alpha por corpo, ver a ideia do mapa mental) acompanha a taxa de erro. Um serviço instável literalmente 'treme'. A fonte vem declarada na config (ADR-0007: dados em config, conteúdo no DSL) por fetch com polling ou EventSource nativos, sem dependência nova de runtime. Parâmetros mudam no lugar, sem reiniciar o mundo, o que dá ao diagrama semântica física de observabilidade. Primeiro passo: Gerador sintético (senoides e picos) de tráfego por aresta alimentando `k` por aresta num harness v2+cable; medir se a mudança de sinal gera movimento legível e proporcional (correlação entre o sinal e a variação de comprimento ou posição) sem instabilidade. Critério: amplitude monotônica no sinal e nenhuma explosão com picos 10×.
- **Laboratório reproduzível: portar o playground para experimentos headless no motor real (I1 como go/no-go da Fase 4)** (esforço M, novidade baixa) — Os 24 cenários do playground são a base de evidência dos ADRs 0010 a 0012, mas rodam num sandbox separado e as conclusões ficam em localStorage. A proposta é portar as funções metric() e summary() dos cenários para experimentos em Node que usam src/physics de verdade, com seed, saída em JSON versionado e figura; cada ADR passa a apontar para um resultado reproduzível. O primeiro experimento é o I1 (acoplamento layout + routing com reciprocidade aresta → nó), para quantificar antes de construir a Fase 4 quanto a unificação ganha em cruzamentos, abertura de corredor e tempo. Primeiro passo: Portar o I1 (5 nós, 3 cadeias de 5 corners, reciprocidade on/off) para Node sobre createWorld, createSolver e createCollision; varrer krep, kchain e kcross e registrar cruzamentos, KE e ms/tick em JSON. Depois o I2 com n de 10 a 120 no motor real, que dá o go/no-go de escala.
- **Escala para a Fase 4: motor em Web Worker e depois WebGPU, com arestas-cadeia multiplicando os corpos** (esforço G, novidade media) — Com arestas como cadeias de corners (Fase 4), o número de corpos aumenta de 4 a 5 vezes: 80 nós e cerca de 100 arestas passam de 500 corpos, somados à anti-colisão entre cápsulas. A proposta é mover o solver v2 para um Web Worker (o World em Float32Array AoS é transferível) e medir o teto. Como moonshot, um kernel WebGPU de integração e colisão por grid para chegar a milhares de corpos a 60 fps, o que abre diagramas vivos de sistemas grandes (centenas de serviços). Primeiro passo: Benchmark sintético em Node com 500, 1000, 2000 e 5000 corpos POINT e RECT, colisão por grid, central e molas de cadeia, medindo ms/tick e perfil (colisão ou integração); depois o mesmo loop num Worker em página de teste servida localmente, comparando postMessage com transferência contra cópia.
- **Métrica e estudo perceptual de 'vivacidade': quantificar o requisito do ADR-0012** (esforço M, novidade alta) — O ADR-0012 fixa 'movimento orgânico/vivo' como identidade do projeto, mas não existe métrica do que é 'vivo', 'nervoso' ou 'morto'. A proposta é definir descritores de trajetória (jerk médio, overshoot, tempo de assentamento, espectro de amplitude, coerência de movimento entre vizinhos) e rodar um estudo perceptual pequeno (5 a 10 pessoas, comparação A/B em pares de animações) correlacionando os descritores com os rótulos 'vivo' e 'agradável' contra 'nervoso' e 'artificial'. O resultado vira função objetivo para a calibração automática e é uma contribuição rara na literatura de layout dinâmico. Primeiro passo: Gravar trajetórias (posições por tick) do exemplo `containers` sob 6 regimes (damping de 0,7 a 0,95, com e sem integral do PI, viscoso contra atrito seco) e calcular os descritores. Montar uma página HTML estática sem dependências com pares lado a lado para um piloto informal com 3 a 5 pessoas.

### Lente ecossistema-alcance

- **CLI headless `tensegrams render` (DSL → SVG/PNG) com modo `serve` compatível com a API do Kroki** (esforço M, novidade baixa) — Empacotar o núcleo já existente (parser → IR → layout adapter → router → pós-passes obstacle/clip/snap → renderer) como uma CLI em Node: `npx tensegrams render arq.yaml --layout live --engine v2 --until-alpha 0.003 -o out.svg\|png`. Num segundo passo, o subcomando `serve` expõe `GET /tensegrams/{svg\|png}/{deflate-base64}` no formato da API do Kroki. Assim, qualquer Markdown (inclusive README do GitHub via `<img>`) renderiza um diagrama a partir de uma URL. A simulação é avançada tick a tick, sem requestAnimationFrame, até assentar. Primeiro passo: Extrair a lógica pura do handler de tick de src/app/pipeline.js:170-243 (route → applyObstacleRouting → clip → snap) para um módulo sem DOM (ex.: src/core/frame.js), sem mudar o comportamento. Depois, promover o spike a scripts/render.mjs com um teste golden de SVG para o exemplo `quad`.
- **"Diagrama que respira": export de SVG animado autocontido (SMIL) da trajetória física** (esforço M, novidade alta) — Gravar a trajetória do motor (frames de posição por tick) e exportar um SVG único com `<animate>` por corpo: o diagrama "nasce" (sai do seed circular e assenta) e, opcionalmente, entra num loop de "respiração" (pequena perturbação periódica e recuperação, a assinatura da tensegridade). Funciona como `<img>` em README, Obsidian, Notion, slides e e-mail, sem JavaScript. As arestas entram reamostrando cada polilinha para N pontos fixos, para animar o atributo `d`. Primeiro passo: No spike, adicionar as arestas: reamostrar os `points` de cada routedEdge para 16 pontos por frame, emitir `<animate attributeName="d">` e dizimar keyframes por tolerância de movimento (<0,5 px). Depois, abrir o SVG num navegador e medir o tamanho para os 4 exemplos.
- **Trace + replay determinístico (`.tgtrace`) → vídeo/GIF e reprodutibilidade científica** (esforço M, novidade alta) — Definir um formato de trace: DSL + config + versão + fluxo de eventos com o tick em que cada um ocorreu (edições, `update({drag})`/`update({release})`, toggles de layer). Como o motor é determinístico, o replay reproduz a sessão exatamente. Usos: (a) exportar WebM/GIF de uma interação (drag, soltar, o diagrama se reorganizando) para posts e palestras; (b) anexar o trace a relatos de bug e a experimentos, que viram casos reproduzíveis; (c) regressão comportamental: mesmo trace, métricas comparadas entre commits. Primeiro passo: Num script da pasta de trabalho, gravar um drag sintético (3 patches `drag` e 1 `release` em ticks fixos) sobre o exemplo `forces`, rodar 2 vezes em headless e comparar as posições finais bit a bit. Se forem iguais, especificar `tensegrams-trace/1` como extensão do schema `tensegrams-debug-pack/1`.
- **Link de compartilhamento + modo embed (DSL comprimida no hash, `?embed=1`)** (esforço P, novidade baixa) — Codificar DSL+config na URL (`#z=<deflate-raw base64url>`) usando a CompressionStream nativa, sem dependência nova. Com `?embed=1`, o app esconde editor e topbar e mostra só o canvas vivo, arrastável. Qualquer diagrama vira um link colável em issues, chats, Notion (/embed), Obsidian (iframe), slides e posts, sem backend e hospedado no próprio GitHub Pages. Primeiro passo: Criar src/app/share.js com `encodeShare(dsl, config)`/`decodeShare(hash)` e testes node (round-trip dos 4 exemplos). No boot, ler o hash antes do localStorage. Botão "copiar link" ao lado de ⤒/⤓.
- **Web Component `<tensegram-diagram>` carregável direto do GitHub Pages** (esforço M, novidade media) — Um custom element ESM: `<script type=module src="https://brunoleos.github.io/tensegrams/src/embed.js">` + `<tensegram-diagram layout=live engine=v2>…yaml…</tensegram-diagram>`. Renderiza o diagrama vivo, arrastável e com física, em qualquer página HTML: Docusaurus, MkDocs, Hugo, Observable, blogs. É a camada comum sobre a qual os plugins de Obsidian e VS Code e o modo embed se apoiam. Primeiro passo: Protótipo src/embed.js de ~100 linhas: lê o textContent do elemento, roda parse → buildIR → adapter.start → router por tick e monta o createRenderer num shadow root. Página de teste estática com 2 diagramas na mesma página, para validar que não há estado global compartilhado (o cache de registries em src/layout/registry.js:19 é global, mas só guarda módulos).
- **Blocos ```tensegram no Obsidian e no preview Markdown do VS Code (+ JSON Schema da DSL)** (esforço M, novidade baixa) — Plugin do Obsidian que registra o bloco de código `tensegram` e monta o Web Component. Extensão do VS Code que contribui `markdown.markdownItPlugins`/`markdown.previewScripts` para o mesmo bloco. Sem extensão alguma, publicar um JSON Schema da DSL e da config (gerado de src/dsl/attr-set.js e src/controls/config-schema.js) para autocompletar e validar em editores YAML. Primeiro passo: Gerar `tensegrams.schema.json` por script a partir de attr-set.js e validar os 4 exemplos com um validador na pasta de trabalho. Em paralelo, criar o esqueleto do plugin Obsidian (sample-plugin) com um processor que só mostra o SVG estático do CLI headless.
- **GitHub Action "diagram diff": render e métricas de diagramas em cada PR** (esforço M, novidade media) — Uma Action que acha `*.tensegram.yaml` no repositório, renderiza antes/depois com a CLI headless e comenta no PR as imagens lado a lado e um delta de métricas: sobreposições intra-layer, cruzamentos, violações de invariantes, ticks até assentar. Serve a quem usa Tensegrams para documentar arquitetura e, principalmente, ao próprio projeto como regressão visual do motor a cada mudança de física. Primeiro passo: Script na pasta de trabalho que, dados dois SHAs, roda o render headless dos 4 exemplos em cada um e imprime uma tabela markdown de métricas. Depois, embrulhar como job `diagram-report` acionado em `pull_request`.
- **Tensegrams Bench: galeria-laboratório pública com métricas de "diagramas vivos"** (esforço M, novidade alta) — Uma galeria de demos gerada no headless que também serve de benchmark: cada diagrama (exemplos, corpora importados de Mermaid, grafos sintéticos de 25 a 200 nós) × engine (v1, v2, v2+connectivitySpring) × router, com métricas clássicas (sobreposição, cruzamentos, variância de comprimento de aresta) e métricas NOVAS de vivacidade: ticks até assentar, energia cinética residual, tempo de recuperação após perturbação padronizada, deslocamento máximo sob drag. Publicada no Pages como página estática com cards e sparklines. Primeiro passo: Consolidar scale.mjs + overlap.mjs num `bench.mjs` que emite JSON (exemplo × engine × métrica) e uma página HTML estática simples que lê esse JSON. Rodar para os 4 exemplos e 4 tamanhos sintéticos.
- **Importadores Mermaid/D2/DOT → YAML Tensegrams ("cole seu Mermaid e veja respirar")** (esforço M, novidade baixa) — Tradutores de subconjunto: Mermaid flowchart (`A[Label] --> B`, `subgraph … end`), D2 (`a -> b`, blocos aninhados) e Graphviz DOT, para a DSL YAML. Primeiro, um parser escrito à mão, sem dependência, cobrindo o subconjunto comum. Opcionalmente, import dinâmico do mermaid via CDN para usar o parser oficial. Vira botão "Importar de…" no app, comando da CLI e a principal fonte de corpora reais para o Bench. Primeiro passo: Escrever src/dsl/import/mermaid-flowchart.js (subconjunto: nós com label, `-->`/`---`/`-.->`, `subgraph`) com testes de ida (Mermaid → YAML → buildIR sem erros) sobre 10 flowcharts reais coletados de READMEs públicos.
- **"Force zoo": API pública de plugins de força carregados por URL (ESM dinâmico)** (esforço M, novidade alta) — Abrir o motor para terceiros: a config aceita `physics.plugins: [https://…/vortex.js]`, e cada módulo exporta `{ id, factory(opts) => ({ apply(world, ctx) }) }` e, opcionalmente, um field com `defaultEnabled`. Pesquisadores e curiosos publicam forças novas (vórtice, gravidade por camada, campo magnético por tag, atrito anisotrópico que produz Manhattan emergente) sem fork. Uma página "zoo" lista plugins com demo ao vivo. Estender depois aos registries de layout e router. Primeiro passo: Adicionar `registerLayoutAdapter`/`registerRouter` (espelhando registerContributor) e escrever um plugin-exemplo fora do repo (contributor "vortex" de ~30 linhas sobre os offsets X/Y/FX/FY de src/physics/world.js:17-26), carregado por `import()` numa página de teste.
- **Playground público + "explorable explanation" da tese de tensegridade** (esforço M, novidade alta) — Publicar o physics playground no Pages e transformá-lo num artigo interativo no estilo Distill: cada decisão de física (ADR-0010 repulsão só entre corpos, ADR-0011 zona de força linear, ADR-0012 arestas por tendência) é explicada por um cenário vivo e manipulável, com o veredito do experimento (decidido/decisivo/aberto). Os cenários "abertos" viram convites explícitos à comunidade. Primeiro passo: Adicionar 'playground' ao ASSETS de scripts/build-dist.js e um link no header do app. Escrever a primeira seção do artigo, "Por que arestas por força?", embutindo o cenário G2 e o G4 (Manhattan real: dobra × snap × híbrido).
- **Paper/poster: "diagramas como sistemas físicos contínuos", posicionado contra Penrose e Bluefish** (esforço G, novidade alta) — Escrever um paper curto ou pôster (e um post longo derivado) com a contribuição do projeto: diagramas cuja forma é o estado de equilíbrio dinâmico de um sistema físico (corpos, zonas de força, arestas como cadeias de corpos) e que permanecem vivos sob interação. O argumento de avaliação vem do Bench (métricas de vivacidade) e dos traces reproduzíveis. Alvos candidatos, não verificados: pôster UIST/VIS, workshop LIVE (programação ao vivo) ou PLATEAU. Primeiro passo: Redigir um abstract de 2 páginas com related work (Penrose, Bluefish, layouts force-directed clássicos) e uma figura: o mesmo diagrama em v1, v2 e v2+mola, com as métricas do bench.mjs. Pedir leitura crítica a 1 ou 2 pesquisadores de visualização.
- **Storytelling físico: sequências de DSL (ou o histórico git) animadas pela física** (esforço M, novidade alta) — Um modo "apresentação" em que o documento tem passos (`steps:` ou vários YAMLs em ordem), e a transição entre passos é feita pelo próprio motor: nós novos entram e o sistema se reacomoda organicamente em vez de cortar a cena. Variante de alcance viral: `tensegrams history arquitetura.yaml` percorre o `git log` do arquivo e gera um vídeo/SVG animado da evolução da arquitetura, commit a commit. Primeiro passo: Script na pasta de trabalho que aplica 3 versões incrementais do exemplo `intro` (adicionando nós) com seedPositions encadeados entre sessões v2 em headless e concatena os frames num único SVG animado.
- **Diagrama vivo por dados: telemetria dirigindo forças (tensão = tráfego, massa = carga)** (esforço M, novidade alta) — Ligar o diagrama a uma fonte de dados ao vivo (WebSocket/SSE/JSON polling: métricas de Prometheus/OpenTelemetry, filas, CI) e mapear valores para parâmetros físicos. Tráfego numa aresta vira rigidez/tensão (arestas "esticam" ou "vibram"), carga de um nó vira massa ou raio de zona, erro vira repulsão. O diagrama de arquitetura passa a ser literalmente vivo: o layout reage fisicamente ao estado do sistema. Primeiro passo: Adicionar ao patch um caso `{ params: { id, invMass?, zone? } }` num fork da pasta de trabalho e dirigi-lo por um gerador sintético (seno por aresta) no exemplo `containers`, medindo se o sistema permanece estável (sem explosão) sob kicks contínuos.
- **Servidor MCP + ciclo "LLM desenha, motor assenta, métricas voltam"** (esforço M, novidade media) — Um servidor MCP com ferramentas `validate_dsl(yaml)` → diagnósticos com sugestões, `render(yaml, engine)` → SVG + métricas (sobreposições, cruzamentos, ticks até assentar) e `import_mermaid(text)` → YAML. Agentes de código (Claude Code, Cursor, etc.) passam a gerar diagramas de arquitetura em Tensegrams e a iterar com feedback quantitativo, não só visual. O JSON Schema da DSL entra como recurso do servidor. Primeiro passo: Servidor MCP mínimo em Node (SDK oficial), na pasta de trabalho, com uma única ferramenta `validate_dsl` que chama parse+buildIR e devolve `ir.errors`/`ir.warnings`. Testar pedindo a um agente que corrija um YAML com atributo digitado errado (`lable:`).
