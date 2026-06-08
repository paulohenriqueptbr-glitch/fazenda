-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA: cow_id como FK UUID
-- ============================================================================
-- Use este script se você já tem dados no banco e não quer recriar as tabelas.
-- ATENÇÃO: antes de rodar, garanta que todos os cow_id existentes correspondem
-- a UUIDs válidos na tabela animals. Se cow_id era texto livre antes, pode
-- haver incompatibilidade — use supabase-schema.sql em banco novo.
-- ============================================================================

-- 1. Converter cow_id de text para uuid nas 3 tabelas afetadas
alter table lactation_records
  alter column cow_id type uuid using cow_id::uuid;

alter table breeding_records
  alter column cow_id type uuid using cow_id::uuid;

alter table medication_records
  alter column cow_id type uuid using cow_id::uuid;

-- 2. Adicionar constraint de FK para animals
alter table lactation_records
  add constraint fk_lactation_cow
  foreign key (cow_id) references animals(id) on delete cascade;

alter table breeding_records
  add constraint fk_breeding_cow
  foreign key (cow_id) references animals(id) on delete cascade;

alter table medication_records
  add constraint fk_medication_cow
  foreign key (cow_id) references animals(id) on delete cascade;

-- 3. Índices nas FKs (melhora performance de joins)
create index if not exists idx_lactation_cow  on lactation_records(cow_id);
create index if not exists idx_breeding_cow   on breeding_records(cow_id);
create index if not exists idx_medication_cow on medication_records(cow_id);

-- 4. Recriar policies de insert com verificação cruzada de user_id
--    (impede que um usuário registre no animal de outro)

-- Lactation
drop policy if exists "lactation_records_insert" on lactation_records;
create policy "lactation_records_insert" on lactation_records for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
  );

-- Breeding
drop policy if exists "breeding_records_insert" on breeding_records;
create policy "breeding_records_insert" on breeding_records for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
  );

-- Medication
drop policy if exists "medication_records_insert" on medication_records;
create policy "medication_records_insert" on medication_records for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from animals where id = cow_id and user_id = auth.uid())
  );
