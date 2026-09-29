-- ============================================================
-- 034_pacotes_sessoes.sql — pacotes de sessões pré-pagos
--
-- O paciente fecha, numa sessão, um pacote de N sessões por um valor
-- combinado (que varia de paciente para paciente) e paga na hora. Até aqui
-- a psicóloga registrava o valor cheio na primeira sessão e R$ 0,00 em cada
-- uma das seguintes, à mão — e nada dizia quantas ainda faltavam.
--
-- Modelo:
--   * `session_packages`      — o pacote: quantas sessões, quanto custou,
--                               como foi pago, desde quando vale.
--   * `appointments.package_id` — a sessão que consumiu uma vaga do pacote.
--
-- O saldo NÃO é guardado em lugar nenhum: sessões usadas = quantas linhas de
-- `appointments` apontam para o pacote. Não existe contador para dessincronizar.
--
-- Regime de caixa: o dinheiro entra inteiro no dia da venda (uma linha de
-- receita do pacote no ledger); as sessões cobertas ficam pagas com valor 0
-- e saem do ledger, para não virarem uma fileira de lançamentos de R$ 0,00.
--
-- O consumo é feito por TRIGGER, não pelo app. Assim ele vale para qualquer
-- caminho que mexa na sessão (marcar atendido, falta cobrada, reagendar,
-- desfazer, RPCs antigas, um app em cache ainda na versão anterior) e é
-- atômico — dois aparelhos não conseguem gastar a mesma última vaga.
--
-- ORDEM DE PUBLICAÇÃO: rode esta migração ANTES de publicar o frontend. O
-- frontend novo lê `appointments.package_id` e a tabela `session_packages`.
-- A ordem inversa é segura para o app antigo: sem nenhum pacote cadastrado o
-- trigger não altera nada e as views devolvem exatamente o que devolviam.
--
-- Idempotente: pode rodar de novo sem efeito.
-- ============================================================

-- ── 1) O pacote ──────────────────────────────────────────────────────
create table if not exists public.session_packages (
  id                text primary key,
  user_id           uuid not null default auth.uid()
                      references auth.users(id) on delete cascade,
  patient_id        text not null
                      references public.patients(id) on delete cascade,
  total_sessions    integer not null,
  total_value       numeric not null,
  payment_method_id text references public.payment_methods(id) on delete set null,
  -- Dia da venda: competência da receita E primeiro dia coberto pelo pacote.
  start_date        text not null,
  paid_at           text,
  notes             text,
  -- Encerrado antes de acabar (o saldo que sobrou não será usado).
  closed_at         text,
  created_at        text not null,
  updated_at        text not null,
  constraint session_packages_total_sessions_check
    check (total_sessions between 1 and 200),
  constraint session_packages_total_value_check
    check (total_value >= 0),
  constraint session_packages_start_date_check
    check (start_date ~ '^\d{4}-\d{2}-\d{2}$')
);

comment on table public.session_packages is
  'Pacote de sessões pré-pago. Sessões usadas = appointments com package_id = id.';

create index if not exists session_packages_patient_idx
  on public.session_packages (patient_id);
create index if not exists session_packages_user_idx
  on public.session_packages (user_id);

alter table public.session_packages enable row level security;

-- Explícito, para não depender dos privilégios padrão do projeto: sem isto o
-- trigger de consumo falharia com "permission denied" a cada sessão marcada
-- como atendida. Quem decide o que cada conta enxerga continua sendo o RLS.
grant select, insert, update, delete on public.session_packages to authenticated;
grant all on public.session_packages to service_role;

drop policy if exists session_packages_select on public.session_packages;
create policy session_packages_select on public.session_packages
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists session_packages_insert on public.session_packages;
create policy session_packages_insert on public.session_packages
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists session_packages_update on public.session_packages;
create policy session_packages_update on public.session_packages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists session_packages_delete on public.session_packages;
create policy session_packages_delete on public.session_packages
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── 2) A sessão que consome o pacote ─────────────────────────────────
-- `on delete set null`: apagar o pacote solta as sessões; o trigger abaixo
-- percebe o vínculo desfeito e devolve cada uma ao estado "não paga".
alter table public.appointments
  add column if not exists package_id text
    references public.session_packages(id) on delete set null;

