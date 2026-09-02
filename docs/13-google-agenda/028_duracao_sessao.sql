-- ============================================================
-- 028_duracao_sessao.sql — duração de sessão configurável (Fase 1)
-- Aplicar no SQL Editor do Supabase (ou via MCP apply_migration),
-- após a migração 027. Idempotente: pode rodar novamente sem efeito.
--
-- 100% aditiva: colunas nullable + tabela nova. Sem backfill e sem
-- seed — a resolução usa fallback em domain (effectiveDuration):
--   appointments.duration_min ?? patients.session_duration_min
--     ?? user_settings.default_session_duration_min ?? 50
-- Usuário sem linha em user_settings continua idêntico ao hoje.
-- ============================================================

-- ── 1) Preferências do usuário ──────────────────────────────────────
create table if not exists public.user_settings (
  user_id                      uuid primary key default auth.uid(),
  default_session_duration_min int  not null default 50
    check (default_session_duration_min between 10 and 240),
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

alter table public.user_settings enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings_own'
  ) then
    create policy "user_settings_own" on public.user_settings
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- ── 2) Duração por paciente (null = herda o padrão do usuário) ──────
alter table public.patients
  add column if not exists session_duration_min int
    check (session_duration_min is null or session_duration_min between 10 and 240);

-- ── 3) Duração por atendimento (null = herda do paciente/usuário) ───
alter table public.appointments
  add column if not exists duration_min int
    check (duration_min is null or duration_min between 10 and 240);
