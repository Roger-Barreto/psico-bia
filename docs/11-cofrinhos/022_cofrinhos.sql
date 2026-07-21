-- ============================================================
-- 022_cofrinhos.sql — cofrinhos (reservas de dinheiro)
-- Aplicar após a 021. Idempotente (pode rodar de novo sem efeito).
-- Mirror da 020 (cartões), com as diferenças: cofrinho tem saldo
-- acumulado (sem ciclo de fatura) e a atividade é computada no client
-- (sem trigger). "Guardar" é neutro (não é despesa).
-- ============================================================

-- ── 1) Flag "cofrinho" nas formas de pagamento ─────────────────────
alter table public.payment_methods
  add column if not exists is_cofrinho boolean not null default false;

-- Garante uma forma "Cofrinho" (retirada da reserva) para cada usuário
-- que já tem formas cadastradas e ainda não tem uma marcada como cofrinho.
insert into public.payment_methods (id, name, is_loan, is_credit_card, is_cofrinho, color, created_at, user_id)
select 'pm_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
       'Cofrinho', false, false, true, '#eab308',
       to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
       u.user_id
from (select distinct user_id from public.payment_methods) u
where not exists (
  select 1 from public.payment_methods p
  where p.user_id = u.user_id and p.is_cofrinho = true
);

-- ── 2) Cadastro de cofrinhos ───────────────────────────────────────
create table if not exists public.finance_cofrinhos (
  id           text primary key,                 -- cof_<nanoid(10)>
  name         text not null,
  color        text,
  goal_type    text not null check (goal_type in ('percent','fixed')),
  percent      numeric,                            -- 0..100 (goal_type='percent')
  fixed_amount numeric,                            -- valor mensal (goal_type='fixed')
  fixed_day    int check (fixed_day between 1 and 31),
  income_scope text not null default 'all' check (income_scope in ('clinic','all')),
  active       boolean not null default true,
  created_at   text not null,
  user_id      uuid not null default auth.uid()
);
create index if not exists finance_cofrinhos_user_idx on public.finance_cofrinhos (user_id);

alter table public.finance_cofrinhos enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_cofrinhos'
      and policyname = 'finance_cofrinhos_own'
  ) then
    create policy "finance_cofrinhos_own" on public.finance_cofrinhos
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 3) Atividade do cofrinho (depósitos / pulos / planos) ──────────
-- deposit: guardei X (reserva sobe). skip: não guardo (suprime o prompt).
-- plan: obrigação futura gravada (reposição de "pagar com cofrinho" ou
--       rollover de sobra de meta fixa) — é um slot esperado a mais.
create table if not exists public.finance_cofrinho_entries (
  id           text primary key,                 -- ce_<nanoid(10)>
  cofrinho_id  text not null references public.finance_cofrinhos(id) on delete cascade,
  kind         text not null check (kind in ('deposit','skip','plan')),
  date         text not null,                     -- YYYY-MM-DD
  period       text generated always as (substr(date, 1, 7)) stored,
  slot_key     text,                              -- fixed:YYYY-MM | pct:YYYY-MM-DD | plan:<id> | manual
  source       text not null check (source in ('fixed','percent','rollover','repay','manual')),
  expected     numeric,                           -- alvo do slot (planos)
  amount       numeric not null default 0,        -- depositado (0 p/ skip/plano pendente)
  status       text not null default 'pending'
               check (status in ('pending','saved','partial','skipped','done')),
  purchase_tx_id text,                            -- reposição: tx da compra paga com cofrinho
  parent_id    text,                              -- lineage de rollover/reposição
  created_at   text not null,
  updated_at   text not null,
  user_id      uuid not null default auth.uid()
);
create index if not exists finance_ce_cofrinho_period_idx on public.finance_cofrinho_entries (cofrinho_id, period);
create index if not exists finance_ce_cofrinho_slot_idx   on public.finance_cofrinho_entries (cofrinho_id, slot_key);
create index if not exists finance_ce_user_idx            on public.finance_cofrinho_entries (user_id);

alter table public.finance_cofrinho_entries enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_cofrinho_entries'
      and policyname = 'finance_cofrinho_entries_own'
  ) then
    create policy "finance_cofrinho_entries_own" on public.finance_cofrinho_entries
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 4) Vínculo do cofrinho na transação (compra paga com cofrinho) ──
alter table public.finance_transactions
  add column if not exists cofrinho_id text references public.finance_cofrinhos(id) on delete set null;
create index if not exists finance_tx_cofrinho_idx on public.finance_transactions (cofrinho_id);

