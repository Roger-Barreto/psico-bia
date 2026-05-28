# Arquitetura — Visão Geral

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

## Diagrama de camadas

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  React (src/)                                                       │
│    pages/ ──► components/ ──► api/queries (TanStack Query hooks)    │
│                                     │                               │
│    domain/ (puro: recurrence,       │ usa                          │
│      pendencies, finance, dates) ◄──┘                              │
│                                     │                               │
│                              api/client.ts (fetch wrapper)         │
└─────────────────────────────────────┬──────────────────────────────┘
                                       │ HTTP /api/*
┌──────────────────────────────────────▼─────────────────────────────┐
│  Vite Dev Server                                                    │
│    vite-plugin-json-db.ts  (middleware: intercepta /api/*)          │
│        └─► server/routes.ts  (roteador + handlers REST)             │
│               ├─► server/schemas.ts  (validação Zod)               │
│               ├─► server/auth.ts     (scrypt, usuário)             │
│               └─► server/db.ts       (engine JSON: cache, lock,    │
│                                        escrita atômica, backup)     │
└──────────────────────────────────────┬─────────────────────────────┘
                                        │ fs
┌──────────────────────────────────────▼─────────────────────────────┐
│  data/                                                              │
│    *.json (coleções)   .backups/<data>/   patient-documents/<p>/   │
└────────────────────────────────────────────────────────────────────┘
```

## Decisão central: backend dentro do Vite

Não há processo de servidor separado. A persistência é viabilizada por um **plugin Vite**
(`jsonDbPlugin`) que registra um middleware no dev-server. Toda requisição a `/api/*` é roteada para
`server/routes.ts` via `server.ssrLoadModule` (carregamento SSR sob demanda, com HMR do código de
servidor durante o dev).

**Consequência:** a aplicação só tem backend rodando sob `npm run dev`. Um build estático não inclui
a API. Esta foi uma escolha consciente para um app local single-user (ver
[`/PLANNING.md`](../../PLANNING.md) seção 3 — "Opção A").

Detalhes em [backend.md](backend.md).

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
