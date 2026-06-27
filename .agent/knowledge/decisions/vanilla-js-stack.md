---
type: decision
topic: Vanilla JS Stack - Sem Framework
date: 2026-06-25
tags: [stack, architecture, frontend]
---

## Summary
Projeto usa vanilla JS modular (ES Modules) sem framework. Não sugerir React/Vue a menos que Paulo peça explicitamente.

## Context
Escolha inicial do projeto para manter simplicidade e controle total sobre o código. Evita dependências pesadas e complexidade de build desnecessária.

## Decision / Finding
- Frontend: Vanilla JS com ES Modules
- Build: Vite
- Sem framework CSS (CSS puro)
- Módulos organizados em `js/` com import/export

## Rationale
- Controle total sobre o código
- Sem overhead de framework
- Mais fácil de manter para um único desenvolvedor
- Performance melhor sem overhead de virtual DOM

## Consequences
- UI mais simples, sem componentes reutilizáveis complexos
- Mais código manual para interatividade
- Benefício: zero dependências de framework no bundle final

## References
- AGENTS.md: "Projeto vanilla JS - evitar sugerir frameworks"
