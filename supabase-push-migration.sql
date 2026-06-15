-- Migration: push_subscriptions
-- Rode no SQL Editor do Supabase

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  subscription jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Índice para buscar subscriptions por usuário
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

-- RLS: cada usuário só vê/edita suas próprias subscriptions
alter table push_subscriptions enable row level security;

create policy "Usuário vê suas subscriptions"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Usuário insere suas subscriptions"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza suas subscriptions"
  on push_subscriptions for update
  using (auth.uid() = user_id);

create policy "Usuário deleta suas subscriptions"
  on push_subscriptions for delete
  using (auth.uid() = user_id);
