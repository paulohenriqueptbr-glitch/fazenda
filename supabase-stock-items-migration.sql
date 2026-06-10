-- ============================================================================
-- MIGRACAO: ESTOQUE
-- ============================================================================
-- Use este script em um banco Supabase existente.
-- Ele cria a tabela stock_items sem apagar dados e ativa RLS por usuario.
-- ============================================================================

create table if not exists stock_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_name    text not null,
  category     text not null default 'Insumo',
  quantity     numeric(12, 2) not null default 0 check (quantity >= 0),
  unit         text not null default 'un',
  min_quantity numeric(12, 2) check (min_quantity is null or min_quantity >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_stock_items_user_name
  on stock_items(user_id, item_name);

alter table stock_items enable row level security;

drop policy if exists "stock_items_select" on stock_items;
drop policy if exists "stock_items_insert" on stock_items;
drop policy if exists "stock_items_update" on stock_items;
drop policy if exists "stock_items_delete" on stock_items;

create policy "stock_items_select" on stock_items
  for select using (auth.uid() = user_id);

create policy "stock_items_insert" on stock_items
  for insert with check (auth.uid() = user_id);

create policy "stock_items_update" on stock_items
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "stock_items_delete" on stock_items
  for delete using (auth.uid() = user_id);
