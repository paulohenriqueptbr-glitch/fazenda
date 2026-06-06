-- ============================================================================
-- CONTROLE LEITE - ATIVAR RLS SEM APAGAR DADOS
-- ============================================================================
-- Use este arquivo quando voce NAO quer recriar tabelas.
-- Ele apenas liga o Row Level Security e recria as politicas por user_id.
--
-- Importante:
-- - As tabelas precisam ter a coluna user_id.
-- - Se houver dados antigos com user_id vazio, eles nao aparecerao para o usuario.
-- ============================================================================

do $$
declare
  target_table text;
  tables text[] := array[
    'milk_records',
    'animals',
    'lactation_records',
    'breeding_records',
    'medication_records',
    'app_settings'
  ];
begin
  foreach target_table in array tables loop
    if to_regclass('public.' || quote_ident(target_table)) is null then
      raise notice 'Tabela public.% nao existe. Ignorando.', target_table;
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'user_id'
    ) then
      raise exception 'Tabela public.% nao tem a coluna user_id. Adicione user_id antes de ativar as politicas.', target_table;
    end if;

    execute format('alter table public.%I enable row level security', target_table);

    execute format('drop policy if exists %I on public.%I', target_table || '_select', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_insert', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_update', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_delete', target_table);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      target_table || '_select',
      target_table
    );

    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      target_table || '_insert',
      target_table
    );

    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      target_table || '_update',
      target_table
    );

    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      target_table || '_delete',
      target_table
    );
  end loop;
end $$;

select
  tablename,
  rowsecurity as rls_ativo
from pg_tables
where schemaname = 'public'
  and tablename in (
    'milk_records',
    'animals',
    'lactation_records',
    'breeding_records',
    'medication_records',
    'app_settings'
  )
order by tablename;

select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'milk_records',
    'animals',
    'lactation_records',
    'breeding_records',
    'medication_records',
    'app_settings'
  )
order by tablename, policyname;
