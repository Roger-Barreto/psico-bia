-- ============================================================
-- 026_cofrinho_meta_objetivo.sql — novos tipos de meta do cofrinho
--   • 'target': objetivo de valor total (ex.: juntar R$ 2.000 p/ uma
--     viagem). Opcionalmente com aporte mensal (fixed_amount/fixed_day)
--     que gera lembretes até a meta ser atingida. O saldo pode passar
--     da meta; a meta permanece fixa.
--   • 'none': cofrinho livre — sem meta, sem valor predefinido e sem
--     cobranças mensais; o usuário guarda quando quiser.
-- Idempotente: pode rodar de novo sem efeito.
-- ============================================================

alter table public.finance_cofrinhos
  drop constraint if exists finance_cofrinhos_goal_type_check;
alter table public.finance_cofrinhos
  add constraint finance_cofrinhos_goal_type_check
  check (goal_type in ('percent', 'fixed', 'target', 'none'));

-- valor do objetivo (goal_type = 'target')
alter table public.finance_cofrinhos
  add column if not exists target_amount numeric;
