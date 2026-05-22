# Plano — Admin Panel de Psicologia

Painel local (single-user) para organizar atendimentos psicológicos e checklists pós-sessão. Persistência em arquivos JSON dentro do próprio repo. Sem backend remoto.

---

## 1. Domínio

### 1.1 Conceitos

| Conceito | Descrição |
|---|---|
| **Paciente** | Pessoa atendida. Tem recorrência fixa de agendamento. |
| **Recorrência** | `once` \| `weekly` \| `biweekly` \| `monthly`. |
| **Ocorrência** | Instância concreta de atendimento numa data. Pode ser gerada (derivada da recorrência) ou explícita (reagendamento/única). |
| **Status da ocorrência** | `scheduled` \| `attended` \| `missed` \| `rescheduled` \| `cancelled`. |
| **Checklist compartilhado** | Lista global de itens herdada por todo paciente em todo atendimento. |
| **Checklist individual** | Itens extras específicos de um paciente. Default vazio. |
| **Checklist do dia** | União `compartilhado ∪ individual(paciente)`, instanciada na ocorrência. |
| **Pendência** | Item de checklist **não marcado** em ocorrência cuja `date ≤ hoje` **e** status ∈ {`attended`, `scheduled`, `missed`}. |

### 1.2 Regras

- Paciente possui `defaultWeekday` (0=Dom..6=Sáb) + `anchorDate` (primeira sessão). Datas futuras derivam de `(recurrence, anchorDate, defaultWeekday)`.
- Dia da semana **pode variar** numa instância → criar `appointmentOverride` (reagendamento) sem mexer na recorrência base.
- `once`: só existe na `anchorDate` (ou onde for reagendada).
- `weekly`: toda semana no `defaultWeekday`.
- `biweekly`: semana sim, semana não, a partir de `anchorDate`.
- `monthly`: mesmo dia-do-mês do `anchorDate` (com fallback para último dia do mês quando inexistente).
- Marcar `attended` instancia a `checklistInstance` (snapshot dos IDs de itens vigentes naquele dia) → garante que pendências antigas não somem se item compartilhado for editado depois.
- Itens marcados ficam em `checkedItemIds[]` dentro da ocorrência.

---

## 2. Modelo de dados (JSON)

Arquivos em `data/` na raiz do projeto. Cada arquivo = uma coleção. Schemas enxutos, sem duplicar dados derivados.

### 2.1 `data/patients.json`
```json
[
  {
    "id": "p_01HXYZ",
    "name": "Marina Costa",
    "gender": "female",          // "male" | "female" | "other"
    "age": 32,
    "defaultWeekday": 2,         // 0..6 (Dom..Sáb)
    "recurrence": "weekly",      // "once" | "weekly" | "biweekly" | "monthly"
    "anchorDate": "2026-01-13",  // ISO date, sem hora
    "individualChecklistItemIds": ["ci_03"],
    "active": true,
    "createdAt": "2026-01-13T10:00:00Z"
  }
]
```

### 2.2 `data/shared-checklist.json`
```json
[
  { "id": "sc_01", "label": "Registrar evolução no prontuário", "order": 1, "archived": false },
  { "id": "sc_02", "label": "Atualizar plano terapêutico", "order": 2, "archived": false }
]
```

### 2.3 `data/individual-checklist.json`
```json
[
  { "id": "ci_03", "patientId": "p_01HXYZ", "label": "Revisar diário do sono", "order": 1, "archived": false }
]
```

### 2.4 `data/appointments.json`
Só armazena **overrides e estados** (não materializa toda recorrência futura).
```json
[
  {
    "id": "ap_01",
    "patientId": "p_01HXYZ",
    "date": "2026-05-12",
    "originDate": "2026-05-12",      // mesma se não foi reagendado
    "status": "attended",            // scheduled | attended | missed | rescheduled | cancelled
    "rescheduledTo": null,           // ISO date se status === "rescheduled"
    "checkedItemIds": ["sc_01"],
    "snapshotItemIds": ["sc_01","sc_02","ci_03"],  // itens vigentes no momento do atendimento
    "notes": null,
    "updatedAt": "2026-05-12T18:30:00Z"
  }
]
```

**Por que `snapshotItemIds`:** evita que edição posterior do checklist compartilhado mude o passado. Snapshot só é gravado a partir de `attended`/`missed`. Antes disso, ocorrência é virtual.

### 2.5 `data/meta.json`
```json
{ "schemaVersion": 1, "createdAt": "2026-05-15T00:00:00Z" }
```

