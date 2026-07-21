-- ============================================================
-- 023_cofrinho_valor_inicial.sql — saldo inicial do cofrinho
-- O cofrinho pode começar com um valor guardado. Idempotente.
-- (A "data de início" que impede metas retroativas usa created_at,
--  então não precisa de coluna nova.)
-- ============================================================

alter table public.finance_cofrinhos
  add column if not exists initial_amount numeric not null default 0;
