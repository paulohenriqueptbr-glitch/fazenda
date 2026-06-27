---
type: convention
topic: Uso do Logger Centralizado
date: 2026-06-25
tags: [logging, debugging, convention]
---

## Summary
Usar `js/logger.js` em vez de `console.log/error/warn` diretamente. Logger só emite logs em desenvolvimento.

## Context
Para manter produção limpa de logs desnecessários e ter controle centralizado de logging.

## Decision / Finding
- Importar `logger` de `js/logger.js`
- Usar `logger.log()`, `logger.error()`, `logger.warn()`
- Logger só emite em modo desenvolvimento
- Não usar `console.log/error/warn` diretamente

## Rationale
- Produção fica limpa de logs
- Controle centralizado de logging
- Fácil de desativar em produção

## Consequences
- Todos os arquivos JS devem importar logger
- Não adicionar console.log diretamente
- Logger pode ser expandido com níveis (debug, info, warn, error)

## References
- js/logger.js
- AGENTS.md: "Logger (js/logger.js) deve ser usado"