---

## 3. Persistência (camada de I/O)

### 3.1 Estratégia

Não dá pra escrever arquivos do navegador puro. Soluções:

| Opção | Prós | Contras |
|---|---|---|
| **A — Vite dev middleware** (custom plugin Node em `vite.config.ts`) | Zero processo extra. Roda só em `npm run dev`. | Não funciona em `vite preview`/build estático. |
| **B — Sidecar Express** (`server/index.ts`, `npm run dev:all` via `concurrently`) | Funciona em build de produção também. | Mais infra. |
| **C — File System Access API** | 100% browser. | Chrome-only, exige permissão a cada sessão. |

**Escolha: A (Vite middleware)** — projeto é local, dev-only, mínimo overhead. Migrar pra B se um dia precisar empacotar.

### 3.2 Plugin Vite — `vite-plugin-json-db.ts`

```
configureServer(server) {
  server.middlewares.use('/api', router)
}
```

Endpoints REST minimalistas (todos JSON):

| Método | Path | Ação |
|---|---|---|
| GET | `/api/patients` | lista |
| POST | `/api/patients` | cria |
| PATCH | `/api/patients/:id` | atualiza |
| DELETE | `/api/patients/:id` | soft-delete (`active=false`) |
| GET | `/api/shared-checklist` | lista |
| POST/PATCH/DELETE | `/api/shared-checklist[/:id]` | CRUD |
| GET | `/api/individual-checklist?patientId=` | lista |
| POST/PATCH/DELETE | `/api/individual-checklist[/:id]` | CRUD |
| GET | `/api/appointments?from=&to=` | range query |
| POST | `/api/appointments` | upsert por `(patientId, originDate)` |
| PATCH | `/api/appointments/:id` | atualiza status/checks |

### 3.3 Engine de arquivo (`server/db.ts`)

- Cache em memória por coleção (load once on start, write-through).
- Escrita atômica: `writeFile(tmp) → rename(tmp, target)` para evitar corrupção.
- Lock por mutex em memória (single-process, single-user → suficiente).
- IDs: `nanoid(10)` com prefixo de coleção (`p_`, `sc_`, `ci_`, `ap_`).

### 3.4 Backup
- Snapshot diário em `data/.backups/YYYY-MM-DD/` (cópia simples na primeira escrita do dia).
- Manter 7 dias, rotacionar.

---

## 4. Lógica de domínio (cliente)

### 4.1 Geração de ocorrências (lazy, por range)

```ts
function occurrencesInRange(patient, range, overrides): Occurrence[]
```

- **Não** materializa lista global de ocorrências. Calcula sob demanda para o intervalo visível (mini-calendário = mês visível; lista do dia = 1 data).
- Aplica `overrides` (appointments existentes) por cima das datas calculadas (mesclando por `originDate`).
- Reagendamentos (`status=rescheduled`, `rescheduledTo`) **removem** ocorrência da origem e **adicionam** na nova data.

### 4.2 Cálculo de pendências

```ts
function pendenciesFor(occurrence, sharedItems, individualItems): PendingItem[]
```

- Só para ocorrência com `date ≤ today` e status ∈ {scheduled, attended, missed}.
- Para `scheduled` passada (não atendida ainda): **todos os itens** do checklist vigente contam como pendentes.
- Para `attended`/`missed`: usa `snapshotItemIds \ checkedItemIds`.

### 4.3 Índice de pendências por dia (cache)

Para colorir o mini-calendário rapidamente:
- `pendencyIndex: Map<isoDate, { hasPatients: boolean, pendencyCount: number }>`
- Recalculado quando: paciente CRUD, appointment CRUD, checklist CRUD, ou data muda.
- Escopo: só o mês visível + 1 mês à frente/atrás.
- **Não persiste**, é derivado. Mantém memória baixa.

---

## 5. Arquitetura frontend

### 5.1 Camadas

```
src/
  api/                  fetch wrappers para /api/*
  db/                   tipos compartilhados (Patient, Appointment, ...)
  domain/               occurrencesInRange, pendenciesFor, recurrence rules
  hooks/
    usePatients.ts
    useAppointments.ts  (range-aware, com cache local)
    useDayAgenda.ts     (paciente do dia X + pendências)
    useChecklists.ts
  pages/
    home/               PatientManagement (tela principal)
    patients/           Cadastro/edição
    checklist/          Gestão compartilhado
  components/
    calendar/MiniCalendar.tsx
    patient/PatientCard.tsx
    patient/PatientDrawer.tsx
    patient/PatientForm.tsx
    checklist/ChecklistEditor.tsx
    checklist/ChecklistItem.tsx
  context/
    auth-context.tsx    (já existe)
```

