# Trilha 1 · Governança e entrega

> Gerado pelo ecossistema de agentes de avaliação em 2026-09-30, sobre o commit `5bb9b8d`. Caminhos em `/tmp/.../scratchpad/eco/` citados abaixo referem-se a harnesses, spikes e protótipos da sessão de avaliação, que **não** foram versionados. Relatório navegável: [Avaliação do Tensegrams](https://claude.ai/code/artifact/363b8c16-cbcc-4469-9857-bd3e95653830).

**Veredito:** 29 de 30 achados sobreviveram (16 confirmados, 13 parciais, 1 refutado). A entrega está sólida: SHA 5bb9b8d publicado, 4/4 runs verdes. A memória do núcleo de pesquisa está quebrada: 0/11 arquivos do motor v2 no Manifest, ADR-0010/0011 contradizem o código e a Fase 4 não tem registro. O audit não detecta nada disso.

Veredito: 29 de 30 achados sobreviveram à refutação (16 confirmados, 13 parciais, 1 refutado). A entrega funciona, mas a memória do núcleo de pesquisa não.

O deploy publicado confere com o HEAD: `version.js?cb=` devolve `5bb9b8d`. Os 4 runs de CI estão verdes. Já o motor físico unificado tem 0 de 11 arquivos em `contracts`, e `feat-memory audit --strict` responde "Nenhum issue encontrado".

### Placar da verificação

| Auditor | Achados (n) | Confirmados (n) | Parciais (n) | Refutados (n) |
|---|---|---|---|---|
| Processo (G1) | 16 | 7 | 8 | 1 |
| Repositório/entrega (G2) | 14 | 9 | 5 | 0 |
| Total | 30 | 16 | 13 | 1 |

Severidade final dos 29 que sobraram: 2 altas, 9 médias, 17 baixas e 1 info. Rebaixei 11 severidades e subi 1.

### Núcleo de pesquisa: memória e decisões

| ID | Achado | Severidade final | Evidência reproduzida |
|---|---|---|---|
| G1-01 | Fase 4 e decisão sobre default v2 perdidas na migração 2.1.0 | alta | `git show 5bb9b8d~1:.feat-memory/STATE.md` tinha `Next`; hoje `UNRELEASED.md:9` só lista ADRs |
| G1-03 | ADR-0010/0011 aceitos contradizem o motor | alta | pad global `src/physics/collision.js:37`; Ki default `:36` e `compile-world.js:42`; atração corpo→corpo `tag-forces.js:23-38` |
| G1-02 | Motor v2 fora do Manifest | média | 0/11 arquivos; 54,5% das LOC de `src/` em contracts (script próprio) |
| G1-06 | Audit cego ao drift | média | reexecutado em clone limpo: 0 issues, rc=0 |
| G1-05 | Fórmula de pesos errada no Manifest e no README | média | `F-0005:60-61`, `README.md:317-321` vs `src/layout/collision.js:13-22` |
| G1-12 | Vereditos do playground só no localStorage | média (subiu) | `physics-playground.html:827-841`: 8 cenários "aberto" |
| G1-09 | ADR-0009 editado no lugar | baixa | `0009:14-29` vs METHODOLOGY:86 |
| G1-10 | Sem inventário de remoção para a Fase 4 | baixa | specs E2E 14/17/18/19 usam `engine: physics`; 19 testes em `tests/routing/physics` |

O commit 113ef70 afirma "colisão capsule×rect no motor unificado". O código só tem o enum `SHAPE.CAPSULE` (`world.js:29`). A colisão é AABB×AABB (`collision.js:2,62-65`).

A F-0002 não descreve um modelo superado, como G1-02 alegava. Ela descreve o v1, que continua default (`live/index.js:50-55`). O v2 também mantém arestas passivas por default (`connectivitySpring: false`, `compile-world.js:54`).

Por isso G1-02 caiu para média. O defeito real é a omissão do opt-in v2.

### Gates, CI e entrega

| ID | Achado | Severidade final | Evidência reproduzida |
|---|---|---|---|
| G1-04 / G2-05 | Gates só por disciplina; CI só em push na main; main sem proteção | média | `deploy-tensegrams.yml:3-7`; API: `"protected": false`, 0 PRs, 4 runs |
| G2-01 | U+2028/U+2029 derrubam o highlight e o boot | média | `highlight()` lança TypeError; `parse()` da mesma DSL dá 0 erros |
| G2-07 | Repositório público sem LICENSE | média | API: `"license": null`, `"visibility": "public"` |
| G2-06 | E2E testa a raiz, não o `dist/`; smoke de produção fora do CI | baixa | `playwright.config.js:31` |
| G2-08 / G2-13 | Permissões de escrita em todos os jobs; e2e leva 4m16s | baixa | `deploy-tensegrams.yml:9-16`; API do run 28257430979 |

G1-04 caiu de alta para média. O deploy já depende de `needs: [test, e2e]` (`deploy-tensegrams.yml:57`). Pular o gate local deixa a main vermelha, mas não quebra o site.

G2-01 caiu de alta para média. O defeito é real e persistente, mas depende de um caractere raro num protótipo. Em Node o `\r` também quebra, só que o textarea o normaliza no navegador.

### Higiene e proporcionalidade

G1-07 (média) foi confirmado. O frontmatter em `AGENTS.md:23-32` aponta para `.agent-memory/`, pasta que não existe.

As skills citam IDs do upstream que colidem com os IDs locais: `memory-debrief:64` cita F-0019 e `memory-bootstrap:68` cita F-0014 e ADR-0017. Achei mais uma colisão: `.feat-memory/.meta.yaml` remete ao "ADR-0013".

G1-13, G1-14, G1-15 e G1-08 (baixa) apontam cerimônia de time sem uso. Houve três migrações de metodologia em 23 dias e há 0 tags. `telemetry_enabled: true` convive com a CLI ausente.

O `merge=ours` do UNRELEASED fica inerte sem driver. Reproduzi o conflito visível num repo de teste.

G2-02, G2-03, G2-04 e G2-09 a G2-12 (baixa) são higiene técnica. São eles: ids sem escape no renderer e cache de 600 s sem versionamento. Há ainda 138 módulos estáticos em profundidade 11 e routing deprecated carregado eager (9 arquivos, 80.282 B).

G2-14 (info) foi confirmado: há 9 `innerHTML` e 8 deles só limpam.

### Correções de fato nos relatórios

| ID | Afirmação do auditor | Fato verificado |
|---|---|---|
| G1-08 | regra em `.gitattributes:233-234` | o arquivo tem 26 linhas; a regra está em `:24` |
| G1-11 | 9 commits num único push | foram 10 commits entre `dff963c` e `5bb9b8d` |
| G1-11 | commit grande viola "lotes de 5" | a regra trata de rodadas de aprovação (`memory-deploy:97,119`) |
| G1-15 | 6 de 10 commits são metadados | são 4 a 5; `f00f0e6` traz o playground de 1.170 linhas |
| G1-10 | `endpoints.*.side` é override de face | é o tamanho numérico (> 0) do BBox (`src/dsl/ir.js:410-417`) |
| G2-04 | tempos até o primeiro nó | só a estrutura do grafo foi reproduzida; os tempos são sintéticos |

O erro sobre `endpoints.*.side` vem do próprio Manifest. `F-0016:53-54` chama o campo de "override de face por aresta". É mais um drift que o audit não detecta.

O README fala em ~72 arquivos de teste e o dossiê em 83. `find tests -name '*.test.js'` retorna 78.

### O achado refutado

G1-16 dizia que o ADR-0013 "já é violado na prática" via `session.routedEdges`. Nenhum adapter fornece rotas: os três declaram `providesRouting: false` (`src/layout/registry.js:14-16`).

O live define `routedEdges: undefined` (`live/index.js:179`). O contrato já prevê o campo (`src/layout/adapter.js:19,34`). A tensão com a Fase 4 existe, mas é uma previsão, não uma violação.

## Recomendações priorizadas

| # | Recomendação | Impacto | Esforço | Por quê |
|---|---|---|---|---|
| 1 | Registrar a Fase 4 agora: F-0021 planned, ADR-0014 proposed e entrada no UNRELEASED com o próximo passo e a decisão pendente sobre o default v2 | alto | P | G1-01 (alta): hoje a retomada carrega 5 ADRs e nenhuma feature, e o plano citado em compile-world.js:19-20 não existe. É o que METHODOLOGY:18,144 manda fazer. O ADR-0014 também absorve o inventário de remoção (G1-10) e usa o slot providesRouting/routedEdges que já existe (adapter.js:19,34). |
| 2 | Reconciliar ADR-0010/0011 com o motor: um ADR novo que os supere (PI no default, pad global, attractTo como exceção) ou divergência declarada como escopo da Fase 4 | alto | M | G1-03 (alta): três fontes divergem (ADR, código e playground C3 'aberto'), e o commit de reconciliação 113ef70 afirmou uma colisão cápsula que não existe. A Fase 4 seria construída sobre premissas falsas. |
| 3 | Criar tests/governance/manifest.test.js no job unit: paths e símbolos '::' dos contracts, reciprocidade ADR↔feature e todo src/**/*.js num contract ou numa allowlist | alto | P | G1-06: o audit 2.1.0 deu 0 issues num clone limpo, apesar de runPipeline inexistente, 0/11 arquivos do motor e 54,5% de cobertura por LOC. O teste custa ~80 linhas com o yaml já instalado e pega G1-02 e G1-05 mecanicamente. |
| 4 | Criar F-0020 physics-engine-v2 e corrigir o drift do Manifest: F-0002 (v1/v2), fórmula de pesos na F-0005 e no README, símbolo da F-0001, 'override de face' da F-0016 | medio | P | G1-02 e G1-05 confirmados. O README documenta a semântica de pesos errada para o usuário da DSL (0,25 vs 0,00 no par (0,5; 0)). |
| 5 | CI em qualquer branch e em PR, deploy só com `if: github.ref == 'refs/heads/main'`, branch protection exigindo test/e2e e job pós-deploy com curl de version.js e e2e-prod | medio | M | G1-04/G2-05/G2-06: os gates e a lição 5 são manuais. Com isso, o C1 vira 'merge só via PR verde' e deixa de exigir E2E local em toda branch de sessão. |
| 6 | Versionar os vereditos do playground (verdicts.json exportável) e abrir os 8 cenários 'aberto' como ADRs proposed curtos ou entradas no suggestions.md | medio | P | G1-12 (subiu para média): a ambição declarada é pesquisa, e os vereditos que decidem a Fase 4 vivem só no localStorage de um navegador. |
| 7 | Corrigir o yaml-highlight para U+2028/U+2029 (flag s ou split por terminadores Unicode), envolver refreshOverlay em try/catch e adicionar teste | medio | P | G2-01: uma DSL válida deixa o app em branco de forma persistente após import ou reload. A correção é de uma linha. |
| 8 | Limpar o frontmatter do AGENTS.md (.agent-memory → .feat-memory), expor as skills em .claude/skills e registrar a migração num ADR que supere o ADR-0001 | medio | P | G1-07: referências mortas e IDs do upstream que colidem (F-0014, F-0019, ADR-0013, ADR-0017, ADR-0023) induzem o agente ao erro na retomada. |
| 9 | Adicionar LICENSE e o campo license no package.json | medio | P | G2-07: repositório público sem licença equivale a 'todos os direitos reservados', o que bloqueia fork e reuso experimental. |
| 10 | Enxugar a cerimônia: desligar a telemetria, declarar 'release = SHA do deploy', tirar merge=ours do UNRELEASED e congelar a versão da metodologia até a Fase 4 | baixo | P | G1-08/G1-13/G1-15: três migrações em 23 dias, 0 tags e telemetria ligada sem CLI instalada. O esforço liberado vai para os itens 1, 2 e 6. |
| 11 | Endurecer o workflow: permissões por job, dependabot para actions e npm, concurrency só no deploy e timeout-minutes | baixo | P | G2-08/G2-13: pages:write e id-token:write valem para os jobs que rodam npm ci, e um push espera o pipeline inteiro do anterior. |
| 12 | Escapar ids no renderer (Map id→el ou CSS.escape; ids de máscara derivados e entre aspas) e carregar src/routing/physics por import dinâmico | baixo | P | G2-02/G2-09: máscara perdida com id contendo espaço, leak de <g> com '\\' e 80 KB de código deprecated em toda visita. |

### ADRs candidatas desta trilha

- **ADR-0014 (proposed) · Routing de arestas no motor físico unificado (Fase 4)** (confiança alta; supersede ADR-0009 (na entrega)). Arestas como cadeias de corners 2-DOF no World do v2, com cápsulas derivadas. O adapter unificado declara `providesRouting: true` e preenche `session.routedEdges` (contrato já existente em src/layout/adapter.js:19,34). Critérios de remoção de src/routing/physics: specs 14/17/18/19 migradas, `endpoints.*.side` portado ou removido com warning de DSL, stub `astar` apagado. O default v2 é decidido junto, com critério explícito de calibração.
- **Modelo de força vigente do motor v2: PI no default, pad global, atração por tag como exceção** (confiança media; supersede ADR-0010, ADR-0011 (parcial)). O mantenedor escolhe o lado. Se o código for o alvo, este ADR supera parcialmente 0010/0011 e declara PI no default, pad global até o motor ter zonas por elemento e `attractTo` como acoplamento declarado. Se os ADRs forem o alvo, a divergência vira escopo explícito da Fase 4 no ADR-0014.
- **Adoção do feat-memory 2.1.0 com escopo reduzido para projeto solo de pesquisa** (confiança media; supersede ADR-0001). Registrar a migração para o 2.1.0. Release = SHA do deploy, sem tags. Telemetria desligada, merge=ours só nos INDEX gerados e versão da metodologia congelada até o fim da Fase 4.

### Sugestões de evolução do processo desta trilha

- `governance-manifest-test` (heuristic-fix) → tests/governance/manifest.test.js no job unit; upstream: métrica de cobertura por LOC de src e checagem de símbolos '::' no audit: O feat-memory audit 2.1.0 deu 0 issues com um símbolo de contrato inexistente, 0/11 arquivos do motor e 54,5% de cobertura por LOC. A métrica dele só verifica se o arquivo de teste existe.
- `rule-evidence-in-commit-claims` (new-rule) → AGENTS.md: afirmações 'confirmado em código' em commit ou ADR exigem caminho:linha: O commit 113ef70 afirmou 'confirmado em código: colisão capsule×rect', e só existe o enum SHAPE.CAPSULE.
- `rule-planned-before-code` (new-rule) → AGENTS.md + skill memory-debrief: diretório novo em src/ exige feature planned/in_progress no mesmo commit: As Fases 1-3 (1.645 linhas em src/physics e compile-world) entraram sem feature planned nem ADR proposed, e o plano ficou fora do repo.
- `skill-experiment-log` (new-skill) → skills/experiment-log + botão de export de verdicts.json no playground: Os vereditos do playground ficam no localStorage, 8 cenários estão 'aberto' e o ADR-0011 diz 'medido' sem números.
- `skills-id-namespace` (refactor-skill) → skills/*/SKILL.md e .meta.yaml: prefixar IDs do upstream (FM-ADR-NNNN): Skills e .meta.yaml citam IDs do repo upstream que colidem com os locais: F-0014, F-0019, ADR-0013, ADR-0017, ADR-0023.
- `agents-frontmatter-stale-refs` (doc-gap) → AGENTS.md frontmatter (references e budgets): AGENTS.md:23-32 aponta para .agent-memory/, agent-memory v0.13.0 e state_max_bytes, que não existem mais.
- `expose-skills-to-claude` (refactor-skill) → feat-memory deploy: symlink/cópia para .claude/skills ou remover `skills:` do agente: O agente .claude/agents/memory-debrief.md pré-carrega uma skill que não está em .claude/skills, e nenhuma memory-* aparece nas skills da sessão.
- `adr-template-consequencias` (doc-gap) → skills memory-deploy e memory-debrief (template único): memory-deploy:105 exige a seção Consequências, e memory-debrief:168 a proíbe. Os ADRs do projeto misturam os dois formatos.
- `ci-gate-per-branch` (new-rule) → AGENTS.md C1: 'merge na main só via PR com test/e2e verdes' + workflow ci.yml por branch/PR: O C1 exige E2E local nos dois projetos antes de todo push, mas o CI só roda na main e a sessão de nuvem não tem browsers Playwright.
- `deploy-verify-job` (heuristic-fix) → .github/workflows: job verify pós-deploy com polling do SHA + playwright.config.prod.js: A lição 5 (curl de version.js com cache-buster) é manual, e o e2e-prod existe mas não roda no CI.
- `merge-ours-unreleased` (heuristic-fix) → .gitattributes: tirar o UNRELEASED.md; upstream feat-memory: configurar o driver no deploy ou abandoná-lo: Sem driver, o merge=ours fica inerte e gera conflito. Com driver, descarta em silêncio as entradas de outra branch (reproduzido).
- `adr-in-place-edit-guard` (heuristic-fix) → tests/governance: git diff de corpo em ADR accepted só com superseded_by/status: O ADR-0009 foi editado no lugar após accepted (113ef70), contra METHODOLOGY:86. O teste de governança pode detectar diff no corpo de ADR accepted.

### Fontes

- /home/user/tensegrams/.feat-memory/changelog/UNRELEASED.md
- /home/user/tensegrams/.feat-memory/manifest/INDEX.md
- /home/user/tensegrams/.feat-memory/manifest/features/F-0001-dsl-to-diagram.md
- /home/user/tensegrams/.feat-memory/manifest/features/F-0002-layout-adapters.md
- /home/user/tensegrams/.feat-memory/manifest/features/F-0003-edge-routers.md
- /home/user/tensegrams/.feat-memory/manifest/features/F-0005-collision-layers.md
- /home/user/tensegrams/.feat-memory/manifest/features/F-0016-edge-endpoint-styles.md
- /home/user/tensegrams/.feat-memory/manifest/features/F-0017-physics-routing.md
- /home/user/tensegrams/.feat-memory/decisions/0009-physics-routing-opt-in.md
- /home/user/tensegrams/.feat-memory/decisions/0010-repulsion-bodies-attraction-attractors.md
- /home/user/tensegrams/.feat-memory/decisions/0011-force-zone-linear-zone-x-zone.md
- /home/user/tensegrams/.feat-memory/decisions/0012-edges-driven-by-force-tendencies.md
- /home/user/tensegrams/.feat-memory/decisions/0013-plugin-architecture-layout-routing.md
- /home/user/tensegrams/.feat-memory/.meta.yaml
- /home/user/tensegrams/.feat-memory/suggestions.md
- /home/user/tensegrams/.gitattributes
- /home/user/tensegrams/AGENTS.md
- /home/user/tensegrams/.claude/agents/memory-debrief.md
- /home/user/tensegrams/skills/memory-debrief/SKILL.md
- /home/user/tensegrams/skills/memory-bootstrap/SKILL.md
- /home/user/tensegrams/skills/memory-deploy/SKILL.md
- /home/user/tensegrams/skills/memory-pull-brief/SKILL.md
- /home/user/tensegrams/.github/workflows/deploy-tensegrams.yml
- /home/user/tensegrams/playwright.config.js
- /home/user/tensegrams/scripts/build-dist.js
- /home/user/tensegrams/src/physics/collision.js
- /home/user/tensegrams/src/physics/world.js
- /home/user/tensegrams/src/physics/contributors/tag-forces.js
- /home/user/tensegrams/src/layout/compile-world.js
- /home/user/tensegrams/src/layout/adapters/live/index.js
- /home/user/tensegrams/src/layout/adapter.js
- /home/user/tensegrams/src/layout/registry.js
- /home/user/tensegrams/src/layout/collision.js
- /home/user/tensegrams/src/app/pipeline.js
- /home/user/tensegrams/src/app/boot.js
- /home/user/tensegrams/src/editor.js
- /home/user/tensegrams/src/controls/yaml-highlight.js
- /home/user/tensegrams/src/renderer/ensure-el.js
- /home/user/tensegrams/src/renderer/edges.js
- /home/user/tensegrams/src/dsl/ir.js
- /home/user/tensegrams/src/routing/physics/forces-endpoint-bbox.js
- /home/user/tensegrams/src/routing/snap-resolver.js
- /home/user/tensegrams/playground/physics-playground.html
- /home/user/tensegrams/README.md
- /home/user/tensegrams/e2e/17-debug-export.spec.js
- https://raw.githubusercontent.com/brunoleos/feat-memory/v2.1.0/METHODOLOGY.md
- https://brunoleos.github.io/tensegrams/src/version.js?cb=<ts>
- https://api.github.com/repos/brunoleos/tensegrams/branches/main
- https://api.github.com/repos/brunoleos/tensegrams/pulls?state=all
- https://api.github.com/repos/brunoleos/tensegrams/actions/runs
- https://api.github.com/repos/brunoleos/tensegrams/actions/runs/28257430979/jobs
- https://api.github.com/repos/brunoleos/tensegrams
- https://brunoleos.github.io/feat-memory/
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/verif/cov.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/verif/bfs.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/verif/u2028.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/verif/u2028b.mjs
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/verif/mt
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/verif/rc2
- /tmp/claude-0/-home-user-tensegrams/efc24348-7db3-5c00-a502-3172f6e24dbc/scratchpad/eco/governanca/browser-probe.txt

## Apêndice A · Achados do auditor de processo e memória

Auditoria de governança (processo e memória) do Tensegrams, com verificação contra código, git, CI e a própria CLI feat-memory 2.1.0 (instalada num venv na minha pasta e rodada sobre um clone do repo).

Veredito: a parte de deploy funciona bem. O SHA publicado bate com o HEAD, os 4 runs de CI estão verdes e a cadeia test→e2e→deploy está correta. O resto da governança é declarativo e está mais desatualizado justamente onde mais importa, no núcleo de pesquisa (motor físico, Fase 4):

1. **Rigor e retomada.** Na migração para a 2.1.0 (5bb9b8d), o `Next` do STATE sumiu: a Fase 4 e a decisão pendente sobre o default v2. O UNRELEASED ficou com só uma linha. O motor unificado tem 0 de 11 arquivos no Manifest. A F-0002 ainda descreve o modelo que foi superado (arestas passivas). Os ADRs 0010/0011 contradizem o motor já implementado: PI no default, pad global, atração corpo→corpo por tag. O commit de "reconciliação" (113ef70) afirma no texto uma colisão cápsula×retângulo que não existe no código.
2. **Gates.** Os gates do AGENTS.md dependem só de disciplina. Não há hook versionado nem `.claude/settings`, a `main` não é protegida, há 0 PRs e o CI só roda depois do push na `main`. Nesta sessão de nuvem não há CLI feat-memory nem browsers do Playwright. Detalhe positivo: o CI roda sim os dois projetos Playwright.
3. **O audit não pega esses problemas.** `feat-memory audit --strict` responde "Nenhum issue encontrado" apesar de tudo isso. A métrica de cobertura dele é "feature com arquivo de teste existente", então o "cobertura 100%" do commit 113ef70 é enganoso.
4. **Proporcionalidade.** Sobra cerimônia de time multi-dev: release/tags nunca usados, telemetria, `merge=ours`, pull-brief e três migrações de metodologia em 23 dias. Desde a adoção, 6 de 10 commits são só metadados. Falta rigor científico: ADR↔código, registro dos experimentos do playground (vereditos ficam no localStorage), plano da Fase 4 como ADR proposto e feature planejada, e gates automáticos no CI.

Recomendação central, em poucas mudanças baratas:
- Fazer o CI rodar em qualquer branch e em PR, proteger a `main` e fazer o deploy só a partir dela.
- Criar um teste node de governança (~80 linhas, zero dependências novas) que substitui o audit onde ele é cego.
- Criar F-0020/F-0021 e um ADR-0014 proposto para a Fase 4.
- Reconciliar ADR-0010/0011/0009 com o código.
- Cortar release, telemetria e merge=ours.

#### G1-01 · Contexto da Fase 4 e decisão pendente (default v2) perdidos na migração 2.1.0; plano referenciado no código não existe (alta, esforço M)

- **Evidência:** `git show 5bb9b8d~1:.feat-memory/STATE.md` tinha `Next: Fase 4 ... Decisão pendente: flipar o default de layout para v2 junto com a virada`. Hoje .feat-memory/changelog/UNRELEASED.md:9 diz apenas `- Foco herdado do STATE: ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013`, sem feature e sem próximo passo. A decisão de não flipar o v2 só existe na mensagem do commit 113ef70. Não há feature `planned`/`in_progress` (manifest/INDEX.md: 18 shipped + 1 deprecated). src/layout/compile-world.js:19 remete a `ver plano (D-massa / D-PI)` e src/physics/*.js cita `princípios #1..#7` de um brainstorm; `git log --all -S 'D-massa'` só acha o commit que adicionou a referência (992e5ca), ou seja, o plano nunca foi versionado. METHODOLOGY v2.1.0:18 e :144 (ADR-0041) mandam justamente criar feature `planned` + ADR `proposed` para a retomada não depender de plano efêmero.
- **Detalhe:** Uma sessão nova que siga o AGENTS.md carrega 5 ADRs e nenhuma feature, e não fica sabendo que a Fase 4 é o próximo passo. O próprio dossiê precisou reconstruir isso pelo git.
- **Recomendação:** Criar agora: F-0021 unified-edge-routing (status planned), ADR-0014 proposed (design da Fase 4: arestas como corpos, contrato com o router e `session.routedEdges`, critérios de remoção de src/routing/physics) e uma entrada no UNRELEASED citando F-0020/F-0021/ADR-0012/ADR-0014, com a decisão pendente sobre o default v2 explícita. Substituir `ver plano (D-massa/D-PI)` e os `#1..#7` por referência a ADR ou remover.
- **Verificação cética:** confirmado (severidade corrigida: alta) — Reproduzido. `git show 5bb9b8d~1:.feat-memory/STATE.md` tem `Next: Fase 4 ... Decisão pendente: flipar o default de layout para v2`. Hoje `.feat-memory/changelog/UNRELEASED.md:9` traz só `Foco herdado do STATE: ADR-0009..0013`. O manifest/INDEX.md tem 18 shipped + 1 deprecated, nenhuma feature planned. `git log --all -S 'D-massa'` só acha 992e5ca. `src/layout/compile-world.js:19-20` cita `ver plano (D-massa / D-PI)`, e os `#1..#7` aparecem em src/physics/*.js:1. A cópia da METHODOLOGY é idêntica à de raw.githubusercontent v2.1.0 (diff vazio), e as linhas 18 e 144 exigem feature planned + ADR proposed.

#### G1-02 · Motor físico unificado (Fases 1-3) invisível no Manifest; F-0002 descreve o modelo superado (alta, esforço P)

- **Evidência:** Cobertura por `contracts` (scripts/coverage-contracts.mjs): src/physics 0/10 arquivos (706 LOC), compile-world.js ausente, 0 de 11 arquivos do motor unificado; tests/physics/* e tests/layout/compile-world.test.js não são citados em nenhuma feature. Grep em .feat-memory por `compile-world|live.engine|connectivitySpring` só acha menções em prosa. F-0002:38-41 (A4: `compartilha o modelo de força base (atrator central + separação só por collision layers)`) e F-0002:64 (`arestas são passivas`) repetem o modelo do ADR-0005 (superado), embora a F-0002 cite ADR-0010. O código tem a flag v2 (src/layout/adapters/live/index.js:52) e a mola de conectividade opt-in (compile-world.js:54). Os commits bab6b3f/992e5ca/2a8c80d/3b8692e não tocaram .feat-memory, apesar de a metodologia estar adotada desde 89a85d6 (06-03).
- **Detalhe:** As features de UI amostradas estão corretas (F-0008 LOD 0.4/0.18 em renderer/index.js:9-10; F-0009 frozen/flow; F-0012 applyUI; F-0013 chaves de storage; F-0014 setas no teclado). O drift se concentra no núcleo de pesquisa.
- **Recomendação:** Criar F-0020 physics-engine-v2 (status in_progress, critérios `optional` para `live.engine: v2` e `live.connectivitySpring`, contracts em src/physics/* e compile-world.js e testes correspondentes). Reescrever A4 e Limites da F-0002 para descrever v1 e v2.
- **Verificação cética:** parcial (severidade corrigida: media) — A omissão é real: meu script independente (verif/cov.mjs) dá 0/11 arquivos do motor em contracts, 54,5% das LOC de src cobertas e 42/97 testes não citados. Os 4 commits das Fases 1-3 não tocam .feat-memory nem .agent-memory. Mas a F-0002 não descreve um modelo superado: descreve o v1, que continua default (`src/layout/adapters/live/index.js:50-55`, `compile-world.js:37` engine 'v1'). Arestas também seguem passivas por default no v2 (`connectivitySpring: false`, compile-world.js:54). O defeito é omitir o opt-in v2, não descrevê-lo errado.

#### G1-03 · ADR-0010/0011 (accepted) contradizem o motor já implementado; a 'reconciliação' afirmou algo falso (alta, esforço M)

- **Evidência:** ADR-0011:23-24 pede pad por elemento, mas src/physics/collision.js:37 usa `pad` global único. ADR-0011:33-35 diz que o termo integral fica fora do default, mas collision.js:36,80 tem `Ki=0.05` e `f = Kp*pen + Ki*acc` por default, e compile-world.js:42 usa `collisionKi: 0.04`. ADR-0010:24-31 diz que corpos só se repelem e que toda atração vem de atratores, mas src/physics/contributors/tag-forces.js:23-38 implementa `attractTo` como atração corpo→corpo, ligada no v2 (compile-world.js:15). O playground marca C3 (PI no contato) como `aberto` (playground/physics-playground.html:830), de modo que as três fontes divergem entre si. O commit 113ef70 diz `Confirmado em código: ... colisão capsule×rect no motor unificado`, mas só existe o enum `SHAPE.CAPSULE` (src/physics/world.js:29), e a colisão é AABB×AABB (collision.js:2,62-65). Os ADRs 0010/0011 datam de 06-10, e o código que eles contradizem é de 06-06.
- **Detalhe:** É o achado mais importante para a pesquisa: a Fase 4 vai ser construída em cima de um motor cujas premissas registradas não batem com o que foi implementado.
- **Recomendação:** Decidir, com o mantenedor, qual lado é o alvo. Se o código estiver certo, superar os ADRs com um novo ADR (PI default, pad global, `attractTo` como exceção declarada). Se os ADRs estiverem certos, abrir essas divergências como escopo explícito da Fase 4 dentro do ADR-0014 proposto. Regra nova no AGENTS.md: afirmação do tipo 'confirmado em código' num commit exige caminho:linha.
- **Verificação cética:** confirmado (severidade corrigida: alta) — ADR-0011:23-24 pede pad por elemento, e `src/physics/collision.js:37` tem um `pad` único. ADR-0011:33-35 deixa o integral fora do default, mas `collision.js:36,80` usa Ki=0.05 e `compile-world.js:42` usa collisionKi 0.04. ADR-0010:24-26 diz que toda atração vem de atratores, e `tag-forces.js:23-38` faz atração corpo→corpo, ligada em compile-world.js:130. O escape de ADR-0010:29-31 cobre em tese, mas `attractTo` é campo global por tag. A mensagem de 113ef70 afirma `colisão capsule×rect no motor unificado`, mas só existe o enum `SHAPE.CAPSULE` (world.js:29) e a colisão é AABB×AABB (collision.js:2,62-65). Playground: C3 `aberto` (physics-playground.html:830).

#### G1-04 · Gates do AGENTS.md (unit+E2E, code review, deploy) dependem só de disciplina; nenhum é bloqueio automático antes do push (alta, esforço M)

- **Evidência:** Não há hooks: .git/hooks só tem *.sample, não existe .githooks/, não há core.hooksPath (`git config --list --local`) nem .claude/settings*.json no repo. A `main` não é protegida (GitHub list_branches: `protected:false`) e o repo tem 0 PRs (list_pull_requests state=all → []). O CI dispara só em `push: branches: [main]` e workflow_dispatch (deploy-tensegrams.yml:3-7), então funciona como gate de deploy depois do push, não de push. O feat-memory audit não roda no CI. O hook de pre-commit da CLI pula a auditoria se `feat-memory` não estiver no PATH (pre-commit instalado: `AVISO: 'feat-memory' não encontrado no PATH; pulando auditoria` e return 0); nesta sessão de nuvem a CLI não está instalada (`command -v feat-memory` → rc=1), nem há browsers Playwright (~/.cache/ms-playwright não existe) ou SessionStart hook. O Stop hook do ambiente (~/.claude/stop-hook-git-check.sh) cobra `Please push these changes` e empurra o agente contra o gate. Ponto positivo: o CI roda os DOIS projetos (`npx playwright test` sem `--project`, playwright.config.js:19-28; o nome do passo 'Run Chromium E2E' engana). Porém `retries: 1` no CI (playwright.config.js:9) mascara flakiness, e não consegui ler os logs do último run (get_job_logs → 410 Gone), então a contagem de testes executados não foi verificada.
- **Detalhe:** Deploy verificado agora: `curl .../src/version.js?cb=…` → `5bb9b8d` = `git rev-parse --short HEAD`. Runs de CI: 4, todos success.
- **Recomendação:** Automatizar em vez de exigir: (1) CI de test+e2e em `push: branches: ['**']` + `pull_request`, com deploy só se `github.ref == 'refs/heads/main'`; (2) branch protection na `main` exigindo test e e2e, com o agente trabalhando em claude/* e abrindo PR; (3) code review via /code-review no PR; (4) job pós-deploy que faz curl do version.js com cache-buster e roda o smoke e2e-prod (automatiza a lição 5); (5) reporter que publique retries/flaky; (6) SessionStart hook que instale o Chromium do Playwright. Com isso o C1 vira 'merge na main só via PR verde' e deixa de valer para push em branch de sessão.
- **Verificação cética:** parcial (severidade corrigida: media) — Fatos confirmados: .git/hooks só tem *.sample, não há core.hooksPath nem .claude/settings versionado. A API do GitHub dá `"protected": false`, 0 PRs e 4 runs, todos na main. O workflow roda só em push na main (:3-7). `command -v feat-memory` retorna rc=1 e ~/.cache/ms-playwright não existe. O stop hook pede push (stop-hook-git-check.sh:119). Mas a severidade está inflada: o deploy já exige `needs: [test, e2e]` (workflow:57), e o CI roda os dois projetos (playwright.config.js:20-29). Pular o gate local deixa a main vermelha, sem site quebrado. `retries` está em playwright.config.js:10, não :9.

#### G1-05 · Manifest e README documentam a fórmula errada de divisão por pesos de colisão; símbolo de contrato inexistente (media, esforço P)

- **Evidência:** F-0005:32-33,60-61 e README.md:317-321 dizem `fracX = pesoY/(pesoX+pesoY)`. O código usa diferença linear, `fracX = 0.5 - (wX-wY)/2` (src/layout/collision.js:13-22,63-68), e o teste confirma o código (tests/layout/collision.test.js:99-107, fracs 0.25/0.75). Script scripts/frac.mjs: pesos (0.5, 0) → código 0.250 vs documentação 0.000; (1, 0.5) → 0.250 vs 0.333. F-0001 aponta o contrato `src/app/pipeline.js::runPipeline`, mas o símbolo não existe; o export real é `createPipeline` (pipeline.js:31).
- **Detalhe:** A gênese retroativa (89a85d6) copiou prosa do README sem triangular com o código, contrariando o próprio princípio de 'Triangulação' da skill memory-deploy.
- **Recomendação:** Corrigir F-0005 A2, o corpo da F-0005 e o README. Corrigir o símbolo da F-0001. Coberto de forma mecânica pelo teste de governança do G1-06.
- **Verificação cética:** confirmado (severidade corrigida: media) — F-0005:60-61 e README.md:317-321 dizem `fracX = pesoY/(pesoX+pesoY)`, mas o código faz `0.5 - diff/2` (src/layout/collision.js:13-22 e computeSplit :58-63). tests/layout/collision.test.js:99-107 confirma o código (0.25/0.75). F-0001:10 aponta `src/app/pipeline.js::runPipeline`, e o único export é `createPipeline` (pipeline.js:31); grep por runPipeline em src dá vazio.

#### G1-06 · feat-memory audit fica verde apesar dos drifts; a métrica de 'cobertura' é fraca (media, esforço P)

- **Evidência:** `feat-memory audit --strict --no-index` (CLI 2.1.0, clone em repo-copy) → schema 1.00, cobertura 100%, drift 0, `Nenhum issue encontrado` (audit-strict.out), mesmo com G1-01..G1-05 e com o frontmatter do AGENTS.md apontando para `.agent-memory/`. Frescor de estado: `—` (não há mais STATE para medir). METHODOLOGY v2.1.0:160 define cobertura como 'features cujo contracts.tests aponta para arquivos que existem', não como cobertura do código pelas features. Pelos contracts, só 54,5% das LOC de src/ estão em alguma feature (coverage-contracts.out); o '97%' só sai se contarmos menções em prosa.
- **Recomendação:** Adicionar tests/governance/manifest.test.js (node, usando o `yaml` já presente), rodado no job unit do CI: todo path de contracts existe; todo `::símbolo` existe; decisions↔affects_features recíprocos (exceto superseded); todo src/**/*.js pertence a algum contracts ou a uma allowlist explícita (shapes, main, version). Base pronta em scripts/check-contracts.mjs e scripts/coverage-contracts.mjs.
- **Verificação cética:** confirmado (severidade corrigida: media) — Reexecutei `feat-memory audit --strict --no-index` (CLI 2.1.0) num clone limpo (verif/rc2): schema 1.00, cobertura 100%, drift 0, `Nenhum issue encontrado`, rc=0. Isso com o símbolo quebrado `::runPipeline` e o frontmatter apontando para `.agent-memory/`. METHODOLOGY:160 define cobertura como existência de arquivo de teste.

#### G1-07 · Skills, agente e metodologia incoerentes entre si e com o projeto (media, esforço P)

- **Evidência:** (a) .claude/agents/memory-debrief.md:9-10 pré-carrega a skill `memory-debrief`, mas as skills estão em skills/ na raiz, não em .claude/skills/ (não existe). A lista de skills disponíveis nesta sessão não tem nenhuma memory-*. (b) As skills citam IDs internos do repo feat-memory que colidem com os do projeto: memory-debrief cita `ADR-0023, F-0019` (aqui F-0019 é mobile-layout) e memory-bootstrap:69 cita `F-0014, ADR-0017` (aqui F-0014 é splitter e ADR-0017 não existe), enquanto bootstrap:74 manda 'Não invente IDs que não estão nos índices'. (c) memory-deploy (Fase 3.3) exige quatro seções, incluindo Consequências; memory-debrief:168 diz 'Sem seção Consequências separada'. Os ADRs do projeto misturam os dois formatos. (d) AGENTS.md aponta para METHODOLOGY v2.1.0, que ainda descreve STATE.md (METHODOLOGY:13,74-82,140,146), enquanto a skill diz 'não há mais STATE.md' (memory-debrief:44); a CLI 2.1.0 ainda tem `check-staleness-staged` baseado em STATE. (e) O frontmatter do AGENTS.md:23-32 referencia `./.agent-memory/STATE.md`, `.agent-memory/manifest/INDEX.md`, a metodologia agent-memory v0.13.0 e `state_max_bytes`, e o diretório .agent-memory não existe.
- **Recomendação:** Corrigir o frontmatter do AGENTS.md (C/P). Expor as skills em .claude/skills (symlink ou cópia no deploy) ou tirar o `skills:` do agente. No upstream feat-memory: prefixar IDs próprios (FM-ADR-0043) e alinhar METHODOLOGY/CLI à 2.1.0. Registrar a migração de metodologia num ADR que supere o ADR-0001 (que ainda descreve .agent-memory/STATE).
- **Verificação cética:** confirmado (severidade corrigida: media) — AGENTS.md:23-32 referencia ./.agent-memory/*, agent-memory v0.13.0 e state_max_bytes, e `.agent-memory` não existe. `.claude/agents/memory-debrief.md:9-10` pré-carrega a skill, mas não existe .claude/skills (as skills estão em skills/). memory-debrief:64 cita ADR-0023/F-0019, memory-bootstrap:68 cita F-0014/ADR-0017 e bootstrap:74 diz para não inventar IDs. memory-deploy:105 exige a seção Consequências, que memory-debrief:168 proíbe. METHODOLOGY:13,74,140,146 ainda falam de STATE, e debrief:44 diz que ele não existe mais. A CLI 2.1.0 ainda lista `check-staleness-staged`. Achei outra colisão: `.feat-memory/.meta.yaml` diz 'Schema documentado em ADR-0013', e o ADR-0013 local é a arquitetura de plugins.

#### G1-08 · merge=ours no UNRELEASED/índices: inerte neste clone e, onde funciona, descarta trabalho em voo (media, esforço P)

- **Evidência:** `git config --list --local` não mostra `merge.ours.driver`. Teste empírico (mergetest/): com `U.md merge=ours` e sem o driver configurado, o merge dá `CONFLICT (content)` normal. Onde o driver está configurado, o .gitattributes:233-234 descarta silenciosamente as entradas do UNRELEASED vindas de outra branch; a skill memory-pull-brief:53 assume esse descarte ('Ignore changelog/UNRELEASED.md'). Com agentes trabalhando em branches claude/*, o comportamento depende do clone.
- **Recomendação:** Para 1 mantenedor: remover `merge=ours` do UNRELEASED (conflito visível é melhor que perda silenciosa) e manter só nos INDEX gerados, com o driver configurado no SessionStart hook ou regenerado pelo teste de governança.
- **Verificação cética:** parcial (severidade corrigida: baixa) — O mecanismo foi reproduzido em repo de teste (verif/mt). Sem driver há CONFLICT visível. Com `merge.ours.driver true` a entrada da outra branch some em silêncio. `git config` local e global não definem o driver. A citação de linha está errada: .gitattributes tem 26 linhas e a regra do UNRELEASED está em :24, não :233-234. O risco depende de o driver estar configurado, o que não acontece aqui. Com 1 mantenedor, o impacto é baixo.

#### G1-09 · ADR-0009 editado no lugar e 'meio-válido'; referências a F-0017 e ADR-0012 desalinhadas (media, esforço P)

- **Evidência:** ADR-0009:14-29 traz uma 'Atualização' que revoga o enquadramento, mas o corpo continua dizendo 'O roteador algébrico permanece o default' (:42-43) e 'intenção de tornar o solver físico o padrão' (:53-57). O título mudou e o slug do arquivo (`physics-routing-opt-in`) não. METHODOLOGY:86 ('Decisões nunca são editadas após accepted') e :96 (supersede parcial via split, que o mesmo commit 113ef70 aplicou ao ADR-0005) foram ignorados para o 0009. ADR-0012 tem `affects_features: [F-0017]`, justamente a feature que ele vai eliminar, e nenhuma feature para o que ele de fato decide. F-0003:57-58, F-0017 A4 e README.md:334 ainda dizem 'algébrico permanece o default' sem mencionar a depreciação. Verificado: pipeline.js:187 usa `|| 'algebraic'` como fallback e pipeline.js:193-199 emite `console.warn` de depreciação uma vez (flag de módulo em :29); não há teste desse aviso (grep por DEPRECATED em tests/ → nada).
- **Recomendação:** Restaurar o ADR-0009 original com `superseded_by` e criar um ADR novo ('engines co-iguais; físico anterior deprecated'). Apontar `affects_features` do ADR-0012 para a F-0021 planejada. Alinhar F-0003, F-0017 e README.
- **Verificação cética:** parcial (severidade corrigida: baixa) — A edição no lugar é real: 113ef70 somou 23 linhas ao ADR-0009, contra METHODOLOGY:86. O corpo ainda diz 'algébrico permanece o default' (:42-43), e o ADR-0012 tem affects_features [F-0017]. Mas a edição é transparente, com banner em :14-29 que avisa que o texto original vem abaixo. 'Algébrico permanece o default' também é verdade no comportamento (pipeline.js:187 `|| 'algebraic'`). F-0003:57-58 e F-0017 A4 não mentem sobre o comportamento, só omitem a depreciação. Não há teste do console.warn (grep em tests/e2e vazio).

#### G1-10 · Depreciação de F-0017 sem inventário de remoção: a Fase 4 vai quebrar features e testes shipped (media, esforço P)

- **Evidência:** e2e/17-debug-export.spec.js:11,27 (F-0018, shipped) depende de `engine: physics`. O override de face `endpoints.*.side` da DSL (F-0016:52-54; parse em src/dsl/ir.js:372, attr-set.js:80-83) só é consumido por src/routing/physics/forces-endpoint-bbox.js:28. src/routing/snap-resolver.js:63-70 tem um stub `astar` 'até 5.6 plugar A*', numeração do plano antigo. Custo corrente: 19 arquivos de teste unit em tests/routing/physics e 4 specs E2E (14, 17, 18, 19) do engine deprecated rodando em todo CI.
- **Recomendação:** No ADR-0014 proposto (ou na F-0017), listar o que sai, o que migra e o que é reescrito: e2e 17 passa a usar o engine default; decidir se `endpoints.*.side` é portado para o motor unificado ou removido (com warning de DSL); remover o stub `astar`.
- **Verificação cética:** parcial (severidade corrigida: baixa) — O inventário confere: e2e/17:11,27 usa `engine: physics`, e as specs 14/17/18/19 também. tests/routing/physics tem 19 arquivos. O stub `astar` está em snap-resolver.js:63-70. `endpoints.*.side` só é consumido em src/routing/physics/forces-endpoint-bbox.js:28. Só que o campo não é override de face: é tamanho numérico > 0 do BBox (src/dsl/ir.js:410-417). O erro vem da F-0016:53-54, e isso é um drift extra. É um checklist da Fase 4, não um defeito atual.

#### G1-11 · Rastreabilidade commit↔feature/ADR fraca e commits em lote (media, esforço P)

- **Evidência:** Nenhum commit de código cita F/ADR: bab6b3f (952+), 992e5ca (637+), 2a8c80d, 3b8692e → refs vazias. Só 113ef70, f00f0e6 e 89a85d6 citam, e são commits de documentação. As Fases 1-3 e o code review foram commitados em 22 minutos (02:48:52 → 03:10:27, author=committer), o que indica recorte em lote no fim da sessão. O 'code review' (3b8692e) cobriu ~1.645 linhas novas numa única passada de agente. Só houve 4 runs de CI para 13 commits: 9 commits (06-03..06-26) subiram num único push em 06-26, com as Fases 1-3 ficando 20 dias só locais. Commit inicial squashado com 25.897 linhas (178 arquivos). 89a85d6 gravou 19 features + 9 ADRs num commit de 2.239 linhas, contra a regra de 'lotes de 5' da memory-deploy.
- **Recomendação:** Convenção barata: rodapé `Refs: F-0020, ADR-0014` em commits de código (pode virar checagem no teste de governança via git log). Fazer push por fase (a branch claude/* com CI do G1-04 torna isso barato). Code review por fase, antes do commit seguinte.
- **Verificação cética:** parcial (severidade corrigida: baixa) — Confirmado que 0 dos commits de código citam F/ADR. As Fases 1-3 somam 952+637+56 linhas em 22 min (02:48:52 → 03:10:27). O commit inicial tem 178 arquivos e 25.897 linhas, e há 4 runs. Duas afirmações estão erradas. Foram 10 commits entre dff963c e 5bb9b8d, não 9. A regra de 'lotes de 5' (memory-deploy:97,119) trata de rodadas de aprovação com o usuário, não do tamanho do commit. Num projeto solo de pesquisa, a rastreabilidade commit↔feature pesa pouco.

#### G1-12 · Decisões de design do motor ficam fora do repo (localStorage do playground); 8 questões abertas sem registro (baixa, esforço P)

- **Evidência:** Os vereditos e notas do mantenedor no playground são persistidos em `localStorage` na chave `tensegrams:playground-notes` (playground/physics-playground.html:839-841); a única saída é 'copiar prompt' (:1156). O META (:827-835) marca como `aberto` os cenários B2 (XPBD), C3 (PI), D2 (polaridade), F1/F2 (atratores ponto/path), G1 (aresta contornando obstáculos), G3 (topologia fixa × fissão/fusão) e H1 (dissipação), exatamente o núcleo da Fase 4. .feat-memory/suggestions.md está vazio e decisions/proposals/ só tem .gitkeep. ADR-0011:17-19 diz 'medido' mas não registra números.
- **Recomendação:** Versionar os vereditos (por exemplo playground/verdicts.json exportado pelo playground) e abrir os 8 'abertos' como ADRs `proposed` curtos ou como entradas do suggestions.md. Para pesquisa, um log de experimento com métricas vale mais que EARS de UI.
- **Verificação cética:** parcial (severidade corrigida: media) — Tudo confere: a chave de localStorage está em physics-playground.html:839-841, o único 'Copiar' em :1156 e 8 cenários 'aberto' no META (:827-835: B2, C3, D2, F1, F2, G1, G3, H1). suggestions.md está vazio, proposals/ só tem .gitkeep e ADR-0011:17-19 diz 'mediram' sem números. Subo a severidade: o mantenedor declarou que o valor central é pesquisa, e os vereditos que definem a Fase 4 não têm registro durável.

#### G1-13 · Fluxo de release/changelog/versions não se aplica e nunca foi usado (baixa, esforço P)

- **Evidência:** changelog/INDEX.md sem linhas, `git tag` vazio, todas as 19 features com `version: —` (manifest/INDEX.md). O deploy real é 'todo push na main' com SHA carimbado (deploy-tensegrams.yml:81-85).
- **Recomendação:** Declarar no AGENTS.md que o release é o SHA do deploy, abandonar tags/semver e manter o UNRELEASED só como 'em voo'. Ou usar `feat-memory release` a cada marco de fase (Fase 4 = v0.4), se o mantenedor quiser marcos.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — A tabela de changelog/INDEX.md está vazia, `git tag | wc -l` dá 0 e as 19 features têm versão '—' no manifest/INDEX.md. O deploy carimba o SHA (workflow:81-85).

#### G1-14 · README desatualizado no núcleo (modelo de força, contagens, árvore) (baixa, esforço P)

- **Evidência:** README.md:191 diz 'As arestas são passivas (nunca exercem força)'. README.md:262 e :385 falam em ~751 testes em ~72 arquivos, contra 797 testes (dossiê) e 78 arquivos *.test.js (find; o dossiê diz 83). A árvore (README.md:209-254) omite src/physics/, compile-world.js e playground/. README.md:334 apresenta o routing físico sem mencionar a depreciação.
- **Recomendação:** Atualizar junto com a F-0002/F-0020. Trocar contagens fixas por 'ver CI', para não apodrecerem.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — README.md:191 diz 'arestas são passivas'. README.md:264 e :385 dão ~751 testes em ~72 arquivos, e `find tests -name '*.test.js'` dá 78; o dossiê diz 83, também errado. A árvore do README (~:205-250) não tem src/physics, compile-world.js nem playground/. README.md:334 não menciona a depreciação.

#### G1-15 · Proporcionalidade: churn de metodologia e cerimônia de time multi-dev num projeto de 1 mantenedor (baixa, esforço P)

- **Evidência:** Três migrações de metodologia em 23 dias: agent-memory v0.13.0 (89a85d6, 06-03) → feat-memory 1.3.1 (b5e8884, 45 arquivos) → 2.1.0 (5bb9b8d, 17 arquivos). Desde a adoção, 6 de 10 commits são só ou quase só metadados. Pegada: .feat-memory 70,8 KB (41 arquivos) + skills 39,9 KB + AGENTS/CLAUDE/agent 9,5 KB, contra 454 KB de src/. Instruções sem efeito aqui: `feat-memory record` (telemetria; CLI ausente), pull-brief e `--check-collisions` (fluxos de time), release (G1-13), merge=ours (G1-08). O gate C1 exige E2E local nos dois projetos antes de TODO push, inclusive em branch claude/* que não faz deploy.
- **Recomendação:** Enxugar: manter AGENTS.md, Manifest, ADRs e UNRELEASED. Remover do fluxo telemetria, release, pull-brief e merge=ours. Congelar a versão da metodologia até a Fase 4. Trocar a disciplina de E2E local pelo CI por branch/PR (G1-04). Investir o esforço liberado em G1-01/G1-03/G1-12 (rigor científico).
- **Verificação cética:** parcial (severidade corrigida: baixa) — Confirmado: três migrações em 23 dias (89a85d6 06-03, b5e8884 06-07, 5bb9b8d 06-26). A pegada confere: .feat-memory 70.818 B em 41 arquivos, skills 39.890 B e src 454.303 B. `telemetry_enabled: true` (.meta.yaml) convive com a CLI ausente. O '6 de 10 commits são metadados' está inflado. Pela análise de arquivos são 4 a 5, porque f00f0e6 traz o playground de 1.170 linhas (artefato de pesquisa) e 7011317 é só um .gitignore.

#### G1-16 · ADR-0013 (layout ⟂ routing) já é violado na prática e a Fase 4 o tensiona sem ADR (info, esforço P)

- **Evidência:** pipeline.js:179 usa `const rawEdges = session.routedEdges || router.route(...)`: a sessão de layout pode substituir o router. O live adapter produz `edgeWaypoints` (src/layout/adapters/live/index.js:504) que o routing consome (pipeline.js:215); `orthogonal: store.state.routerId === 'orthogonal'` também acopla os dois. ADR-0013:34-37 afirma que 'qualquer combinação layout×router funciona' e que os solvers físicos são plugins. No ADR-0012, arestas são corpos no mesmo World dos nós, o que não cabe no contrato `router.route(ir, rects, opts)`.
- **Recomendação:** Tratar isso no ADR-0014 proposto: formalizar `session.routedEdges` como contrato (engine unificado = adapter que também roteia) e dizer o que acontece com o seletor de router quando o v2 estiver ativo.
- **Verificação cética:** refutado — A tese de que o ADR-0013 'já é violado na prática' não se reproduz. Nenhum adapter fornece rotas: custom, live e off têm `providesRouting: false` (registry.js:14-16), e o live define `routedEdges: undefined` (live/index.js:179). O fallback `session.routedEdges || router.route` nunca desvia do router hoje. `edgeWaypoints` é uma dica opcional que o obstacle-route aceita (obstacle-route.js:32), e as combinações continuam funcionando. A recomendação de 'formalizar session.routedEdges' já está feita: `src/layout/adapter.js:19,34`. A tensão com a Fase 4 é uma previsão, não um defeito.

## Apêndice B · Achados do auditor de repositório e entrega

Auditoria de repositório, entrega e segurança básica do Tensegrams (G2). Veredito: a entrega é disciplinada. O deploy só sai depois de test e e2e passarem; o site publicado bate com a origin/main (curl em https://brunoleos.github.io/tensegrams/src/version.js?cb=… devolve '5bb9b8d', igual a `git rev-parse --short origin/main`). Não há vulnerabilidades em dependências (npm audit: 0) e não achei XSS: 8 dos 9 innerHTML só limpam o elemento (`= ''`) e o único que recebe texto do usuário (src/editor.js:26) passa por um escape correto; o fuzz de 20 mil entradas deu 0 violações e o teste no Chromium com payload em id, label, title e chave de config não disparou nenhum alert nem injetou elemento. Os achados que importam são de robustez e de entrega. (1) ALTA: um YAML válido com U+2028/U+2029 derruba o realce de sintaxe e, com ele, o boot. Um .yaml importado com esse caractere fica salvo e, depois do reload, o app fica em branco. Reproduzi no Chromium. (2) MÉDIA: ids de nó/aresta montados à mão em seletor CSS e em url(): um id com '\' duplica <g> a cada tick no layout live (305 → 631 elementos em 3 s); um id com '\n' quebra a renderização; um id com espaço perde a máscara do rótulo. (3) MÉDIA: não há cache busting de módulos ESM. O Pages serve com max-age=600, a CDN guarda cada objeto separado, então até ~10 min depois de um deploy o navegador pode montar um grafo com módulos velhos e novos misturados. (4) MÉDIA: o E2E testa a raiz do repo, não o dist/; o smoke e2e-prod existe mas não roda no CI; o CI só roda em push na main (sem PR nem outras branches) e a main não é protegida. (5) MÉDIA: repositório público sem LICENSE. ADR-0006 (sem bundler): medido de verdade. O dist/ tem 165 arquivos e 747 KB crus (~254 KB gzip somando arquivo a arquivo). A carga a frio faz 142 requests de script (69 de src/ e 73 do yaml), com grafo de import de profundidade 11. Em HTTP/2 com RTT de 150 ms, o primeiro nó aparece em 2,45 s no modelo atual, contra 0,77–0,99 s com <link rel=modulepreload> gerado no build (ainda sem bundler) e 0,91–0,94 s com esbuild (11 requests, 85 KB gzip, 0,36 s de build). Conclusão: o ADR-0006 se sustenta pela DX (zero build, testes importam src direto). O custo real é o waterfall de rede, e ele se resolve dentro do próprio ADR com modulepreload e diretório versionado no build-dist. O ADR deveria ser emendado com esses números. Observação de método: o probe da página ao vivo via Chromium falhou no proxy (ERR_TOO_MANY_RETRIES); as medições de carga foram feitas numa cópia local do dist/ servida por HTTP/1.1 e por HTTP/2+TLS (servidor próprio, portas privadas 5391–5396), não no GitHub Pages. O E2E do projeto não foi rodado. Nada foi modificado no repo (`git status` limpo).

#### G2-01 · YAML válido com U+2028/U+2029 derruba o realce e o boot; um import deixa o app em branco de forma persistente (alta, esforço P)

- **Evidência:** src/controls/yaml-highlight.js:22-23: `line.match(/^(\s*)(.*)$/)` devolve null quando a linha tem U+2028/U+2029/\r, porque `.` não casa terminadores de linha e só há split por '\n' em :16. Aí `m[1]` lança TypeError. Caminho até o boot: src/app/boot.js:32-33 (createEditor com highlight:true e depois `editor.setValue(store.state.dsl)`) → src/editor.js:57-59 → refreshOverlay em :26 → throw → boot() rejeita → src/main.js registra 'boot failed'. Pelo import: src/app/dsl-io.js:45-50 (applyImport → store.setDSL) grava em localStorage (src/store.js:82) antes da falha. Saídas: sec-probe.txt '[1b] highlight com U+2028: LANÇA TypeError' e 'parse() da mesma DSL: errors= []' (o YAML é válido); browser-probe.txt '(b) import .yaml c/ U+2028: nós antes = 8 | persistiu U+2028 = true | ... após reload nós = 0 | erros no boot = boot failed: TypeError'; recover-probe.txt mostra a UI morta (select de layout com 0 opções, editor visualmente vazio porque o texto do textarea é transparente). Só volta se o usuário digitar uma DSL nova e recarregar, ou limpar os dados do site. Nenhum teste cobre isso: grep por 2028/2029 em tests/controls/yaml-highlight.test.js e tests/editor.test.js não achou nada.
- **Detalhe:** Não é XSS: é negação de serviço disparada por entrada válida, persistente e fácil de acontecer por acidente (texto colado de PDF/Word ou um .yaml recebido de terceiros).
- **Recomendação:** Correção de uma linha: usar `/^(\s*)([^]*)$/` ou a flag `s` (`/^(\s*)(.*)$/s`), ou dividir as linhas com `/\r\n|[\n\r  ]/`. Além disso, envolver refreshOverlay em try/catch (a sobreposição é só cosmética: se falhar, mostrar o texto escapado sem cor) e não deixar erro de UI abortar o boot antes da store e do pipeline estarem ligados. Adicionar teste unitário com U+2028/U+2029/\r e um caminho de recuperação (por exemplo `?reset` na URL limpando `tensegrams:dsl-v2`).
- **Verificação cética:** parcial (severidade corrigida: media) — Reproduzido em Node (verif/u2028.mjs). `highlight()` lança TypeError com U+2028, U+2029 e \r. `parse()` da mesma DSL (exemplo embutido com U+2028 num label) dá 0 erros. O caminho até o boot confere: boot.js:32-33 → editor.js:57-59 → :26. No navegador o \r é normalizado pelo textarea, então só U+2028 e U+2029 disparam. O browser-probe do auditor mostra o boot quebrando depois do reload. Não há teste com 2028/2029. O defeito é real e persistente, mas depende de um caractere raro, num protótipo de pesquisa.

#### G2-02 · Ids do usuário entram sem escape em seletor CSS e em url(#…): vazamento de DOM, render quebrado e máscara perdida (media, esforço P)

- **Evidência:** O parser aceita qualquer string não vazia como id (src/dsl/parser.js:111-127; sec-probe.txt '[4] ids exóticos aceitos: ["a\\","b c","d\"e","x\ny","<img ...>"]'). src/renderer/ensure-el.js:11 monta `:scope > g[data-id="${escapeAttr(id)}"]` e escapeAttr (:24-26) só escapa aspas. Com id `a\` o seletor não casa, :13-16 cria um <g> novo a cada render e o cleanup (src/renderer/edges.js:71-73, nodes.js:36) mantém os duplicados porque o id continua vivo. browser-probe.txt: 'layout=live: g[data-id] t≈2.5s total=305/únicos=5; t≈5.5s total=631 ... após 5 re-renders total=785'. Com id contendo '\n': '(c2) ... nós = 0 | pageerror: Failed to execute querySelector ... is not a valid selector'. edges.js:107 e :117-119 geram `url(#edge-mask-e:b|c d)` sem aspas; mask-probe.txt mostra computedMask 'none' para o id com espaço e 'url("#edge-mask-e:a|b")' para um id normal, ou seja, a aresta passa por baixo do rótulo. O próprio código já faz certo em src/renderer/edge-end-styles.js:62 (`CSS.escape`).
- **Recomendação:** Em ensureEl, trocar querySelector por um Map id→elemento, ou usar `CSS.escape(id)`. Para ids de DOM (máscara), derivar um id seguro (hash ou índice, ex.: `edge-mask-${n}`) e usar `url("#…")` com aspas. Opcional: validar ids no parser (rejeitar '\n' com diagnóstico). Adicionar testes com ids contendo '\', '"', espaço e quebra de linha.
- **Verificação cética:** parcial (severidade corrigida: baixa) — Confere no código. `ensure-el.js:11,24-26` só escapa aspas, e `edges.js:107,117-118` monta `url(#edge-mask-${id})` sem escape nem aspas. Já `edge-end-styles.js:62` usa CSS.escape. O browser-probe mostra 305 → 631 <g> no live com id contendo '\\' e erro de seletor com '\n'. O impacto realista é cosmético (máscara perdida em id com espaço), e o leak exige ids patológicos.

#### G2-03 · Sem cache busting de módulos ESM: grafo misto de módulos velhos e novos por até ~10 min depois do deploy (media, esforço P)

- **Evidência:** index.html:13 (importmap) e :110 (`./src/main.js`) referenciam caminhos fixos, e os imports relativos dentro de src/ não têm hash nem versão. curl no Pages: todo asset com `cache-control: max-age=600`, e a CDN guarda cada objeto separado. No mesmo instante, index.html veio com `expires: 06:07:29` (x-cache HIT) e src/main.js com `expires: 06:30:11` (MISS), então cada módulo expira numa hora diferente. Com isso, uma mudança de assinatura de export entre dois módulos pode quebrar a carga ('does not provide an export named …') até expirar. O rótulo de versão do HUD (src/version.js, carimbado no deploy, linhas 75-85 do workflow) é ele mesmo um módulo sujeito ao mesmo cache, então só indica, não garante.
- **Recomendação:** Sem violar o ADR-0006: no scripts/build-dist.js, copiar a árvore para um diretório versionado (`dist/v/<sha>/src`, `dist/v/<sha>/node_modules/yaml/browser`) e reescrever só o index.html (script src e importmap) para esse prefixo. Os imports relativos passam a ter URL única por deploy sem mexer em src/, e a falha fica atômica (um index.html velho em cache aponta para um diretório que ou existe inteiro ou dá 404). Como reforço barato, no boot comparar VERSION com `fetch('version.txt?cb='+Date.now())` e sugerir reload se divergir.
- **Verificação cética:** parcial (severidade corrigida: baixa) — `curl -I` confirma `cache-control: max-age=600` e `expires` diferentes por objeto: index.html 06:51:35 e src/main.js 06:30:11 com HIT. index.html:13,110 usa caminhos fixos. O grafo misto é plausível mas não foi demonstrado como falha real. A janela é de 10 min, houve 4 deploys na história inteira, e só quebra se uma assinatura de export mudar.

#### G2-04 · Custo real do ADR-0006: 142 requests e waterfall de profundidade 11. Com modulepreload se chega perto da latência de bundle sem abrir mão do ADR (media, esforço P)

- **Evidência:** load-local-0.txt: 144 requests (142 scripts: 69 de src/ e 73 do yaml), 678,7 KB crus, primeiro nó em 583 ms sem latência. depth.txt: 138 módulos estáticos, profundidade BFS 11 (os mais fundos são de node_modules/yaml/browser/dist/compose/*). h2-compare.txt (HTTP/2+TLS, RTT 150 ms): atual 2482/2446 ms até o primeiro nó; com modulepreload (gen-preload.mjs) 994/772 ms; bundle esbuild 907/938 ms com 11 requests. Em HTTP/1.1 com 150 ms (load-local-150-nothrottle.txt) o atual leva 4894 ms, e o modulepreload não ajuda ali (limite de 6 conexões), mas o GitHub Pages serve HTTP/2 (curl: 'HTTP/2 200'). Bytes: soma gzip por arquivo de 254 KB (JS) contra 85 KB gzip do bundle esbuild (spike-esbuild, build em 362 ms).
- **Recomendação:** Manter o ADR-0006 e emendá-lo com esses números. No build-dist.js, gerar `<link rel=modulepreload>` para o grafo estático; o script gen-preload.mjs da minha pasta é uma prova de conceito de ~20 linhas. Se o tamanho em bytes passar a importar, a alternativa com melhor custo-benefício é pré-empacotar só o `yaml` no build, porque ele sozinho responde por 73 dos 142 requests; src/ continua vanilla. Um bundler completo não se justifica para a DX atual.
- **Verificação cética:** parcial (severidade corrigida: baixa) — A estrutura foi reproduzida por BFS independente (verif/bfs.mjs): 138 módulos estáticos, 73 do yaml, profundidade 11. Os tempos até o primeiro nó (2,45 s contra 0,77-0,99 s) vêm de servidor local com RTT simulado. Não os reproduzi e não foram medidos no Pages. Desempenho de carga é secundário para a ambição declarada, que é pesquisa.

#### G2-05 · CI só roda em push na main: sem PR, sem outras branches, e a main não é protegida (media, esforço P)

- **Evidência:** .github/workflows/deploy-tensegrams.yml:3-7 (`on: push: branches: [main]` + workflow_dispatch). A API do GitHub listou só 4 runs, todas `head_branch: main`. A branch remota `origin/claude/elegant-heisenberg-1ykrqa` existe (`git branch -a`) e nunca teve CI. `curl https://api.github.com/repos/brunoleos/tensegrams/branches/main` → `"protected": false`. O gate do AGENTS.md depende inteiramente de disciplina local. workflow_dispatch pode ser acionado de qualquer branch e o job deploy não tem `if:` de branch; a regra de branch do environment github-pages NÃO foi verificada (a API de environments foi bloqueada pelo proxy).
- **Recomendação:** Separar em dois workflows: `ci.yml` (test+e2e em `push` de qualquer branch e `pull_request`, com `concurrency: ci-${{ github.ref }}` e cancel-in-progress) e o de deploy, com `if: github.ref == 'refs/heads/main'` no job deploy. Ligar branch protection na main exigindo os checks test/e2e (mesmo sendo projeto solo, isso transforma o gate do AGENTS.md de convenção em verificação automática).
- **Verificação cética:** confirmado (severidade corrigida: media) — É o mesmo fato de G1-04: workflow :3-7, `"protected": false`, 4 runs todos na main e a branch origin/claude/elegant-heisenberg-1ykrqa sem CI. O job deploy não tem `if:` de branch. A política do environment github-pages não pôde ser verificada: a API respondeu 'not permitted through this proxy'.

#### G2-06 · O E2E testa a raiz do repo, não o artefato publicado; o smoke de produção existe mas não roda no CI (media, esforço M)

- **Evidência:** playwright.config.js:31 serve a raiz (`python3 -m http.server 5179`), não o dist/. scripts/build-dist.js:7-8 afirma que 'what you test locally is what Pages publishes', mas isso não é verificado: nenhum teste referencia build-dist (grep em tests/ e e2e/ vazio). Um asset novo na raiz fora de ASSETS (build-dist.js:34) passaria no E2E e quebraria em produção. e2e-prod/edges-render.spec.js e playwright.config.prod.js existem (README.md:275-278), mas o workflow não os roda. A verificação do deploy é manual (AGENTS.md, lição 5).
- **Recomendação:** No CI, rodar o E2E contra o dist/ (`npm run build && http.server --directory dist`, ou um projeto Playwright apontando para ele) ou, no mínimo, um teste unitário que monte o dist num tmp e confira que todo import (mesma BFS de depth.mjs) resolve dentro dele. Acrescentar um job `verify` depois do deploy que faça polling de `version.js?cb=` até bater com o SHA e rode `playwright test --config=playwright.config.prod.js`, automatizando a lição 5.
- **Verificação cética:** parcial (severidade corrigida: baixa) — playwright.config.js:31 serve a raiz, e e2e-prod/ e playwright.config.prod.js existem fora do workflow. Mas o build-dist.js é uma cópia literal de 4 itens (:34), então a divergência entre raiz e dist é improvável. O valor real está em automatizar a lição 5, o que já conta como recomendação de G1-04.

#### G2-07 · Repositório público sem LICENSE (media, esforço P)

- **Evidência:** `ls LICENSE* COPYING*` → nenhum arquivo; grep -i 'licen' no README.md → nada; package.json:3 `"private": true` e nenhum campo license. A API do GitHub mostra `"visibility":"public"` e nenhum campo license. Sem licença, o padrão legal é 'todos os direitos reservados': terceiros não podem reutilizar nem fazer fork para experimentar, o que contraria a ambição de pesquisa/experimento do dossiê.
- **Recomendação:** Escolher e adicionar uma licença (MIT/Apache-2.0 se a intenção é fomentar experimentos; se quiser reciprocidade, MPL-2.0/GPL) e declará-la no package.json (`license`) e no README.
- **Verificação cética:** confirmado (severidade corrigida: media) — `ls LICENSE* COPYING*` vazio, 0 menções a 'licen' no README e package.json sem campo license. A API do GitHub dá `"license": null` e `"visibility": "public"`.

#### G2-08 · Actions pinadas por tag de major (não por SHA), permissões de escrita no workflow inteiro e sem Dependabot (baixa, esforço P)

- **Evidência:** deploy-tensegrams.yml:22,23,36,37,48,63,64,90,95,99 usam `@v4`/`@v5`/`@v3`. :9-12 dá `pages: write` e `id-token: write` a TODOS os jobs, inclusive test e e2e, que executam `npm ci` e código de terceiros (:29,:43). Não existe .github/dependabot.yml (`ls .github` → só workflows). Há majors mais novas (a página de releases de actions/upload-pages-artifact lista v4, que exclui dotfiles, e v5, e o dist não tem dotfiles: `find dist -name '.*'` vazio). Pelo changelog do GitHub (https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/), os runners passaram a usar Node24 por padrão desde 16/06/2026 e o Node20 sai no outono de 2026; a última run (26/06/2026) passou.
- **Recomendação:** Mover `pages: write`/`id-token: write` para o job deploy e deixar `contents: read` no topo. Pinar por SHA com comentário da tag e criar dependabot.yml para o ecossistema `github-actions` (e `npm`), que mantém os SHAs atualizados sozinho. Subir upload-pages-artifact para v4+ e checkout/setup-node para majors com runtime node24.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — Em deploy-tensegrams.yml, `pages: write` e `id-token: write` ficam no topo (:9-12) e valem para test e e2e. As actions são pinadas por tag (@v4/@v5/@v3). `.github` só tem workflows/, sem dependabot.

#### G2-09 · Módulo de routing físico deprecated carregado de forma eager em toda visita (baixa, esforço P)

- **Evidência:** src/app/pipeline.js:23 `import { runPhysicsRouter } from '../routing/physics/index.js'` (estático). load-local-0.txt lista 9 arquivos /src/routing/physics/* na carga padrão (80.282 bytes crus, 9 dos 69 módulos de src/), embora o engine físico seja opt-in (`options.routing.engine: physics`) e deprecated (F-0017). O metafile do esbuild confirma os 9 inputs no chunk principal.
- **Recomendação:** Trocar por `await import('../routing/physics/index.js')` só quando `engine === 'physics'`, como já fazem os registries (src/routing/registry.js:2-4, src/layout/registry.js:4-6), ou apagar junto com a Fase 4, como já está planejado.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — A BFS independente acha 9 arquivos de src/routing/physics no grafo estático, com 80.282 B, via pipeline.js:23.

#### G2-10 · Código morto e superfície exportada inflada (pequena); sem marcadores TODO/FIXME/HACK (baixa, esforço P)

- **Evidência:** dead-code.txt (script dead-code.mjs): de 88 módulos em src/, 87 são alcançáveis a partir de src/main.js. O único que não é, src/physics/registry.js (67 linhas), só é importado por tests/physics/solver.test.js e tem 4 exports sem nenhum importador (registerContributor, listContributors, registerField, getField). Stubs vazios que nunca são chamados (1 ocorrência só, a declaração): src/routing/physics/constraints.js:196,200 (projectPerpendicularLegs, clipAnchorsToNodes), forces.js:337 (slackAttract), topology.js:19-20 (MERGE_*). 32 exports sem importador externo (a maioria usada só internamente, ex.: diagnostics.js levenshtein/suggest) e 31 exports usados só por testes. Ganchos de teste expostos em produção: src/app/boot.js:141-160 (`window.__store__`, `__examples__`, `__currentIR__`, `__currentLayout__`). grep TODO/FIXME/HACK/XXX em src, tests, e2e, scripts, index.html, style.css, playground e README.md → 0 ocorrências.
- **Recomendação:** Apagar src/physics/registry.js, ou ligá-lo ao motor se fizer parte do design da Fase 4 (decidir e registrar). Remover os stubs junto com src/routing/physics na Fase 4. Tirar `export` do que é só interno. Opcionalmente, expor os ganchos window.__* só sob `?test` ou `navigator.webdriver`.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — src/physics/registry.js só é importado por tests/physics/solver.test.js:5. projectPerpendicularLegs, clipAnchorsToNodes e slackAttract têm 1 ocorrência cada, a própria declaração. As 4 ocorrências de TODO/XXX são falsos positivos: texto de teste 'XXXXX' e a palavra 'TODOS'.

#### G2-11 · Dependências: 0 vulnerabilidades; o caret do yaml é inofensivo por causa do lockfile; o lockfile ainda tem o nome antigo (baixa, esforço P)

- **Evidência:** npm-audit.txt: `npm audit --omit=dev` → 'found 0 vulnerabilities' (exit 0); o audit completo também dá 0. npm-outdated.txt: yaml 2.9.0 → 2.9.1 disponível; @playwright/test 1.56.1 fixado exato contra 1.63.0 latest (fixação deliberada para determinismo). O deploy usa `npm ci --omit=dev` (workflow:74), que respeita o package-lock.json (lockfileVersion 3, com integrity), então `^2.9.0` não gera deriva em produção. As notas do release 2.9.1 do yaml (https://github.com/eemeli/yaml/releases) citam 'limiting recursive merge aliases'; o app usa `schema: 'core'` (parser.js:33, config.js:27), onde merge keys provavelmente estão desligadas (não verifiquei). package-lock.json:2 tem `"name": "whiteboard-e2e"`, diferente de package.json:2 `"tensegrams"`, sobra da marca antiga.
- **Recomendação:** Subir o yaml para 2.9.1 e regenerar o lockfile (`npm install --package-lock-only`), o que também corrige o nome. Se quiser uma política explícita, fixar `"yaml": "2.9.1"` (sem caret), já que ele é servido direto ao navegador. Dependabot npm semanal (ver G2-08).
- **Verificação cética:** confirmado (severidade corrigida: baixa) — `npm audit --omit=dev` num clone dá 'found 0 vulnerabilities', e `npm view yaml version` dá 2.9.1. package-lock.json:2 tem 'whiteboard-e2e'. O schema 'core' está em parser.js:33 e config.js:27.

#### G2-12 · Persistência: localStorage validado de forma mínima e origem compartilhada com outros projetos do Pages; sem CSP (baixa, esforço P)

- **Evidência:** src/store.js:197-201 faz só `JSON.parse` e `typeof parsed.dsl === 'string'`; ui, viewState e options entram sem schema (:170-178). O spread é seguro contra `__proto__` vindo do JSON (cria propriedade própria). Os dados são reinterpretados como texto (DSL e config voltam a passar pelo parser YAML) e nunca como HTML. A origem `https://brunoleos.github.io` é compartilhada com outro projeto publicado (`curl https://brunoleos.github.io/feat-memory/` → 200), e como localStorage é por origem e não por caminho, qualquer página desse domínio lê e escreve `tensegrams:dsl-v2`. index.html não tem <meta> CSP e o Pages não permite headers (curl não mostra content-security-policy nos assets). Validei uma CSP estrita via meta (csp-probe.txt): `default-src 'self'; script-src 'self' 'sha256-wYr5WNdqCAQ/5gDzShk/kSEfyl9yO28Q1ntHf2VxDsE='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. Com ela o app sobe (8 nós), o Debug pack e o export .yaml funcionam, o layout live roda e não houve nenhuma violação.
- **Recomendação:** Adicionar essa CSP via <meta>, com o hash do importmap calculado no build-dist.js (e `style-src 'unsafe-inline'` só por causa de index.html:47; movendo esse estilo para style.css dá para remover). Validar o blob persistido com um schema leve (tipos de ui/viewState) e descartar o que não bater. Se o isolamento de origem importar no futuro, um domínio próprio (CNAME) resolve.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — brunoleos.github.io/feat-memory/ responde 200, então a origem é compartilhada. index.html não tem CSP (grep = 0). store.js só valida `typeof parsed.dsl`. boot.js:141-160 expõe window.__store__ e outros ganchos. A CSP validada é do auditor e não a reexecutei.

#### G2-13 · Tempo e custo do CI: 5,5 min por deploy, dominado pelo E2E; concorrência serializa até os testes (baixa, esforço P)

- **Evidência:** Run 28257430979 (via API): test 9 s (a suíte unit em si, 4 s); e2e 4m16s (instalação do Chromium 23 s, E2E 3m39s); deploy 1m04s (deploy-pages 48 s); total 330.000 ms. Billable 0 ms (repo público). workflow:14-16 põe `concurrency: pages` no nível do WORKFLOW, então um segundo push espera o pipeline inteiro do primeiro. Nenhum job tem `timeout-minutes` (o padrão é 360). playwright.config.js:10 usa `retries: 1` no CI, o que mascara flakiness como sucesso.
- **Recomendação:** Levar a concorrência 'pages' só para o job deploy. Usar uma matrix `project: [chromium, mobile-chromium]` no e2e (~metade do tempo). Cachear ~/.cache/ms-playwright pela versão fixada. Adicionar `timeout-minutes: 15`. Publicar a contagem de testes 'flaky' no summary do job.
- **Verificação cética:** confirmado (severidade corrigida: baixa) — A API de jobs do run 28257430979 dá test 18:27:03→18:27:12 (9 s) e e2e 18:27:04→18:31:20 (4m16s). A concurrency 'pages' fica no nível do workflow (:14-16), e nenhum job tem timeout-minutes.

#### G2-14 · XSS: nenhum caso explorável encontrado nos 9 innerHTML nem nos demais sinks (info, esforço P)

- **Evidência:** 8 dos 9 innerHTML só limpam o elemento (`= ''`): src/controls/layers.js:16, config-editor.js:34 e :136, abstraction.js:29, drill.js:14, ui/context-menu.js:18 e :30, ui/action-fab.js:35. O único que recebe texto do usuário é src/editor.js:26 (`yamlHighlight(text)`), e todo token passa por escape() (yaml-highlight.js:12-13, :153-154, e :25/:60/:119/:126). sec-probe.txt: fuzz com 20.000 entradas (inclui '<script>', 'onerror', '</span>', '&lt;') deu 0 violações, sem tag crua e com round-trip idêntico. Label, id, title, mensagens de erro e chaves de config chegam ao DOM por textContent, title ou dataset (pipeline.js:72, drill.js:24-26, abstraction.js:35/59/64, action-fab.js:57, config-editor.js:82-98, edges.js:37). browser-probe.txt '(d) XSS: dialogs(alert) = 0 | elementos injetados = {img:0, script:1 (o próprio main.js), foreignObject:0}'. Prototype pollution: não há (sec-probe.txt: Object.prototype intacto; o yaml usa defineProperty para `__proto__` em addPairToJSMap.js:24-30 e a DSL usa mapAsMap). Alias bomb e aninhamento de 20.000 níveis viram erro de diagnóstico em ≤92 ms (sec-probe.txt, deep-probe.txt). Detalhe menor: `__proto__` como atributo de nó é engolido sem aviso, porque parser.js:220-221 atribui com `out[k]=`.
- **Recomendação:** Manter a disciplina de textContent. Colocar um teste de regressão de escape (payload HTML em label/id → sem elemento injetado) e a CSP de G2-12 como defesa em profundidade. Em mapToObject/unwrap, usar `Object.create(null)` ou defineProperty para não trocar o protótipo dos attrs locais.
- **Verificação cética:** confirmado (severidade corrigida: info) — O grep acha 9 innerHTML em src. Oito recebem `''`, e o único com texto (editor.js:26) passa por escape(). outerHTML só aparece como leitura, em debug-export.js:68.

