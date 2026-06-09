-- ============================================================================
-- CONTROLE LEITE - SCHEMA SEGURO COM ISOLAMENTO POR USUÁRIO
-- ============================================================================
-- ATENÇÃO: Isso apaga tabelas antigas. Faça backup antes!
-- ============================================================================

drop table if exists medication_records cascade;
drop table if exists crop_events cascade;
drop table if exists breeding_records cascade;
drop table if exists lactation_records cascade;
drop table if exists animals cascade;
drop table if exists milk_records cascade;
drop table if exists app_settings cascade;

-- ============================================================================
-- TABELA: PRODUÇÃO DE LEITE
-- ============================================================================
create table milk_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  date       date not null,
  liters     numeric(10, 2) not null check (liters >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (date <= current_date),
  -- Uma data por usuário (não múltiplos registros no mesmo dia)
  unique(user_id, date)
);

create index idx_milk_user_date on milk_records(user_id, date desc);

-- ============================================================================
-- TABELA: ANIMAIS
-- ============================================================================
create table animals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  identification text not null,
  type           text not null default 'Bovino de Leite',
  status         text not null default 'Em lactação',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Um identificador por usuário
  unique(user_id, identification)
);

create index idx_animals_user on animals(user_id, created_at desc);

-- ============================================================================
-- TABELA: LACTAÇÕES
-- CORRIGIDO: cow_id agora é FK para animals.id (era texto livre sem referência)
-- ============================================================================
create table lactation_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  -- FK para animals garante integridade referencial: sem animais órfãos
  cow_id       uuid not null references animals(id) on delete cascade,
  start_date   date not null,
  end_date     date,
  daily_liters numeric(10, 2) not null check (daily_liters > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  check (end_date is null or start_date <= end_date)
);

create index idx_lactation_user on lactation_records(user_id, start_date desc);
create index idx_lactation_cow  on lactation_records(cow_id);

-- ============================================================================
-- TABELA: REPRODUÇÃO
-- CORRIGIDO: cow_id agora é FK para animals.id (era texto livre sem referência)
-- ============================================================================
create table breeding_records (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  -- FK para animals garante integridade referencial: sem animais órfãos
  cow_id                uuid not null references animals(id) on delete cascade,
  insemination_date     date not null,
  expected_calving_date date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  check (expected_calving_date is null or insemination_date <= expected_calving_date)
);

create index idx_breeding_user on breeding_records(user_id, insemination_date desc);
create index idx_breeding_cow  on breeding_records(cow_id);

-- ============================================================================
-- TABELA: MEDICAÇÕES
-- CORRIGIDO: cow_id agora é FK para animals.id (era texto livre sem referência)
-- ============================================================================
create table medication_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  -- FK para animals garante integridade referencial: sem animais órfãos
  cow_id              uuid not null references animals(id) on delete cascade,
  medication_name     text not null,
  dosage              text,
  administration_date date not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_medication_user on medication_records(user_id, administration_date desc);
create index idx_medication_cow  on medication_records(cow_id);

-- ============================================================================
-- TABELA: LAVOURA
-- Registra manejos como plantio, pulverizacao, adubacao, colheita e observacao.
-- ============================================================================
create table crop_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  plot_name    text not null,
  crop_name    text not null,
  event_type   text not null,
  event_date   date not null,
  product      text,
  dosage       text,
  area_tasks   numeric(10, 2) check (area_tasks is null or area_tasks >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  check (event_date <= current_date)
);

create index idx_crop_events_user_date on crop_events(user_id, event_date desc);

-- ============================================================================
-- TABELA: CONFIGURAÇÕES DO APP (per usuário)
-- ============================================================================
create table app_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),

  -- Uma chave por usuário
  unique(user_id, key)
);

create index idx_settings_user on app_settings(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - ISOLAMENTO POR USUÁRIO
-- ============================================================================

-- Ativar RLS em todas as tabelas
alter table milk_records       enable row level security;
alter table animals            enable row level security;
alter table lactation_records  enable row level security;
alter table breeding_records   enable row level security;
alter table medication_records enable row level security;
alter table crop_events        enable row level security;
alter table app_settings       enable row level security;

-- ============================================================================
-- POLÍTICAS RLS: Cada usuário só vê seus próprios dados
-- ============================================================================

-- MILK RECORDS
create policy "milk_records_select" on milk_records for select using (auth.uid() = user_id);
create policy "milk_records_insert" on milk_records for insert with check (auth.uid() = user_id);
create policy "milk_records_update" on milk_records for update using (auth.uid() = user_id);
create policy "milk_records_delete" on milk_records for delete using (auth.uid() = user_id);

-- ANIMALS
create policy "animals_select" on animals for select using (auth.uid() = user_id);
create policy "animals_insert" on animals for insert with check (auth.uid() = user_id);
create policy "animals_update" on animals for update using (auth.uid() = user_id);
create policy "animals_delete" on animals for delete using (auth.uid() = user_id);

-- LACTATION_RECORDS
-- A policy também verifica o user_id da tabela de animais via subconsulta,
-- impedindo que um usuário registre lactação no animal de outro usuário.
create policy "lactation_records_select" on lactation_records for select
  using (auth.uid() = user_id);

create policy "lactation_records_insert" on lactation_records for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
  );

create policy "lactation_records_update" on lactation_records for update
  using (auth.uid() = user_id);

create policy "lactation_records_delete" on lactation_records for delete
  using (auth.uid() = user_id);

-- BREEDING_RECORDS
create policy "breeding_records_select" on breeding_records for select
  using (auth.uid() = user_id);

create policy "breeding_records_insert" on breeding_records for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
  );

create policy "breeding_records_update" on breeding_records for update
  using (auth.uid() = user_id);

create policy "breeding_records_delete" on breeding_records for delete
  using (auth.uid() = user_id);

-- MEDICATION_RECORDS
create policy "medication_records_select" on medication_records for select
  using (auth.uid() = user_id);

create policy "medication_records_insert" on medication_records for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
  );

create policy "medication_records_update" on medication_records for update
  using (auth.uid() = user_id);

create policy "medication_records_delete" on medication_records for delete
  using (auth.uid() = user_id);

-- CROP_EVENTS
create policy "crop_events_select" on crop_events for select using (auth.uid() = user_id);
create policy "crop_events_insert" on crop_events for insert with check (auth.uid() = user_id);
create policy "crop_events_update" on crop_events for update using (auth.uid() = user_id);
create policy "crop_events_delete" on crop_events for delete using (auth.uid() = user_id);

-- APP_SETTINGS
create policy "app_settings_select" on app_settings for select using (auth.uid() = user_id);
create policy "app_settings_insert" on app_settings for insert
  with check (auth.uid() = user_id and key <> 'subscription_admin');
create policy "app_settings_update" on app_settings for update
  using (auth.uid() = user_id and key <> 'subscription_admin')
  with check (auth.uid() = user_id and key <> 'subscription_admin');
create policy "app_settings_delete" on app_settings for delete
  using (auth.uid() = user_id and key <> 'subscription_admin');
