---
id: ADR-0006
date: 2026-06-02
status: accepted
supersedes: null
superseded_by: null
affects_features: []
related: []
tags: [architecture, build]
---

# ADR-0006 · Sem bundler: ES modules vanilla + importmap

## Contexto

O ecossistema front-end default assume um bundler (Vite, webpack, esbuild) com
passo de build, transpilação e toolchain de dependências. Para uma SPA cuja
única dependência de runtime é `yaml`, esse aparato adiciona complexidade,
tempo de build e superfície de manutenção desproporcionais ao ganho.

## Decisão

Sem bundler. O código é ES modules vanilla carregados direto pelo navegador a
partir de `src/`; a dependência `yaml` é resolvida via **importmap** no
`index.html` (apontando para `node_modules/yaml/browser`). Em dev não há passo de
build — serve-se a raiz por HTTP. O "build" de deploy é apenas montar o conjunto
deployável em `dist/` (index.html, style.css, src/ e a subárvore do yaml),
preservando caminhos relativos, via
[scripts/build-dist.js](scripts/build-dist.js) — sem transpilar nem empacotar.

## Consequências

Zero toolchain de bundling; o que roda em dev é o que roda em produção (mesmos
módulos, mesmos caminhos). Onboarding trivial (`http.server` + browser). O custo:
nenhuma tree-shaking/minificação automática, dependência da disponibilidade de
importmap no browser-alvo, e a necessidade de servir por HTTP (ES modules não
funcionam via `file://`). O Node usa `exports.node` do `yaml` para os testes.

## Alternativas rejeitadas

Vite/webpack/esbuild foram rejeitados pelo custo de toolchain desproporcional a
uma SPA de uma dependência. Versionar uma cópia buildada do `yaml` no repo foi
rejeitado em favor do importmap resolvendo `node_modules/yaml/browser`
diretamente, mantendo a dependência declarada uma só vez no `package.json`.