comment on column public.appointments.package_id is
  'Pacote que pagou esta sessão. Só existe em sessão cobrável, sempre com paid = true e paid_value = 0.';

create index if not exists appointments_package_idx
  on public.appointments (package_id)
  where package_id is not null;

-- ── 3) Regras do vínculo sessão ↔ pacote ─────────────────────────────
-- Invariante mantido aqui: package_id preenchido ⇒ sessão cobrável
-- (atendida, ou falta cobrada), paid = true, paid_value = 0.
create or replace function public.appointments_apply_package()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev_pkg     text    := null;
  v_prev_value   numeric := null;
  v_was_billable boolean := false;
  v_billable     boolean;
  v_pkg          public.session_packages%rowtype;
  v_locked       public.session_packages%rowtype;
  v_used         integer;
  v_now          text := to_char(now() at time zone 'utc',
                                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  v_billable := new.status = 'attended'
                or (new.status = 'missed' and new.charged_absence);

  if tg_op = 'UPDATE' then
    v_prev_pkg     := old.package_id;
    v_prev_value   := old.paid_value;
    v_was_billable := old.status = 'attended'
                      or (old.status = 'missed' and old.charged_absence);
  elsif exists (
    select 1 from public.appointments a
     where a.series_id = new.series_id
       and a.origin_date = new.origin_date
  ) then
    -- Upsert (INSERT … ON CONFLICT DO UPDATE): o BEFORE INSERT dispara mesmo
    -- quando a linha já existe e o comando vai virar UPDATE. Quem decide
    -- nesse caso é o BEFORE UPDATE, que enxerga o estado anterior de
    -- verdade; aqui fica só a regra que não depende dele.
    if new.package_id is not null and not v_billable then
      new.package_id        := null;
      new.paid              := false;
      new.paid_value        := null;
      new.paid_at           := null;
      new.payment_method_id := null;
    end if;
    return new;
  end if;

  -- (1) A sessão aponta para um pacote.
  if new.package_id is not null then
    if not v_billable then
      -- Deixou de gerar receita (reagendada, desfeita, falta sem cobrança):
      -- a vaga volta para o saldo do pacote.
      new.package_id        := null;
      new.paid              := false;
      new.paid_value        := null;
      new.paid_at           := null;
      new.payment_method_id := null;
      return new;
    end if;

    if new.package_id is distinct from v_prev_pkg then
      -- Sessão que já tem pagamento de verdade não entra em pacote: o
      -- vínculo zeraria o valor recebido sem ninguém perceber.
      if tg_op = 'UPDATE' and old.paid and old.package_id is null then
        raise exception 'appointment_already_paid' using errcode = 'P0001';
      end if;

      -- Vínculo novo: o pacote precisa existir, ser deste paciente, estar
      -- aberto e ter vaga. O lock serializa dois consumos simultâneos.
      select p.* into v_pkg
        from public.session_packages p
       where p.id = new.package_id
         for update;
      if not found
         or v_pkg.patient_id <> new.patient_id
         or v_pkg.user_id <> new.user_id then
        raise exception 'package_not_found' using errcode = 'P0001';
      end if;
      if v_pkg.closed_at is not null then
        raise exception 'package_closed' using errcode = 'P0001';
      end if;
      select count(*) into v_used
        from public.appointments a
       where a.package_id = v_pkg.id and a.id <> new.id;
      if v_used >= v_pkg.total_sessions then
        raise exception 'package_full' using errcode = 'P0001';
      end if;
      new.paid              := true;
      new.paid_value        := 0;
      new.paid_at           := v_now;
      new.payment_method_id := v_pkg.payment_method_id;
      return new;
    end if;

    -- Vínculo que já existia.
    if not new.paid then
      -- "Desmarcar pagamento" numa sessão de pacote devolve a vaga.
      new.package_id        := null;
      new.paid_value        := null;
      new.paid_at           := null;
      new.payment_method_id := null;
    else
      new.paid_value := 0;
    end if;
    return new;
  end if;

  -- (2) O vínculo acabou de ser desfeito (pelo app, ou pelo
  -- `on delete set null` quando o pacote é apagado). Se ninguém mexeu no
  -- valor, ele ainda é o 0 do pacote: a sessão volta a "não paga" e sem
  -- valor próprio — senão ficaria valendo R$ 0,00. Se veio um valor novo
  -- no mesmo update (tirar do pacote e cobrar à parte), ele fica.
  if v_prev_pkg is not null then
    if new.paid_value is not distinct from v_prev_value then
      new.paid              := false;
      new.paid_value        := null;
      new.paid_at           := null;
      new.payment_method_id := null;
    end if;
    return new;
  end if;

  -- (3) Consumo automático: a sessão acabou de virar cobrável, ainda não foi
  -- paga e o paciente tem pacote aberto com vaga. Usa o mais antigo primeiro.
  -- Só na transição — quem tirou a sessão do pacote de propósito não a vê
  -- voltar sozinha na próxima edição.
  if v_billable and not v_was_billable and not new.paid then
    for v_pkg in
      select p.*
        from public.session_packages p
       where p.patient_id = new.patient_id
         and p.user_id = new.user_id
         and p.closed_at is null
         and p.start_date <= new.date
       order by p.start_date, p.created_at, p.id
    loop
      -- Relê o pacote JÁ com o lock: entre a busca acima e este ponto outro
      -- aparelho pode tê-lo encerrado, encolhido ou apagado.
      select p.* into v_locked
        from public.session_packages p
       where p.id = v_pkg.id
         for update;
      continue when not found or v_locked.closed_at is not null;
      select count(*) into v_used
        from public.appointments a
       where a.package_id = v_locked.id and a.id <> new.id;
      if v_used < v_locked.total_sessions then
        new.package_id        := v_locked.id;
        new.paid              := true;
        new.paid_value        := 0;
        new.paid_at           := v_now;
        new.payment_method_id := v_locked.payment_method_id;
        exit;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_package on public.appointments;
create trigger appointments_package
  before insert or update on public.appointments
  for each row execute function public.appointments_apply_package();

-- ── 4) Guarda do próprio pacote ──────────────────────────────────────
-- Não dá para encolher o pacote abaixo do que já foi usado, nem trocá-lo de
-- paciente (as sessões vinculadas ficariam apontando para o pacote de outro).
create or replace function public.session_packages_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_used integer;
begin
  if new.patient_id <> old.patient_id then
    raise exception 'package_patient_immutable' using errcode = 'P0001';
  end if;
  if new.total_sessions < old.total_sessions then
    select count(*) into v_used
      from public.appointments a
     where a.package_id = new.id;
    if new.total_sessions < v_used then
      raise exception 'package_total_below_used' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists session_packages_guard on public.session_packages;
