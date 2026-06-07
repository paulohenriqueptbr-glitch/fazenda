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
- Cotação do leite salva no Supabase.
- Instalação como PWA no celular.
- Página de privacidade e contato de suporte configurável.

## Arquivos principais

- `index.html`: interface do app.
- `privacy.html`: política de privacidade pública.
- `app.js`: regras de tela, login e integração com Supabase.
- `styles.css`: visual do app.
- `manifest.webmanifest`: configuração de instalação PWA.
- `service-worker.js`: cache básico do PWA.
- `supabase-schema.sql`: estrutura do banco no Supabase.
- `api/config.js`: carrega a configuração do Supabase pelas variáveis da Vercel.
- `config.example.js`: exemplo local, sem credenciais reais.

## Rodar localmente

Crie um arquivo `.env` na pasta do projeto com suas credenciais públicas do Supabase:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
SUPPORT_WHATSAPP_NUMBER=5582999999999
SUPPORT_EMAIL=suporte@seudominio.com.br
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
8. Não coloque `.env`, `config.js` ou chaves reais no repositório.

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
- Regenerar a anon/publishable key se ela já apareceu em commits antigos.
- Ativar rate limit no Supabase Auth, por exemplo 5 tentativas de login por hora por IP.
- Usar `supabase-security-migration.sql` para reforçar RLS, políticas e constraints em bancos já existentes.
- A aba Config possui exportação manual em JSON para backup dos dados visíveis ao usuário logado.
- A página `privacy.html` explica dados coletados, segurança, backup e contato.
