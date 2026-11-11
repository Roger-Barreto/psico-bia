-- ============================================================
-- 036_compromissos.sql — compromissos pessoais na agenda
--
-- A agenda só conhecia atendimentos. Consulta médica, pilates, supervisão,
-- férias: tudo isso vivia em outro app, e o resultado era marcar paciente
-- em cima de um compromisso próprio. Esta migração traz esses compromissos
-- para dentro da agenda.
--
-- Modelo (espelha o de atendimentos: regra + exceções, nada materializado):
--
--   agenda_categories   categorias do usuário, com cor e ícone
--   agenda_events       o compromisso — avulso (frequency null) ou a REGRA de
--                       uma repetição. As ocorrências são calculadas no
--                       cliente (src/domain/events.ts), como as de
--                       appointment_series.
--   agenda_event_skips  ocorrências removidas de uma repetição ("só este
--                       dia"). Mesmo papel de finance_recurring_skips.
--
-- Editar "só este dia" = pular a data na regra + criar um compromisso avulso.
-- Editar "este e os próximos" = encerrar a regra na véspera + criar outra.
-- Por isso não há tabela de overrides: skip + avulso cobre os dois casos.
--
-- Datas e horas são `text` ('YYYY-MM-DD', 'HH:MM'), como no resto do
-- esquema — a agenda compara strings e não lida com fuso.
--
-- `busy`: o compromisso ocupa o horário. É o que faz o app avisar ao agendar
-- um paciente em cima dele. Lembretes ("aniversário da mãe") ficam com false.
--
-- ORDEM DE PUBLICAÇÃO: rode ANTES do frontend. A ordem inversa só deixaria a
-- lista de compromissos vazia (a consulta falha e a agenda segue mostrando
-- os atendimentos).
--
-- 100% aditiva (só tabelas novas) e idempotente.
-- ============================================================

-- ── 1) Categorias ────────────────────────────────────────────────────
create table if not exists public.agenda_categories (
  id         text primary key,
  name       text not null,
  color      text not null,
  icon       text not null default 'calendar',
  created_at text not null,
  user_id    uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  constraint agenda_categories_name_check  check (btrim(name) <> ''),
  constraint agenda_categories_color_check check (color ~ '^#[0-9a-fA-F]{6}$')
);

-- Um nome por usuário (sem diferenciar maiúsculas). Também é o que torna o
-- seed seguro contra duas abas abrindo a agenda ao mesmo tempo.
create unique index if not exists agenda_categories_user_name_key
  on public.agenda_categories (user_id, lower(btrim(name)));

comment on table public.agenda_categories is
  'Categorias de compromisso pessoal (cor + ícone). Ver docs/19-compromissos.';

