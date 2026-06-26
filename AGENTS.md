---
schema_version: 2
project: tensegrams
stack:
  language: javascript (ES modules vanilla, sem bundler)
  architecture: SPA DSL→diagrama; layout adapters + edge routers pluggáveis
  runtime_dep: yaml
  test: node --test (unit) + Playwright (E2E, chromium + mobile-chromium)
  deploy: GitHub Pages (build dist/ sem bundler, SHA carimbado em src/version.js)
constraints:
  - id: C1
    severity: hard
    rule: "Nunca git push sem, nesta ordem: suíte completa verde (unit + E2E nos 2 projetos) e code review do diff"
  - id: C2
    severity: hard
    rule: "Todo git push exige verificação do deploy: SHA curto do HEAD deve aparecer em src/version.js no Pages"
  - id: C3
    severity: hard
    rule: "Sempre caminhos absolutos; nunca confiar na cwd herdada entre comandos"
  - id: C4
    severity: hard
    rule: "Pipe nunca pode mascarar exit code em testes/build/lint; conferir conteúdo do output, não só o código de saída"
references:
  manifest_index: ./.agent-memory/manifest/INDEX.md
  state: ./.agent-memory/STATE.md
  decisions_index: ./.agent-memory/decisions/INDEX.md
  methodology: https://github.com/brunoleos/agent-memory/blob/v0.13.0/METHODOLOGY.md
  skills: ./skills/
budgets:
  resumption_max_bytes: 12288
  state_max_bytes: 4096
  feature_file_max_bytes: 6144
---

# AGENTS.md

Arquivo canônico de instruções para agentes (Claude Code, Cursor, Aider e
outras ferramentas), seguindo a convenção `AGENTS.md`. Ferramentas que
procuram um arquivo próprio (`CLAUDE.md`, `.cursorrules`, …) devem apenas
importar/apontar para este.

**O projeto** é uma SPA standalone de DSL→diagrama (ES modules vanilla, sem
bundler; única dep de runtime é `yaml`). Visão geral de arquitetura, DSL, como
rodar e como testar em [README.md](README.md).

## Gate obrigatório antes de qualquer push

**Nunca dê `git push` sem, nesta ordem:**

1. **Suíte completa verde.** Rodar unit **e** E2E — não basta o unit:
   - `node --test $(find tests -name '*.test.js')`
   - `npx playwright test` (os dois projetos: `chromium` **e**
     `mobile-chromium`).

   Conferir o conteúdo do output, não só o exit code (ver lição 3). E2E é
   sensível a timing/snapshot e roda sequencial — re-rodar specs que
   falharem isoladas antes de concluir que há regressão.
2. **Code review do diff.** Revisar tudo que entra no push, inclusive
   mudanças "triviais" (rename, doc, config) — é por elas que bug passa.
3. Só então `git push` — que ainda exige **verificar o deploy** (ver lição 5).

Pular qualquer etapa = a entrega NÃO está "pronta". Vale para todo push, sem
exceção.

## Lições operacionais — erros a nunca repetir

Registro de falhas cometidas em sessões anteriores. Ler antes de rodar
comandos de verificação ou de fechar uma tarefa.

1. **Code review e testes ANTES do push, nunca depois.** A definição de
   "pronto" inclui suíte de testes verde **mais** revisão do diff. O push
   é o último passo. Já fechei uma entrega pulando o code review e tive
   que revisar depois do push — não repetir.

2. **Sempre caminhos absolutos; nunca confiar na cwd herdada.** O
   diretório de trabalho pode resetar entre comandos. Usar
   `cd /caminho/absoluto && comando` no mesmo comando, ou caminhos
   absolutos. Já rodei uma suíte E2E inteira a partir do diretório
   errado por confiar num `cd` de um comando anterior — rodada
   desperdiçada e diagnóstico falso. Os artefatos do Playwright
   (`playwright-report/`, `test-results/`) já estão no `.gitignore`.

