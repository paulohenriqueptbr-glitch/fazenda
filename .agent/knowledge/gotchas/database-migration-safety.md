---
type: gotcha
topic: Database Migration Safety - NUNCA Rodar Direto
date: 2026-06-25
tags: [database, safety, supabase, production]
---

## Summary
Já houve perda de dados em produção por rodar migration destrutiva sem confirmar ambiente. SEMPRE confirmar antes de rodar SQL.

## Context
Incidente: arquivo de schema destrutivo rodado junto com migration na mesma sessão. Recuperação via autobackup do Supabase.

## Decision / Finding
**REGRA CRÍTICA:** Nunca rodar arquivos de schema/migração direto em produção sem:
1. Confirmar explicitamente qual ambiente (dev vs prod)
2. Ter certeza de que SQL não contém DROP/TRUNCATE/recriação
3. Confirmar que existe backup recente

## Rationale
- Dados de produção são irreversíveis
- Backup pode não estar disponível quando necessário
- Prevenção é mais barata que recuperação

## Consequences
- Sempre usar `revisor-db` antes de rodar SQL
- Nunca executar migrations sem confirmação explícita
- Manter backup automatizado configurado

## References
- AGENTS.md: "REGRA CRÍTICA DE SEGURANÇA"
- Incidente documentado em 2026
