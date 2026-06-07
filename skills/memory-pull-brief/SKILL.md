---
name: memory-pull-brief
description: Use após git pull em projeto cliente quando o usuário pergunta o que mudou no remote (frases como "o que veio do pull?", "brifa as mudanças do main", "atualizei meu branch, o que mudou?", "ressincroniza o STATE com o que veio"). Examina o diff do pull, identifica mudanças em features e decisions e no bloco metodológico de AGENTS.md, cruza com .feat-memory/STATE.md local, e propõe ajustes para refletir a nova realidade. Read-only sobre .feat-memory/manifest/ e .feat-memory/decisions/ — só escreve em .feat-memory/STATE.md após aprovação do usuário.
---

# Memory pull-brief

Quando o usuário acaba de fazer `git pull` (ou um merge equivalente) e quer saber o que veio do remote, execute esta rotina antes de seguir trabalhando.

## Quando usar

Esta skill se aplica quando o usuário diz coisas como:
- "o que veio do pull?"
- "brifa as mudanças do main"
- "atualizei meu branch, o que mudou?"
- "ressincroniza o STATE com o que veio"
- "fiz pull, o que mudou nos artefatos?"

Também se aplica por delegação a partir de `memory-bootstrap` quando o último commit é merge **e** o merge tocou `.feat-memory/manifest/features/`, `.feat-memory/decisions/`, ou o bloco entre sentinelas de `AGENTS.md`. Nesse caso, a pull-brief roda antes do briefing tático normal da bootstrap.

Não se aplica para:
- Pulls que só trouxeram código (nenhum artefato da metodologia tocado) — termine cedo, em uma frase
- Sessões sem pull recente (não invente um range)

## Procedimento

Execute em ordem. Cada passo é condicional ao que veio.

### 1. Determine o range do pull

Por padrão, use `@{1}..HEAD` — `@{1}` é a posição anterior do reflog, então este range cobre o que o último pull (ou merge/reset) trouxe.

Antes de aceitar o default, verifique a ação anterior:

```
git reflog -1 --format='%gs'
```

Se a mensagem **não** menciona `pull` ou `merge`, o range default é ambíguo (o usuário pode ter feito commits locais depois do pull). Nesse caso, peça ao usuário a base explícita (ex.: hash do último commit antes do pull, ou nome de uma tag/branch). Não chute.

Registre a base usada no briefing — o usuário precisa poder verificar.

### 2. Liste arquivos tocados

```
git diff --name-only <base>..HEAD
```

Filtre para os caminhos relevantes:
- `.feat-memory/manifest/features/F-*.md` — novos, modificados, removidos
- `.feat-memory/decisions/*.md` (incluindo `.feat-memory/decisions/proposals/*.md`)
- `AGENTS.md` — apenas se o diff atingiu o conteúdo entre `<!-- >>> feat-memory >>> -->` e `<!-- <<< feat-memory <<< -->`

**Ignore `STATE.md`.** O `.gitattributes` da metodologia o marca com `merge=ours`, então mudanças do colega são silenciosamente descartadas pelo merge driver. Reportar seria enganoso — o usuário não vai ver as mudanças do colega no seu STATE local.

Se nenhum arquivo relevante apareceu na lista, encerre a skill em uma frase: "Pull não tocou artefatos da metodologia." Não invente briefing.

### 3. Extraia mudança semântica de cada arquivo

Para arquivos novos: leia o frontmatter atual.

Para arquivos modificados: compare o frontmatter antes (via `git show <base>:<path>`) e depois (versão atual no working tree). Reporte:

- **Features**: ID, transição de `status` (ex.: `in_progress → shipped`), mudança de `version`, mudanças em `acceptance` (resumido — número de critérios adicionados/removidos, não o conteúdo verbatim)
- **ADRs**: ID, transição de `status`, `supersedes` / `superseded_by`, `affects_features`
- **AGENTS.md (bloco sentinela)**: indique apenas que a metodologia foi atualizada upstream. Não tente diferenciar conteúdo do bloco — é responsabilidade do `feat-memory deploy` quando o usuário decidir atualizar a tool.

Para arquivos removidos: registre o ID e o slug do arquivo.

### 4. Cruze com o `.feat-memory/STATE.md` local

Carregue `STATE.md::active_features` e `STATE.md::active_decisions`. Para cada ID listado lá, verifique se mudou upstream:

- Feature em `active_features` cujo status virou `shipped` ou `deprecated` upstream → propor remoção
- ADR em `active_decisions` cujo status virou `superseded` upstream → propor remoção
- Feature/ADR em `active_*` que foi **removida** upstream → propor remoção (e alertar que isso pode indicar incompatibilidade de branches — pedir confirmação)

Não proponha **adições** em `active_*` automaticamente. Novas features e ADRs criados pelo colega são contexto que o usuário deve conhecer, mas não são foco do usuário até que ele decida focar nelas.

### 5. Apresente o briefing e proponha ajustes

Formato curto, similar ao da bootstrap:

```
**Pull range:** <base>..HEAD (N commits)
**Novidades upstream:**
- F-XXXX (slug) — nova, status: shipped
- F-YYYY (slug) — status: in_progress → shipped
- ADR-NNNN (slug) — nova, affects: F-YYYY

**Ajustes propostos no `.feat-memory/STATE.md`:**
- Remover F-YYYY de active_features (agora shipped upstream)
- Adicionar entrada Recent: "rebased on N upstream changes: F-YYYY shipped, ADR-NNNN added"

Aprova os ajustes? (s/n)
```

Aguarde aprovação explícita antes de escrever.

### 6. Aplique e valide

Após aprovação:
- Escreva `.feat-memory/STATE.md` com `active_features` / `active_decisions` ajustados
- Adicione uma linha em `Recent` (buffer circular de 5)
- Atualize `updated_at` (ISO 8601 UTC) e `updated_by` (seu modelo, ex. `claude-opus-4.7`)
- Não toque em `Current` nem em `Next` — esses são foco do usuário, não do colega

Rode `feat-memory audit --strict` para detectar drift entre STATE local e os artefatos pulled (ex.: STATE referencia ADR que foi removido upstream). Se a auditoria reclamar, surfaceie sem tentar consertar — pode indicar conflito real que o usuário precisa decidir.

## O que evitar

- Não modifique `.feat-memory/manifest/features/*.md` nem `.feat-memory/decisions/*.md`. Esses já vieram corretos do pull — escrever neles seria reverter trabalho de colegas.
- Não adicione IDs em `active_features` ou `active_decisions` automaticamente. Novidades do colega entram em foco do usuário só por decisão explícita dele.
- Não force entrada em `Recent` se o pull não tocou nenhum artefato da metodologia. Buffer circular é caro.
- Não execute se o branch local tem commits feitos depois do pull (passo 1 detecta isso) — o range fica ambíguo. Peça base explícita.
- Não duplique briefing quando chamada por delegação da bootstrap. Termine a pull-brief, deixe a bootstrap seguir para o passo 2 (expansão de active_*) com o STATE já ajustado.
- Não tente diff de `STATE.md` — `merge=ours` dropa mudanças upstream silenciosamente. Reportar daria informação errada.