-- Recria a view do ledger expondo cofrinho_id (mantém security_invoker).
create or replace view public.finance_ledger
with (security_invoker = true) as
 select t.id, t.kind, t.scope, t.description, t.amount, t.date, t.period,
        t.category_id, c.name as category_name, t.payment_method_id, t.person_id,
        t.settled, t.settled_at, t.recurring_rule_id, t.installment_group,
        t.installment_no, t.installment_total, t.link_id,
        'manual'::text as source, true as editable, null::text as patient_id,
        t.created_at, t.updated_at, t.user_id,
        t.card_id, t.invoice_period, t.invoice_close_date, t.invoice_due_date,
        t.cofrinho_id
   from public.finance_transactions t
   left join public.finance_categories c on c.id = t.category_id
 union all
 select ci.id, ci.kind, ci.scope, ci.description, ci.amount, ci.date, ci.period,
        ci.category_id, ci.category_name, ci.payment_method_id, ci.person_id,
        ci.settled, ci.settled_at, ci.recurring_rule_id, ci.installment_group,
        ci.installment_no, ci.installment_total, ci.link_id,
        ci.source, ci.editable, ci.patient_id,
        ci.created_at, ci.updated_at, ci.user_id,
        null::text, null::text, null::text, null::text,
        null::text
   from public.finance_clinic_income ci;

-- ── 5) Exclusão de cofrinho (preserva as despesas; apaga a atividade) ─
create or replace function public.finance_delete_cofrinho(p_id text)
returns json
language plpgsql
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_tx int := 0; v_entries int := 0;
begin
  if not exists (select 1 from public.finance_cofrinhos where id = p_id and user_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- desvincula as compras (continuam como despesa no ledger)
  with u as (
    update public.finance_transactions set cofrinho_id = null
     where cofrinho_id = p_id and user_id = v_uid returning 1
  ) select count(*) into v_tx from u;
  -- apaga a atividade do cofrinho (depósitos/pulos/planos)
  with d as (
    delete from public.finance_cofrinho_entries
     where cofrinho_id = p_id and user_id = v_uid returning 1
  ) select count(*) into v_entries from d;
  delete from public.finance_cofrinhos where id = p_id and user_id = v_uid;
  return json_build_object('ok', true, 'transactions', v_tx, 'entries', v_entries);
end;
$$;

-- ── 6) Seed: semeia a forma "Cofrinho" para novos usuários ─────────
create or replace function public.seed_finance_defaults()
returns json
language plpgsql
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_cats int := 0;
  v_pms  int := 0;
  v_colors text[] := array[
    '#f43f5e','#ec4899','#d946ef','#a855f7','#8b5cf6','#6366f1','#3b82f6','#0ea5e9',
    '#06b6d4','#14b8a6','#10b981','#22c55e','#84cc16','#eab308','#f59e0b','#f97316'
  ];
begin
  if v_uid is null then
    raise exception 'no_session' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.finance_categories where user_id = v_uid) then
    with ins as (
      insert into public.finance_categories (id, name, color, created_at, user_id)
      select 'cat_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
             n.name,
             v_colors[((n.ord - 1) % array_length(v_colors,1)) + 1],
             v_now, v_uid
      from unnest(array[
        'Moradia','Alimentação','Transporte','Saúde','Lazer',
        'Educação','Impostos','Aluguel consultório','Material clínico',
        'Salário','Investimentos','Empréstimos concedidos',
        'Atendimentos','Outros'
      ]) with ordinality as n(name, ord)
      returning 1
    )
    select count(*) into v_cats from ins;
  end if;

  if not exists (select 1 from public.payment_methods where user_id = v_uid) then
    with ins as (
      insert into public.payment_methods (id, name, is_loan, is_credit_card, is_cofrinho, color, created_at, user_id)
      select 'pm_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
             t.name, t.is_loan, t.is_cc, t.is_cof,
             v_colors[((t.ord - 1) % array_length(v_colors,1)) + 1],
             v_now, v_uid
      from unnest(
        array['PIX','Dinheiro','Débito','Crédito','Boleto','Transferência/TED','Empréstimo','Cofrinho'],
        array[false,false,false,false,false,false,true, false],
        array[false,false,false,true, false,false,false,false],
        array[false,false,false,false,false,false,false,true]
      ) with ordinality as t(name, is_loan, is_cc, is_cof, ord)
      returning 1
    )
    select count(*) into v_pms from ins;
  end if;

  return json_build_object('categories', v_cats, 'paymentMethods', v_pms);
end;
$$;
