---
type: bug
topic: Module Not Defined em config.js
date: 2026-06-25
tags: [bug, vite, commonjs]
---

## Summary
`api/config.js` é CommonJS (module.exports) mas Vite dev espera ESM - causava erro "module is not defined".

## Context
Ao rodar `vite dev`, `api/config.js` tentava usar `module.exports` que não existe em ESM.

## Decision / Finding
Criado plugin `devApiConfigPlugin` em `vite.config.js` que:
1. Intercepta requisição para `/api/config.js`
2. Lê as mesmas env vars do Supabase
3. Retorna handler que injeta `window.CONTROLE_LEITE_CONFIG`

## Rationale
- Não alterar `api/config.js` (precisa ser CommonJS para Vercel)
- Plugin Vite simula o behavior serverless em dev
- Mantém compatibilidade entre dev e produção

## Consequences
- Qualquer mudança em `api/config.js` deve ser testada tanto em dev quanto em produção
- Plugin Vite é ponto único de configuração para dev

## References
- vite.config.js: devApiConfigPlugin (linhas ~20-40)
- api/config.js: serverless function
