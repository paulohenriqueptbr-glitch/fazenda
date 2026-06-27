---
type: convention
topic: Vendor Libraries (sem npm)
date: 2026-06-25
tags: [dependencies, vendor, libraries]
---

## Summary
chart.js, lucide.js, supabase.js ficam em `vendor/` sem npm. Dependências npm são só para build/dev.

## Context
Para manter controle total sobre versões e evitar bundles desnecessários.

## Decision / Finding
- `vendor/chart.js` - gráficos
- `vendor/lucide.js` - ícones
- `vendor/supabase.js` - cliente Supabase v2.108.0
- npm: apenas esbuild, vite, jest, express, dotenv

## Rationale
- Controle total sobre versões
- Sem overhead de npm para libs frontend
- Funciona offline sem CDN
- Mais fácil de auditar dependências

## Consequences
- Atualizar vendor/ manualmente
- Não adicionar novas libs npm sem necessidade
- CSP configurado para permitir apenas 'self'

## References
- vendor/ directory
- service-worker.js
