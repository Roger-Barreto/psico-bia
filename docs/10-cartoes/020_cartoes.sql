-- ============================================================
-- 020_cartoes.sql — controle de fatura de cartão de crédito
-- Aplicar no SQL Editor do Supabase (ou via MCP apply_migration),
-- após a migração 019. Idempotente: pode rodar novamente sem efeito.
-- ============================================================

-- ── 1) Flag "cartão de crédito" nas formas de pagamento ─────────────
alter table public.payment_methods
  add column if not exists is_credit_card boolean not null default false;

-- Marca a forma "Crédito" (do seed) como cartão de crédito, retroativo.
update public.payment_methods
   set is_credit_card = true
 where lower(name) in ('crédito', 'credito', 'cartão de crédito', 'cartao de credito')
   and is_loan = false
   and is_credit_card = false;

-- ── 2) Cadastro de cartões ──────────────────────────────────────────
create table if not exists public.finance_cards (
  id           text primary key,                 -- card_<nanoid(10)>
  name         text not null,
  closing_day  int  not null default 1  check (closing_day between 1 and 31),   -- dia de fechamento
  due_day      int  not null default 10 check (due_day     between 1 and 31),   -- dia de vencimento
  color        text,
  credit_limit numeric,                            -- limite (opcional)
  brand        text,                               -- bandeira (Visa, Master…) (opcional)
  last4        text,                               -- 4 últimos dígitos (opcional)
  active       boolean not null default true,      -- soft-delete / arquivar
  created_at   text not null,
  user_id      uuid not null default auth.uid()
);
create index if not exists finance_cards_user_idx on public.finance_cards (user_id);

alter table public.finance_cards enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_cards'
      and policyname = 'finance_cards_own'
  ) then
    create policy "finance_cards_own" on public.finance_cards
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 3) Vínculo de cartão + fatura nas transações e regras ───────────
alter table public.finance_transactions
  add column if not exists card_id            text references public.finance_cards(id) on delete set null,
  add column if not exists invoice_period     text,   -- YYYY-MM (mês de vencimento da fatura)
  add column if not exists invoice_close_date text,   -- YYYY-MM-DD
  add column if not exists invoice_due_date   text;   -- YYYY-MM-DD
create index if not exists finance_tx_card_idx
  on public.finance_transactions (card_id, invoice_period);

alter table public.finance_recurring_rules
  add column if not exists card_id text references public.finance_cards(id) on delete set null;

-- ── 4) Função pura: fatura de uma compra ────────────────────────────
-- Dado o dia de fechamento/vencimento do cartão e a data da compra,
-- devolve o período (mês de vencimento), a data de fechamento e a de
-- vencimento da fatura em que a compra cai.
create or replace function public.finance_card_invoice(
  p_closing int, p_due int, p_date text
)
returns table(period text, close_date text, due_date text)
language plpgsql immutable
set search_path to 'public'
as $$
declare
  y   int := substr(p_date, 1, 4)::int;
  m   int := substr(p_date, 6, 2)::int;
  d   int := substr(p_date, 9, 2)::int;
  first_of_month date := make_date(y, m, 1);
  nextm date;
  cy int; cm int; dy int; dmo int;
  eff_close int; close_last int; due_last int;
begin
  -- fechamento efetivo do mês da compra (dia truncado ao último do mês)
  eff_close := least(p_closing, extract(day from (first_of_month + interval '1 month - 1 day'))::int);
  cy := y; cm := m;
  if d > eff_close then                    -- comprou depois do fechamento → fecha no mês seguinte
    nextm := first_of_month + interval '1 month';
    cy := extract(year  from nextm)::int;
    cm := extract(month from nextm)::int;
  end if;

  -- vencimento: mesmo mês do fechamento se vence depois de fechar; senão mês seguinte
  dy := cy; dmo := cm;
  if p_due <= p_closing then
    nextm := make_date(cy, cm, 1) + interval '1 month';
    dy  := extract(year  from nextm)::int;
    dmo := extract(month from nextm)::int;
  end if;

  close_last := extract(day from (make_date(cy, cm, 1)  + interval '1 month - 1 day'))::int;
  due_last   := extract(day from (make_date(dy, dmo, 1) + interval '1 month - 1 day'))::int;
  period     := to_char(make_date(dy, dmo, 1), 'YYYY-MM');
  close_date := to_char(make_date(cy, cm,  least(p_closing, close_last)), 'YYYY-MM-DD');
  due_date   := to_char(make_date(dy, dmo, least(p_due,     due_last)),   'YYYY-MM-DD');
  return next;