### 5.2 Estado / data fetching

- **TanStack Query** (`@tanstack/react-query`): cache, invalidação, refetch on focus. Justifica-se mesmo local: dedupe, GC, suspensão de dados antigos → menos memória que estado global.
- Queries:
  - `['patients']`
  - `['shared-checklist']`
  - `['individual-checklist', patientId]`
  - `['appointments', from, to]` — chave por range mensal
- Mutations invalidam apenas chaves afetadas.

### 5.3 Tela Home (`/`) — Gestão de pacientes

Layout:
```
┌────────────────┬──────────────────────────────────────────┐
│ MiniCalendar   │ [Search................................] │
│  (mês atual)   │ ── pacientes do dia selecionado ──       │
│                │ ┌─ Card paciente ─────────────────────┐  │
│                │ │ Avatar(gender)  Nome   • 3 pend.     │  │
│                │ └─────────────────────────────────────┘  │
│                │ ┌─ Card paciente ─────────────────────┐  │
│                │ │ ...                                  │  │
│                │ └─────────────────────────────────────┘  │
└────────────────┴──────────────────────────────────────────┘
```

**MiniCalendar:**
- Grade 7×6 do mês visível.
- Cada célula renderiza:
  - quadradinho rounded preenchido `bg-primary/80` se houver paciente
  - badge vermelha + ícone `WarningIcon` (Phosphor fill) se `pendencyCount > 0`
  - ring `ring-primary` se for dia selecionado
  - hoje recebe `outline` extra
- Navegação mês anterior/próximo (sem virtualizar — máx 42 células).

**Drawer paciente** (`@radix-ui/react-dialog` ou shadcn `Sheet`):
- Header: avatar, nome, idade, gênero, recorrência.
- Ações: `[Marcar atendido]` `[Marcar falta]` `[Reagendar]`.
- Após `Marcar atendido` (ou se já foi): seção checklist (compartilhado + individual mesclados), checkboxes persistem via PATCH em `/api/appointments/:id`.
- `Reagendar`: date-picker → cria/atualiza appointment com status `rescheduled` + `rescheduledTo`.

### 5.4 Tela Cadastro (`/patients`)

- Lista + form em drawer/dialog. Campos:
  - Nome (text, required)
  - Gênero (radio: F/M/Outro)
  - Idade (number)
  - Dia da semana padrão (select)
  - Recorrência (select)
  - Data âncora (date)
  - Checklist individual (lista editável inline com add/remove/reorder)

### 5.5 Tela Checklist compartilhado (`/checklist`)

- CRUD simples: input + lista drag-and-drop (opcional fase 2) ou só order numérico.
- Soft-archive (não deletar) para preservar histórico de pendências antigas.

### 5.6 Sidebar
Já existe esqueleto. Habilitar:
- `/` Início → Gestão pacientes
- `/patients` Pacientes (cadastro)
- `/checklist` Checklist compartilhado
- Remover Analytics/Users/Settings ou deixar "em breve".

---

## 6. Performance / memória

| Ponto | Estratégia |
|---|---|
| Recorrência futura | Não materializar. Calcular por range visível. |
| Mini-calendário | Só dados do mês visível (`from=YYYY-MM-01, to=YYYY-MM-last`). |
| Lista do dia | Filtra do range já carregado, não refetch. |
| Pendências históricas | Lookup vem de `appointments.json` filtrado por `date ≤ today`; sem recursão profunda. |
| React Query GC | `gcTime: 5 * 60_000`. Mês fora da view sai do cache. |
| JSON size | Append-only no comportamento típico. Considerar split por ano em `appointments-YYYY.json` se passar de 5k registros (fase 3). |
| Re-render | Memo nos cards de paciente. Selectors por id em vez de array completo. |
| Bundle | Phosphor já tree-shakes. Importar ícones nominalmente, sem barrel. |

---

## 7. Roadmap de execução

### Fase 0 — Infra (1 sessão)
- [ ] `npm i nanoid @tanstack/react-query date-fns zod` (zod p/ validar body API)
- [ ] `src/api/client.ts` (fetch wrapper)
- [ ] `vite-plugin-json-db.ts` + `server/db.ts` (read/write atômico + cache)
- [ ] Seed inicial `data/*.json` vazios
- [ ] Provider React Query em `main.tsx`

