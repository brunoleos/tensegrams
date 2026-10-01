# Backlog de sugestões

Propostas de **evolução do sistema de agentes** capturadas durante o trabalho —
skills novas, regras de `AGENTS.md`, ADRs, refactors, heurísticas, gaps de doc.
É o funil pré-feature: uma sugestão amadurece em Feature/ADR, ou é descartada.
Commitado e compartilhado entre agentes (ADR-0046) — merge normal (acumula
entradas de todos); **não** é `merge=ours`.

Quando o `changelog/UNRELEASED.md` está vazio (nada em voo), a `memory-bootstrap`
oferece candidatos daqui como próximo foco.

Formato por entrada (uma seção `##` por sugestão):

```
## <id-kebab>

- **tipo:** new-skill | refactor-skill | new-rule | new-adr | heuristic-fix | doc-gap
- **contexto:** 1–2 frases do que motivou
- **alvo:** onde aplicar se promovida (skill X / AGENTS.md / ADR / doc)
- **occ:** quantas vezes reapareceu (bump silencioso em duplicata)
```

<!-- Entradas abaixo. Backlog vazio = sem pendências de evolução. -->

## gate-de-engine-contrato-e-bancada

- **tipo:** new-rule
- **contexto:** O v2 falha em 8 de 35 testes do contrato do v1, e nenhum E2E usa engine v2. As propostas do motor compararam cenas diferentes (5 contra 27,6 ms). A Fase 4 remove 158 testes sem critério objetivo. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** AGENTS.md (gate pré-push): troca ou remoção de engine, e mudança em src/physics ou src/routing, exigem suíte de contrato por engine e harness bench/ com limiares verdes. Implementação em tests/layout/contract e bench/
- **occ:** 5

## teste-de-termino-e-constantes-do-produto

- **tipo:** new-rule
- **contexto:** O bug do 'end' do v2 passou porque o runUntilSettled usa 0,005 e o produto usa alphaMin 0,003 (compile-world.test.js:11). O único teste de 'end' pina a cena toda. Com '<=', o 'end' sai no tick 481 = ln(0,003)/ln(0,988), que é o cronograma de alpha, não repouso. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Checklist de code review do AGENTS.md: - helpers de teste importam as constantes do produto; - todo loop de simulação tem teste de término com rAF falso e corpo livre; - um teste distingue repouso cinético de cronograma de alpha.
- **occ:** 4

## plano-fase-4-versionado

