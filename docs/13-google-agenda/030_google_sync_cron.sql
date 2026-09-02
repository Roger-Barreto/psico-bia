-- ============================================================
-- 030_google_sync_cron.sql — motor de sincronização agendado (Fase 3)
-- Aplicar após a 029 e DEPOIS de publicar a Edge Function `google-sync`.
--
-- ⚠️ Antes de rodar, substituir <SYNC_SECRET> pelo MESMO valor definido em:
--     supabase secrets set SYNC_SECRET=<valor forte aleatório>
-- O secret fica no Vault; o comando do cron o injeta no header a cada chamada.
--
-- Compatibilidade: com zero conexões em google_connections, cada execução
-- da function encontra nada a fazer e retorna em milissegundos.
-- Rollback operacional: select cron.unschedule('google-sync');
--                       select cron.unschedule('google-sync-reconcile');
-- ============================================================

-- ── 1) Extensões ────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 2) Secret compartilhado no Vault (idempotente) ──────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'google_sync_secret') then
    perform vault.create_secret('<SYNC_SECRET>', 'google_sync_secret');
  end if;
end $$;

-- ── 3) Delta sync a cada 10 minutos ─────────────────────────────────
-- (unschedule tolerante a "job não existe" → migração re-executável)
do $$ begin perform cron.unschedule('google-sync'); exception when others then null; end $$;
select cron.schedule(
  'google-sync',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://yhnbqjscewaiwemlllwl.supabase.co/functions/v1/google-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret',
        (select decrypted_secret from vault.decrypted_secrets
          where name = 'google_sync_secret')
    ),
    body    := '{"mode":"delta"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

-- ── 4) Reconcile completo diário — 04:00 em Brasília ────────────────
-- pg_cron agenda em UTC; America/Sao_Paulo = UTC-3 (sem horário de verão) → 07:00 UTC.
do $$ begin perform cron.unschedule('google-sync-reconcile'); exception when others then null; end $$;
select cron.schedule(
  'google-sync-reconcile',
  '0 7 * * *',
  $cron$
  select net.http_post(
    url     := 'https://yhnbqjscewaiwemlllwl.supabase.co/functions/v1/google-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret',
        (select decrypted_secret from vault.decrypted_secrets
          where name = 'google_sync_secret')
    ),
    body    := '{"mode":"reconcile"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
