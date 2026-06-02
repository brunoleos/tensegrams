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
