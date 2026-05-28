# Validação — Schemas Zod

Definidos em [`server/schemas.ts`](../../server/schemas.ts). Todo corpo de request é validado antes
de tocar nos dados; falha → `400 { error, details }` com `error.format()` do Zod.

## Tipos base / regex

```ts
genderSchema    = enum(["male","female","other"])
frequencySchema = enum(["weekly","biweekly","monthly"])
statusSchema    = enum(["scheduled","attended","missed","rescheduled","cancelled"])
isoDate         = string regex /^\d{4}-\d{2}-\d{2}$/   // "YYYY-MM-DD"
hhmm            = string regex /^\d{2}:\d{2}$/          // "HH:MM"
```

## Paciente

```ts
patientCreateSchema = {
  name: string().min(1).max(120),
  gender: genderSchema,
  birthdate: isoDate,
  individualChecklistItemIds: string[]  default [],
  active: boolean  default true,
  consultationValue: number().nonnegative()  default 0,
  insuranceId: string | null  default null,
  dischargedAt: isoDate | null  default null,
  dischargeReasonId: string | null  default null,
  avatarId?: int 1..MONSTER_AVATAR_COUNT (56),
}
patientPatchSchema = patientCreateSchema.partial()  // + avatarId opcional
```

## Checklist

```ts
checklistItemCreateSchema = {
  label: string().min(1).max(200),
  order: int().nonnegative()  default 0,
  archived: boolean  default false,
}
checklistItemPatchSchema = .partial()

individualChecklistItemCreateSchema = checklistItemCreate + { patientId: string().min(1) }
individualChecklistItemPatchSchema  = .partial()
```

## Série de atendimento

```ts
appointmentSeriesCreateSchema = {
  patientId: string().min(1),
  startDate: isoDate,
  time: hhmm,
  frequency: frequencySchema | null,
  endDate: isoDate | null  default null,
}
appointmentSeriesPatchSchema = create.omit({ patientId }).partial()
```

## Atendimento

```ts
appointmentUpsertSchema = {
  seriesId: string().min(1),
  patientId: string().min(1),
  originDate: isoDate,
  date?: isoDate,
  status: statusSchema,
  rescheduledTo?: isoDate | null,
  time?: hhmm | null,
  checkedItemIds: string[]  default [],
  snapshotItemIds: string[]  default [],
  notes?: string | null,
  paid?: boolean,
  paidValue?: number().nonnegative() | null,
  paidAt?: string | null,
}

appointmentPatchSchema = {  // todos opcionais
  date?, status?, rescheduledTo?, time?, checkedItemIds?,
  snapshotItemIds?, notes?, paid?, paidValue?, paidAt?
}

appointmentBulkDeleteSchema = {
  seriesId: string().min(1),
  scope: enum(["one","future","all"]),
  originDate?: isoDate,
}.refine(scope === "all" || !!originDate, "originDate required for scope=one|future")
```

## Encerramento

```ts
dischargeSchema = { dischargedAt: isoDate, dischargeReasonId: string().min(1) }
```

## Convênio / Motivo

```ts
insuranceCreateSchema = {
  name: string().min(1).max(120),
  active: boolean  default true,
  defaultValue: number().nonnegative()  default 0,
}
insurancePatchSchema = .partial()

dischargeReasonCreateSchema = { name: string().min(1).max(120), active: boolean default true }
dischargeReasonPatchSchema  = .partial()
```

## Anotação

```ts
patientAnnotationCreateSchema = { patientId: string().min(1), text: string().min(1).max(2000) }
```

## Auth / Perfil

```ts
loginSchema          = { username: string().min(1), password: string().min(1) }

profilePatchSchema   = {   // .strict()
  displayName?: string().trim().min(1).max(80),
  avatarId?: int 1..56 | null,
}

passwordChangeSchema = {   // .strict()
  currentPassword: string().min(1),
  newPassword: string().min(8).max(200),
}
```

## Observações

- `.partial()` torna todos os campos opcionais (PATCHs).
- `.strict()` (perfil/senha) rejeita campos desconhecidos.
- `default` é aplicado pelo Zod no parse — o backend recebe o valor já preenchido.
- `MONSTER_AVATAR_COUNT = 56` vem de [`src/lib/monster-avatars.ts`](../../src/lib/monster-avatars.ts).
- A validação cobre **forma**; regras de negócio (ex.: data passada, valor de pagamento) são
  validadas adicionalmente na UI e/ou nos handlers.
