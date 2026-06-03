-- Supabase schema for farm management

-- Table: cows (optional, retained for future use)
create table if not exists cows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text,
  birth_date date not null,
  created_at timestamptz not null default now()
);

-- Table: lactation_records (matches app.js expectations)
create table if not exists lactation_records (
  id uuid primary key default gen_random_uuid(),
  cow_id uuid references animals(id) on delete cascade,
  start date not null,
  "end" date,
  liters_per_day numeric(10,2) not null check (liters_per_day >= 0),
  created_at timestamptz not null default now()
);

-- Table: breeding_records (matches app.js expectations)
create table if not exists breeding_records (
  id uuid primary key default gen_random_uuid(),
  cow_id uuid references animals(id) on delete cascade,
  insemination_date date not null,
  expected_calving_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Table: medication_records (matches app.js expectations)
create table if not exists medication_records (
  id uuid primary key default gen_random_uuid(),
  cow_id uuid references animals(id) on delete cascade,
  medication_name text not null,
  dosage text,
  administered_by text,
  administration_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Enable row level security for new tables
alter table lactation_records enable row level security;
alter table breeding_records enable row level security;
alter table medication_records enable row level security;

-- Simple public policies (adjust as needed)
create policy "Public read lactation_records" on lactation_records for select using (true);
create policy "Public insert lactation_records" on lactation_records for insert with check (true);

create policy "Public read breeding_records" on breeding_records for select using (true);
create policy "Public insert breeding_records" on breeding_records for insert with check (true);

create policy "Public read medication_records" on medication_records for select using (true);
create policy "Public insert medication_records" on medication_records for insert with check (true);