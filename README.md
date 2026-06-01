# Controle Leite

PWA para controle de producao de leite, animais e estoque. O app pode rodar localmente para testes e pode sincronizar com Supabase quando as chaves forem configuradas.

## Abrir no computador

```powershell
node server.js
```

Depois acesse:

```text
http://127.0.0.1:5173
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode o conteudo do arquivo `supabase-schema.sql`.
4. Copie a Project URL e a chave `anon public`.
5. Preencha o arquivo `config.js`:

```js
window.CONTROLE_LEITE_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_ANON_PUBLIC",
};
```

Enquanto essas chaves estiverem vazias, o app salva os dados apenas no navegador.

## Publicar na Vercel

1. Envie esta pasta para um repositorio no GitHub.
2. Na Vercel, importe o repositorio.
3. Use as configuracoes padrao para projeto estatico.
4. Depois do deploy, abra o link HTTPS no celular para instalar como PWA.

## Observacao de seguranca

O esquema inicial libera leitura e cadastro publico para facilitar o primeiro deploy. Antes de usar com dados reais, o ideal e adicionar login e politicas de seguranca por usuario no Supabase.
