-- ============================================================================
-- MIGRACAO: lembretes e alertas manuais
-- ============================================================================
-- Use este script em um banco Supabase existente.
-- Ele cria a tabela reminders sem apagar dados e ativa RLS por usuario.
-- ============================================================================

create table if not exists reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  category     text not null default 'Geral',
  due_date     date not null,
  notes        text,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_reminders_user_due
  on reminders(user_id, done, due_date);

alter table reminders enable row level security;

drop policy if exists "reminders_select" on reminders;
drop policy if exists "reminders_insert" on reminders;
drop policy if exists "reminders_update" on reminders;
drop policy if exists "reminders_delete" on reminders;

create policy "reminders_select" on reminders
  for select using (auth.uid() = user_id);

create policy "reminders_insert" on reminders
  for insert with check (auth.uid() = user_id);

create policy "reminders_update" on reminders
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reminders_delete" on reminders
  for delete using (auth.uid() = user_id);
