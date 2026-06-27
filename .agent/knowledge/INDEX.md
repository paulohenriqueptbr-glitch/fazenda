# Project Knowledge Base

| Date | Type | Topic | Summary |
|------|------|-------|---------|
| 2026-06-25 | decision | [Vanilla JS Stack](./decisions/vanilla-js-stack.md) | Projeto usa vanilla JS sem framework - não sugerir React/Vue |
| 2026-06-25 | decision | [Vite + Vercel Deploy](./decisions/vite-vercel-deploy.md) | Vite para dev local, Vercel para produção com serverless functions |
| 2026-06-25 | bug | [Module Not Defined Config](./bugs/module-not-defined-config.md) | api/config.js é CommonJS - plugin Vite necessário para dev |
| 2026-06-25 | bug | [Named Export Mismatch](./bugs/named-export-mismatch.md) | supabaseUnavailableMessage exportada de state.js, não auth.js |
| 2026-06-25 | bug | [Service Worker CDN CSP](./bugs/service-worker-cdn-csp.md) | SW cacheava CDN bloqueado por CSP - usar vendor local |
| 2026-06-25 | gotcha | [Database Migration Safety](./gotchas/database-migration-safety.md) | NUNCA rodar migrations destrutivas sem confirmar ambiente |
| 2026-06-25 | convention | [Logger Usage](./conventions/logger-usage.md) | Usar logger.js em vez de console.log/error/warn |
| 2026-06-25 | decision | [Supabase Backend](./decisions/supabase-backend.md) | Supabase para Postgres, Auth e RLS - host sa-east-1 |
| 2026-06-25 | convention | [Vendor Libraries](./conventions/vendor-libraries.md) | chart.js, lucide.js, supabase.js em vendor/ sem npm |
