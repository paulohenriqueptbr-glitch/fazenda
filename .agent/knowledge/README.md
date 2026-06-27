# Knowledge Base - Terrasyn

Base de conhecimento do projeto para preservar decisões arquiteturais,
convenções, bugs resolvidos e armadilhas conhecidas.

## Como Usar

1. Ao iniciar uma sessão, ler `INDEX.md` para ver entradas relevantes
2. Seguir links para ler arquivos completos
3. Ao aprender algo novo, adicionar entrada usando skill `knowledge-base-update`

## Estrutura

```
.knowledge/
├── INDEX.md                    # Índice com todas as entradas
├── README.md                   # Este arquivo
├── decisions/                  # Decisões de arquitetura
├── bugs/                       # Bugs resolvidos com causa raiz
├── gotchas/                    # Armadilhas e issues conhecidas
└── conventions/                # Convenções do projeto
```

## Formato

Cada arquivo usa frontmatter YAML:
```yaml
---
type: decision|bug|gotcha|convention|research
topic: Título legível
date: YYYY-MM-DD
tags: [tag1, tag2]
---
```
