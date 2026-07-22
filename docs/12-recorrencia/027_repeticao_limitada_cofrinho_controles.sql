-- ============================================================
-- 027 — repetição limitada + controles de cofrinho
--   • finance_recurring_rules.occurrences: repetir N vezes (null = infinito).
--   • finance_cofrinhos.paused: cofrinho pausado não gera lembretes de guardar
--     (mantém saldo/histórico; planos gravados continuam).
--   • finance_cofrinho_entries: novo kind 'withdraw' (retirada da reserva /
--     transferência de saída) + novas sources 'transfer' e 'repeat'.
--   • ensure_recurring_materialized: respeita occurrences (para após N meses)
--     e continua respeitando os tombstones da 025.
-- Idempotente: pode rodar de novo sem efeito.
-- ============================================================

-- ── 1) Repetição limitada nas regras recorrentes ───────────────────
alter table public.finance_recurring_rules
  add column if not exists occurrences int check (occurrences is null or occurrences >= 1);

-- ── 2) Pausa do cofrinho ───────────────────────────────────────────
alter table public.finance_cofrinhos
  add column if not exists paused boolean not null default false;

-- ── 3) Novos kind/source nas atividades do cofrinho ────────────────
alter table public.finance_cofrinho_entries
  drop constraint if exists finance_cofrinho_entries_kind_check;
alter table public.finance_cofrinho_entries
  add constraint finance_cofrinho_entries_kind_check
  check (kind in ('deposit','skip','plan','withdraw'));

alter table public.finance_cofrinho_entries
  drop constraint if exists finance_cofrinho_entries_source_check;
alter table public.finance_cofrinho_entries
  add constraint finance_cofrinho_entries_source_check
  check (source in ('fixed','percent','rollover','repay','manual','transfer','repeat'));

-- ── 4) Materialização respeita occurrences (+ tombstones da 025) ───
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
  v_idx     int;
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
    v_idx := 0;
    while v_period <= p_until_period loop
      -- repetição limitada: para depois de N meses a partir do início
      exit when r.occurrences is not null and v_idx >= r.occurrences;

      v_year  := substr(v_period, 1, 4)::int;
      v_month := substr(v_period, 6, 2)::int;

      -- mês excluído individualmente → não recria (tombstone da 025)
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

      v_idx := v_idx + 1;
      v_period := to_char(make_date(v_year, v_month, 1) + interval '1 month', 'YYYY-MM');
    end loop;
  end loop;

  return json_build_object('inserted', v_inserted);
end;
$$;
