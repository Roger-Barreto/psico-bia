-- ============================================================
-- 033_falta_cobrada.sql — falta que continua sendo cobrada
--
-- Alguns contratos preveem cobrança da sessão perdida quando o paciente
-- não avisa com antecedência. Até aqui o único jeito de registrar isso
-- era marcar a sessão como "atendida", o que corrompia o KPI de faltas,
-- o checklist e as pendências.
--
-- Solução: uma flag por atendimento. O status continua 'missed' — nenhum
-- valor novo no CHECK de status, nenhuma máquina de estados nova. O que
-- muda é só o predicado "isto gera receita?".
--
-- IMPORTANTE — por que a view `finance_clinic_income` NÃO é tocada aqui:
-- o SQL dela nunca foi versionado (migrations 012–016 foram aplicadas via
-- MCP). Um `create or replace view` escrito às cegas correria dois riscos
-- sérios: (a) perder a cláusula `with (security_invoker = true)`, o que faz
-- a view voltar a rodar como o dono e ignorar o RLS; (b) falhar/divergir na
-- ordem das colunas, da qual `finance_ledger` depende. Em vez disso,
-- acrescentamos um TERCEIRO BRAÇO ao `finance_ledger` — cuja definição
-- completa está versionada em docs/11-cofrinhos/022_cofrinhos.sql:102-123 e
-- é reproduzida abaixo verbatim. Os braços são disjuntos:
--   braço 2 = sessões 'attended'   (finance_clinic_income, intocada)
--   braço 3 = faltas 'missed' com charged_absence = true  (novo)
--
-- Idempotente: pode rodar de novo sem efeito.
-- ============================================================

-- ── 1) A flag ────────────────────────────────────────────────────────
alter table public.appointments
  add column if not exists charged_absence boolean not null default false;

comment on column public.appointments.charged_absence is
  'Falta que continua sendo cobrada (contrato). Só faz sentido com status = ''missed''.';

-- Só uma falta pode estar marcada como cobrada. Impede o estado latente
-- "reagendei e a flag sobreviveu", que voltaria a cobrar sozinho depois.
alter table public.appointments
  drop constraint if exists appointments_charged_absence_only_missed;
alter table public.appointments
  add constraint appointments_charged_absence_only_missed
  check (charged_absence = false or status = 'missed');

create index if not exists appointments_charged_absence_idx
  on public.appointments (charged_absence)
  where charged_absence;

-- ── 2) Ledger: braços 1 e 2 verbatim + braço 3 (faltas cobradas) ─────
-- `with (security_invoker = true)` é OBRIGATÓRIO repetir: create or replace
-- substitui as reloptions da view, e sem ele o RLS deixa de ser aplicado.
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
   from public.finance_clinic_income ci
 union all
 -- Braço 3 — faltas cobradas. Espelha o braço 2 (mesma origem: a agenda,
 -- read-only, editable = false), mudando só o filtro, a descrição e a
 -- categoria, para que a falta cobrada seja distinguível no ledger e vire
 -- fatia própria no gráfico por categoria.
 select 'ca_' || a.id                                  as id,
        'income'::text                                 as kind,
        'clinic'::text                                 as scope,
        ('Falta cobrada — ' || p.name)                 as description,
        coalesce(a.paid_value, p.consultation_value)   as amount,
        a.date                                         as date,
        substr(a.date, 1, 7)                           as period,
        null::text                                     as category_id,
        'Faltas cobradas'::text                        as category_name,
        a.payment_method_id                            as payment_method_id,
        null::text                                     as person_id,
        a.paid                                         as settled,
        a.paid_at                                      as settled_at,
        null::text                                     as recurring_rule_id,
        null::text                                     as installment_group,
        null::int                                      as installment_no,
        null::int                                      as installment_total,
        null::text                                     as link_id,
        'clinic'::text                                 as source,
        false                                          as editable,
        a.patient_id                                   as patient_id,
        a.updated_at                                   as created_at,
        a.updated_at                                   as updated_at,
        auth.uid()                                     as user_id,
        null::text, null::text, null::text, null::text,
        null::text
   from public.appointments a
   join public.patients p on p.id = a.patient_id
  where a.status = 'missed'
    and a.charged_absence
    and p.active;
