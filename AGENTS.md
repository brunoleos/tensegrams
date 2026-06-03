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

<!-- >>> agent-memory >>> -->
## agent-memory

Sessões começam por `.agent-memory/STATE.md` (foco atual) e `.agent-memory/manifest/INDEX.md` (mapa de capacidades). Detalhes de uma feature ficam em `.agent-memory/manifest/features/F-NNNN-*.md`. Decisões arquiteturais em `.agent-memory/decisions/`. A metodologia completa está documentada no repositório do agent-memory: <https://github.com/brunoleos/agent-memory/blob/v0.13.0/METHODOLOGY.md>.

Este bloco é refrescado a cada `agent-memory deploy`. Não edite diretamente — mudanças aqui são sobrescritas no próximo redeploy. Conteúdo específico do projeto vai fora das marcações HTML que delimitam este bloco.

### Skills disponíveis

Este projeto inclui quatro skills em `skills/` (na raiz do workspace) que orientam você nos fluxos críticos da metodologia. Cada skill tem um arquivo `SKILL.md` com instruções detalhadas e condições de ativação no frontmatter. Use-as quando os triggers correspondentes aparecerem na conversa, lendo o `SKILL.md` correspondente antes de executar — as skills são autoritativas sobre como cada fluxo deve ser conduzido.

A skill `memory-deploy` é o ponto de entrada único para instalar a metodologia em qualquer projeto. Ela ativa quando o usuário pede para instalar, configurar ou adotar a metodologia, com frases como "instale a metodologia neste projeto", "configure o agent-memory aqui" ou "este projeto não tem AGENTS.md". Ela detecta se o projeto é greenfield ou legacy, executa `agent-memory deploy` para instalar a estrutura mecânica, e em projetos legacy conduz gênese retroativa code-first: a fonte primária é a leitura do próprio código (capacidades viram features; decisões visíveis na estrutura viram ADRs), com o git log como fonte secundária para datar e justificar decisões. A skill nunca escreve no corpo da `AGENTS.md` fora do bloco delimitado por sentinelas — identidade, restrições e convenções específicas do projeto são autoria do mantenedor humano.

A skill `memory-bootstrap` ativa no início de uma sessão quando o usuário pergunta sobre o estado atual do projeto, com frases como "onde paramos", "qual o status" ou "carregue o contexto". Ela carrega os artefatos de memória eficientemente e apresenta um briefing tático antes de você prosseguir com a tarefa. Quando detecta que o último commit é um merge que tocou artefatos da metodologia, ela delega para `memory-pull-brief` antes do briefing tático.

A skill `memory-debrief` ativa quando o usuário sinaliza intenção de commitar ou fechar a sessão, com frases como "vou commitar", "atualize o STATE" ou "antes de subir". Ela executa a rotina de debrief: examina o diff, atualiza entradas do Manifest para features tocadas, reescreve o `.agent-memory/STATE.md`, e gera proposta de ADR se a sessão produziu uma decisão arquitetural não-trivial. Esta é a skill mais importante do dia-a-dia — invoque-a antes de cada commit relevante.

A skill `memory-pull-brief` ativa após `git pull` quando o usuário pergunta o que veio do remote, com frases como "o que veio do pull", "brifa as mudanças do main" ou "ressincroniza o STATE com o que veio". Ela examina o diff trazido pelo pull, identifica mudanças em features, decisions e no bloco metodológico de AGENTS.md, e propõe ajustes em `.agent-memory/STATE.md` para refletir a nova realidade — sem tocar `.agent-memory/manifest/` nem `.agent-memory/decisions/`, que já vieram corretos do pull.

### Como retomar trabalho

A constituição é carregada automaticamente. Em seguida, você deve carregar `.agent-memory/STATE.md` para descobrir o foco da sessão e os IDs de features e decisões ativas. Apenas as features e ADRs listados em `STATE.md::active_features` e `STATE.md::active_decisions` precisam ser expandidos no contexto inicial — carregar o Manifest inteiro ou todos os ADRs viola o orçamento de retomada.
<!-- <<< agent-memory <<< -->