-- ── 2) Compromissos ──────────────────────────────────────────────────
create table if not exists public.agenda_events (
  id          text primary key,
  title       text not null,
  category_id text references public.agenda_categories (id) on delete set null,
  start_date  text not null,
  all_day     boolean not null default false,
  start_time  text,
  end_time    text,
  frequency   text,
  weekdays    smallint[],
  end_date    text,
  location    text,
  notes       text,
  busy        boolean not null default true,
  created_at  text not null,
  updated_at  text not null,
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  constraint agenda_events_title_check check (btrim(title) <> ''),
  constraint agenda_events_start_date_check
    check (start_date ~ '^\d{4}-\d{2}-\d{2}$'),
  constraint agenda_events_end_date_check
    check (end_date is null
           or (end_date ~ '^\d{4}-\d{2}-\d{2}$' and end_date >= start_date)),
  constraint agenda_events_frequency_check
    check (frequency in ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  -- Dia inteiro não tem hora; com hora, as duas existem e o fim vem depois
  -- do início (o compromisso não atravessa a meia-noite).
  constraint agenda_events_time_check
    check (
      (all_day and start_time is null and end_time is null)
      or (not all_day
          -- `is not null` explícito: `null ~ '…'` é NULL, e CHECK aceita NULL.
          and start_time is not null
          and end_time is not null
          and start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'
          and end_time   ~ '^([01]\d|2[0-3]):[0-5]\d$'
          and end_time > start_time)
    ),
  -- Dias da semana (0 = domingo … 6 = sábado) só na repetição semanal:
  -- "pilates toda terça e quinta" é uma regra só.
  constraint agenda_events_weekdays_check
    check (
      weekdays is null
      or (frequency = 'weekly'
          and cardinality(weekdays) between 1 and 7
          and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    ),
  -- Fim da repetição só existe em repetição.
  constraint agenda_events_end_requires_frequency_check
    check (end_date is null or frequency is not null)
);

create index if not exists agenda_events_user_start_idx
  on public.agenda_events (user_id, start_date);
create index if not exists agenda_events_category_idx
  on public.agenda_events (category_id);

comment on table public.agenda_events is
  'Compromisso pessoal: avulso (frequency null) ou regra de repetição. Ver docs/19-compromissos.';
comment on column public.agenda_events.busy is
  'Ocupa o horário: o app avisa ao agendar paciente em cima. false = lembrete.';
comment on column public.agenda_events.weekdays is
  'Só com frequency = weekly: dias da semana (0 = domingo). null = o dia de start_date.';

-- ── 3) Ocorrências removidas de uma repetição ────────────────────────
create table if not exists public.agenda_event_skips (
  event_id    text not null
                references public.agenda_events (id) on delete cascade,
  origin_date text not null,
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  primary key (event_id, origin_date),
  constraint agenda_event_skips_date_check
    check (origin_date ~ '^\d{4}-\d{2}-\d{2}$')
);

create index if not exists agenda_event_skips_user_idx
  on public.agenda_event_skips (user_id);

comment on table public.agenda_event_skips is
  'Datas puladas de um compromisso repetido (excluir/editar "só este dia").';

-- ── 4) RLS: cada conta só enxerga o que é dela ───────────────────────
alter table public.agenda_categories  enable row level security;
alter table public.agenda_events      enable row level security;
alter table public.agenda_event_skips enable row level security;

-- `(select auth.uid())`: avaliado uma vez por consulta, não por linha.
drop policy if exists agenda_categories_own on public.agenda_categories;
create policy agenda_categories_own on public.agenda_categories
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- O `with check` também barra apontar para categoria de outra conta: a FK
-- sozinha não olha RLS.
drop policy if exists agenda_events_own on public.agenda_events;
create policy agenda_events_own on public.agenda_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      category_id is null
      or exists (
        select 1 from public.agenda_categories c
         where c.id = category_id
           and c.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists agenda_event_skips_own on public.agenda_event_skips;
create policy agenda_event_skips_own on public.agenda_event_skips
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.agenda_events e
       where e.id = event_id
         and e.user_id = (select auth.uid())
    )
  );

revoke all on public.agenda_categories, public.agenda_events,
              public.agenda_event_skips from anon;
grant select, insert, update, delete
   on public.agenda_categories, public.agenda_events, public.agenda_event_skips
   to authenticated;

-- ── 5) Categorias iniciais ───────────────────────────────────────────
-- Chamado pelo app quando a lista de categorias do usuário está vazia (mesmo
-- desenho de seed_finance_defaults). Roda como o próprio usuário: passa pela
-- RLS. Cores frias de propósito — rosa, âmbar, verde e vermelho já são os
-- estados dos atendimentos na agenda.
create or replace function public.seed_agenda_defaults()
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_now   text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'no_session' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.agenda_categories where user_id = v_uid) then
    return 0;
  end if;

  with ins as (
    insert into public.agenda_categories (id, name, color, icon, created_at, user_id)
    select 'agc_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
           t.name, t.color, t.icon, v_now, v_uid
      from (values
        ('Saúde',     '#14b8a6', 'stethoscope'),
        ('Exercício', '#0ea5e9', 'barbell'),
        ('Pessoal',   '#8b5cf6', 'user'),
        ('Família',   '#d946ef', 'house'),
        ('Estudo',    '#6366f1', 'graduation-cap'),
        ('Trabalho',  '#64748b', 'briefcase'),
        ('Lazer',     '#84cc16', 'confetti')
      ) as t(name, color, icon)
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  return v_count;
end;
$$;

revoke all on function public.seed_agenda_defaults() from public, anon;
grant execute on function public.seed_agenda_defaults() to authenticated;
