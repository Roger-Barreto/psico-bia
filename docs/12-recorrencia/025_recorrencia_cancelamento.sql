-- ============================================================
-- 025_recorrencia_cancelamento.sql — excluir/cancelar recorrência
-- Bug: excluir uma linha recorrente só apagava a transação; a
-- materialização (ensure_recurring_materialized) recriava o mês no
-- próximo acesso. Agora:
--   • excluir "só este mês" grava um tombstone (finance_recurring_skips)
--     que a materialização respeita — a linha não volta mais;
--   • "cancelar recorrência" (escopo future) apaga os não quitados
--     daquele mês em diante e desativa a regra;
--   • novo escopo one_and_future: exclui o mês clicado (mesmo quitado)
--     + futuros não quitados e desativa a regra.
-- Idempotente: pode rodar de novo sem efeito.
-- ============================================================

-- ── 1) Tombstones: meses excluídos individualmente ─────────────────
create table if not exists public.finance_recurring_skips (
  rule_id    text not null references public.finance_recurring_rules(id) on delete cascade,
  period     text not null,                       -- YYYY-MM suprimido
  created_at text not null,
  user_id    uuid not null default auth.uid(),
  primary key (rule_id, period)
);
create index if not exists finance_recurring_skips_user_idx
  on public.finance_recurring_skips (user_id);

alter table public.finance_recurring_skips enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_recurring_skips'
      and policyname = 'finance_recurring_skips_own'
  ) then
    create policy "finance_recurring_skips_own" on public.finance_recurring_skips
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 2) Materialização pula meses com tombstone ─────────────────────
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

      -- mês excluído individualmente → não recria
      if not exists (
        select 1 from public.finance_recurring_skips s
         where s.rule_id = r.id and s.period = v_period and s.user_id = v_uid
      ) then
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
      end if;

      v_period := to_char(make_date(v_year, v_month, 1) + interval '1 month', 'YYYY-MM');
    end loop;
  end loop;

  return json_build_object('inserted', v_inserted);
end;
$$;

-- ── 3) delete_recurring: tombstone no 'one' + escopo one_and_future ─
create or replace function public.delete_recurring(p_rule_id text, p_scope text, p_from_period text)
returns json
language plpgsql
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_deleted int := 0;
begin
  if not exists (select 1 from public.finance_recurring_rules where id = p_rule_id and user_id = v_uid) then
    raise exception 'rule_not_found' using errcode = 'P0001';
  end if;

  if p_scope = 'one' then
    -- exclui só aquele mês e grava o tombstone: não é recriado nunca mais
    with del as (
      delete from public.finance_transactions
       where recurring_rule_id = p_rule_id and user_id = v_uid and period = p_from_period
      returning 1
    ) select count(*) into v_deleted from del;
    insert into public.finance_recurring_skips (rule_id, period, created_at, user_id)
    values (p_rule_id, p_from_period, v_now, v_uid)
    on conflict (rule_id, period) do nothing;

  elsif p_scope = 'future' then
    -- cancela a recorrência: some daquele mês em diante (quitados ficam)
    with del as (
      delete from public.finance_transactions
       where recurring_rule_id = p_rule_id and user_id = v_uid
         and settled = false and period >= p_from_period
      returning 1
    ) select count(*) into v_deleted from del;
    update public.finance_recurring_rules set active = false
     where id = p_rule_id and user_id = v_uid;

  elsif p_scope = 'one_and_future' then
    -- exclui o mês clicado (mesmo quitado) + futuros não quitados e cancela
    with del as (
      delete from public.finance_transactions
       where recurring_rule_id = p_rule_id and user_id = v_uid
         and (period = p_from_period or (settled = false and period > p_from_period))
      returning 1
    ) select count(*) into v_deleted from del;
    update public.finance_recurring_rules set active = false
     where id = p_rule_id and user_id = v_uid;

  elsif p_scope = 'all' then
    with del as (
      delete from public.finance_transactions
       where recurring_rule_id = p_rule_id and user_id = v_uid and settled = false
      returning 1
    ) select count(*) into v_deleted from del;
    delete from public.finance_recurring_rules where id = p_rule_id and user_id = v_uid;

  else
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  return json_build_object('ok', true, 'deleted', v_deleted);
end;
$$;
