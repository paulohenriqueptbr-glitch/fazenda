---
type: bug
topic: Named Export Mismatch - supabaseUnavailableMessage
date: 2026-06-25
tags: [bug, imports, modules]
---

## Summary
`js/app.js` importava `supabaseUnavailableMessage` de `auth.js`, mas a função é exportada de `state.js`.

## Context
Ao importar de módulo errado, causava SyntaxError: does not provide an export named 'supabaseUnavailableMessage'.

## Decision / Finding
Ajustado import em `js/app.js` para importar de `state.js` em vez de `auth.js`.

## Rationale
- `state.js` é onde a função é definida e exportada
- `auth.js` só importa para uso interno
- Imports devem vir do módulo que define/exporta

## Consequences
- Verificar exports antes de importar
- Funções devem ser exportadas do módulo que as define

## References
- js/app.js: import corrigido
- js/state.js: export da função
