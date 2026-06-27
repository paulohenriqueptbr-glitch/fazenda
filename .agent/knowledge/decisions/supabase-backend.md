---
type: decision
topic: Supabase como Backend
date: 2026-06-25
tags: [backend, database, auth, supabase]
---

## Summary
Supabase para Postgres, Auth e RLS. Host: aws-1-sa-east-1.pooler.supabase.com.

## Context
Escolha por simplicidade e integração. Supabase oferece auth, database e storage prontos.

## Decision / Finding
- Database: Supabase Postgres
- Auth: Supabase Auth (email/password)
- RLS: Row Level Security para isolamento por user_id
- Storage: Supabase Storage para backups
- Host: aws-1-sa-east-1.pooler.supabase.com

## Rationale
- Setup rápido sem backend customizado
- Auth integrado sem código extra
- RLS para segurança granular
- Free tier generoso para projetos pequenos

## Consequences
- Dependência do Supabase para dados e auth
- Precisa de internet para login inicial
- Offline-first com fallback local

## References
- supabase-schema.sql
- supabase-security-migration.sql
