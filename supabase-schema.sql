create table if not exists milk_records (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  liters numeric(10, 2) not null check (liters >= 0),
  price_per_liter numeric(10, 2) not null check (price_per_liter >= 0),
  created_at timestamptz not null default now()
);

create table if not exists animals (
  id uuid primary key default gen_random_uuid(),
  identification text not null unique,
  type text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  price numeric(10, 2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

alter table milk_records enable row level security;
alter table animals enable row level security;
alter table products enable row level security;

drop policy if exists "Permitir leitura publica de producao" on milk_records;
drop policy if exists "Permitir cadastro publico de producao" on milk_records;
drop policy if exists "Permitir atualizacao publica de producao" on milk_records;
drop policy if exists "Permitir leitura publica de animais" on animals;
drop policy if exists "Permitir cadastro publico de animais" on animals;
drop policy if exists "Permitir leitura publica de produtos" on products;
drop policy if exists "Permitir cadastro publico de produtos" on products;

create policy "Permitir leitura publica de producao"
on milk_records for select
using (true);

create policy "Permitir cadastro publico de producao"
on milk_records for insert
with check (true);

create policy "Permitir atualizacao publica de producao"
on milk_records for update
using (true)
with check (true);

create policy "Permitir leitura publica de animais"
on animals for select
using (true);

create policy "Permitir cadastro publico de animais"
on animals for insert
with check (true);

create policy "Permitir leitura publica de produtos"
on products for select
using (true);

create policy "Permitir cadastro publico de produtos"
on products for insert
with check (true);
