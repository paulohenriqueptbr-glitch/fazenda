# Controle Fazenda

PWA para gerenciamento de fazenda leiteira. O app possui login via Supabase e registra produção de leite, animais, lactações, reprodução, medicações e cotação do leite.

## Funcionalidades

- Login com e-mail e senha pelo Supabase Auth.
- Registro diário de litros produzidos.
- Resumo de produção do dia e do mês.
- Cadastro de animais.
- Controle de lactação, reprodução e medicação.
- Edição e exclusão de registros.
- Relatórios com total mensal, valor estimado, média e gráfico recente.
- Cotação do leite salva no Supabase.
- Instalação como PWA no celular.

## Arquivos principais

- `index.html`: interface do app.
- `app.js`: regras de tela, login e integração com Supabase.
- `styles.css`: visual do app.
- `manifest.webmanifest`: configuração de instalação PWA.
- `service-worker.js`: cache básico do PWA.
- `supabase-schema.sql`: estrutura do banco no Supabase.
- `config.js`: URL e chave pública do Supabase.

## Rodar localmente

```powershell
node server.js
```

Depois acesse:

```text
http://127.0.0.1:5173
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Em Authentication, crie o usuário administrador.
3. Abra o SQL Editor.
4. Rode todo o conteúdo de `supabase-schema.sql`.
5. Confira se `config.js` tem a URL e a chave pública do projeto.

## Publicar na Vercel

1. Envie o projeto para o GitHub.
2. Na Vercel, importe o repositório.
3. Use framework `Other`.
4. Deixe Build Command vazio.
5. Use Output Directory como `.` se a Vercel pedir.
6. Desative Vercel Authentication em Deployment Protection se quiser acesso público.

## Observação de segurança

As políticas atuais permitem acesso a qualquer usuário autenticado. Para múltiplas fazendas ou múltiplos administradores, o próximo passo é adicionar `user_id` ou `farm_id` nas tabelas e filtrar os dados por usuário.
