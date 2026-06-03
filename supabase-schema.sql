-- Supabase schema additions for farm management

-- Table: cows
create table if not exists cows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text,
  birth_date date not null,
  created_at timestamptz not null default now()
);

-- Table: lactations
create table if not exists lactations (
  id uuid primary key default gen_random_uuid(),
  cow_id uuid references cows(id) on delete cascade,
  start_date date not null,
  end_date date,
  daily_milk numeric(10,2) not null check (daily_milk >= 0),
  created_at timestamptz not null default now()
);

-- Table: breeding
create table if not exists breeding (
  id uuid primary key default gen_random_uuid(),
  cow_id uuid references cows(id) on delete cascade,
  insemination_date date not null,
  expected_calving_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Table: medications
create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  cow_id uuid references cows(id) on delete cascade,
  medication_name text not null,
  dosage text,
  administered_by text,
  administration_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Enable row level security for new tables
alter table cows enable row level security;
alter table lactations enable row level security;
alter table breeding enable row level security;
alter table medications enable row level security;

-- Simple public policies (you may tighten later)
create policy "Public read cows" on cows for select using (true);
create policy "Public insert cows" on cows for insert with check (true);

create policy "Public read lactations" on lactations for select using (true);
create policy "Public insert lactations" on lactations for insert with check (true);

create policy "Public read breeding" on breeding for select using (true);
create policy "Public insert breeding" on breeding for insert with check (true);

create policy "Public read medications" on medications for select using (true);
create policy "Public insert medications" on medications for insert with check (true);