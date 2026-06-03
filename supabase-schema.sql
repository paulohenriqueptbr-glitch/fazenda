-- ============================================
-- Controle Fazenda — Schema completo Supabase
-- ============================================
-- Execute este script no SQL Editor do Supabase.
-- Ele cria TODAS as tabelas necessárias.
-- Se uma tabela já existir, ela NÃO será recriada.

-- ========== TABELA: milk_records ==========
create table if not exists milk_records (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  liters numeric(10,2) not null check (liters >= 0),
  created_at timestamptz not null default now()
);

-- ========== TABELA: animals ==========
create table if not exists animals (
  id uuid primary key default gen_random_uuid(),
  identification text not null,
  type text not null default 'Bovino de Leite',
  status text not null default 'Em lactação',
  created_at timestamptz not null default now()
);

-- ========== TABELA: lactation_records ==========
create table if not exists lactation_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  start_date date not null,
  end_date date,
  daily_liters numeric(10,2) not null check (daily_liters >= 0),
  created_at timestamptz not null default now()
);

-- ========== TABELA: breeding_records ==========
create table if not exists breeding_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  insemination_date date not null,
  expected_calving_date date,
  created_at timestamptz not null default now()
);

-- ========== TABELA: medication_records ==========
create table if not exists medication_records (
  id uuid primary key default gen_random_uuid(),
  cow_id text not null,
  medication_name text not null,
  dosage text,
  administration_date date not null,
  created_at timestamptz not null default now()
);

-- ========== RLS (Row Level Security) ==========
alter table milk_records enable row level security;
alter table animals enable row level security;
alter table lactation_records enable row level security;
alter table breeding_records enable row level security;
alter table medication_records enable row level security;

-- ========== POLICIES ==========
-- Permite leitura e escrita para usuários autenticados.
-- Ajuste conforme necessário.

-- milk_records
create policy "Auth read milk_records" on milk_records
  for select using (auth.role() = 'authenticated');
create policy "Auth insert milk_records" on milk_records
  for insert with check (auth.role() = 'authenticated');
create policy "Auth update milk_records" on milk_records
  for update using (auth.role() = 'authenticated');

-- animals
create policy "Auth read animals" on animals
  for select using (auth.role() = 'authenticated');
create policy "Auth insert animals" on animals
  for insert with check (auth.role() = 'authenticated');

-- lactation_records
create policy "Auth read lactation_records" on lactation_records
  for select using (auth.role() = 'authenticated');
create policy "Auth insert lactation_records" on lactation_records
  for insert with check (auth.role() = 'authenticated');

-- breeding_records
create policy "Auth read breeding_records" on breeding_records
  for select using (auth.role() = 'authenticated');
create policy "Auth insert breeding_records" on breeding_records
  for insert with check (auth.role() = 'authenticated');

-- medication_records
create policy "Auth read medication_records" on medication_records
  for select using (auth.role() = 'authenticated');
create policy "Auth insert medication_records" on medication_records
  for insert with check (auth.role() = 'authenticated');