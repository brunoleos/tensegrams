---
name: memory-bootstrap
description: Use no início de uma sessão ou quando o usuário pergunta sobre o estado atual do projeto (frases como "onde paramos", "qual o status", "carregue o contexto", "o que está em andamento"). Carrega a memória persistente do projeto (AGENTS.md, STATE.md, índices) e apresenta um briefing tático antes de prosseguir com a tarefa.
---

# Memory bootstrap

Quando o usuário inicia uma sessão de trabalho ou pede para você carregar o contexto do projeto, siga esta rotina antes de responder substancialmente.

## Quando usar

Esta skill se aplica quando:
- A sessão é nova e o usuário fez uma pergunta substantiva sobre o projeto
- O usuário pergunta explicitamente "onde paramos?", "qual o status?", "carregue o contexto", "o que está em andamento?"
- O usuário pede para retomar trabalho após uma pausa
- Você precisa de contexto sobre features ou decisões existentes para responder

Não se aplica para:
- Perguntas que não dependem do estado do projeto
- Conversas que já estão fluindo (o contexto já foi carregado anteriormente nesta sessão)
- Pedidos triviais ou off-topic

## Procedimento

### 1. Carregue os artefatos base

Se ainda não estão no contexto da sessão atual, leia:
- `AGENTS.md` (constituição do projeto — geralmente já está no contexto via auto-load)
- `.feat-memory/STATE.md` (foco atual da sessão)
- `.feat-memory/manifest/INDEX.md` (mapa resumido de capacidades)
- `.feat-memory/decisions/INDEX.md` (decisões arquiteturais resumidas)

O total fica dentro do orçamento de retomada definido em `AGENTS.md::budgets::resumption_max_bytes` (padrão: 12KB).

**Detecção de pós-merge.** Se o último commit é um merge commit (verifique com `git log -1 --pretty=%P` retornando dois ou mais hashes de parent), os índices podem estar desatualizados porque o `.gitattributes` configurou `merge=ours` para mantê-los, deixando para o agente regenerar. Rode `feat-memory audit` antes de prosseguir, o que valida a estrutura mesclada e regenera os índices automaticamente. Se a auditoria reportar problemas (drift, colisões residuais, schemas quebrados), informe o usuário e sugira investigação antes de continuar.

Em seguida, verifique se o merge tocou artefatos da metodologia: `git log -1 --name-only --pretty=format: | grep -E '^(\.feat-memory/manifest/features/F-|\.feat-memory/decisions/[0-9]|AGENTS\.md)'`. Se houve mudança nesses caminhos, invoque a skill `memory-pull-brief` antes de seguir para o passo 2. A pull-brief brifa o usuário sobre o que veio do remote e ajusta o `STATE.md` se necessário, deixando-o consistente com a nova realidade antes da expansão seletiva de `active_*`.

### 2. Expanda apenas o necessário

Use `STATE.md::active_features` e `STATE.md::active_decisions` como filtro. Carregue **somente** os arquivos correspondentes em `.feat-memory/manifest/features/F-NNNN-*.md` e `.feat-memory/decisions/NNNN-*.md`. Não carregue o Manifest inteiro nem todos os ADRs — isso quebra o orçamento de contexto sem ganho.

### 3. Apresente um briefing tático

Antes de continuar com a tarefa, dê um resumo curto e estruturado:

> **Foco atual:** {de STATE.md::Current, em uma frase}
> **Próximo:** {de STATE.md::Next, em uma frase}
> **Features ativas:** {lista de IDs}
> **ADRs relevantes:** {lista de IDs}
> **Bloqueios:** {STATE.md::blocked_on, ou "nenhum"}

Mantenha o briefing em até cinco linhas. Detalhes vão por demanda.

### 4. Pergunte sobre direção

Encerre o briefing perguntando se o usuário quer prosseguir a partir do `Next` registrado, ou se tem outra prioridade. Não assuma — o `Next` reflete a última sessão, e a prioridade pode ter mudado.

### 5. Registre adesão na telemetria local

Após o briefing, invoque (silencioso, falha não bloqueia):

```bash
feat-memory record session_start state_read=true
```

Use `state_read=false` apenas se você pulou o passo 1 (não chegou a ler `STATE.md`). A telemetria é local-only (`.feat-memory/.telemetry.jsonl`, gitignored) e opt-out via `.meta.yaml::telemetry_enabled=false` — F-0014, ADR-0017. Sem rede, sem agregação central. O sinal serve ao mantenedor checar adesão via `feat-memory log --summary`.

## Saída esperada

```
Foco atual: implementação de F-0008 (metadata-filtering) em curso.
Próximo: adicionar predicate pushdown no plano IVF.
Features ativas: F-0007, F-0008
ADRs relevantes: ADR-0007
Bloqueios: nenhum

Quer prosseguir com o predicate pushdown ou tem outra prioridade?
```

## O que evitar

- Não recarregue arquivos que já estão no contexto da sessão
- Não apresente o briefing como se fosse a primeira vez quando a conversa já está em andamento
- Não invente IDs ou referências que não estão nos índices
- Não expanda features ou ADRs que não estão em `active_*` (custo de tokens sem ganho)
- Não mostre o briefing em projetos que ainda não têm `STATE.md` populado — nesse caso, sugira rodar `feat-memory deploy <projeto>` ou invocar a skill `memory-deploy`