3. **Pipe nunca pode mascarar o exit code.** `cmd | tail` reporta o
   status do `tail`, não do `cmd`. Em testes/build/lint: rodar sem pipe,
   ou usar `${PIPESTATUS[0]}`, e sempre conferir o conteúdo do output —
   não só o código de saída.

4. **Comportamento estranho de paths → checar `pwd` primeiro.** Antes de
   culpar dependências ou ambiente (ex.: "node_modules quebrado"),
   confirmar o diretório de trabalho. Já dei diagnóstico errado e quase
   reinstalei dependências quando a causa real era só a cwd resetada.

5. **Todo `git push` exige verificação do deploy.** Push NÃO é o passo
   final — o passo final é confirmar que o deploy chegou no destino.
   Para este projeto (workflow `.github/workflows/deploy-tensegrams.yml`):

   - Push na branch `main` dispara `test` → `e2e` → `deploy` no GitHub
     Actions.
   - O job `deploy` carimba o SHA curto do commit em `src/version.js`
     antes de publicar.
   - Validação:
     `curl -s "https://brunoleos.github.io/tensegrams/src/version.js?cb=$(date +%s)"`
     deve devolver o SHA curto do `HEAD` empurrado. A query
     `?cb=…` é cache-buster — sem ela o CDN serve versão velha por
     ~10 min.
   - Se o ambiente não tiver token do GitHub (api.github.com fica
     rate-limited sem auth), poll a cada 30s até o SHA bater com
     `git rev-parse --short HEAD`.
   - Falha persistente do poll (>10 min sem mudança) = algum job
     quebrou. Investigar antes de fechar a tarefa.

<!-- >>> feat-memory >>> -->
## feat-memory

Sessões começam por `.feat-memory/changelog/UNRELEASED.md` (trabalho em voo) e `.feat-memory/manifest/INDEX.md` (mapa de capacidades). Detalhes de uma feature ficam em `.feat-memory/manifest/features/F-NNNN-*.md`. Decisões arquiteturais em `.feat-memory/decisions/`. O histórico de releases vive em `.feat-memory/changelog/<tag>.md`. A metodologia completa está documentada no repositório do feat-memory: <https://github.com/brunoleos/feat-memory/blob/v2.1.0/METHODOLOGY.md>.

Este bloco é refrescado a cada `feat-memory deploy`. Não edite diretamente — mudanças aqui são sobrescritas no próximo redeploy. Conteúdo específico do projeto vai fora das marcações HTML que delimitam este bloco.

### Skills disponíveis

Quatro skills em `skills/` orientam os fluxos críticos. Leia o `SKILL.md` de cada uma antes de executá-la — o frontmatter traz os triggers de ativação e as instruções autoritativas (fonte única; não duplicadas aqui). Roster:

- **`memory-deploy`** — instalar/adotar a metodologia num projeto: deploy mecânico e, em legacy, gênese retroativa multi-fonte (testes, telas, código, deps; git secundário).
- **`memory-bootstrap`** — retomar uma sessão: carregar o contexto e dar o briefing tático ("onde paramos", "qual o status").
- **`memory-debrief`** — fechar/commitar uma sessão: atualizar Manifest e registrar o trabalho no `changelog/UNRELEASED.md` e propor ADR a partir do diff. A mais usada no dia-a-dia.
- **`memory-pull-brief`** — após `git pull`, brifar o que veio do remote e reconciliar o `UNRELEASED.md`.

### Como retomar trabalho

A constituição é carregada automaticamente. Em seguida, você deve carregar `.feat-memory/changelog/UNRELEASED.md` para descobrir o trabalho em voo. O conjunto ativo de features e ADRs é **derivado** das referências `F-NNNN`/`ADR-NNNN` nas entradas-bullet do UNRELEASED (ADR-0043) — apenas esses precisam ser expandidos no contexto inicial; carregar o Manifest inteiro ou todos os ADRs viola o orçamento de retomada. UNRELEASED vazio = nada em voo (veja o último release em `changelog/INDEX.md`).
<!-- <<< feat-memory <<< -->
