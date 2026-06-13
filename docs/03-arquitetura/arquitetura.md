# Arquitetura — Visão Geral

> ⚠️ **Atualização (2026-06):** o app migrou de backend local (JSON + plugin Vite) para
> **Supabase-direct**. O frontend fala direto com o Supabase (Postgres + RLS + Storage + Auth) via
> `@supabase/supabase-js`; **não há mais API própria nem `server/`**. As seções abaixo que descrevem
> o "backend dentro do Vite", `server/routes.ts`, engine JSON e `data/*.json` são **históricas** —
> ver o diagrama atual logo abaixo e [backend.md](backend.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5.7 (strict) |
| Build / dev server | Vite 6 |
| UI | React 18 |
| Roteamento | react-router-dom 6 |
| Dados/cache | TanStack Query 5 |
| Estilo | TailwindCSS 3 + `tailwindcss-animate` + tokens HSL |
| Componentes acessíveis | Radix UI (dialog, dropdown, popover, select, checkbox, radio, avatar, separator, label, tooltip, slot) |
| Ícones | `@phosphor-icons/react` |
| Gráficos | Recharts 3 |
| Datas | date-fns 4 (utilitários próprios em `domain/dates.ts`) + react-day-picker 10 |
| Animação | framer-motion 12 |
| Toasts | sonner |
| Confete | canvas-confetti |
| Validação | Zod 4 (no backend) |
| IDs | nanoid |
| Upload | busboy (multipart no backend) |
| Variantes de classe | class-variance-authority + clsx + tailwind-merge |

## Diagrama de camadas (atual — Supabase-direct)

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  React (src/)                                                       │
│    pages/ ──► components/ ──► api/queries.ts (TanStack Query hooks) │
│                                     │                               │
│    domain/ (puro: recurrence,       │ usa                          │
│      pendencies, finance, dates) ◄──┘                              │
│                                     │                               │
│                          lib/supabase.ts (supabase-js client)      │
└─────────────────────────────────────┬──────────────────────────────┘
                                       │ HTTPS (PostgREST / RPC / Storage / Auth)
┌──────────────────────────────────────▼─────────────────────────────┐
│  Supabase (projeto `psicobia`, região sa-east-1)                    │
│    Postgres 17  ── RLS por user_id = auth.uid()  (multi-tenant)     │
│      tabelas + views (finance_ledger, finance_clinic_income)        │
│      RPCs plpgsql (discharge_patient, bulk_delete_appointments,     │
│                    seed_finance_defaults, ensure_recurring_… etc.)  │
│    Auth (e-mail/senha)   Storage (bucket patient-documents)         │
└────────────────────────────────────────────────────────────────────┘
```

## Decisão central: Supabase-direct (sem API própria)

O frontend acessa o Supabase **diretamente** via `@supabase/supabase-js`
([`src/lib/supabase.ts`](../../src/lib/supabase.ts)). Não há servidor próprio, rota `/api/*`, nem
processo Node — o "backend" é o Supabase:

- **Persistência:** Postgres; cada tabela tem `user_id` com default `auth.uid()` e **RLS** que isola
  os dados por usuário (multi-tenant). Hooks em `api/queries.ts` traduzem `snake_case ↔ camelCase`.
- **Operações compostas/atômicas:** **RPCs** plpgsql (`SET search_path TO 'public'`, scoped por
  `auth.uid()`), p.ex. encerramento de paciente, desfazer série, materialização de recorrência
  financeira.
- **Auth:** Supabase Auth (e-mail/senha) — ver [`auth-context`](../../src/context/auth-context.tsx).
- **Storage:** bucket `patient-documents`, caminhos `{userId}/{patientId}/{arquivo}` (RLS por
  prefixo).
- **Build estático** (Vite) é deployável (Vercel) — não depende de dev-server.

A decisão original "Opção A" (app local single-user, [`/PLANNING.md`](../../PLANNING.md)) foi
**substituída** por esta arquitetura pública multi-dispositivo.

## Separação de responsabilidades

- **`src/domain/`** — lógica de negócio **pura** e testável (sem React, sem fetch): recorrência,
  pendências, finanças, datas, idade. É o coração das regras.
- **`src/api/`** — `client.ts` (wrapper de `fetch`) e `queries.ts` (hooks TanStack Query: chaves,
  queries, mutations, invalidação).
- **`src/components/`** — UI. Subdividida por feature (`patient/`, `appointments/`, `dashboard/`,
  `calendar/`, `profile/`) + `ui/` (primitivos shadcn-style sobre Radix).
- **`src/pages/`** — telas roteadas.
- **`src/context/`** — `auth-context` (estado de autenticação).
- **`server/`** — handlers, schemas, auth, engine de dados.

## Aliases

`@/` → `src/` (configurado em `vite.config.ts` e nos `tsconfig`).

## Fluxo de uma requisição típica (ex.: marcar atendido)

1. Componente chama `upsert.mutateAsync(...)` (hook `useUpsertAppointment`).
2. `api.post("/api/appointments", body)` → `fetch` com `Content-Type: application/json`.
3. Middleware do Vite vê `/api/...`, carrega `server/routes.ts`, chama `handleApi(req, res, url)`.
4. `handleApi` casa rota/método, lê o body, valida com `appointmentUpsertSchema` (Zod).
5. `update("appointments", [], mutator)` (em `db.ts`): adquire lock, lê cache, aplica mutator,
   persiste atômico (tmp+rename), faz backup do dia.
6. Resposta JSON; `onSuccess` da mutation invalida `["appointments"]` → re-fetch e re-render.