create trigger session_packages_guard
  before update on public.session_packages
  for each row execute function public.session_packages_guard();

-- ── 5) Vender o pacote ───────────────────────────────────────────────
-- Cria o pacote e, quando ele foi fechado numa sessão, já consome a primeira
-- vaga com ela — tudo na mesma transação.
create or replace function public.create_session_package(
  p_id                text,
  p_patient_id        text,
  p_total_sessions    integer,
  p_total_value       numeric,
  p_payment_method_id text,
  p_start_date        text,
  p_appointment_id    text default null,
  p_notes             text default null
)
returns public.session_packages
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now text := to_char(now() at time zone 'utc',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_row public.session_packages%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform 1 from public.patients p
    where p.id = p_patient_id and p.user_id = v_uid;
  if not found then
    raise exception 'patient_not_found' using errcode = 'P0001';
  end if;

  insert into public.session_packages (
    id, user_id, patient_id, total_sessions, total_value,
    payment_method_id, start_date, paid_at, notes, closed_at,
    created_at, updated_at
  ) values (
    p_id, v_uid, p_patient_id, p_total_sessions, p_total_value,
    p_payment_method_id, p_start_date, v_now, nullif(btrim(p_notes), ''), null,
    v_now, v_now
  )
  returning * into v_row;

  if p_appointment_id is not null then
    update public.appointments a
       set package_id = v_row.id,
           updated_at = v_now
     where a.id = p_appointment_id
       and a.patient_id = p_patient_id
       and a.user_id = v_uid
       and not a.paid
       and (a.status = 'attended'
            or (a.status = 'missed' and a.charged_absence));
    if not found then
      raise exception 'appointment_not_found' using errcode = 'P0001';
    end if;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.create_session_package(
  text, text, integer, numeric, text, text, text, text
) from public, anon;
grant execute on function public.create_session_package(
  text, text, integer, numeric, text, text, text, text
) to authenticated, service_role;

-- ── 6) Receita clínica: sessão de pacote sai do ledger ───────────────
-- Definição copiada de `pg_get_viewdef` em produção (o SQL desta view nunca
-- tinha sido versionado — ver 033), acrescida só do filtro `package_id is
-- null`. `with (security_invoker = true)` é OBRIGATÓRIO repetir: create or
-- replace substitui as reloptions, e sem ele a view deixa de respeitar RLS.
create or replace view public.finance_clinic_income
with (security_invoker = true) as
 select 'cli_'::text || a.id                                      as id,
        'income'::text                                            as kind,
        'clinic'::text                                            as scope,
        p.name                                                    as description,
        coalesce(a.paid_value, p.consultation_value, 0::numeric)  as amount,
        a.date,
        substr(a.date, 1, 7)                                      as period,
        null::text                                                as category_id,
        'Atendimentos'::text                                      as category_name,
        a.payment_method_id,
        null::text                                                as person_id,
        a.paid                                                    as settled,
        a.paid_at                                                 as settled_at,
        null::text                                                as recurring_rule_id,
        null::text                                                as installment_group,
        null::integer                                             as installment_no,
        null::integer                                             as installment_total,
        null::text                                                as link_id,
        'clinic'::text                                            as source,
        false                                                     as editable,
        a.patient_id,
        a.updated_at                                              as created_at,
        a.updated_at,
        a.user_id
   from public.appointments a
   join public.patients p on p.id = a.patient_id
  where a.status = 'attended'
    and p.active = true
    and a.package_id is null;

