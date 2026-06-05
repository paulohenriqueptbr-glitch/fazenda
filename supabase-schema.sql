-- ATENÇÃO: Isso vai apagar as tabelas antigas de teste para criar a estrutura nova
drop table if exists milk_records cascade;
drop table if exists lactation_records cascade;
drop table if exists breeding_records cascade;
drop table if exists medication_records cascade;
drop table if exists animals cascade;
drop table if exists app_settings cascade;

-- Agora criamos a estrutura do zero, exatamente como o aplicativo espera
create table milk_records (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  liters numeric(10, 2) not null check (liters >= 0),
  created_at timestamptz not null default now()
);

create table animals (
  id uuid primary key default gen_random_uuid(),
  identification text not null unique,
  type text not null default 'Bovino de Leite',
  status text not null default 'Em lactação',
  created_at timestamptz not null default now()
);

create table lactation_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  start_date date not null,
  end_date date,
  daily_liters numeric(10, 2) not null check (daily_liters >= 0),
  created_at timestamptz not null default now()
);

create table breeding_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  insemination_date date not null,
  expected_calving_date date,
  created_at timestamptz not null default now()
);

create table medication_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  medication_name text not null,
  dosage text,
  administration_date date not null,
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Ativar segurança
alter table milk_records enable row level security;
alter table animals enable row level security;
alter table lactation_records enable row level security;
alter table breeding_records enable row level security;
alter table medication_records enable row level security;
alter table app_settings enable row level security;

-- Permissões para seu usuário logado
create policy "Auth access milk_records" on milk_records for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth access animals" on animals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth access lactation_records" on lactation_records for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth access breeding_records" on breeding_records for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth access medication_records" on medication_records for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth access app_settings" on app_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
