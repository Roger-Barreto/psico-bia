import { z } from "zod"
import { MONSTER_AVATAR_COUNT } from "../src/lib/monster-avatars"

export const genderSchema = z.enum(["male", "female", "other"])
export const recurrenceSchema = z.enum(["once", "weekly", "biweekly", "monthly"])
export const statusSchema = z.enum([
  "scheduled",
  "attended",
  "missed",
  "rescheduled",
  "cancelled",
])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "HH:MM")

export const recurrenceSegmentSchema = z.object({
  activeFrom: isoDate,
  recurrence: recurrenceSchema,
  defaultWeekday: z.number().int().min(0).max(6),
  anchorDate: isoDate,
  defaultTime: hhmm,
})

export const patientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  gender: genderSchema,
  age: z.number().int().min(0).max(130),
  defaultWeekday: z.number().int().min(0).max(6),
  recurrence: recurrenceSchema,
  anchorDate: isoDate,
  defaultTime: hhmm.default("08:00"),
  recurrenceHistory: z.array(recurrenceSegmentSchema).optional(),
  individualChecklistItemIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  consultationValue: z.number().nonnegative().default(0),
  insuranceId: z.string().nullable().default(null),
  dischargedAt: isoDate.nullable().default(null),
  dischargeReasonId: z.string().nullable().default(null),
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

export const checklistItemPatchSchema = checklistItemCreateSchema.partial()

export const individualChecklistItemCreateSchema =
  checklistItemCreateSchema.extend({
    patientId: z.string().min(1),
  })

export const individualChecklistItemPatchSchema =
  individualChecklistItemCreateSchema.partial()

export const appointmentUpsertSchema = z.object({
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
