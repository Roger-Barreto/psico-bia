# Google Agenda — Plano de Implementação

> **Status:** Proposta / plano técnico (nada implementado ainda).
> **Data:** 2026-08-06 · **Módulo:** `Google Agenda` (sincronização bidirecional de agenda).
> **Branch:** `feat/google-agenda`, criada a partir de `main` (o repositório não tem `develop`;
> o fluxo da casa é `feat/*` → `main`, como em `feat/financeiro` e `feat/leituras`).
> **Restrição central:** **nenhuma fase pode quebrar usuários existentes** — ver §3.

Este documento é um plano **acionável**: modelo de dados (SQL de migração pronto em
[`028`](028_duracao_sessao.sql), [`029`](029_google_agenda_core.sql),
[`030`](030_google_sync_cron.sql), [`031`](031_google_push_outbox.sql)), Edge Functions,
fluxo OAuth, engine de sincronização nos dois sentidos, pontos de contato na UI e roadmap
por fases — cada fase termina em estado **mergeável e inerte** para quem não conectar o Google.

---

## Sumário

1. [Sumário executivo](#1-sumário-executivo)
2. [Requisitos e escopo](#2-requisitos-e-escopo)
3. [Estratégia de branch, rollout e compatibilidade](#3-estratégia-de-branch-rollout-e-compatibilidade)
4. [Arquitetura da integração](#4-arquitetura-da-integração)
5. [Configuração no Google Cloud](#5-configuração-no-google-cloud)
6. [Migrações](#6-migrações)
7. [Edge Functions](#7-edge-functions)
8. [Duração da sessão](#8-duração-da-sessão)
9. [Leitura — compromissos do Google no PsicoBia](#9-leitura--compromissos-do-google-no-psicobia)
10. [Escrita — sessões do PsicoBia no Google](#10-escrita--sessões-do-psicobia-no-google)
11. [Frontend](#11-frontend)
12. [Segurança e privacidade](#12-segurança-e-privacidade)
13. [Roadmap por fases](#13-roadmap-por-fases)
14. [Testes e validação](#14-testes-e-validação)
15. [Riscos e mitigações](#15-riscos-e-mitigações)
16. [Decisões tomadas e pontos em aberto](#16-decisões-tomadas-e-pontos-em-aberto)

---

## 1. Sumário executivo

Integração **bidirecional** com o Google Agenda, com privacidade por padrão:

- **Leitura:** os compromissos pessoais da psicóloga aparecem na Agenda do PsicoBia
  (lista do dia, mini-calendário e aviso **não bloqueante** ao agendar/reagendar).
- **Escrita:** as sessões do PsicoBia são gravadas num **calendário secundário dedicado
  ("PsicoBia")** na conta Google dela, com título fixo **"Atendimento"** — **nunca** o nome
  do paciente.
- **Duração de sessão configurável** (padrão 50 min) em três níveis — atendimento →
  paciente → configuração geral — espelhando o padrão `effectiveValue` de
  `domain/finance.ts`. A duração também conserta um bug latente: hoje o conflito de
  agendamento só detecta horário **idêntico** (14:30 não conflita com sessão das 14:00).
- **Uma única autorização OAuth** (leitura + escrita num só consentimento), via **OAuth
  client próprio** com o `client_secret` guardado em **Edge Function** do Supabase —
  **não** pelo provider Google do Supabase Auth (login continua e-mail/senha; ver §4.3).

Como não há backend próprio e a maior parte das sessões **não existe como linha no banco**
(ocorrências são derivadas de `appointment_series` sob demanda), a escrita exige um
componente servidor: 4 Edge Functions + `pg_cron`/`pg_net` + uma **outbox** alimentada por
triggers. Tudo aditivo, tudo inerte até o usuário conectar a conta.

## 2. Requisitos e escopo

| # | Requisito | Onde é tratado |
|---|---|---|
| R1 | Ver compromissos do Google ao agendar, **sem impedir** o agendamento | §9, §11 |
| R2 | Configurar a **duração da sessão** no sistema | §8 |
| R3 | Gravar as sessões na agenda Google dela, **sem nome de paciente** | §10, §12 |
| R4 | **Uma** autenticação Google cobrindo leitura e escrita | §4.3, §5 |
| R5 | Implementar em feature branch, **sem quebrar usuários atuais** | §3, §13 |

**Fora do escopo (v1):** importar compromissos do Google como atendimentos; convidar
pacientes por e-mail; múltiplas contas Google por usuário; sincronizar eventos passados
(anteriores à conexão); notificações/lembretes do Google configurados pelo app.

## 3. Estratégia de branch, rollout e compatibilidade

### 3.1 Branch

```
main ──┬─────────────────────────────────────────────▶ (produção Vercel)
       └─ feat/google-agenda
            ├─ commit F1: duração da sessão (mergeável sozinho)
            ├─ commit F2: OAuth connect/disconnect
            ├─ commit F3: leitura (pull) + UI
            ├─ commit F4: escrita (push) + outbox
            └─ commit F5: hardening + docs
```

- Uma branch única `feat/google-agenda`, com **um commit (ou PR parcial) por fase**.
- **Cada fase termina em estado mergeável**: a F1 já entrega valor sozinha (duração +
  aviso de sobreposição) e pode ser promovida a `main` antes do resto, se desejado.
- Vercel gera **Preview Deployment** por branch — validação com URL própria antes do merge.

### 3.2 O banco é um só — regras de compatibilidade

Não há Supabase de staging: a branch de código aponta para o **mesmo projeto** (`psicobia`)
usado pela produção. Toda a segurança do rollout vem destas regras:

1. **Migrações 100% aditivas.** Só `create table`, `add column` nullable/`default`, novas
   functions/triggers/policies. Nenhum `drop`, `rename`, `alter type`, nenhuma mudança de
   assinatura de RPC existente, nenhuma view existente alterada.
2. **Aditivas ⇒ podem ser aplicadas cedo.** O frontend em produção usa `select("*")` com
   mappers que ignoram colunas desconhecidas; colunas novas nullable são invisíveis para
   o código antigo. Clientes PWA com bundle antigo (aba aberta) continuam gravando
   `appointments` sem `duration_min` → `null` → fallback de 50 min. Nada quebra.
3. **Triggers nunca abortam o fluxo principal.** As triggers de outbox (§10.3) têm
   `exception when others then return …` — um erro de sincronização **jamais** derruba um
   agendamento, desfazer ou alta. Além disso, só enfileiram se o usuário tiver conexão
   Google ativa: para os demais usuários são um `if exists` que retorna falso.
4. **Tudo atrás do estado "conectado".** Sem conexão Google: nenhuma chamada de rede nova,
   nenhum card novo na agenda, nenhum evento criado. As únicas mudanças visíveis são a
   seção "Preferências de agenda" e o botão "Conectar Google Agenda" no perfil.
5. **Edge Functions e cron são inertes.** As functions só fazem algo quando chamadas com
   credencial válida; o job de cron encontra zero conexões e encerra em milissegundos.

### 3.3 Ordem de deploy (por fase) e rollback

Ordem **sempre**: ① migração SQL → ② Edge Functions/secrets → ③ frontend (merge → Vercel).
Cada passo é compatível com o anterior ainda em produção.

| Alavanca de rollback | Efeito |
|---|---|
| `update google_connections set status = 'paused'` | pausa toda a sincronização de todos |
| `select cron.unschedule('google-sync')` | desliga o motor sem tocar em dados |
| Revert do merge na Vercel | UI some; tabelas/functions ficam (inofensivas) |
| Botão "Desconectar" | remove tokens + eventos espelhados daquele usuário |

Migrações **não** são revertidas em rollback — são aditivas e inertes por construção.

## 4. Arquitetura da integração

### 4.1 Diagrama

```
┌───────────────────────── Navegador (React) ─────────────────────────┐
│  home.tsx / schedule-dialog / profile-drawer                        │
│    ├─ hooks novos: useGoogleConnection, useExternalEventsInRange,   │
│    │                useUserSettings                                 │
│    └─ supabase-js: select em external_events / google_connections   │
└───────────────┬───────────────────────────────┬─────────────────────┘
                │ PostgREST (RLS)               │ functions.invoke (JWT)
┌───────────────▼───────────────────────────────▼─────────────────────┐
│ Supabase (projeto psicobia)                                         │
│  Postgres: user_settings · google_connections · google_oauth_tokens │
│            external_calendars · external_events · google_sync_outbox│
│            triggers (appointments, appointment_series, patients)    │
│  pg_cron + pg_net ──────────────┐                                   │
│  Edge Functions:                ▼                                   │
│   google-oauth-start → google-oauth-callback → google-disconnect    │
│   google-sync  (pull de eventos + push da outbox + reconcile)       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS (OAuth 2.0 + Calendar API v3)
                        ┌───────▼────────┐
                        │  Google APIs   │  calendário dedicado "PsicoBia"
                        └────────────────┘  + calendários pessoais (leitura)
```

### 4.2 Por que Edge Function (e não token no browser)

1. Ocorrências são **derivadas** (`occurrencesForSeries`) — a maioria das sessões futuras
   não tem linha em `appointments`; o browser não tem o que "empurrar" de forma confiável.
2. Exclusões acontecem **dentro do Postgres** (`bulk_delete_appointments`,
   `discharge_patient`): o cliente recebe só contagens, nunca a lista de ocorrências
   removidas. Triggers no banco são o único ponto que enxerga tudo — inclusive RPCs.
3. Escrita precisa de **refresh token** e retry — impossível de manter num bundle estático.

### 4.3 Por que NÃO usar o provider Google do Supabase Auth

- O Supabase devolve `provider_refresh_token` **só** no callback e não o persiste nem
  renova — o armazenamento/refresh teria de ser escrito do mesmo jeito.
- Acoplaria **login** a **autorização de API**. O login é e-mail/senha; logar com Google
  criaria outro `auth.uid()` e **toda a RLS do sistema** é chaveada nele.
- `detectSessionInUrl: false` em `src/lib/supabase.ts` é global; mudar isso para captar o
  callback OAuth tem efeito colateral em todo o app.

**Decisão:** OAuth client próprio; "Conectar Google Agenda" é uma autorização comum,
revogável sem afetar o acesso ao sistema.

### 4.4 Por que materializar eventos (e não usar RRULE)

`recurrence.ts` define `monthly` como "mesmo dia do mês, **truncado ao último dia**"
(dia 31 → 30/abr). O iCalendar não tem isso: `FREQ=MONTHLY;BYMONTHDAY=31` **pula** os
meses sem dia 31. Reagendamentos/exceções (`rescheduled`, `cancelled`, escopo `one`)
também mapeiam mal para `EXDATE`/instâncias. Materializar **1 evento por ocorrência**
num horizonte móvel dá mapeamento 1:1 com a chave `(seriesId, originDate)` — mesma chave
de unicidade lógica do sistema — e reusa o padrão de horizonte do módulo financeiro.

- **Horizonte:** hoje → **hoje + 90 dias** (constante `PUSH_HORIZON_DAYS`).
- **Chave no Google:** `extendedProperties.private = { psi_series, psi_origin }`;
  busca por `privateExtendedProperty=psi_series=<id>` → diff idempotente sem tabela de
  mapeamento local.

## 5. Configuração no Google Cloud

Checklist manual (fora do repositório), pré-requisito da Fase 2:

1. Criar projeto (ex.: `psicobia-agenda`) e **ativar a Google Calendar API**.
2. **OAuth consent screen:** tipo **External** → preencher nome/e-mails → **Publish app
   ("In production")**. ⚠️ Em modo *Testing* o refresh token expira em **7 dias** — a
   sincronização morreria semanalmente. "In production" sem verificação mostra a tela
   "app não verificado" **uma vez** (aceitável; limite de 100 usuários, irrelevante aqui).
3. **Escopos** (menor privilégio, um único consentimento — R4):
   - `…/auth/calendar.events.readonly` — ler eventos dos calendários dela (pull);
   - `…/auth/calendar.calendarlist.readonly` — listar os calendários (tela de toggles);
   - `…/auth/calendar.app.created` — criar o calendário "PsicoBia" e gerir **apenas**
     eventos de calendários criados pelo app (push).
   > Validar na Fase 2 que `calendar.app.created` cobre criar calendário + CRUD de eventos
   > nele (é o comportamento documentado). Fallback: trocar por `calendar.events` +
   > manter os dois readonly.
4. **Credencial:** OAuth Client ID tipo **Web application**; redirect URI única:
   `https://yhnbqjscewaiwemlllwl.supabase.co/functions/v1/google-oauth-callback`.
5. Guardar client id/secret como **secrets** das Edge Functions (§7.1) — nunca em
   `VITE_*`, nunca no bundle.

## 6. Migrações

Padrão da casa: SQL idempotente, RLS `user_id = auth.uid()`, ids `text` com prefixo.
Próximo número livre: **028**. Arquivos nesta pasta:

| Arquivo | Fase | Conteúdo |
|---|---|---|
| [`028_duracao_sessao.sql`](028_duracao_sessao.sql) | F1 | `user_settings` + `patients.session_duration_min` + `appointments.duration_min` |
| [`029_google_agenda_core.sql`](029_google_agenda_core.sql) | F2 | `google_connections`, `google_oauth_tokens` (sem policies = só service role), `external_calendars`, `external_events` |
| [`030_google_sync_cron.sql`](030_google_sync_cron.sql) | F3 | extensões `pg_cron`/`pg_net`, secret no Vault, job `google-sync` (10 min) |
| [`031_google_push_outbox.sql`](031_google_push_outbox.sql) | F4 | `google_sync_outbox` + triggers em `appointments`, `appointment_series`, `patients` |

Pontos de desenho que garantem compatibilidade:

- **`google_oauth_tokens` tem RLS ligada e zero policies** → nem `anon` nem `authenticated`
  leem; apenas `service_role` (Edge Functions). Tokens jamais transitam pelo PostgREST.
- **`external_events` é read-only para o cliente** (só policy de `select`): o browser não
  consegue inserir/editar — impossibilita "Occurrence falsa" entrando nos fluxos clínicos.
- **`date_local`/`time_local` são computados no sync** (Edge Function, `America/Sao_Paulo`),
  não coluna gerada — `timezone(text, timestamptz)` é `STABLE`, não `IMMUTABLE`, e o
  domínio inteiro compara datas puras `YYYY-MM-DD` lexicograficamente.
- **Triggers com `exception when others`** e guarda `if exists (conexão ativa)` — §3.2.3.

## 7. Edge Functions

Nova pasta `supabase/functions/` (o repo ainda não tem). Deploy via CLI
(`supabase functions deploy <nome> --project-ref yhnbqjscewaiwemlllwl`).

### 7.1 Secrets (via `supabase secrets set`)

| Secret | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | troca e refresh de tokens |
| `GOOGLE_STATE_SECRET` | HMAC do `state` do OAuth (CSRF) |
| `SYNC_SECRET` | autoriza o `pg_cron` a chamar `google-sync` |
| `APP_ORIGINS` | allowlist de origens de retorno (`https://<prod>`, `http://localhost:5173`, preview) |

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo runtime.)

### 7.2 As quatro functions

| Function | JWT? | Papel |
|---|---|---|
| `google-oauth-start` | ✅ usuário | monta URL de consentimento: escopos §5.3, `access_type=offline`, `prompt=consent`, `state = HMAC(user_id, origin, ts)` com TTL 10 min |
| `google-oauth-callback` | ❌ (`verify_jwt=false`; valida o `state`) | troca `code` por tokens; grava `google_oauth_tokens` (service role); upsert `google_connections` (status `active`); cria o calendário **"PsicoBia"** se não existir e guarda `psicobia_calendar_id`; importa a lista de calendários para `external_calendars`; redireciona `302` para `origin` validado contra `APP_ORIGINS` (`/agenda?google=ok`) |
| `google-disconnect` | ✅ usuário | revoga o token no Google (`oauth2.googleapis.com/revoke`), apaga conexão + tokens + calendários + eventos espelhados (cascade); opcional `deleteCalendar: true` apaga o calendário "PsicoBia" no Google |
| `google-sync` | ❌ (`verify_jwt=false`; exige header `x-sync-secret`) | motor: para cada conexão ativa → refresh do access token se preciso → **pull** (§9) → **push** da outbox (§10) → **reconcile completo** 1×/dia; grava `last_synced_at`/`last_error` |

`verify_jwt` por function em `supabase/config.toml`:

```toml
[functions.google-oauth-callback]
verify_jwt = false
[functions.google-sync]
verify_jwt = false
```

### 7.3 Reuso do domínio (recorrência) na Edge Function

`src/domain/recurrence.ts` e `dates.ts` são **puros** (zero dependências externas;
`recurrence` importa só tipos + `dates`) — a expansão de ocorrências do push usa
**exatamente o mesmo código** do frontend, eliminando divergência de regra.

Mecânica: script `scripts/sync-shared-domain.mjs` copia `recurrence.ts`, `dates.ts` e
`db/types.ts` para `supabase/functions/_shared/domain/`, reescrevendo o specifier
`@/db/types` → `./types` (alias `@/` não resolve no Deno). Roda via npm script antes do
deploy (`predeploy:functions`); a cópia é commitada e o script garante que nunca diverge.

## 8. Duração da sessão

### 8.1 Modelo — três níveis, mesmo padrão de `effectiveValue`

```ts
// src/domain/finance.ts (novo, ao lado de effectiveValue)
export function effectiveDuration(
  appt: Appointment | null,
  patient: Patient | undefined,
  settings: UserSettings | undefined,
): number {
  return (
    appt?.durationMin ??
    patient?.sessionDurationMin ??
    settings?.defaultSessionDurationMin ??
    50
  )
}
```

| Nível | Coluna | UI |
|---|---|---|
| Atendimento | `appointments.duration_min` (nullable) | campo opcional no drawer (F1 pode adiar; ver §16) |
| Paciente | `patients.session_duration_min` (nullable) | campo "Duração da sessão" no `PatientForm`, placeholder "padrão (50 min)" |
| Geral | `user_settings.default_session_duration_min` (default 50) | seção **"Preferências de agenda"** no `ProfileDrawer` |

Fallback `?? 50` no domínio ⇒ **nenhum seed, nenhum backfill**: usuário sem linha em
`user_settings` continua funcionando idêntico ao hoje.

### 8.2 Sobreposição no agendamento — aviso, não bloqueio

Hoje `schedule-appointment-dialog.tsx` indexa por igualdade de string `"date|time"` e
**bloqueia** (`disabled={conflicts.length > 0}`). Para não mudar comportamento existente:

- **Mantém**: colisão de slot exato continua bloqueando (regra atual, intocada).
- **Novo (âmbar, não bloqueante):** sobreposição parcial entre sessões internas, calculada
  por intervalo `[start, start + effectiveDuration)` — "Sobrepõe a sessão de Fulana
  (14:00–14:50)". Não desabilita o botão: quem decide é ela.
- **Novo (neutro, não bloqueante):** compromisso Google ocupado no intervalo (§9.3).
- Helper puro `overlaps(startA, durA, startB, durB)` em `domain/dates.ts` + testes de mesa
  na doc. Mesmo tratamento no fluxo de reagendar (`reschedule-conflict-dialog.tsx` /
  drawer).

## 9. Leitura — compromissos do Google no PsicoBia

### 9.1 Pull incremental (dentro de `google-sync`)

- Por calendário **habilitado** (`external_calendars.enabled`, excluindo o "PsicoBia"):
  `events.list` com `singleEvents=true` (instâncias já expandidas, RRULE resolvido pelo
  Google), `timeMin = hoje−30d`, `timeMax = hoje+180d`.
- Guarda `sync_token` por calendário → chamadas seguintes só trazem deltas; resposta
  `410 GONE` → ressincronização completa daquele calendário.
- Upsert em `external_events` por `(calendar_id, google_event_id)`; `status=cancelled` →
  marca `cancelled=true` (e some da UI). Poda linhas fora da janela a cada reconcile.
- `date_local` (`YYYY-MM-DD`) e `time_local` (`HH:MM`) computados com
  `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })`; evento de dia inteiro
  → `all_day=true`, `time_local=null`. `busy = transparency !== 'transparent'`.

### 9.2 Latência

Cron de **10 min** é suficiente para "conferir ao agendar" (compromissos pessoais mudam
pouco). Botão "Sincronizar agora" no perfil chama `google-sync` para o próprio usuário.
*Watch channels* (push do Google) ficam de fora da v1 — expiram em ~30 dias e exigem
renovação agendada (§16).

### 9.3 Consumo na UI

`useExternalEventsInRange(fromISO, toISO)` (TanStack Query, chave
`["external-events", from, to]`, habilitada só com conexão ativa) alimenta:

- **Lista do dia** (`home.tsx`): cards **neutros, não clicáveis** intercalados por horário
  — tipo próprio `ExternalEvent`, **nunca** um `Occurrence` falso (não entra em
  `pendencyIndex`/`unpaidIndex`/financeiro).
- **Mini-calendário:** `DayMeta.personal?: number` + ponto discreto (o dia já disputa
  espaço com 3 indicadores).
- **Diálogos de agendar/reagendar:** aviso não bloqueante quando um evento `busy` sobrepõe
  o intervalo da sessão (§8.2).
- Preferência **"Mostrar apenas 'Ocupado'"** (`google_connections.show_details=false`)
  esconde os títulos — compromissos pessoais podem ser sensíveis (§12).

## 10. Escrita — sessões do PsicoBia no Google

### 10.1 O que é publicado

| Campo | Valor |
|---|---|
| Calendário | secundário **"PsicoBia"** (criado pelo app; `google_connections.psicobia_calendar_id`) |
| `summary` | **"Atendimento"** — fixo, sem nome/iniciais (R3) |
| `start`/`end` | `date + time` da ocorrência, `end = start + effectiveDuration`, `timeZone: America/Sao_Paulo` |
| `extendedProperties.private` | `{ psi_series, psi_origin }` — chave de idempotência |
| Lembretes | `reminders.useDefault=true` (ela controla no próprio Google) |

### 10.2 Algoritmo (por série, dentro de `google-sync`)

1. Carrega série + paciente + overrides; **pula** se paciente `!active` ou `dischargedAt`
   (mesmo filtro do diálogo de agendamento).
2. Expande ocorrências de hoje → hoje+90d com o `occurrencesForSeries` compartilhado
   (§7.3); remove `cancelled`; aplica data/hora efetivas dos overrides (reagendamentos).
3. Lista eventos existentes no calendário PsicoBia com
   `privateExtendedProperty=psi_series=<id>`.
4. **Diff** por `psi_origin`: faltante → `insert`; divergente (data/hora/duração) →
   `patch`; sobrando (dentro do horizonte) → `delete`. Série inexistente (apagada) →
   deleta todos os eventos da chave.
5. Eventos **passados** não são tocados (histórico preservado no Google).

### 10.3 Outbox + triggers — reatividade

- `google_sync_outbox (id, user_id, series_id, enqueued_at, processed_at)`; índice único
  parcial em `(series_id) where processed_at is null` → colapsa N mudanças numa entrada.
- Triggers `after insert/update/delete` em `appointment_series` e `appointments`
  (enfileiram `series_id`), e em `patients` para `active`/`discharged_at`/
  `session_duration_min` (enfileira todas as séries do paciente). Como triggers disparam
  em **qualquer** escrita — inclusive dentro das RPCs `bulk_delete_appointments` e
  `discharge_patient` — nenhum fluxo fica de fora, sem tocar nas RPCs existentes.
- Guardas de compatibilidade (§3.2.3): early-return sem conexão ativa + `exception when
  others` engolindo qualquer erro.
- `google-sync` processa a outbox a cada execução; **reconcile completo** (todas as séries
  ativas) 1×/dia (`04:00`) e no primeiro sync após conectar — cobre o backfill inicial,
  o avanço do horizonte e correções manuais que ela fizer nos eventos.

### 10.4 Regra de ouro

**O PsicoBia é a fonte da verdade do calendário "PsicoBia".** Edição/remoção manual de um
evento "Atendimento" no Google é revertida no reconcile diário. Documentar na UI
("gerenciado pelo PsicoBia").

## 11. Frontend

### 11.1 Camada de dados (`src/api/queries.ts`, padrão existente)

| Hook | Fonte |
|---|---|
| `useUserSettings` / `useUpsertUserSettings` | `user_settings` |
| `useGoogleConnection` | `google_connections` (singleton do usuário) |
| `useExternalCalendars` / `useToggleExternalCalendar` | `external_calendars` |
| `useExternalEventsInRange(from, to)` | `external_events` (habilitado só se conectado) |
| `useGoogleConnect` | `functions.invoke("google-oauth-start")` → `window.location = url` |
| `useGoogleDisconnect` / `useGoogleSyncNow` | `functions.invoke(...)` |

Tipos novos em `src/db/types.ts`: `UserSettings`, `GoogleConnection`, `ExternalCalendar`,
`ExternalEvent` (+ `durationMin`/`sessionDurationMin` nos existentes).

### 11.2 Pontos de contato na UI

| Onde | Mudança |
|---|---|
| `profile-drawer.tsx` | seção **"Preferências de agenda"** (duração padrão) + seção **"Google Agenda"**: conectar/desconectar, e-mail conectado, status/último sync/último erro, toggles por calendário, "mostrar só Ocupado", on/off da escrita, "Sincronizar agora" |
| `patient-form.tsx` | campo opcional "Duração da sessão (min)" |
| `schedule-appointment-dialog.tsx` | avisos de sobreposição interna (âmbar) e Google (neutro), não bloqueantes (§8.2) |
| `reschedule-conflict-dialog.tsx` / drawer | mesmos avisos no reagendamento |
| `home.tsx` | intercala `ExternalEvent`s na lista do dia (cards neutros) |
| `mini-calendar.tsx` | `DayMeta.personal` + ponto + item na legenda |

Sem página nova e sem rota nova — configuração vive no perfil, como troca de senha.

## 12. Segurança e privacidade

- **Tokens**: só em `google_oauth_tokens` (RLS sem policies → só service role); nunca no
  browser, nunca em `VITE_*`, nunca logados.
- **CSRF**: `state` HMAC-assinado (`GOOGLE_STATE_SECRET`), TTL 10 min, origem de retorno
  validada contra `APP_ORIGINS`.
- **Dados clínicos não saem do perímetro**: título fixo "Atendimento"; a chave
  `psi_series`/`psi_origin` são nanoids opacos — sem nome, valor ou diagnóstico (R3).
- **Compromissos dela podem ser sensíveis**: opção "mostrar só Ocupado" (§9.3); eventos
  externos ficam em tabela read-only isolada dos dados clínicos.
- **Menor privilégio no Google**: escopos granulares (§5.3) — o app não consegue tocar nos
  eventos dos calendários pessoais dela.
- **Desconectar** revoga no Google e apaga tokens + espelho local; migração `029` em
  cascade.
- Rodar `get_advisors` (security) após cada migração — padrão da casa.

## 13. Roadmap por fases

> DoD = definition of done. Toda fase inclui: migração aplicada → advisors ok → deploy →
> smoke test de regressão (agendar/atender/pagar/desfazer continuam idênticos p/ usuário
> sem Google).

| Fase | Entrega | Passos | DoD | Est. |
|---|---|---|---|---|
| **F0** | Fundação | branch `feat/google-agenda`; pasta `docs/13-google-agenda/`; projeto Google Cloud (§5) até "In production" | consent screen publicado; plano commitado | 0,5 d |
| **F1** | Duração da sessão | mig `028`; `effectiveDuration`; `overlaps()`; UI perfil + `PatientForm`; avisos âmbar nos diálogos | sem `user_settings` row, tudo idêntico ao hoje; 14:30 sobre 14:00 exibe aviso e **não** bloqueia | 1 d |
| **F2** | Conexão Google | mig `029`; `supabase/functions/` + `_shared` + script de cópia; `google-oauth-start/callback/disconnect`; secrets; seção no perfil | conectar → consentimento único → volta conectado; calendário "PsicoBia" criado; desconectar limpa tudo; quem não conecta não sofre nenhuma chamada nova | 1–1,5 d |
| **F3** | Leitura (pull) | mig `030` (cron 10 min); pull incremental em `google-sync`; `useExternalEventsInRange`; lista do dia + mini-calendário + avisos Google; "Sincronizar agora" | compromisso criado no Google aparece em ≤10 min; agendar por cima só avisa; desligar calendário some da UI | 1–1,5 d |
| **F4** | Escrita (push) | mig `031` (outbox + triggers); materializador com domínio compartilhado; diff/reconcile | agendar/reagendar/desfazer (3 escopos)/alta refletem no Google em ≤10 min; eventos sem nome de paciente; horizonte 90d avança sozinho | 1,5 d |
| **F5** | Hardening + release | erros visíveis no perfil (`last_error`, badge `status='error'`); poda de eventos; atualizar docs (`arquitetura`, `modelo-de-dados`, `08-capacidades`, `paginas`, `seguranca`) + memória; PR final → `main`; deploy na ordem §3.3; conectar a conta real e acompanhar 1 ciclo de cron | checklist §14 completo em produção | 0,5–1 d |

**Total: ~5,5–7 dias.** Merges intermediários recomendados: F1 (valor imediato,
independente de Google) e F2+F3 (leitura já resolve o pedido original dela — R1); F4 pode
ir numa segunda leva sem custo de retrabalho.

## 14. Testes e validação

Sem suíte automatizada no repo (limite conhecido) — validação por checklist manual:

**Regressão (usuário SEM Google) — rodar em toda fase:**
- [ ] agendar único e recorrente; conflito de slot exato ainda **bloqueia**
- [ ] atender / falta / pagar / checklist / desfazer (one/future/all) / alta / arquivar
- [ ] dashboard e financeiro idênticos (nenhum número muda — eventos externos não entram)
- [ ] PWA em produção continua funcionando **antes** do merge do frontend (migrações cedo)

**Feature (usuária COM Google):**
- [ ] consentimento único; refresh após >1 h continua sincronizando (token renovado)
- [ ] pull: criar/mover/apagar compromisso no Google reflete em ≤10 min; dia inteiro ok;
      `transparency=transparent` não gera aviso de conflito
- [ ] push: cada mutação (agendar, reagendar, desfazer×3, alta, arquivar, mudar duração)
      converge no Google; evento passado intocado; título sempre "Atendimento"
- [ ] anti-loop: calendário "PsicoBia" nunca aparece como compromisso pessoal
- [ ] revogar acesso via myaccount.google.com → app mostra `status='error'` com CTA de
      reconectar (sem crash)
- [ ] desconectar apagando o calendário remove os eventos no Google

**Operacional:** `get_advisors` sem findings novos; logs das functions sem erro em ciclo
completo de cron; `cron.job_run_details` saudável.

## 15. Riscos e mitigações

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Trigger de outbox quebrar fluxo clínico | baixa | **crítico** | `exception when others` + early-return sem conexão + teste de regressão F4 |
| Refresh token expirar (app em Testing) | média se esquecido | alto | §5.2 — publicar "In production" na F0; checklist |
| `calendar.app.created` insuficiente | baixa | médio | validar na F2; fallback `calendar.events` (§5.3) |
| Loop de sincronização (ler o que escreveu) | média | médio | excluir `psicobia_calendar_id` do pull (anti-loop, §9.1) |
| Ela editar eventos "Atendimento" no Google | alta | baixo | fonte da verdade + reconcile diário (§10.4) + aviso na UI |
| Import fora de `supabase/functions` falhar no deploy | média | baixo | script de cópia `_shared` determinístico (§7.3) |
| `sync_token` invalidado (410) | certa (eventual) | baixo | full resync automático do calendário |
| Cron parado silenciosamente | baixa | médio | `last_synced_at` no perfil + badge de erro (F5) |
| Duração nova mudar semântica de conflito | — | — | bloqueio atual preservado; duração só gera **avisos** (§8.2) |

## 16. Decisões tomadas e pontos em aberto

**Decididas neste plano:**
1. OAuth próprio via Edge Function; login intocado (§4.3).
2. Calendário secundário dedicado; título fixo "Atendimento" (§10.1).
3. Materialização com horizonte de 90 dias; sem RRULE (§4.4).
4. Outbox por triggers + cron 10 min + reconcile diário; sem watch channels na v1 (§9.2).
5. Duração em 3 níveis com fallback 50 min; sobreposição **avisa**, não bloqueia (§8).
6. Timezone fixa `America/Sao_Paulo` (Brasil sem DST desde 2019) — constante na function.
7. Eventos externos read-only, tipo próprio, fora dos cálculos clínicos/financeiros (§9.3).

**Em aberto (decidir durante as fases, nenhum bloqueia o início):**
- Campo "duração" por **atendimento** no drawer já na F1 ou só paciente+geral? (coluna já
  entra na `028` de qualquer forma)
- Desconectar: default apaga ou mantém o calendário "PsicoBia" no Google? (proposta:
  mantém, com checkbox "apagar também")
- Cor do calendário "PsicoBia" no Google (fixa vs. escolhida pelo usuário).
- Mostrar eventos de dia inteiro no aviso de conflito ou só na lista do dia? (proposta:
  só na lista).
- Watch channels (quase tempo real) como evolução F6, se 10 min incomodar.
