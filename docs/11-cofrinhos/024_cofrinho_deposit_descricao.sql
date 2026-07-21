-- ============================================================
-- 024_cofrinho_deposit_descricao.sql — descrição do depósito
-- Um depósito avulso ("Adicionar valor") pode ter uma descrição
-- livre, para aparecer como um lançamento no ledger. Idempotente.
-- ============================================================

alter table public.finance_cofrinho_entries
  add column if not exists description text;
