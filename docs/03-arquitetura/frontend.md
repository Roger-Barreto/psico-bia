# Frontend — Estrutura e Bootstrap

## Bootstrap — `src/main.tsx`

Monta a árvore:

```
StrictMode
 └ QueryClientProvider (TanStack Query)
    └ BrowserRouter
       ├ App            (rotas)
       ├ ConfirmDialogHost   (host global de confirmações)
       └ Toaster (sonner)    (tema dark, richColors, bottom-right)
```

`QueryClient` com defaults: `refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 30s`,
`gcTime: 5min`.

## Rotas — `src/App.tsx`

```
/login                         → LoginPage (pública)
(ProtectedRoute > AppShell):
  /                            → DashboardPage
  /agenda                      → HomePage (agenda)
  /patients                    → PatientsPage
  /insurances                  → InsurancesPage
  /discharge-reasons           → DischargeReasonsPage
  /checklist                   → SharedChecklistPage
*                              → redireciona para /
```

- `AuthProvider` envolve tudo.
- `ProtectedRoute` redireciona para `/login` (guardando `from`) se não houver usuário.
- `AppShell` é o layout com sidebar + header (avatar/menu) + `<Outlet/>`.

## Autenticação — `src/context/auth-context.tsx`

- Estado `user` inicializado do `localStorage` (chave `admin-panel.auth`).
- `login(username, password)` → `POST /api/login`; em sucesso grava no estado e no localStorage.
- `logout()` → limpa estado e storage.
- `refreshUser()` → `GET /api/me` (revalida no mount se já logado).
- `updateUser(next)` → atualiza após edição de perfil.

> A sessão é **client-side**: a API não exige token; a proteção é só de roteamento no frontend.
> Adequado ao contexto local single-user. Ver [segurança](../07-operacao/seguranca.md).

## Layout — `src/components/app-shell.tsx`

- **Sidebar** (≥ md): logo PsicoBia (badge "beta"), navegação. Itens: Dashboard, Agenda, e grupo
  **Cadastros** (Pacientes, Convênios, Motivos de encerramento, Checklist) — colapsável, aberto
  automaticamente quando a rota atual pertence ao grupo.
- **Header:** menu do usuário (avatar/iniciais) → "Meu perfil" (abre `ProfileDrawer`) e "Sair".
- `main` com `max-w-7xl` e animação `fade-in`.

## Estrutura de pastas (`src/`)

```
src/
  api/
    client.ts          fetch wrapper (get/post/patch/delete/upload)
    queries.ts         hooks TanStack Query + qk (query keys)
  components/
    app-shell.tsx
    breadcrumbs.tsx
    protected-route.tsx
    appointments/      schedule-appointment-dialog, undo-appointment-dialog
    calendar/          mini-calendar
    dashboard/         charts, financial-gauge, kpi-card, month-selector,
                       pendency-block, pendency-list, unpaid-patients-dialog, skeletons
    patient/           patient-drawer, patient-form, payment-control, patient-documents,
                       patient-avatar, avatar-picker, add-annotation-dialog,
                       add-checklist-item-dialog
    profile/           profile-drawer
    ui/                primitivos (button, input, dialog, sheet, select, popover,
                       dropdown-menu, checkbox, radio-group, calendar, date-picker,
                       time-picker, card, avatar, label, separator, skeleton,
                       confirm-dialog)
  context/
    auth-context.tsx
  db/
    types.ts           tipos de domínio compartilhados (frontend)
  domain/
    age, dates, finance, pendencies, recurrence   (lógica pura)
  lib/
    utils.ts (cn), monster-avatars.ts, celebrate.ts
  pages/
    dashboard, home, patients, checklist, insurances, discharge-reasons, login
  App.tsx, main.tsx, index.css, vite-env.d.ts
```

## Padrões de UI recorrentes

- **Sheet (drawer lateral)** para formulários e detalhes (paciente, perfil, atendimento).
- **Dialog (modal)** para ações pontuais (agendar, desfazer, confirmações).
- **Confirmação imperativa:** `confirmDialog({ title, description, destructive })` retorna
  `Promise<boolean>` — um único host global (`ConfirmDialogHost`) renderiza o modal. Evita prop
  drilling de estado de confirmação.
- **Toasts** (`sonner`) em toda mutação (sucesso/erro).
- **Update otimista** no toggle de checklist (atualiza todos os ranges de cache de `appointments` e
  faz rollback em erro).
- **Skeletons** durante carregamento do dashboard.
- **framer-motion** para transição de mês no dashboard (slide direcional).

## Estado e dados

Ver [estado e dados](../05-frontend/estado-e-dados.md) para as chaves de query, estratégia de
`staleTime`/`gcTime` e invalidações.
