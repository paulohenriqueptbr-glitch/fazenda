# Controle Fazenda

PWA para gerenciamento de fazenda leiteira. O app possui login via Supabase e registra produção de leite, animais, lactações, reprodução, medicações e cotação do leite.

## Funcionalidades

- Login com e-mail e senha pelo Supabase Auth.
- Cadastro de novos usuários pelo Supabase Auth.
- Registro diário de litros produzidos.
- Resumo de produção do dia e do mês.
- Cadastro de animais.
- Controle de lactação, reprodução e medicação.
- Edição e exclusão de registros.
- Relatórios com total mensal, valor estimado, média e gráfico recente.
- Impressão de relatório mensal com lactação, medicações, previsão de parto e faturamento estimado.
- Onboarding inicial para fazenda, preço do litro, primeiro animal e primeira produção.
- Painel de cliente na aba Config com fazenda, responsável, WhatsApp, assinatura e vencimento.
- Página comercial pública em `landing.html`.
- Admin interno em `admin.html` para controlar status de assinatura.
- Cotação do leite salva no Supabase.
- Assinatura simples por WhatsApp e Pix manual.
- Instalação como PWA no celular.
- Página de privacidade e contato de suporte configurável.

## Arquivos principais

- `index.html`: interface do app.
- `privacy.html`: política de privacidade pública.
- `landing.html`: página comercial pública.
- `admin.html`: painel interno para controlar clientes.
- `app.js`: regras de tela, login e integração com Supabase.
- `styles.css`: visual do app.
- `manifest.webmanifest`: configuração de instalação PWA.
- `service-worker.js`: cache básico do PWA.
- `supabase-schema.sql`: estrutura do banco no Supabase.
- `api/config.js`: carrega a configuração do Supabase pelas variáveis da Vercel.
- `api/admin-customers.js`: endpoint server-side do admin interno.
- `api/backup.js`: endpoint server-side para backup no Supabase Storage.
- `config.example.js`: exemplo local, sem credenciais reais.

## Rodar localmente

Crie um arquivo `.env` na pasta do projeto com suas credenciais públicas do Supabase:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
SUPPORT_WHATSAPP_NUMBER=5582999999999
SUPPORT_EMAIL=suporte@seudominio.com.br
TRIAL_DAYS=14
PLAN_PRICE=39
PIX_KEY=sua-chave-pix
PIX_RECEIVER=Seu Nome ou Empresa
```

Depois rode:

```powershell
node server.js
```

Depois acesse:

```text
http://127.0.0.1:5173
```

O login local precisa de internet para validar e-mail e senha no Supabase. Depois de entrar uma vez online, o app consegue abrir offline com a sessão salva e guardar registros para sincronizar depois.

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Em Authentication, crie o usuário administrador.
3. Abra o SQL Editor.
4. Para banco novo, rode todo o conteúdo de `supabase-schema.sql`.
5. Para banco já existente, prefira rodar `supabase-security-migration.sql`, que ativa RLS e adiciona políticas sem apagar tabelas.
   - Se quiser apenas ligar RLS e políticas, use `supabase-rls-only.sql`.
6. No painel da Vercel, cadastre as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
   - A aplicação também aceita `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
7. Cadastre `SUPPORT_WHATSAPP_NUMBER` para o botão de WhatsApp e, se quiser, `SUPPORT_EMAIL`.
8. Cadastre `TRIAL_DAYS`, `PLAN_PRICE`, `PIX_KEY` e `PIX_RECEIVER` para a página comercial e a área de assinatura.
9. Não coloque `.env`, `config.js` ou chaves reais no repositório.

## Vender o produto

- Página comercial: publique `https://seu-dominio/landing`.
- Login do cliente: `https://seu-dominio/`.
- Privacidade: `https://seu-dominio/privacy`.
- Assinatura inicial: use o botão WhatsApp e Pix manual.
- Teste grátis: controle pelo status `Teste` e data de vencimento no `admin.html`.

## Admin interno

Cadastre estas variáveis privadas na Vercel:

```text
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
ADMIN_TOKEN=crie-um-token-longo-para-o-admin
```

Depois acesse:

```text
https://seu-dominio/admin
```

Use o `ADMIN_TOKEN` para carregar clientes e alterar status de assinatura. A `service_role` fica somente no endpoint server-side.
O admin grava status e vencimento em `subscription_admin`, uma chave separada do perfil editado pelo cliente. Rode a migração de segurança atualizada para impedir que usuários alterem essa chave pelo app.

## Backup automático

1. Crie um bucket privado no Supabase Storage, por exemplo `backups`.
2. Cadastre na Vercel:

```text
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
BACKUP_BUCKET=backups
CRON_SECRET=crie-um-token-longo-para-o-cron
```

Mantenha `CRON_SECRET` ou `BACKUP_CRON_SECRET` configurado; o endpoint recusa backup sem segredo.

3. O `vercel.json` agenda `/api/backup` diariamente às 03:00 UTC.
4. O backup será gravado em `backups/controle-fazenda/AAAA-MM-DD.json`.

## Publicar na Vercel

1. Envie o projeto para o GitHub.
2. Na Vercel, importe o repositório.
3. Use framework `Other`.
4. Deixe Build Command vazio.
5. Use Output Directory como `.` se a Vercel pedir.
6. Desative Vercel Authentication em Deployment Protection se quiser acesso público.

## Segurança

- As credenciais reais ficam fora do GitHub, configuradas no painel da Vercel.
- O app usa apenas a chave pública anon do Supabase no navegador.
- O isolamento dos dados deve ser feito com RLS no Supabase usando `user_id`.
- Nunca use a `service_role` key no frontend ou em arquivos públicos.
- Use `SUPABASE_SERVICE_ROLE_KEY` somente em variáveis de ambiente da Vercel para `api/admin-customers.js` e `api/backup.js`.
- O status comercial do cliente fica em `app_settings.subscription_admin` e deve ser alterado apenas pelo endpoint server-side do admin.
- Regenerar a anon/publishable key se ela já apareceu em commits antigos.
- Ativar rate limit no Supabase Auth, por exemplo 5 tentativas de login por hora por IP.
- Usar `supabase-security-migration.sql` para reforçar RLS, políticas e constraints em bancos já existentes.
- A aba Config possui exportação manual em JSON para backup dos dados visíveis ao usuário logado.
- A página `privacy.html` explica dados coletados, segurança, backup e contato.