end;
$$;

-- ── 5) Trigger: preenche a fatura da transação a partir do cartão ───
-- Grava o período/datas no INSERT e recomputa só quando cartão ou data
-- mudam. Alterar o fechamento/vencimento do cartão NÃO mexe em linhas já
-- gravadas → o histórico das faturas antigas é preservado.
create or replace function public.finance_tx_set_card_invoice()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_close int; v_due int;
  v_period text; v_close_date text; v_due_date text;
begin
  if new.card_id is null then
    new.invoice_period     := null;
    new.invoice_close_date := null;
    new.invoice_due_date   := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.card_id is not distinct from old.card_id
     and new.date    is not distinct from old.date
     and new.invoice_period is not null then
    return new;                              -- edição não relacionada → preserva
  end if;

  select closing_day, due_day into v_close, v_due
    from public.finance_cards where id = new.card_id;
  if v_close is null then
    return new;                              -- cartão inexistente → não computa
  end if;

  select period, close_date, due_date
    into v_period, v_close_date, v_due_date
    from public.finance_card_invoice(v_close, v_due, new.date);
  new.invoice_period     := v_period;
  new.invoice_close_date := v_close_date;
  new.invoice_due_date   := v_due_date;
  return new;
end;
$$;

drop trigger if exists finance_tx_card_invoice on public.finance_transactions;
create trigger finance_tx_card_invoice
  before insert or update on public.finance_transactions
  for each row execute function public.finance_tx_set_card_invoice();

-- ── 6) Recriar a view do ledger expondo os campos de fatura ─────────
create or replace view public.finance_ledger
with (security_invoker = true) as
 select t.id, t.kind, t.scope, t.description, t.amount, t.date, t.period,
        t.category_id, c.name as category_name, t.payment_method_id, t.person_id,
        t.settled, t.settled_at, t.recurring_rule_id, t.installment_group,
        t.installment_no, t.installment_total, t.link_id,
        'manual'::text as source, true as editable, null::text as patient_id,
        t.created_at, t.updated_at, t.user_id,
        t.card_id, t.invoice_period, t.invoice_close_date, t.invoice_due_date
   from public.finance_transactions t
   left join public.finance_categories c on c.id = t.category_id
 union all
 select ci.id, ci.kind, ci.scope, ci.description, ci.amount, ci.date, ci.period,
        ci.category_id, ci.category_name, ci.payment_method_id, ci.person_id,
        ci.settled, ci.settled_at, ci.recurring_rule_id, ci.installment_group,
        ci.installment_no, ci.installment_total, ci.link_id,
        ci.source, ci.editable, ci.patient_id,
        ci.created_at, ci.updated_at, ci.user_id,
        null::text, null::text, null::text, null::text
   from public.finance_clinic_income ci;

-- ── 7) Exclusão de cartão (preserva o histórico das despesas) ───────
create or replace function public.finance_delete_card(p_id text)
returns json
language plpgsql
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_tx int := 0; v_rules int := 0;
begin
  if not exists (select 1 from public.finance_cards where id = p_id and user_id = v_uid) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- só desvincula: as despesas continuam no ledger, sem cartão/fatura
  with u as (
    update public.finance_transactions
       set card_id = null
     where card_id = p_id and user_id = v_uid returning 1
  ) select count(*) into v_tx from u;
  with u as (
    update public.finance_recurring_rules
       set card_id = null
     where card_id = p_id and user_id = v_uid returning 1
  ) select count(*) into v_rules from u;
  delete from public.finance_cards where id = p_id and user_id = v_uid;
  return json_build_object('ok', true, 'transactions', v_tx, 'rules', v_rules);
end;
$$;

-- ── 8) Seed: marca "Crédito" como cartão de crédito para novos users ─
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
      insert into public.payment_methods (id, name, is_loan, is_credit_card, color, created_at, user_id)
      select 'pm_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
             t.name, t.is_loan, t.is_cc,
             v_colors[((t.ord - 1) % array_length(v_colors,1)) + 1],
             v_now, v_uid
      from unnest(
        array['PIX','Dinheiro','Débito','Crédito','Boleto','Transferência/TED','Empréstimo'],
        array[false,false,false,false,false,false,true],
        array[false,false,false,true, false,false,false]
      ) with ordinality as t(name, is_loan, is_cc, ord)
      returning 1
    )
    select count(*) into v_pms from ins;
  end if;

  return json_build_object('categories', v_cats, 'paymentMethods', v_pms);
