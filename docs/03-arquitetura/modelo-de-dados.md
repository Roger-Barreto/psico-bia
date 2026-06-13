# Modelo de Dados

> ⚠️ **Atualização (2026-06):** a persistência **não é mais JSON em `data/`** — é **Supabase
> Postgres** (uma tabela por coleção, `snake_case`, RLS por `user_id`). Os mappers
> `snake_case ↔ camelCase` vivem em [`src/api/queries.ts`](../../src/api/queries.ts). Os **tipos
> canônicos** continuam em [`src/db/types.ts`](../../src/db/types.ts). As menções a `server/` e
> `data/*.json` abaixo são históricas. O esquema financeiro está na seção [Finance](#finance).

Tipos canônicos em [`src/db/types.ts`](../../src/db/types.ts) (frontend). Persistência: Supabase
Postgres (tabelas `public.*`). *(Histórico: antes, um arquivo JSON por coleção em `data/`.)*

## Coleções (arquivos)

| Arquivo | Conteúdo | Chave de I/O (`name`) |
|---|---|---|
| `data/patients.json` | `Patient[]` | `patients` |
| `data/appointment-series.json` | `AppointmentSeries[]` | `appointment-series` |
| `data/appointments.json` | `Appointment[]` | `appointments` |
| `data/shared-checklist.json` | `SharedChecklistItem[]` | `shared-checklist` |
| `data/individual-checklist.json` | `IndividualChecklistItem[]` | `individual-checklist` |
| `data/insurances.json` | `Insurance[]` | `insurances` |
| `data/discharge-reasons.json` | `DischargeReason[]` | `discharge-reasons` |
| `data/patient-annotations.json` | `PatientAnnotation[]` | `patient-annotations` |
| `data/user.json` | `StoredUser` (objeto, não array) | `user` |
| `data/patient-documents/<slug>-<id>/` | arquivos físicos | (filesystem) |
| `data/.backups/<YYYY-MM-DD>/` | cópias diárias | (filesystem) |

## Tipos

### `Patient`

```ts
interface Patient {
  id: string                       // "p_…"
  name: string
  gender: "male" | "female" | "other"
  birthdate: string                // YYYY-MM-DD (idade é derivada)
  avatarId: number                 // 1..56
  active: boolean                  // false = arquivado
  createdAt: string                // ISO datetime
  consultationValue: number
  insuranceId: string | null
  individualChecklistItemIds: string[]
  dischargedAt: string | null      // YYYY-MM-DD (encerramento)
  dischargeReasonId: string | null
}
```

### `AppointmentSeries`

```ts
interface AppointmentSeries {
  id: string                       // "as_…"
  patientId: string
  startDate: string                // YYYY-MM-DD
  time: string                     // HH:MM
  frequency: "weekly" | "biweekly" | "monthly" | null   // null = único
  endDate: string | null           // YYYY-MM-DD (limite)
  createdAt: string
}
```

### `Appointment` (override persistido)

```ts
interface Appointment {
  id: string                       // "ap_…"
  seriesId: string
  patientId: string
  date: string                     // efetiva (YYYY-MM-DD)
  originDate: string               // âncora na série (chave de upsert)
  status: "scheduled" | "attended" | "missed" | "rescheduled" | "cancelled"
  rescheduledTo: string | null
  time: string | null              // null herda da série
  checkedItemIds: string[]
  snapshotItemIds: string[]        // congelado em attended/missed
  notes: string | null
  updatedAt: string
  paid: boolean
  paidValue: number | null
  paidAt: string | null
}
```

Unicidade lógica: **`(seriesId, originDate)`**.

### `Occurrence` (derivada — nunca persistida)

```ts
interface Occurrence {
  seriesId: string
  patientId: string
  originDate: string
  date: string
  time: string
  appointment: Appointment | null  // override, se houver
  pendencyCount: number            // preenchido pela camada de pendências
}
```

### Checklist

```ts
interface SharedChecklistItem {
  id: string                       // "sc_…"
  label: string
  order: number
  archived: boolean
}
interface IndividualChecklistItem extends SharedChecklistItem {
  patientId: string                // id "ci_…"
}
```

### `Insurance` / `DischargeReason`

```ts
interface Insurance {
  id: string                       // "ins_…"
  name: string
  active: boolean
  createdAt: string
  defaultValue: number
}
interface DischargeReason {
  id: string                       // "dr_…"
  name: string
  active: boolean
  createdAt: string
}
```

### `PatientAnnotation` / `PatientDocument`

```ts
interface PatientAnnotation {
  id: string                       // "an_…"
  patientId: string
  text: string                     // até 2000 chars
  createdAt: string
}
interface PatientDocument {        // metadados lidos do filesystem
  filename: string
  size: number
  modifiedAt: string               // ISO
}
```

### `StoredUser` / `SafeUser` (auth)

```ts
interface StoredUser {
  username: string
  displayName: string
  avatarId: number | null
  password: { salt: string; hash: string }   // scrypt
}
interface SafeUser {               // o que o cliente recebe (sem hash)
  username: string
  displayName: string
  avatarId: number | null
}
```

## Geração de IDs

`nanoid(10)` com prefixo por coleção — ver tabela de prefixos no
[glossário](../01-visao-geral/glossario.md#prefixos-de-id).

## Datas — convenção

- **Datas puras** (sem hora): string ISO `YYYY-MM-DD` (`birthdate`, `startDate`, `endDate`, `date`,
  `originDate`, `rescheduledTo`, `dischargedAt`). Comparáveis lexicograficamente.
- **Timestamps:** ISO completo (`createdAt`, `updatedAt`, `paidAt`, `modifiedAt`).
- **Horários:** `HH:MM`.

## Dados derivados (nunca persistidos)

Idade, ocorrências, pendências, índices por dia, todas as agregações financeiras e do dashboard.
Calculados sob demanda a partir das coleções base.

## Evolução de schema

Migrations versionadas no Supabase (`001_…` a `016_finance_rpcs`). Campos novos entram por migração
(coluna nullable + backfill quando necessário). *(Histórico: antes não havia versão; defaults eram
aplicados por funções `normalize*` no backend JSON.)*

## Finance

Módulo de gestão financeira (regras em
[financeiro-pessoal.md](../02-regras-de-negocio/financeiro-pessoal.md)). Tipos em
[`src/db/types.ts`](../../src/db/types.ts) (`Transaction`, `RecurringRule`, `Person`,
`FinanceCategory`, `PaymentMethod`, `LedgerEntry`).

| Tabela | Conteúdo | Chave |
|---|---|---|
| `people` | contrapartes de empréstimo (`per_…`) | `id` |
| `finance_categories` | categorias (`cat_…`) | `id` |
| `payment_methods` | formas de pagamento; `is_loan` marca empréstimo (`pm_…`) | `id` |
| `finance_recurring_rules` | templates mensais (`rec_…`) | `id` |
| `finance_transactions` | lançamentos manuais/materializados (`tx_…`) | `id` |

Colunas-chave de `finance_transactions`: `kind` (`income`/`expense`), `scope` (`clinic`/`personal`),
`amount` (numeric), `date` (`YYYY-MM-DD`), `period` (gerada = `substr(date,1,7)`), `category_id`,
`payment_method_id`, `person_id`, `settled`/`settled_at`, `recurring_rule_id`,
`installment_group`/`installment_no`/`installment_total`, `link_id`. Unicidade
`(recurring_rule_id, period)` garante materialização idempotente. **Trigger**
`finance_require_person_for_loan` exige `person_id` quando a forma tem `is_loan`.

Coluna nova em `appointments`: **`payment_method_id`** (escolhida ao marcar a sessão paga).

**Views** (`security_invoker = true`):
- `finance_clinic_income` — receita derivada de `appointments` (sessões `attended`, paciente ativo);
  read-only.
- `finance_ledger` — UNION de `finance_transactions` (`source='manual'`) + `finance_clinic_income`
  (`source='clinic'`); superfície única de leitura para o módulo.
