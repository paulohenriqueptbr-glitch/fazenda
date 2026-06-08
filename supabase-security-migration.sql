-- ============================================================================
-- CONTROLE LEITE - MIGRAÇÃO DE SEGURANÇA SEM APAGAR DADOS
-- ============================================================================
-- Rode este arquivo no SQL Editor do Supabase.
-- Se já existirem registros antigos sem user_id, preencha primeiro o UUID do
-- usuário dono na variável abaixo e execute os UPDATEs antes de forçar NOT NULL.
-- ============================================================================

-- 1) Garantir coluna user_id em todas as tabelas usadas pelo app.
alter table milk_records add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table animals add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table lactation_records add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table breeding_records add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table medication_records add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table app_settings add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) Se houver dados antigos, descomente e troque pelo UUID real do usuário:
-- update milk_records set user_id = 'SEU-UUID-AQUI' where user_id is null;
-- update animals set user_id = 'SEU-UUID-AQUI' where user_id is null;
-- update lactation_records set user_id = 'SEU-UUID-AQUI' where user_id is null;
-- update breeding_records set user_id = 'SEU-UUID-AQUI' where user_id is null;
-- update medication_records set user_id = 'SEU-UUID-AQUI' where user_id is null;
-- update app_settings set user_id = 'SEU-UUID-AQUI' where user_id is null;

-- 3) Índices e unicidade por usuário.
create index if not exists idx_milk_user_date on milk_records(user_id, date desc);
create index if not exists idx_animals_user on animals(user_id, created_at desc);
create index if not exists idx_lactation_user on lactation_records(user_id, start_date desc);
create index if not exists idx_breeding_user on breeding_records(user_id, insemination_date desc);
create index if not exists idx_medication_user on medication_records(user_id, administration_date desc);
create index if not exists idx_settings_user on app_settings(user_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'milk_records_user_date_key') then
    alter table milk_records add constraint milk_records_user_date_key unique(user_id, date);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'animals_user_identification_key') then
    alter table animals add constraint animals_user_identification_key unique(user_id, identification);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'app_settings_user_key_key') then
    alter table app_settings add constraint app_settings_user_key_key unique(user_id, key);
  end if;
end $$;

-- 4) Constraints de validação no banco.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'milk_records_liters_nonnegative') then
    alter table milk_records add constraint milk_records_liters_nonnegative check (liters >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'milk_records_date_not_future') then
    alter table milk_records add constraint milk_records_date_not_future check (date <= current_date);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lactation_records_daily_liters_positive') then
    alter table lactation_records add constraint lactation_records_daily_liters_positive check (daily_liters > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lactation_records_dates_coherent') then
    alter table lactation_records add constraint lactation_records_dates_coherent check (end_date is null or start_date <= end_date);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'breeding_records_dates_coherent') then
    alter table breeding_records add constraint breeding_records_dates_coherent check (expected_calving_date is null or insemination_date <= expected_calving_date);
  end if;
end $$;

-- 5) Ativar RLS.
alter table milk_records enable row level security;
alter table animals enable row level security;
alter table lactation_records enable row level security;
alter table breeding_records enable row level security;
alter table medication_records enable row level security;
alter table app_settings enable row level security;

-- 6) Recriar políticas RLS por usuário.
drop policy if exists "milk_records_select" on milk_records;
drop policy if exists "milk_records_insert" on milk_records;
drop policy if exists "milk_records_update" on milk_records;
drop policy if exists "milk_records_delete" on milk_records;
create policy "milk_records_select" on milk_records for select using (auth.uid() = user_id);
create policy "milk_records_insert" on milk_records for insert with check (auth.uid() = user_id);
create policy "milk_records_update" on milk_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "milk_records_delete" on milk_records for delete using (auth.uid() = user_id);

drop policy if exists "animals_select" on animals;
drop policy if exists "animals_insert" on animals;
drop policy if exists "animals_update" on animals;
drop policy if exists "animals_delete" on animals;
create policy "animals_select" on animals for select using (auth.uid() = user_id);
create policy "animals_insert" on animals for insert with check (auth.uid() = user_id);
create policy "animals_update" on animals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "animals_delete" on animals for delete using (auth.uid() = user_id);

drop policy if exists "lactation_records_select" on lactation_records;
drop policy if exists "lactation_records_insert" on lactation_records;
drop policy if exists "lactation_records_update" on lactation_records;
drop policy if exists "lactation_records_delete" on lactation_records;
create policy "lactation_records_select" on lactation_records for select using (auth.uid() = user_id);
create policy "lactation_records_insert" on lactation_records for insert with check (
  auth.uid() = user_id
  and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
);
create policy "lactation_records_update" on lactation_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lactation_records_delete" on lactation_records for delete using (auth.uid() = user_id);

drop policy if exists "breeding_records_select" on breeding_records;
drop policy if exists "breeding_records_insert" on breeding_records;
drop policy if exists "breeding_records_update" on breeding_records;
drop policy if exists "breeding_records_delete" on breeding_records;
create policy "breeding_records_select" on breeding_records for select using (auth.uid() = user_id);
create policy "breeding_records_insert" on breeding_records for insert with check (
  auth.uid() = user_id
  and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
);
create policy "breeding_records_update" on breeding_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "breeding_records_delete" on breeding_records for delete using (auth.uid() = user_id);

drop policy if exists "medication_records_select" on medication_records;
drop policy if exists "medication_records_insert" on medication_records;
drop policy if exists "medication_records_update" on medication_records;
drop policy if exists "medication_records_delete" on medication_records;
create policy "medication_records_select" on medication_records for select using (auth.uid() = user_id);
create policy "medication_records_insert" on medication_records for insert with check (
  auth.uid() = user_id
  and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
);
create policy "medication_records_update" on medication_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "medication_records_delete" on medication_records for delete using (auth.uid() = user_id);

drop policy if exists "app_settings_select" on app_settings;
drop policy if exists "app_settings_insert" on app_settings;
drop policy if exists "app_settings_update" on app_settings;
drop policy if exists "app_settings_delete" on app_settings;
create policy "app_settings_select" on app_settings for select using (auth.uid() = user_id);
create policy "app_settings_insert" on app_settings for insert with check (auth.uid() = user_id and key <> 'subscription_admin');
create policy "app_settings_update" on app_settings for update using (auth.uid() = user_id and key <> 'subscription_admin') with check (auth.uid() = user_id and key <> 'subscription_admin');
create policy "app_settings_delete" on app_settings for delete using (auth.uid() = user_id and key <> 'subscription_admin');
