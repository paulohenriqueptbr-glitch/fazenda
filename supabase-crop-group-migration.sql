-- ============================================================================
-- MIGRACAO: separar lavouras por grupo (Milho/Sorgo, Palma Forrageira, Outra)
-- ============================================================================
-- Use este script em um banco Supabase que ja tem a tabela crop_events.
-- Ele adiciona a coluna crop_group sem apagar nem alterar dados existentes.
-- Registros antigos ficam com o valor padrao 'Milho/Sorgo' e podem ser
-- editados manualmente depois pelo app caso pertencam a outra lavoura.
-- ============================================================================

alter table crop_events
  add column if not exists crop_group text not null default 'Milho/Sorgo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crop_events_group_valid') then
    alter table crop_events
      add constraint crop_events_group_valid
      check (crop_group in ('Milho/Sorgo', 'Palma Forrageira', 'Outra'));
  end if;
end $$;

create index if not exists idx_crop_events_user_group
  on crop_events(user_id, crop_group, event_date desc);
