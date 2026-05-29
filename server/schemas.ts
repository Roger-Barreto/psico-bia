import { z } from "zod"
import { MONSTER_AVATAR_COUNT } from "../src/lib/monster-avatars"

export const genderSchema = z.enum(["male", "female", "other"])
export const frequencySchema = z.enum(["weekly", "biweekly", "monthly"])
export const statusSchema = z.enum([
  "scheduled",
  "attended",
  "missed",
  "rescheduled",
  "cancelled",
])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "HH:MM")

export const patientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  gender: genderSchema,
  birthdate: isoDate,
  individualChecklistItemIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  consultationValue: z.number().nonnegative().default(0),
  insuranceId: z.string().nullable().default(null),
  dischargedAt: isoDate.nullable().default(null),
  dischargeReasonId: z.string().nullable().default(null),
  avatarId: z.number().int().min(1).max(MONSTER_AVATAR_COUNT).optional(),
})

export const patientPatchSchema = patientCreateSchema
  .extend({
    avatarId: z.number().int().min(1).max(MONSTER_AVATAR_COUNT).optional(),
  })
  .partial()

export const checklistItemCreateSchema = z.object({
  label: z.string().min(1).max(200),
  order: z.number().int().nonnegative().default(0),
  archived: z.boolean().default(false),
})

// NOTE: not `.partial()` — in Zod 4 `.partial()` keeps the inner `.default()`,
// so a patch missing `order`/`archived` would still resolve them to 0/false and
// clobber the stored value. Explicit `.optional()` fields avoid that.
export const checklistItemPatchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  order: z.number().int().nonnegative().optional(),
  archived: z.boolean().optional(),
})

export const checklistReorderSchema = z.object({
  ids: z.array(z.string()),
})

export const individualChecklistItemCreateSchema =
  checklistItemCreateSchema.extend({
    patientId: z.string().min(1),
  })

export const individualChecklistItemPatchSchema = checklistItemPatchSchema.extend(
  {
    patientId: z.string().min(1).optional(),
  },
)

export const individualChecklistReorderSchema = z.object({
  patientId: z.string().min(1),
  ids: z.array(z.string()),
})

export const appointmentSeriesCreateSchema = z.object({
  patientId: z.string().min(1),
  startDate: isoDate,
  time: hhmm,
  frequency: frequencySchema.nullable(),
  endDate: isoDate.nullable().default(null),
})

export const appointmentSeriesPatchSchema = appointmentSeriesCreateSchema
  .omit({ patientId: true })
  .partial()

export const appointmentUpsertSchema = z.object({
  seriesId: z.string().min(1),
  patientId: z.string().min(1),
  originDate: isoDate,
  date: isoDate.optional(),
  status: statusSchema,
  rescheduledTo: isoDate.nullable().optional(),
  time: hhmm.nullable().optional(),
  checkedItemIds: z.array(z.string()).default([]),
  snapshotItemIds: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  paid: z.boolean().optional(),
  paidValue: z.number().nonnegative().nullable().optional(),
  paidAt: z.string().nullable().optional(),
})

export const appointmentBulkDeleteSchema = z
  .object({
    seriesId: z.string().min(1),
    scope: z.enum(["one", "future", "all"]),
    originDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional(),
  })
  .refine(
    (d) => d.scope === "all" || !!d.originDate,
    "originDate required for scope=one|future",
  )

export const appointmentPatchSchema = z.object({
  date: isoDate.optional(),
  status: statusSchema.optional(),
  rescheduledTo: isoDate.nullable().optional(),
  time: hhmm.nullable().optional(),
  checkedItemIds: z.array(z.string()).optional(),
  snapshotItemIds: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  paid: z.boolean().optional(),
  paidValue: z.number().nonnegative().nullable().optional(),
  paidAt: z.string().nullable().optional(),
})

export const dischargeSchema = z.object({
  dischargedAt: isoDate,
  dischargeReasonId: z.string().min(1),
})

export const insuranceCreateSchema = z.object({
  name: z.string().min(1).max(120),
  active: z.boolean().default(true),
  defaultValue: z.number().nonnegative().default(0),
})

export const insurancePatchSchema = insuranceCreateSchema.partial()

export const dischargeReasonCreateSchema = z.object({
  name: z.string().min(1).max(120),
  active: z.boolean().default(true),
})

export const dischargeReasonPatchSchema = dischargeReasonCreateSchema.partial()

export const patientAnnotationCreateSchema = z.object({
  patientId: z.string().min(1),
  text: z.string().min(1).max(2000),
})

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    avatarId: z
      .number()
      .int()
      .min(1)
      .max(MONSTER_AVATAR_COUNT)
      .nullable()
      .optional(),
  })
  .strict()

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(200),
  })
  .strict()
