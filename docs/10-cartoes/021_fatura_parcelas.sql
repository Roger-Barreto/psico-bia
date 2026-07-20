-- ============================================================
-- 021_fatura_parcelas.sql — correções de fatura de cartão
-- 1) Compra NO dia do fechamento entra na PRÓXIMA fatura
--    (convenção "a partir do dia de fechamento" — melhor dia de compra).
-- 2) Data-fix: parcelas órfãs (grupo em que só uma parcela recebeu o
--    cartão via edição) herdam o cartão do grupo.
-- 3) Recompute geral das faturas gravadas com a função corrigida.
-- Idempotente. Aplicar após a 020.
-- ============================================================

-- ── 1) d >= fechamento → próxima fatura (era ">") ──────────────────
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
  if d >= eff_close then                   -- no dia do fechamento OU depois → fecha no mês seguinte
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

-- ── 2) Parcelas órfãs herdam o cartão do grupo ─────────────────────
-- (o trigger recomputa a fatura de cada parcela pela própria data)
update public.finance_transactions t
   set card_id    = g.the_card,
       updated_at = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  from (
    select installment_group,
           max(card_id) as the_card
      from public.finance_transactions
     where installment_group is not null
     group by installment_group
    having count(*) filter (where card_id is not null) > 0
       and count(*) filter (where card_id is null) > 0
       and count(distinct card_id) = 1
  ) g
 where t.installment_group = g.installment_group
   and t.card_id is null;

-- ── 3) Realinha faturas gravadas com a função corrigida ────────────
update public.finance_transactions t
   set invoice_period     = inv.period,
       invoice_close_date = inv.close_date,
       invoice_due_date   = inv.due_date
  from (
    select tx.id as tx_id, i.period, i.close_date, i.due_date
      from public.finance_transactions tx
      join public.finance_cards c on c.id = tx.card_id,
           lateral public.finance_card_invoice(c.closing_day, c.due_day, tx.date) i
  ) inv
 where t.id = inv.tx_id
   and (t.invoice_period     is distinct from inv.period
     or t.invoice_close_date is distinct from inv.close_date
     or t.invoice_due_date   is distinct from inv.due_date);
