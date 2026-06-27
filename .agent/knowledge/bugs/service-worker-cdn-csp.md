---
type: bug
topic: Service Worker CDN bloqueado por CSP
date: 2026-06-25
tags: [bug, sw, security, csp]
---

## Summary
Service worker cacheava chart.js e lucide.js de CDN, mas CSP só permitia 'self' - causava bloqueio.

## Context
Arquivos estavam em CDN mas Content-Security-Policy só permitia domínio próprio.

## Decision / Finding
Removidas URLs CDN do service worker, apontando para vendor local:
- `vendor/chart.js`
- `vendor/lucide.js`
- `vendor/supabase.js`

## Rationale
- CSP deve ser restrito para segurança
- Vendor local evita dependência externa
- Funciona offline sem CDN

## Consequences
- Manter vendor/ atualizado manualmente
- Não adicionar CDN sem atualizar CSP
- Testar SW após mudanças em dependências

## References
- service-worker.js v36
- vendor/ directory
