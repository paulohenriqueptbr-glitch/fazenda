-- ============================================================================
-- MIGRACAO: ambiente de lavoura
-- ============================================================================
-- Use este script em um banco Supabase existente.
-- Ele cria a tabela crop_events sem apagar dados e ativa RLS por usuario.
-- ============================================================================

create table if not exists crop_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  plot_name    text not null,
  crop_name    text not null,
  event_type   text not null,
  event_date   date not null,
  product      text,
  dosage       text,
  area_tasks   numeric(10, 2),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_crop_events_user_date
  on crop_events(user_id, event_date desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crop_events_area_tasks_nonnegative') then
    alter table crop_events
      add constraint crop_events_area_tasks_nonnegative
      check (area_tasks is null or area_tasks >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'crop_events_date_not_future') then
    alter table crop_events
      add constraint crop_events_date_not_future
      check (event_date <= current_date);
  end if;
end $$;

alter table crop_events enable row level security;

drop policy if exists "crop_events_select" on crop_events;
drop policy if exists "crop_events_insert" on crop_events;
drop policy if exists "crop_events_update" on crop_events;
drop policy if exists "crop_events_delete" on crop_events;

create policy "crop_events_select" on crop_events
  for select using (auth.uid() = user_id);

create policy "crop_events_insert" on crop_events
  for insert with check (auth.uid() = user_id);

create policy "crop_events_update" on crop_events
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "crop_events_delete" on crop_events
  for delete using (auth.uid() = user_id);
