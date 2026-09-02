-- ============================================================
-- 029_google_agenda_core.sql — conexão Google + espelho de eventos (Fase 2)
-- Aplicar após a 028. Idempotente: pode rodar novamente sem efeito.
--
-- Desenho de segurança:
--   · google_oauth_tokens: RLS ligada e ZERO policies + revoke →
--     invisível para anon/authenticated; só as Edge Functions
--     (service_role, que bypassa RLS) leem/escrevem.
--   · external_events: só policy de SELECT → o browser não consegue
--     inserir/alterar (nunca vira "Occurrence falsa" nos fluxos).
--   · Cascata de desconexão: delete em google_connections remove
--     tokens, calendários e eventos espelhados de uma vez.
-- ============================================================

-- ── 1) Conexão (singleton por usuário) ──────────────────────────────
create table if not exists public.google_connections (
  user_id                uuid primary key default auth.uid(),
  google_email           text,
  status                 text not null default 'active'
    check (status in ('active', 'error', 'paused', 'revoked')),
  write_enabled          boolean not null default true,   -- push das sessões p/ o Google
  show_details           boolean not null default true,   -- false = só "Ocupado" na UI
  psicobia_calendar_id   text,                            -- calendário secundário criado pelo app
  timezone               text not null default 'America/Sao_Paulo',
  last_synced_at         timestamptz,
  last_full_reconcile_at timestamptz,
  last_error             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.google_connections enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'google_connections'
      and policyname = 'google_connections_select'
  ) then
    create policy "google_connections_select" on public.google_connections
      for select to authenticated using (user_id = auth.uid());
  end if;
  -- update: toggles (write_enabled/show_details). Criação/remoção é só via
  -- Edge Function (service_role) — sem policy de insert/delete de propósito.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'google_connections'
      and policyname = 'google_connections_update'
  ) then
    create policy "google_connections_update" on public.google_connections
      for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 2) Tokens OAuth — SÓ service_role ───────────────────────────────
create table if not exists public.google_oauth_tokens (
  user_id                 uuid primary key
    references public.google_connections(user_id) on delete cascade,
  refresh_token           text not null,
  access_token            text,
  access_token_expires_at timestamptz,
  scopes                  text,
  updated_at              timestamptz not null default now()
);

alter table public.google_oauth_tokens enable row level security;
-- Nenhuma policy (deny-all para anon/authenticated) + cinto e suspensório:
revoke all on public.google_oauth_tokens from anon, authenticated;

-- ── 3) Calendários da conta (lista + toggles) ───────────────────────
create table if not exists public.external_calendars (
  id                 text primary key,               -- ecal_<nanoid(10)> (gerado na function)
  user_id            uuid not null
    references public.google_connections(user_id) on delete cascade,
  google_calendar_id text not null,
  summary            text,
  color              text,
  is_primary         boolean not null default false,
  enabled            boolean not null default true,  -- exibir no PsicoBia?
  sync_token         text,                           -- sync incremental (events.list)
  last_synced_at     timestamptz,
  unique (user_id, google_calendar_id)
);
create index if not exists external_calendars_user_idx
  on public.external_calendars (user_id);

alter table public.external_calendars enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'external_calendars'
      and policyname = 'external_calendars_select'
  ) then
    create policy "external_calendars_select" on public.external_calendars
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'external_calendars'
      and policyname = 'external_calendars_update'
  ) then
    create policy "external_calendars_update" on public.external_calendars
      for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 4) Eventos espelhados (read-only para o cliente) ────────────────
create table if not exists public.external_events (
  id              text primary key,                  -- eev_<nanoid(10)> (gerado na function)
  user_id         uuid not null,
  calendar_id     text not null
    references public.external_calendars(id) on delete cascade,
  google_event_id text not null,
  title           text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  all_day         boolean not null default false,
  date_local      text not null,   -- YYYY-MM-DD no fuso do usuário (comparável ao domínio)
  end_date_local  text,            -- eventos multi-dia
  time_local      text,            -- HH:MM; null = dia inteiro
  end_time_local  text,
  busy            boolean not null default true,     -- transparency != 'transparent'
  cancelled       boolean not null default false,
  updated_at      timestamptz not null default now(),
  unique (calendar_id, google_event_id)
);
create index if not exists external_events_user_date_idx
  on public.external_events (user_id, date_local);

alter table public.external_events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'external_events'
      and policyname = 'external_events_select'
  ) then
    create policy "external_events_select" on public.external_events
      for select to authenticated using (user_id = auth.uid());
  end if;
  -- Sem insert/update/delete para authenticated: escrita só pelo sync.
end $$;
