-- Controle Fazenda - schema completo Supabase
-- Execute este script no SQL Editor do Supabase.

-- IMPORTANTE: Remove coluna obsoleta caso você tenha criado a tabela na versão antiga do projeto
alter table if exists milk_records drop column if exists price_per_liter;

create table if not exists milk_records (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  liters numeric(10, 2) not null check (liters >= 0),
  created_at timestamptz not null default now()
);

create table if not exists animals (
  id uuid primary key default gen_random_uuid(),
  identification text not null unique,
  type text not null default 'Bovino de Leite',
  status text not null default 'Em lactação',
  created_at timestamptz not null default now()
);

create table if not exists lactation_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  start_date date not null,
  end_date date,
  daily_liters numeric(10, 2) not null check (daily_liters >= 0),
  created_at timestamptz not null default now()
);

create table if not exists breeding_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  insemination_date date not null,
  expected_calving_date date,
  created_at timestamptz not null default now()
);

create table if not exists medication_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  medication_name text not null,
  dosage text,
  administration_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table milk_records enable row level security;
alter table animals enable row level security;
alter table lactation_records enable row level security;
alter table breeding_records enable row level security;
alter table medication_records enable row level security;
alter table app_settings enable row level security;

drop policy if exists "Auth read milk_records" on milk_records;
drop policy if exists "Auth insert milk_records" on milk_records;
drop policy if exists "Auth update milk_records" on milk_records;
drop policy if exists "Auth delete milk_records" on milk_records;
drop policy if exists "Permitir leitura publica de producao" on milk_records;
drop policy if exists "Permitir cadastro publico de producao" on milk_records;
drop policy if exists "Permitir atualizacao publica de producao" on milk_records;
drop policy if exists "Auth read animals" on animals;
drop policy if exists "Auth insert animals" on animals;
drop policy if exists "Auth update animals" on animals;
drop policy if exists "Auth delete animals" on animals;
drop policy if exists "Permitir leitura publica de animais" on animals;
drop policy if exists "Permitir cadastro publico de animais" on animals;
drop policy if exists "Auth read lactation_records" on lactation_records;
drop policy if exists "Auth insert lactation_records" on lactation_records;
drop policy if exists "Auth update lactation_records" on lactation_records;
drop policy if exists "Auth delete lactation_records" on lactation_records;
drop policy if exists "Auth read breeding_records" on breeding_records;
drop policy if exists "Auth insert breeding_records" on breeding_records;
drop policy if exists "Auth update breeding_records" on breeding_records;
drop policy if exists "Auth delete breeding_records" on breeding_records;
drop policy if exists "Auth read medication_records" on medication_records;
drop policy if exists "Auth insert medication_records" on medication_records;
drop policy if exists "Auth update medication_records" on medication_records;
drop policy if exists "Auth delete medication_records" on medication_records;
drop policy if exists "Auth read app_settings" on app_settings;
drop policy if exists "Auth upsert app_settings" on app_settings;
drop policy if exists "Auth update app_settings" on app_settings;

do $$
begin
  if to_regclass('public.products') is not null then
    execute 'drop policy if exists "Permitir leitura publica de produtos" on products';
    execute 'drop policy if exists "Permitir cadastro publico de produtos" on products';
  end if;
end $$;

create policy "Auth read milk_records"
on milk_records for select
using (auth.role() = 'authenticated');

create policy "Auth insert milk_records"
on milk_records for insert
with check (auth.role() = 'authenticated');

create policy "Auth update milk_records"
on milk_records for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Auth delete milk_records"
on milk_records for delete
using (auth.role() = 'authenticated');

create policy "Auth read animals"
on animals for select
using (auth.role() = 'authenticated');

create policy "Auth insert animals"
on animals for insert
with check (auth.role() = 'authenticated');

create policy "Auth update animals"
on animals for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Auth delete animals"
on animals for delete
using (auth.role() = 'authenticated');

create policy "Auth read lactation_records"
on lactation_records for select
using (auth.role() = 'authenticated');

create policy "Auth insert lactation_records"
on lactation_records for insert
with check (auth.role() = 'authenticated');

create policy "Auth update lactation_records"
on lactation_records for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Auth delete lactation_records"
on lactation_records for delete
using (auth.role() = 'authenticated');

create policy "Auth read breeding_records"
on breeding_records for select
using (auth.role() = 'authenticated');

create policy "Auth insert breeding_records"
on breeding_records for insert
with check (auth.role() = 'authenticated');

create policy "Auth update breeding_records"
on breeding_records for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Auth delete breeding_records"
on breeding_records for delete
using (auth.role() = 'authenticated');

create policy "Auth read medication_records"
on medication_records for select
using (auth.role() = 'authenticated');

create policy "Auth insert medication_records"
on medication_records for insert
with check (auth.role() = 'authenticated');

create policy "Auth update medication_records"
on medication_records for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Auth delete medication_records"
on medication_records for delete
using (auth.role() = 'authenticated');

create policy "Auth read app_settings"
on app_settings for select
using (auth.role() = 'authenticated');

create policy "Auth upsert app_settings"
on app_settings for insert
with check (auth.role() = 'authenticated');

create policy "Auth update app_settings"
on app_settings for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
