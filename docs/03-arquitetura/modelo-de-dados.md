# Modelo de Dados

Tipos canônicos em [`src/db/types.ts`](../../src/db/types.ts) (frontend) e espelhados nas interfaces
de [`server/routes.ts`](../../server/routes.ts) (backend). Persistência: um arquivo JSON por coleção
em `data/`.

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

Não há número de versão nem migração formal de JSON. Campos novos são tratados por funções
`normalize*` no backend (defaults para ausentes). Pastas de documentos têm uma migração de
nomenclatura idempotente. Ver [backend](backend.md#normalização-defensiva).
