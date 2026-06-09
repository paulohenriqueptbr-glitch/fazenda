# 🐄 Controle Fazenda v2.0

Sistema PWA de gerenciamento de fazenda leiteira com Supabase, offline-first e gráficos avançados.

## ✨ Novas Features (v2.0)

### Alertas e Lembretes
- Lembretes manuais com categoria, data e observacoes
- Alertas automaticos de producao diaria pendente
- Alertas de parto previsto, lactacao longa e retorno de lavoura
- Status visual para atrasado, hoje, proximos 7 dias e concluido

### 🌙 **Dark Mode**
- Tema automático baseado na preferência do sistema
- Reduz cansaço visual à noite
- Economiza bateria em telas OLED

Para ativar: Configure seu SO para Dark Mode

### 📊 **Gráficos Avançados com Chart.js**
- Gráfico interativo com 30 dias de histórico
- Linha de tendência de produção
- Média mensal sobreposta
- Tooltip ao passar o mouse
- Visualizar produção exata por dia

**Recursos:**
- Zoom interativo
- Hover para detalhes
- Responsivo para celulares

### Robustez offline
- Fila de sincronizacao limitada para evitar crescimento infinito
- Fallback local quando tabelas novas ainda nao foram migradas
- Limpeza local de registros relacionados ao excluir animal
- Validacao centralizada para manejos de lavoura

### ✅ **Testes Automatizados**
- Testes das funções críticas
- Validação de datas
- Validação de números
- Validação de strings
- Lógica de negócio
- Segurança (HTML escape)

**Rodar testes:**
```bash
npm install
npm test
```

---

## 🔧 **Correções Críticas (v1.5 → v2.0)**

✅ **Validação de Datas**
- Impede registrar produção futura
- Valida ranges (fim >= início)

✅ **Timezone Bug Fix**
- Cálculo correto de parto (285 dias)
- Sem offset incorreto

✅ **Modal de Edição**
- UX melhorada (adeus prompts!)
- Visualiza valores atuais
- Cancelamento fácil

✅ **Validação de Números**
- Produção: 0-1000 litros
- Lactação: 0-500 litros/dia
- Cotação: 0-100 R$/L

✅ **Memory Leak Fix**
- Event listeners não duplicam
- Proteção contra re-inicialização

✅ **Cascade Delete**
- Ao deletar animal, limpa:
  - Lactações
  - Reprodução
  - Medicações

✅ **Validação de Strings**
- Animal ID: 1-100 caracteres
- Medicamento: 1-100 caracteres
- Dosagem: máximo 100 caracteres

---

## 📦 **Instalação**

### Localmente

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/fazenda.git
cd fazenda

# 2. Crie .env com suas credenciais Supabase
echo "SUPABASE_URL=https://seu-projeto.supabase.co" > .env
echo "SUPABASE_ANON_KEY=sua-chave-anon" >> .env

# 3. Instale dependências (para testes)
npm install

# 4. Inicie o servidor
npm start

# 5. Acesse http://localhost:5173
```

### Produção (Vercel)

1. Push para GitHub
2. Conecte no painel da Vercel
3. Configure variáveis em Deployment → Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy automático ✅

---

## 📊 **Estrutura de Dados**

### Tabelas Supabase

| Tabela | Função |
|--------|--------|
| `milk_records` | Produção diária |
| `animals` | Cadastro de animais |
| `lactation_records` | Lactações |
| `breeding_records` | Reprodução/Gestação |
| `medication_records` | Medicações |
| `crop_events` | Manejos da lavoura |
| `reminders` | Lembretes e alertas manuais |
| `app_settings` | Cotação do leite |

---

## 🧪 **Testes**

### Rodar Todos os Testes
```bash
npm test
```

### Rodar em Watch Mode
```bash
npm run test:watch
```

### Gerar Coverage Report
```bash
npm run test:coverage
```

### O que é Testado

✅ **Validação de Datas**
- Datas válidas/inválidas
- Datas futuras rejeitadas
- Ranges de data

✅ **Validação de Números**
- Valores dentro/fora do range
- Limites de produção
- Valores não-numéricos

✅ **Lógica de Negócio**
- Produção mensal
- Média de produção
- Melhor dia
- Contagem de animais
- Cálculo de gestação

✅ **Segurança**
- HTML escape contra XSS
- Sanitização de inputs

---

## 🚀 **Performance**

### Antes vs Depois (v1.5 vs v2.0)

| Métrica | v1.5 | v2.0 | Melhoria |
|---------|------|------|----------|
| Memória | 5.2MB | 3.8MB | **-27%** 📉 |
| Gráficos | Barras estáticas | Chart.js interativo | ✅ |
| Dark Mode | Não | Sim (automático) | ✅ |

---

## 📱 **Compatibilidade**

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Mobile (iOS 12+, Android 6+)
- ✅ PWA Installable
- ✅ Offline Mode (com localStorage)
- ✅ Sincronização automática

---

## 🔐 **Segurança**

- 🔒 RLS (Row Level Security) no Supabase
- 🔒 Isolamento por user_id
- 🔒 Apenas chave pública (anon) no frontend
- 🔒 HTML escape contra XSS
- 🔒 Rate limit de login (5 tentativas/hora)
- ⚠️ localStorage em texto plano (veja roadmap)

---

## 📋 **Roadmap**

### v2.1 (Próximas)
- [ ] Encriptar localStorage
- [ ] Alertas de produção baixa
- [ ] Exportar relatórios em PDF
- [ ] Integração WhatsApp (notificações)

### v2.5
- [ ] Múltiplos usuários/fazendas
- [ ] API REST de integração
- [ ] Mobile app nativo (React Native)
- [ ] Análise preditiva (ML)

---

## 💬 **Suporte**

Dúvidas ou problemas? Abra uma issue no GitHub!

---

## 📄 **License**

MIT - Sinta-se livre para usar e modificar!

---

**Desenvolvido com ❤️ para fazendas leiteiras** 🐄
