---
type: decision
topic: Vite + Vercel Deploy
date: 2026-06-25
tags: [infra, deploy, build]
---

## Summary
Vite para dev local (porta 5173), Vercel para produção com serverless functions em `api/`.

## Context
Precisa de hot reload em dev e deploy automático em produção. Vercel oferece serverless functions para APIs.

## Decision / Finding
- `vite dev` para desenvolvimento local
- Vercel para produção (deploy automático via GitHub)
- `api/config.js` é serverless function (CommonJS)
- Plugin Vite em `vite.config.js` simula handler em dev

## Rationale
- Vite: fast HMR, build otimizado
- Vercel: deploy automático, serverless functions, edge network
- Compatibilidade: plugin Vite simula behavior da Vercel em dev

## Consequences
- Manter `vite.config.js` sincronizado com necessidades de dev
- Não quebrar `api/config.js` ao fazer mudanças
- Env vars precisam estar tanto em `.env` (dev) quanto na Vercel (prod)

## References
- vite.config.js: devApiConfigPlugin
- api/config.js: serverless function
