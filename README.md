# 🐄 Fazenda Sertão — Sistema de Gestão Rural

> Projeto desenvolvido para a disciplina de **Algoritmos e Lógica de Programação**

---

## 📋 Sobre o Projeto

O **Fazenda Sertão** é um sistema de gestão rural desenvolvido em Python como projeto avaliativo da cadeira de **Algoritmos e Lógica de Programação**. O sistema simula o gerenciamento de uma fazenda, permitindo o controle de animais, produção de leite, estoque de produtos e atendimento a clientes.

O projeto foi desenvolvido respeitando as **restrições impostas pelo professor**, utilizando exclusivamente os conteúdos abordados em sala de aula, sem o uso de bibliotecas externas, funções avançadas ou recursos além do escopo da disciplina.

---

## 🎯 Objetivo Acadêmico

Aplicar na prática os conceitos fundamentais de lógica de programação aprendidos em sala, demonstrando domínio sobre:

- Declaração e uso de **variáveis**
- **Formatação** de saída com f-strings
- **Operadores lógicos** (`and`, `or`, `not`)
- **Operadores aritméticos** (`+`, `-`, `*`, `/`)
- Estruturas de repetição: **`for`** e **`while`**
- **Listas simples** e listas aninhadas (listas de listas)
- Estruturas condicionais **`if`, `elif`, `else`**
- Entrada de dados com **`input()`**

---

## 🚀 Funcionalidades

O sistema possui dois perfis de acesso: **Administrador** e **Cliente**.

### 🔐 Autenticação
- Login com usuário e senha
- Verificação de credenciais via lista de usuários
- Redirecionamento automático para o menu correspondente ao perfil

---

### 🛠️ Menu do Administrador

| Opção | Funcionalidade |
|-------|---------------|
| 1 | Cadastrar Animal |
| 2 | Buscar Animal |
| 3 | Atualizar Animal |
| 4 | Remover Animal |
| 5 | Listar Animais |
| 6 | Registrar Produção de Leite |
| 7 | Criar Produto |
| 8 | Adicionar Produto ao Estoque |
| 9 | Ver Estoque Atual |
| 10 | Gráfico de Produção de Leite |
| 11 | Cadastrar Usuário |
| 12 | Sair |

**Detalhes das funcionalidades:**

- **Cadastro de Animais:** suporta Bovino de Leite, Caprino, Ovino e Suíno, com status de Em Lactação, Para Engorda ou Disponível para Venda. Valida identificação duplicada.
- **Busca e Atualização:** permite localizar e editar tipo, identificação ou status de qualquer animal cadastrado.
- **Remoção:** exibe detalhes do animal e solicita confirmação antes de excluir.
- **Produção de Leite:** acumula litros produzidos por mês ao longo do ano.
- **Gráfico de Produção:** exibe um gráfico de barras horizontal no terminal usando caracteres `▇`, com escala proporcional ao maior valor registrado.
- **Gestão de Produtos:** criação de produtos com nome, peso (kg) e preço, com controle de estoque.
- **Cadastro de Usuário:** permite criar novos usuários com ou sem permissão de administrador (mínimo de 4 caracteres para usuário e senha).

---

### 🛒 Menu do Cliente

| Opção | Funcionalidade |
|-------|---------------|
| 1 | Ver Estoque Disponível |
| 2 | Comprar Produto |
| 3 | Comprar Animal |
| 4 | Agendar Retirada |
| 5 | Registrar Interesse em Produto |
| 6 | Ver Meus Interesses |
| 7 | Sair |

**Detalhes das funcionalidades:**

- **Estoque Disponível:** visualiza animais ou produtos cadastrados.
- **Comprar Produto:** valida estoque antes de confirmar a compra e debita a quantidade.
- **Comprar Animal:** lista somente animais com status "Disponível p/ venda" e remove o animal do sistema após a compra.
- **Agendar Retirada:** permite agendar data e horário para retirada de itens já comprados.
- **Lista de Interesses:** o cliente pode marcar produtos de interesse para acompanhamento futuro, sem duplicatas.

---

## 🗂️ Estrutura de Dados

Todas as informações são armazenadas em **listas aninhadas** (listas de listas), conforme o conteúdo da disciplina:

```python
# Usuários: [nome_de_usuário, senha, é_admin]
usuarios = [
    ["johndoe", "12345", True],
    ["janedoe", "12345", False]
]

# Animais: [tipo, identificação, status]
animais = []

# Métricas mensais: [mês, litros_acumulados]
metricas = [
    ["Jan", 0], ["Fev", 0], ["Mar", 0], ...
]

# Produtos: [nome, kg, quantidade_em_estoque, preço]
produtos = []

# Listas auxiliares
lista_compras = []
agendamentos = []       # [data, hora, produto]
lista_interesses = []
```

---

## ▶️ Como Executar

**Pré-requisito:** Python 3.10 ou superior instalado na máquina.

> A versão 3.10+ é necessária para o uso correto de f-strings com alinhamento de texto (`:<15`, `:<10`) utilizadas na formatação das tabelas do sistema.

**Passo a passo:**

```bash
# 1. Clone ou baixe o arquivo do projeto
# 2. No terminal, navegue até a pasta onde o arquivo está salvo
cd caminho/para/o/projeto

# 3. Execute o programa
python main.py
```

---

## 🔑 Credenciais de Acesso (Padrão)

| Usuário | Senha | Perfil |
|---------|-------|--------|
| `johndoe` | `12345` | Administrador |
| `janedoe` | `12345` | Cliente |

> Novos usuários podem ser criados pelo administrador através da opção **11 — Cadastrar Usuário** no menu.

---

## 💡 Tipos de Animais Suportados

| Código | Tipo |
|--------|------|
| 1 | Bovino de Leite |
| 2 | Caprino |
| 3 | Ovino |
| 4 | Suíno |

## 📊 Status dos Animais

| Código | Status |
|--------|--------|
| 1 | Em lactação |
| 2 | Para engorda |
| 3 | Disponível p/ venda |

---

## 📁 Estrutura do Projeto

```
fazenda-sertao/
│
└── main.py   # Arquivo principal com todo o código do sistema
```

> Por se tratar de um projeto acadêmico com restrições de escopo, todo o código está concentrado em um único arquivo `.py`, sem separação em módulos ou funções.

---

## 🧠 Conceitos Aplicados

| Conceito | Onde é utilizado |
|----------|-----------------|
| `while` loop | Loop principal do menu, loop de login, validações de entrada |
| `for` loop | Iteração sobre listas de animais, produtos e métricas |
| `for/else` | Verificação de existência de itens nas listas |
| Operadores lógicos | Verificação de login (`and`), controle de fluxo (`not`, `or`) |
| Operadores aritméticos | Cálculo de estoque, acúmulo de produção de leite, escala do gráfico |
| Listas aninhadas | Estrutura principal de dados (usuários, animais, produtos) |
| F-strings | Formatação de tabelas e mensagens de saída |
| `input()` | Captura de todas as interações do usuário |
| Variáveis booleanas | Controle de sessão (`logado`, `admin`, `duplicado`) |

---

## 📌 Observações

- Os dados **não são persistidos** entre execuções. Ao encerrar o programa, todas as informações são perdidas, pois o armazenamento em arquivo não foi abordado na disciplina.
- As validações de entrada (valores negativos, opções inválidas, campos vazios) foram implementadas com loops `while`, seguindo a lógica apresentada em sala.
- O gráfico de produção de leite (opção 10) é exibido diretamente no terminal e usa escala proporcional ao mês com maior produção registrada.

---

*Projeto desenvolvido com fins exclusivamente acadêmicos.*