### Fase 1 — Cadastro + checklists (1 sessão)
- [ ] Tipos `db/types.ts` + schemas zod
- [ ] Endpoints patients CRUD
- [ ] Endpoints shared-checklist + individual-checklist CRUD
- [ ] Página `/patients` (lista + form em Sheet)
- [ ] Página `/checklist` (lista + add/edit/archive)

### Fase 2 — Domínio de ocorrências (1 sessão)
- [ ] `domain/recurrence.ts` — `occurrencesInRange`
- [ ] `domain/pendencies.ts` — `pendenciesFor`
- [ ] Endpoints appointments (GET range, POST upsert, PATCH status/checks)
- [ ] Testes unitários (vitest) p/ recorrência semanal/quinzenal/mensal + reagendamento

### Fase 3 — Tela home (2 sessões)
- [ ] `MiniCalendar` com indicadores (pacientes + pendências)
- [ ] Hook `useDayAgenda(date)` (mescla pacientes + occurrences + pendency count)
- [ ] Cards de paciente do dia + busca client-side
- [ ] `PatientDrawer` com 3 ações
- [ ] Checklist no drawer após `attended`

### Fase 4 — Polimento
- [ ] Toasts (sonner já instalado) em todas mutations
- [ ] Empty states + skeletons
- [ ] Confirmações em ações destrutivas (reagendar/falta)
- [ ] Backup diário em `data/.backups/`

### Fase 5 — Opcionais
- [ ] Dashboard de pendências (lista plana ordenada por data)
- [ ] Exportar relatório mensal (CSV/PDF)
- [ ] Drag-and-drop nos checklists
- [ ] PWA / instalável

---

## 8. Estrutura final do repo

```
psi/
  data/                          # banco JSON (gitignored em prod, opcional commitar seed)
    patients.json
    shared-checklist.json
    individual-checklist.json
    appointments.json
    meta.json
    .backups/
  server/
    db.ts                        # I/O atômico + cache + locks
    routes/
      patients.ts
      checklists.ts
      appointments.ts
    schemas.ts                   # zod
  src/
    api/
    components/
      calendar/
      patient/
      checklist/
      ui/                        # shadcn (já existe)
    context/
    db/
      types.ts
    domain/
      recurrence.ts
      pendencies.ts
    hooks/
    pages/
      home/
      patients/
      checklist/
      login.tsx
    App.tsx
    main.tsx
  vite-plugin-json-db.ts
  vite.config.ts
  PLANNING.md
```

---

## 9. Riscos / decisões em aberto

| Risco | Mitigação |
|---|---|
| Corrupção do JSON em crash durante escrita | Write atômico via tmp+rename. Backup diário. |
| Edição manual do JSON quebrar schema | Validar com zod no load; logar erro sem perder o arquivo (rename pra `.corrupt.json`). |
| Reagendamento criar duplicidade | Constraint `(patientId, originDate)` único no upsert. |
| Recorrência mensal em 31/Fev | Fallback p/ último dia do mês. |
| Crescimento de `appointments.json` | Fase 3 opcional: shard por ano. |
| Múltiplas abas escrevendo | Single-user assumido. Last-write-wins. Se virar problema: lock por arquivo no servidor. |

---

## 10. Modelo TypeScript (referência)

```ts
type Gender = "male" | "female" | "other"
type Recurrence = "once" | "weekly" | "biweekly" | "monthly"
type AppointmentStatus =
  | "scheduled" | "attended" | "missed" | "rescheduled" | "cancelled"

interface Patient {
  id: string
  name: string
  gender: Gender
  age: number
  defaultWeekday: 0|1|2|3|4|5|6
  recurrence: Recurrence
  anchorDate: string            // YYYY-MM-DD
  individualChecklistItemIds: string[]
  active: boolean
  createdAt: string
}

interface SharedChecklistItem {
  id: string; label: string; order: number; archived: boolean
}

interface IndividualChecklistItem extends SharedChecklistItem {
  patientId: string
}

interface Appointment {
  id: string
  patientId: string
  date: string                  // efetiva
  originDate: string            // original (mesma se não reagendou)
  status: AppointmentStatus
  rescheduledTo: string | null
  checkedItemIds: string[]
  snapshotItemIds: string[]     // congelado em attended/missed
  notes: string | null
  updatedAt: string
}

interface Occurrence {           // derivado, nunca persistido
  patientId: string
  date: string
  appointment?: Appointment      // se houver override
  pendencyCount: number
}
```