end;
$$;

-- ── 9) Recorrência: materialização carrega o cartão da regra ────────
create or replace function public.ensure_recurring_materialized(p_until_period text)
returns json
language plpgsql
set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_now     text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  r         record;
  v_period  text;
  v_year    int;
  v_month   int;
  v_lastday int;
  v_day     int;
  v_date    text;
  v_inserted int := 0;
begin
  if v_uid is null then
    raise exception 'no_session' using errcode = 'P0001';
  end if;

  for r in
    select * from public.finance_recurring_rules
     where user_id = v_uid and active = true and start_period <= p_until_period
  loop
    v_period := r.start_period;
    while v_period <= p_until_period loop
      v_year  := substr(v_period, 1, 4)::int;
      v_month := substr(v_period, 6, 2)::int;
      v_lastday := extract(day from (
        date_trunc('month', make_date(v_year, v_month, 1)) + interval '1 month - 1 day'
      ))::int;
      v_day  := least(r.day_of_month, v_lastday);
      v_date := to_char(make_date(v_year, v_month, v_day), 'YYYY-MM-DD');

      insert into public.finance_transactions (
        id, kind, scope, description, amount, date,
        category_id, payment_method_id, person_id,
        settled, settled_at, recurring_rule_id,
        card_id,
        created_at, updated_at, user_id
      ) values (
        'tx_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
        r.kind, r.scope, r.description, r.amount, v_date,
        r.category_id, r.payment_method_id, r.person_id,
        false, null, r.id,
        r.card_id,
        v_now, v_now, v_uid
      )
      on conflict (recurring_rule_id, period) where recurring_rule_id is not null
      do nothing;

      if found then
        v_inserted := v_inserted + 1;
      end if;

      v_period := to_char(make_date(v_year, v_month, 1) + interval '1 month', 'YYYY-MM');
    end loop;
  end loop;

  return json_build_object('inserted', v_inserted);
end;
$$;

-- ── 10) Edição de recorrência: também propaga o cartão ──────────────
create or replace function public.edit_recurring(p_rule_id text, p_scope text, p_patch jsonb, p_from_period text)
returns json
language plpgsql
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_updated int := 0;
begin
  if not exists (select 1 from public.finance_recurring_rules where id = p_rule_id and user_id = v_uid) then
    raise exception 'rule_not_found' using errcode = 'P0001';
  end if;

  if p_scope in ('future', 'all') then
    update public.finance_recurring_rules set
      description       = coalesce(p_patch->>'description', description),
      amount            = coalesce((p_patch->>'amount')::numeric, amount),
      scope             = coalesce(p_patch->>'scope', scope),
      category_id       = case when p_patch ? 'category_id'       then p_patch->>'category_id'       else category_id end,
      payment_method_id = case when p_patch ? 'payment_method_id' then p_patch->>'payment_method_id' else payment_method_id end,
      person_id         = case when p_patch ? 'person_id'         then p_patch->>'person_id'         else person_id end,
      card_id           = case when p_patch ? 'card_id'           then p_patch->>'card_id'           else card_id end,
      day_of_month      = coalesce((p_patch->>'day_of_month')::int, day_of_month)
    where id = p_rule_id and user_id = v_uid;
  end if;

  with upd as (
    update public.finance_transactions set
      description       = coalesce(p_patch->>'description', description),
      amount            = coalesce((p_patch->>'amount')::numeric, amount),
      scope             = coalesce(p_patch->>'scope', scope),
      category_id       = case when p_patch ? 'category_id'       then p_patch->>'category_id'       else category_id end,
      payment_method_id = case when p_patch ? 'payment_method_id' then p_patch->>'payment_method_id' else payment_method_id end,
      person_id         = case when p_patch ? 'person_id'         then p_patch->>'person_id'         else person_id end,
      card_id           = case when p_patch ? 'card_id'           then p_patch->>'card_id'           else card_id end,
      updated_at        = v_now
    where recurring_rule_id = p_rule_id
      and user_id = v_uid
      and settled = false
      and (
        p_scope = 'all'
        or (p_scope = 'future' and period >= p_from_period)
        or (p_scope = 'one' and period = p_from_period)
      )
    returning 1
  )
  select count(*) into v_updated from upd;

  return json_build_object('ok', true, 'updated', v_updated);
end;
$$;