-- ── 7) Ledger: braços 1–3 de 033 + braço 4 (venda de pacotes) ────────
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
 -- Braço 3 — faltas cobradas (033), agora sem as que o pacote pagou.
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
        a.user_id                                      as user_id,
        null::text, null::text, null::text, null::text,
        null::text
   from public.appointments a
   join public.patients p on p.id = a.patient_id
  where a.status = 'missed'
    and a.charged_absence
    and p.active
    and a.package_id is null
 union all
 -- Braço 4 — venda de pacotes. Uma receita por pacote, no dia da venda, já
 -- recebida. Categoria própria: vira fatia separada no gráfico por categoria
 -- e filtro próprio na lista de lançamentos.
 select 'pk_' || k.id                                  as id,
        'income'::text                                 as kind,
        'clinic'::text                                 as scope,
        ('Pacote de ' ||
          case when k.total_sessions = 1 then '1 sessão'
               else k.total_sessions || ' sessões' end
          || ' — ' || p.name)                          as description,
        k.total_value                                  as amount,
        k.start_date                                   as date,
        substr(k.start_date, 1, 7)                     as period,
        null::text                                     as category_id,
        'Pacotes de sessões'::text                     as category_name,
        k.payment_method_id                            as payment_method_id,
        null::text                                     as person_id,
        true                                           as settled,
        k.paid_at                                      as settled_at,
        null::text                                     as recurring_rule_id,
        null::text                                     as installment_group,
        null::int                                      as installment_no,
        null::int                                      as installment_total,
        null::text                                     as link_id,
        'clinic'::text                                 as source,
        false                                          as editable,
        k.patient_id                                   as patient_id,
        k.created_at                                   as created_at,
        k.updated_at                                   as updated_at,
        k.user_id                                      as user_id,
        null::text, null::text, null::text, null::text,
        null::text
   from public.session_packages k
   join public.patients p on p.id = k.patient_id
  where p.active;