- **tipo:** doc-gap
- **contexto:** O plano da Fase 4 (D-massa/D-PI, princípios #1–#7) nunca foi commitado, e o STATE com o roadmap sumiu em 5bb9b8d. A trilha motor reconstruiu um rascunho M0–M11 a partir de protótipos externos. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** .feat-memory/proposals/ (plano M0–M11 com critérios de aceite em pinned e native) + F-0021 planned + UNRELEASED com o próximo passo
- **occ:** 4

## adrs-do-motor-divergem-do-codigo

- **tipo:** doc-gap
- **contexto:** ADR-0011:33-35 exclui o integral, mas compile-world.js:42 liga Ki 0,04. O pad global e o attractTo contrariam 0010/0011. ADR-0009:37 afirma qualidade superior sem medição. O cenário A2 citado pelo ADR-0012 mistura dt com damping. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** ADR novo de reconciliação (sem editar no lugar), correção da F-0017 e nota sobre o A2 no ADR que emendar o ADR-0012
- **occ:** 4

## governance-manifest-test

- **tipo:** heuristic-fix
- **contexto:** O audit 2.1.0 deu 0 issues com o símbolo inexistente runPipeline (F-0001), 0/11 arquivos do motor em contracts e 54,5% das LOC cobertas. O ADR-0009 foi editado no lugar depois de accepted. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** tests/governance/manifest.test.js no job unit, verificando: - paths e símbolos '::' dos contracts; - reciprocidade ADR↔feature; - todo src/**/*.js num contract ou na allowlist; - corpo de ADR accepted imutável. Upstream: a mesma checagem no feat-memory audit.
- **occ:** 3

## manifest-cobre-motor-v2

- **tipo:** doc-gap
- **contexto:** src/physics e compile-world.js (1.645 linhas) não têm feature. A F-0002 não menciona o v2, a flag engine nem a mola, e o v2 viola A3/A4. config-schema.js não expõe live.engine. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** F-0020 physics-engine-v2; F-0002 atualizada; README.md; src/controls/config-schema.js
- **occ:** 3

## baseline-com-comando

- **tipo:** doc-gap
- **contexto:** O dossiê fala em 83 arquivos de teste e 24 cenários, mas o find retorna 78 e o grep -c SCN.push retorna 27. O README fala em ~72 arquivos. Agentes perderam tempo reconciliando. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Template do dossiê do ecossistema e README: todo número de baseline acompanhado do comando que o gerou
- **occ:** 3

## regra-evidencia-reproduzivel

- **tipo:** new-rule
- **contexto:** O commit 113ef70 afirmou uma colisão capsule×rect confirmada, mas só existe o enum (world.js:29). ADR-0010/0011 dizem 'provado em sandbox' sem script. Três ideias alegaram reuso de APIs sem consumidor real. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** AGENTS.md: afirmação 'confirmado' ou 'medido' em commit ou ADR cita caminho:linha, ou script + seed + saída versionados. Alegação de reuso cita o call site consumidor, não só a definição.
- **occ:** 2

## metodologia-de-bancada-de-fisica

- **tipo:** heuristic-fix
- **contexto:** A localidade da proposta perf media só endpoints, e a estabilidade dela só valia com massa 20. Reamostrar a rota infla X em 12% e paralelas em 5,5×. A síntese chegou a usar cenas pinned (nós fixos, reação desligada) como evidência sobre a reciprocidade. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** bench/ e revisão de propostas de física: - mesma cena e mesma métrica; - modos pinned e native sempre rotulados, e pinned nunca como evidência de reciprocidade; - ponto calibrado declarado, com variações; - Hausdorff da polilinha inteira; - baseline reamostrado; - seeds múltiplas.
- **occ:** 2

## skill-physics-experiment

- **tipo:** new-skill
- **contexto:** Os vereditos do playground vivem em localStorage (8 cenários 'aberto'). Mudanças em src/physics exigem comparar a bancada com a baseline antes do push, fora do node --test padrão. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** skills/physics-experiment: roda bench/ contra a baseline, grava métricas, seed e veredito em arquivo versionado e propõe ADR. Acrescentar ao playground um botão de export verdicts.json.
- **occ:** 2

## readme-e-exemplos-divergem-da-dsl

- **tipo:** doc-gap
- **contexto:** A fórmula de pesos do README (317-321) e da F-0005 difere do código. O exemplo forces usa pesos 2 e 3, grampeados em 1 sem aviso. O README nega '[a, b]: {…}', que funciona, e faltam 8 chaves nas tabelas. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** README.md, src/dsl/examples.js e F-0005; a médio prazo, gerar a tabela do README pelo schema único
- **occ:** 2

## regra-feature-planned-antes-do-codigo

- **tipo:** new-rule
- **contexto:** As Fases 1–3 (1.645 linhas em src/physics e compile-world) entraram sem feature planned nem ADR proposed, e o plano ficou fora do repo. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** AGENTS.md + skill memory-debrief: diretório novo em src/ exige feature planned/in_progress no mesmo commit
- **occ:** 1

## readme-e-agents-declaram-pesquisa

- **tipo:** doc-gap
- **contexto:** Há zero ocorrências de pesquisa/experimento/hipótese no repo, e os agentes priorizam como se fosse produto. Não há seção de trabalhos relacionados (Dwyer/Marriott/Wybrow 2008, WebCoLa, vis-network). (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** README.md (Propósito e hipóteses; trabalhos relacionados) e AGENTS.md (ambição de pesquisa como critério de priorização)
- **occ:** 1

## skill-test-audit

- **tipo:** new-skill
- **contexto:** A trilha de testes precisou de 3 agentes ad hoc (cobertura efetiva, oráculos, mutação curada) e de um juiz com sondas metamórficas. O processo deve rodar antes de cada fase do motor. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** skills/test-audit: cobertura sem testes e sem deprecated, módulos não importados, mutação curada, paridade por engine e relatório de falsa segurança
- **occ:** 1

## cobertura-com-exclusoes-e-modulos-orfaos

- **tipo:** heuristic-fix
- **contexto:** O CI não mede cobertura (deploy-tensegrams.yml:31). O 96,61% impresso conta os testes e omite 9 módulos (1.615 linhas) que nenhum teste importa, como pipeline.js e gestures.js. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Script test:cov com --test-coverage-exclude para tests/** e src/routing/physics/**, e um script em scripts/ que lista os src/**/*.js sem importador em tests/, com allowlist. Os dois rodam no CI.
- **occ:** 1

## mutacao-curada-gate-de-fase

- **tipo:** new-rule
- **contexto:** A mutação mata 53,3% com 93,3% de linhas cobertas. Nos arquivos com 100% de linhas, só 9 de 17 mutantes morrem. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Opt-in no fechamento de fase do motor (não no push): scripts/mutate.mjs com score mínimo de 80% em src/physics e compile-world
- **occ:** 1

## proibir-assert-vacuo

- **tipo:** new-rule
- **contexto:** Há asserções que não podem falhar: assert.ok(true) em pipeline-opt-ins.test.js:34-35, testes do tipo 'aceita config sem crash' e screenshots sem comparação no e2e/19. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Checklist de code review do AGENTS.md + grep no CI (assert.ok(true), doesNotThrow isolado, screenshot sem expect)
- **occ:** 1

## ci-por-branch-e-verificacao-de-deploy

- **tipo:** new-rule
- **contexto:** O gate C1 exige E2E local nos dois projetos, mas o CI só roda na main, e a sessão de nuvem não tem browsers do Playwright. A lição 5 (curl de version.js) é manual. pages:write e id-token:write valem para jobs que rodam npm ci. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** AGENTS.md C1: merge na main só via PR com test/e2e verdes. Workflow por branch/PR, com permissões por job e dependabot. Job verify pós-deploy com polling do SHA e e2e-prod.
- **occ:** 1

## merge-ours-unreleased

- **tipo:** heuristic-fix
- **contexto:** Sem driver, o merge=ours fica inerte e gera conflito. Com driver, ele descarta em silêncio entradas de outra branch (reproduzido pela trilha governança). (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** .gitattributes: tirar o UNRELEASED.md; upstream feat-memory: configurar o driver no deploy ou abandoná-lo
- **occ:** 1

## skills-memory-higiene

- **tipo:** refactor-skill
- **contexto:** Skills e .meta.yaml citam IDs do upstream que colidem com os locais (F-0014, F-0019, ADR-0013, ADR-0017). O agente memory-debrief pré-carrega uma skill ausente de .claude/skills. O memory-deploy exige 'Consequências', e o memory-debrief a proíbe. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** skills/*/SKILL.md e .meta.yaml: prefixar os IDs do upstream (FM-ADR-NNNN). O feat-memory deploy expõe as skills em .claude/skills. Adotar um template único de ADR.
- **occ:** 1

## agents-frontmatter-stale-refs

- **tipo:** doc-gap
- **contexto:** AGENTS.md:23-32 aponta para .agent-memory/, agent-memory v0.13.0 e state_max_bytes, que não existem mais. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Frontmatter do AGENTS.md (references e budgets)
- **occ:** 1

## registry-fisica-nao-consumido

- **tipo:** doc-gap
- **contexto:** src/physics/registry.js:1-3 promete contributors plugáveis em runtime, mas compile-world.js:128-144 monta a lista à mão. Só tests/physics/solver.test.js chama buildContributors. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** Comentário de src/physics/registry.js, ou compile-world.js passando a consumir buildContributors
- **occ:** 1

## gate-alocacao-opt-in

- **tipo:** new-rule
- **contexto:** As armadilhas de alocação do V8 voltam com refactors inocentes. A proposta perf caiu de 604 KB/tick para 1 KB/tick só com correções pontuais. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** AGENTS.md: gate opt-in de alocação com --trace-gc para mudanças em src/physics (0 Scavenge em 100 ticks)
- **occ:** 1

## invariantes-da-borda-como-propriedade

- **tipo:** new-rule
- **contexto:** O fuzzer da DSL tem oráculo (fuzz/oracle.mjs) e 220 falhas minimizadas, mas nada disso roda no CI. Foram gerados 22 crashes. (avaliação multiagente 2026-09-30, docs/audits/2026-09-30/)
- **alvo:** tests/dsl/ (teste de propriedade: parse nunca lança, todo diagnóstico tem line ≥ 1 e nada não finito cruza IR→layout) + AGENTS.md
- **occ:** 1
