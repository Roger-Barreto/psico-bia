-- ============================================================
-- 031_google_push_outbox.sql — outbox + triggers do push (Fase 4)
-- Aplicar após a 030. Idempotente: pode rodar novamente sem efeito.
--
-- REGRA DE OURO (compatibilidade): as triggers deste arquivo NUNCA podem
-- derrubar um fluxo clínico. Por isso cada função:
--   1. retorna cedo se o usuário não tem conexão Google ativa com escrita
--      ligada (para os demais usuários, custo = um `if exists`);
--   2. embrulha tudo em `exception when others` — qualquer erro do enfileira-
--      mento é engolido e o agendamento/desfazer/alta segue normalmente.
-- São AFTER triggers: o valor de retorno é ignorado (return null).
--
-- Por que triggers: exclusões/altas acontecem DENTRO de RPCs
-- (bulk_delete_appointments, discharge_patient) e o cliente nunca enumera
-- as ocorrências afetadas. Triggers de linha disparam em qualquer escrita,
-- inclusive dentro de RPCs — nenhum fluxo fica de fora e nenhuma RPC muda.
-- ============================================================

-- ── 1) Outbox (colapsada por série) ─────────────────────────────────
create table if not exists public.google_sync_outbox (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  series_id    text not null,          -- sem FK: precisa sobreviver ao delete da série
  enqueued_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- Uma entrada pendente por série (mudanças em rajada colapsam numa só).
create unique index if not exists google_sync_outbox_pending_uq
  on public.google_sync_outbox (series_id) where processed_at is null;
create index if not exists google_sync_outbox_pending_idx
  on public.google_sync_outbox (processed_at) where processed_at is null;

alter table public.google_sync_outbox enable row level security;
do $$
begin
  -- Insert para authenticated: as triggers rodam com o papel do chamador.
  -- Sem select/update/delete: leitura e baixa são só do sync (service_role).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'google_sync_outbox'
      and policyname = 'google_sync_outbox_insert'
  ) then
    create policy "google_sync_outbox_insert" on public.google_sync_outbox
      for insert to authenticated with check (user_id = auth.uid());
  end if;
end $$;

-- ── 2) Enfileirar por série (appointment_series + appointments) ─────
create or replace function public.google_outbox_enqueue()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_uid    uuid;
  v_series text;
begin
  if tg_op = 'DELETE' then
    v_uid := old.user_id;
  else
    v_uid := new.user_id;
  end if;

  if tg_table_name = 'appointment_series' then
    v_series := case when tg_op = 'DELETE' then old.id else new.id end;
  else  -- appointments
    v_series := case when tg_op = 'DELETE' then old.series_id else new.series_id end;
  end if;

  if v_series is null then
    return null;
  end if;

  if not exists (
    select 1 from public.google_connections gc
     where gc.user_id = v_uid
       and gc.status = 'active'
       and gc.write_enabled
  ) then
    return null;
  end if;

  insert into public.google_sync_outbox (user_id, series_id)
  values (v_uid, v_series)
  on conflict (series_id) where processed_at is null do nothing;

  return null;
exception when others then
  return null;   -- sync nunca derruba o fluxo clínico
end;
$$;

drop trigger if exists google_outbox_on_series on public.appointment_series;
create trigger google_outbox_on_series
  after insert or update or delete on public.appointment_series
  for each row execute function public.google_outbox_enqueue();

drop trigger if exists google_outbox_on_appointments on public.appointments;
create trigger google_outbox_on_appointments
  after insert or update or delete on public.appointments
  for each row execute function public.google_outbox_enqueue();

-- ── 3) Mudanças no paciente que afetam a agenda espelhada ───────────
-- Arquivar/alta remove as sessões futuras do Google; duração muda o fim
-- dos eventos. Enfileira todas as séries do paciente.
create or replace function public.google_outbox_enqueue_patient()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.active is not distinct from old.active
     and new.discharged_at is not distinct from old.discharged_at
     and new.session_duration_min is not distinct from old.session_duration_min then
    return null;
  end if;

  if not exists (
    select 1 from public.google_connections gc
     where gc.user_id = new.user_id
       and gc.status = 'active'
       and gc.write_enabled
  ) then
    return null;
  end if;

  insert into public.google_sync_outbox (user_id, series_id)
  select new.user_id, s.id
    from public.appointment_series s
   where s.patient_id = new.id
  on conflict (series_id) where processed_at is null do nothing;

  return null;
exception when others then
  return null;
end;
$$;

drop trigger if exists google_outbox_on_patients on public.patients;
create trigger google_outbox_on_patients
  after update of active, discharged_at, session_duration_min on public.patients
  for each row execute function public.google_outbox_enqueue_patient();
