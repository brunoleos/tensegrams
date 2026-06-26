---
id: ADR-0013
date: 2026-06-18
status: accepted
supersedes: ADR-0005
superseded_by: null
affects_features: [F-0002, F-0003]
related: [ADR-0010, ADR-0011, ADR-0012]
tags: [architecture, layout, routing]
---

# ADR-0013 · Arquitetura de plugins de layout/routing (contratos únicos)

## Contexto

Split do ADR-0005 (ver "Procedência"). O ADR-0005 acoplava duas decisões: (a) a
arquitetura de plugins de layout/routing e (b) um modelo de força concreto
(atrator central como única base; arestas passivas; separação só por collision
layers). A parte (b) foi superada pela exploração do motor físico unificado
(ADR-0010/0011/0012). Este ADR isola e **mantém vigente** a parte (a), que segue
correta e independe do modelo de força escolhido.

## Decisão

Posicionamento de nós e formato de arestas são duas camadas de plugins
**independentes**, cada uma atrás de um contrato único:

- **layout adapters** — contrato em
  [src/layout/adapter.js](src/layout/adapter.js), registry em
  [src/layout/registry.js](src/layout/registry.js).
- **edge routers** — contrato em [src/routing/router.js](src/routing/router.js),
  registry em [src/routing/registry.js](src/routing/registry.js).

Layout e routing são **ortogonais**: qualquer combinação layout×router funciona.
Adicionar um layout ou um router é registrar um plugin que cumpre o contrato, sem
tocar o núcleo. Solvers físicos (routing — F-0017; layout unificado — ADR-0010)
são plugins dentro desta arquitetura, não exceções a ela.

## Consequências

A evolução de algoritmos de layout e de routing fica desacoplada do núcleo e uma
da outra. O modelo de **força** usado por um adapter de layout é uma decisão
separada desta (ver ADR-0010/0011/0012 para o modelo vigente), e pode mudar sem
afetar o contrato de plugin nem a camada de routing.

## Alternativas rejeitadas

Layout/routing acoplados ao núcleo foram rejeitados por engessar a evolução dos
algoritmos. (O modelo de força clássico "arestas como molas", rejeitado no
ADR-0005 original, foi **revisto** pelo ADR-0010/0012 no contexto do motor
unificado — não é mais uma alternativa rejeitada deste ADR, que trata só da
arquitetura de plugins.)

## Procedência

Split do **ADR-0005** (superseded). O ADR-0005 foi superado e dividido em:
- **este ADR-0013** — a arquitetura de plugins (parcialidade mantida);
- **ADR-0010/0011/0012** — o novo modelo de força (novidade) que substitui o
  "atrator central único / arestas passivas / separação só por collision".
