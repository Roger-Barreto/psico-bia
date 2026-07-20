import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { supabase, DOCS_BUCKET, requireUserId } from "@/lib/supabase"
import { randomMonsterAvatarId } from "@/lib/monster-avatars"
import type {
  Appointment,
  AppointmentSeries,
  AppointmentStatus,
  DischargeReason,
  FinanceCard,
  FinanceCategory,
  FinanceScope,
  Frequency,
  Gender,
  IndividualChecklistItem,
  Insurance,
  LedgerEntry,
  Patient,
  PatientAnnotation,
  PatientDocument,
  PaymentMethod,
  Person,
  RecurringRule,
  RecurringScope,
  SharedChecklistItem,
  Transaction,
  TransactionKind,
} from "@/db/types"

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════
function newId(prefix: string) {
  return `${prefix}_${nanoid(10)}`
}

function nowIso() {
  return new Date().toISOString()
}

// ════════════════════════════════════════════════════════════════
// Mappers snake_case ↔ camelCase
// ════════════════════════════════════════════════════════════════

// ─── PATIENT ─────────────────────────────────────────────
interface PatientRow {
  id: string
  name: string
  gender: Gender
  birthdate: string
  avatar_id: number
  active: boolean
  created_at: string
  consultation_value: number
  insurance_id: string | null
  individual_checklist_item_ids: string[]
  discharged_at: string | null
  discharge_reason_id: string | null
  cpf: string | null
  payer_cpf: string | null
}

function rowToPatient(r: PatientRow): Patient {
  return {
    id: r.id,
    name: r.name,
    gender: r.gender,
    birthdate: r.birthdate,
    avatarId: r.avatar_id,
    active: r.active,
    createdAt: r.created_at,
    consultationValue: Number(r.consultation_value),
    insuranceId: r.insurance_id,
    individualChecklistItemIds: r.individual_checklist_item_ids ?? [],
    dischargedAt: r.discharged_at,
    dischargeReasonId: r.discharge_reason_id,
    cpf: r.cpf ?? null,
    payerCpf: r.payer_cpf ?? null,
  }
}

function patientToRow(
  p: Partial<Patient>,
): Partial<PatientRow> {
  const row: Partial<PatientRow> = {}
  if (p.id !== undefined) row.id = p.id
  if (p.name !== undefined) row.name = p.name
  if (p.gender !== undefined) row.gender = p.gender
  if (p.birthdate !== undefined) row.birthdate = p.birthdate
  if (p.avatarId !== undefined) row.avatar_id = p.avatarId
  if (p.active !== undefined) row.active = p.active
  if (p.createdAt !== undefined) row.created_at = p.createdAt
  if (p.consultationValue !== undefined)
    row.consultation_value = p.consultationValue
  if (p.insuranceId !== undefined) row.insurance_id = p.insuranceId
  if (p.individualChecklistItemIds !== undefined)
    row.individual_checklist_item_ids = p.individualChecklistItemIds
  if (p.dischargedAt !== undefined) row.discharged_at = p.dischargedAt
  if (p.dischargeReasonId !== undefined)
    row.discharge_reason_id = p.dischargeReasonId
  if (p.cpf !== undefined) row.cpf = p.cpf
  if (p.payerCpf !== undefined) row.payer_cpf = p.payerCpf
  return row
}

// ─── APPOINTMENT SERIES ───────────────────────────────────
interface AppointmentSeriesRow {
  id: string
  patient_id: string
  start_date: string
  time: string
  frequency: Frequency | null
  end_date: string | null
  created_at: string
}

function rowToSeries(r: AppointmentSeriesRow): AppointmentSeries {
  return {
    id: r.id,
    patientId: r.patient_id,
    startDate: r.start_date,
    time: r.time,
    frequency: r.frequency,
    endDate: r.end_date,
    createdAt: r.created_at,
  }
}

function seriesToRow(
  s: Partial<AppointmentSeries>,
): Partial<AppointmentSeriesRow> {
  const row: Partial<AppointmentSeriesRow> = {}
  if (s.id !== undefined) row.id = s.id
  if (s.patientId !== undefined) row.patient_id = s.patientId
  if (s.startDate !== undefined) row.start_date = s.startDate
  if (s.time !== undefined) row.time = s.time
  if (s.frequency !== undefined) row.frequency = s.frequency
  if (s.endDate !== undefined) row.end_date = s.endDate
  if (s.createdAt !== undefined) row.created_at = s.createdAt
  return row
}

// ─── APPOINTMENT ─────────────────────────────────────────
interface AppointmentRow {
  id: string
  series_id: string
  patient_id: string
  date: string
  origin_date: string
  status: AppointmentStatus
  rescheduled_to: string | null
  time: string | null
  checked_item_ids: string[]
  snapshot_item_ids: string[]
  notes: string | null
  updated_at: string
  paid: boolean
  paid_value: number | null
  paid_at: string | null
  payment_method_id: string | null
}

function rowToAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    seriesId: r.series_id,
    patientId: r.patient_id,
    date: r.date,
    originDate: r.origin_date,
    status: r.status,
    rescheduledTo: r.rescheduled_to,
    time: r.time,
    checkedItemIds: r.checked_item_ids ?? [],
    snapshotItemIds: r.snapshot_item_ids ?? [],
    notes: r.notes,
    updatedAt: r.updated_at,
    paid: r.paid,
    paidValue: r.paid_value === null ? null : Number(r.paid_value),
    paidAt: r.paid_at,
    paymentMethodId: r.payment_method_id ?? null,
  }
}

function appointmentToRow(
  a: Partial<Appointment>,
): Partial<AppointmentRow> {
  const row: Partial<AppointmentRow> = {}
  if (a.id !== undefined) row.id = a.id
  if (a.seriesId !== undefined) row.series_id = a.seriesId
  if (a.patientId !== undefined) row.patient_id = a.patientId
  if (a.date !== undefined) row.date = a.date
  if (a.originDate !== undefined) row.origin_date = a.originDate
  if (a.status !== undefined) row.status = a.status
  if (a.rescheduledTo !== undefined) row.rescheduled_to = a.rescheduledTo
  if (a.time !== undefined) row.time = a.time
  if (a.checkedItemIds !== undefined) row.checked_item_ids = a.checkedItemIds
  if (a.snapshotItemIds !== undefined) row.snapshot_item_ids = a.snapshotItemIds
  if (a.notes !== undefined) row.notes = a.notes
  if (a.updatedAt !== undefined) row.updated_at = a.updatedAt
  if (a.paid !== undefined) row.paid = a.paid
  if (a.paidValue !== undefined) row.paid_value = a.paidValue
  if (a.paidAt !== undefined) row.paid_at = a.paidAt
  if (a.paymentMethodId !== undefined)
    row.payment_method_id = a.paymentMethodId
  return row
}

// ─── INSURANCE / DISCHARGE REASON ─────────────────────────
interface InsuranceRow {
  id: string
  name: string
  active: boolean
  default_value: number
  created_at: string
}

function rowToInsurance(r: InsuranceRow): Insurance {
  return {
    id: r.id,
    name: r.name,
    active: r.active,
    defaultValue: Number(r.default_value),
    createdAt: r.created_at,
  }
}

function insuranceToRow(p: Partial<Insurance>): Partial<InsuranceRow> {
  const row: Partial<InsuranceRow> = {}
  if (p.id !== undefined) row.id = p.id
  if (p.name !== undefined) row.name = p.name
  if (p.active !== undefined) row.active = p.active
  if (p.defaultValue !== undefined) row.default_value = p.defaultValue
  if (p.createdAt !== undefined) row.created_at = p.createdAt
  return row
}

interface DischargeReasonRow {
  id: string
  name: string
  active: boolean
  created_at: string
}

function rowToDischargeReason(r: DischargeReasonRow): DischargeReason {
  return {
    id: r.id,
    name: r.name,
    active: r.active,
    createdAt: r.created_at,
  }
}

function dischargeReasonToRow(
  p: Partial<DischargeReason>,
): Partial<DischargeReasonRow> {
  const row: Partial<DischargeReasonRow> = {}
  if (p.id !== undefined) row.id = p.id
  if (p.name !== undefined) row.name = p.name
  if (p.active !== undefined) row.active = p.active
  if (p.createdAt !== undefined) row.created_at = p.createdAt
  return row
}

// ─── CHECKLIST ──────────────────────────────────────────
interface SharedItemRow {
  id: string
  label: string
  order: number
  archived: boolean
}

function rowToSharedItem(r: SharedItemRow): SharedChecklistItem {
  return { id: r.id, label: r.label, order: r.order, archived: r.archived }
}

interface IndividualItemRow extends SharedItemRow {
  patient_id: string
}

function rowToIndividualItem(r: IndividualItemRow): IndividualChecklistItem {
  return {
    id: r.id,
    label: r.label,
    order: r.order,
    archived: r.archived,
    patientId: r.patient_id,
  }
}

// ─── ANNOTATION ──────────────────────────────────────────
interface PatientAnnotationRow {
  id: string
  patient_id: string
  text: string
  created_at: string
}

function rowToAnnotation(r: PatientAnnotationRow): PatientAnnotation {
  return {
    id: r.id,
    patientId: r.patient_id,
    text: r.text,
    createdAt: r.created_at,
  }
}

// ════════════════════════════════════════════════════════════════
// Query keys
// ════════════════════════════════════════════════════════════════
export const qk = {
  patients: ["patients"] as const,
  shared: ["shared-checklist"] as const,
  individual: (patientId?: string) =>
    ["individual-checklist", patientId ?? "all"] as const,
  appointments: (from: string, to: string) =>
    ["appointments", from, to] as const,
  series: (patientId?: string) => ["series", patientId ?? "all"] as const,
  insurances: ["insurances"] as const,
  documents: (patientId: string) => ["documents", patientId] as const,
  dischargeReasons: ["discharge-reasons"] as const,
  annotations: (patientId?: string) =>
    ["annotations", patientId ?? "all"] as const,
}

// ════════════════════════════════════════════════════════════════
// PATIENTS
// ════════════════════════════════════════════════════════════════
export function usePatients(opts?: Partial<UseQueryOptions<Patient[]>>) {
  return useQuery({
    queryKey: qk.patients,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToPatient(r as PatientRow))
    },
    staleTime: 30_000,
    ...opts,
  })
}

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      input: Omit<Patient, "id" | "createdAt"> & { avatarId?: number },
    ) => {
      const row: PatientRow = {
        id: newId("p"),
        name: input.name,
        gender: input.gender,
        birthdate: input.birthdate,
        avatar_id: input.avatarId ?? 0,
        active: input.active ?? true,
        created_at: nowIso(),
        consultation_value: input.consultationValue ?? 0,
        insurance_id: input.insuranceId ?? null,
        individual_checklist_item_ids: input.individualChecklistItemIds ?? [],
        discharged_at: input.dischargedAt ?? null,
        discharge_reason_id: input.dischargeReasonId ?? null,
        cpf: input.cpf ?? null,
        payer_cpf: input.payerCpf ?? null,
      }
      const { data, error } = await supabase
        .from("patients")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToPatient(data as PatientRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Patient>
    }) => {
      const { data, error } = await supabase
        .from("patients")
        .update(patientToRow(patch))
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToPatient(data as PatientRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

export function useArchivePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("patients")
        .update({ active: false })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToPatient(data as PatientRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

export function useDischargePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      dischargedAt,
      dischargeReasonId,
    }: {
      id: string
      dischargedAt: string
      dischargeReasonId: string
    }) => {
      const { data: deletedCount, error } = await supabase.rpc(
        "discharge_patient",
        {
          p_id: id,
          p_discharged_at: dischargedAt,
          p_reason_id: dischargeReasonId,
        },
      )
      if (error) throw error
      // Refetch patient pra retornar a row atualizada
      const { data: row, error: e2 } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .single()
      if (e2) throw e2
      return {
        patient: rowToPatient(row as PatientRow),
        deletedAppointments: Number(deletedCount ?? 0),
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patients })
      qc.invalidateQueries({ queryKey: ["series"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

export function useReopenPatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("patients")
        .update({ discharged_at: null, discharge_reason_id: null })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToPatient(data as PatientRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

async function listAllStoragePaths(patientId: string): Promise<string[]> {
  // Path layout: {userId}/{patientId}/{filename}
  const userId = await requireUserId()
  const prefix = `${userId}/${patientId}`
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .list(prefix, { limit: 1000 })
  if (error) return []
  return (data ?? []).map((f) => `${prefix}/${f.name}`)
}

export function useDeletePatientPermanently() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // delete row primeiro — FK cascade cobre série/sessões/anotações/individual
      const { error } = await supabase.from("patients").delete().eq("id", id)
      if (error) throw error
      // cleanup files (best-effort; órfãos toleráveis)
      const paths = await listAllStoragePaths(id)
      if (paths.length > 0) {
        await supabase.storage.from(DOCS_BUCKET).remove(paths)
      }
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.patients })
      qc.invalidateQueries({ queryKey: ["series"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: ["annotations"] })
      qc.invalidateQueries({ queryKey: ["individual-checklist"] })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// APPOINTMENT SERIES
// ════════════════════════════════════════════════════════════════
export function useAppointmentSeries(patientId?: string) {
  return useQuery({
    queryKey: qk.series(patientId),
    queryFn: async () => {
      let q = supabase.from("appointment_series").select("*")
      if (patientId) q = q.eq("patient_id", patientId)
      const { data, error } = await q.order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToSeries(r as AppointmentSeriesRow))
    },
    staleTime: 30_000,
  })
}

export function useCreateAppointmentSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      patientId: string
      startDate: string
      time: string
      frequency: AppointmentSeries["frequency"]
      endDate?: string | null
    }) => {
      const row: AppointmentSeriesRow = {
        id: newId("as"),
        patient_id: input.patientId,
        start_date: input.startDate,
        time: input.time,
        frequency: input.frequency,
        end_date: input.endDate ?? null,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("appointment_series")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToSeries(data as AppointmentSeriesRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["series"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

export function useUpdateAppointmentSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Omit<AppointmentSeries, "id" | "patientId" | "createdAt">>
    }) => {
      const { data, error } = await supabase
        .from("appointment_series")
        .update(seriesToRow(patch))
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToSeries(data as AppointmentSeriesRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["series"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

export function useDeleteAppointmentSeries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("appointment_series")
        .delete()
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToSeries(data as AppointmentSeriesRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["series"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// SHARED CHECKLIST
// ════════════════════════════════════════════════════════════════
export function useSharedChecklist() {
  return useQuery({
    queryKey: qk.shared,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_checklist")
        .select("*")
        .order("order", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToSharedItem(r as SharedItemRow))
    },
    staleTime: 60_000,
  })
}

export function useCreateSharedItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<SharedChecklistItem, "id">) => {
      const row: SharedItemRow = {
        id: newId("sc"),
        label: input.label,
        order: input.order,
        archived: input.archived ?? false,
      }
      const { data, error } = await supabase
        .from("shared_checklist")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToSharedItem(data as SharedItemRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

export function useUpdateSharedItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<SharedChecklistItem>
    }) => {
      const row: Partial<SharedItemRow> = {}
      if (patch.label !== undefined) row.label = patch.label
      if (patch.order !== undefined) row.order = patch.order
      if (patch.archived !== undefined) row.archived = patch.archived
      const { data, error } = await supabase
        .from("shared_checklist")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToSharedItem(data as SharedItemRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

export function useArchiveSharedItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("shared_checklist")
        .update({ archived: true })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToSharedItem(data as SharedItemRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

export function useReorderSharedItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id, idx) =>
          supabase
            .from("shared_checklist")
            .update({ order: idx })
            .eq("id", id),
        ),
      )
      const { data, error } = await supabase
        .from("shared_checklist")
        .select("*")
        .order("order", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToSharedItem(r as SharedItemRow))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

export function useDeleteSharedItemPermanent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase
        .from("shared_checklist")
        .delete()
        .eq("id", id)
      if (e1) throw e1
      const { error: e2 } = await supabase.rpc("scrub_shared_item", {
        p_item_id: id,
      })
      if (e2) throw e2
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.shared })
      qc.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// INDIVIDUAL CHECKLIST
// ════════════════════════════════════════════════════════════════
export function useIndividualChecklist(patientId?: string) {
  return useQuery({
    queryKey: qk.individual(patientId),
    queryFn: async () => {
      let q = supabase.from("individual_checklist").select("*")
      if (patientId) q = q.eq("patient_id", patientId)
      const { data, error } = await q.order("order", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) =>
        rowToIndividualItem(r as IndividualItemRow),
      )
    },
    staleTime: 60_000,
  })
}

export function useCreateIndividualItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<IndividualChecklistItem, "id">) => {
      const row: IndividualItemRow = {
        id: newId("ci"),
        patient_id: input.patientId,
        label: input.label,
        order: input.order,
        archived: input.archived ?? false,
      }
      const { data, error } = await supabase
        .from("individual_checklist")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToIndividualItem(data as IndividualItemRow)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.individual(vars.patientId) })
      qc.invalidateQueries({ queryKey: qk.individual() })
    },
  })
}

export function useUpdateIndividualItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<IndividualChecklistItem>
    }) => {
      const row: Partial<IndividualItemRow> = {}
      if (patch.label !== undefined) row.label = patch.label
      if (patch.order !== undefined) row.order = patch.order
      if (patch.archived !== undefined) row.archived = patch.archived
      if (patch.patientId !== undefined) row.patient_id = patch.patientId
      const { data, error } = await supabase
        .from("individual_checklist")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToIndividualItem(data as IndividualItemRow)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["individual-checklist"] }),
  })
}

export function useArchiveIndividualItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("individual_checklist")
        .update({ archived: true })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToIndividualItem(data as IndividualItemRow)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["individual-checklist"] }),
  })
}

export function useReorderIndividualItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      patientId,
      ids,
    }: {
      patientId: string
      ids: string[]
    }) => {
      await Promise.all(
        ids.map((id, idx) =>
          supabase
            .from("individual_checklist")
            .update({ order: idx })
            .eq("id", id),
        ),
      )
      const { data, error } = await supabase
        .from("individual_checklist")
        .select("*")
        .eq("patient_id", patientId)
        .order("order", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) =>
        rowToIndividualItem(r as IndividualItemRow),
      )
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["individual-checklist"] }),
  })
}

export function useDeleteIndividualItemPermanent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase
        .from("individual_checklist")
        .delete()
        .eq("id", id)
      if (e1) throw e1
      const { error: e2 } = await supabase.rpc("scrub_individual_item", {
        p_item_id: id,
      })
      if (e2) throw e2
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["individual-checklist"] })
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: qk.patients })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ════════════════════════════════════════════════════════════════
export function useAppointmentsInRange(from: string, to: string) {
  return useQuery({
    queryKey: qk.appointments(from, to),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("date", from)
        .lte("date", to)
      if (error) throw error
      return (data ?? []).map((r) => rowToAppointment(r as AppointmentRow))
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })
}

export function useUpsertAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      seriesId: string
      patientId: string
      originDate: string
      date?: string
      status: Appointment["status"]
      rescheduledTo?: string | null
      time?: string | null
      checkedItemIds?: string[]
      snapshotItemIds?: string[]
      notes?: string | null
      paid?: boolean
      paidValue?: number | null
      paidAt?: string | null
      paymentMethodId?: string | null
    }) => {
      // Tenta detectar linha existente por (series_id, origin_date) pra preservar id
      const { data: existing } = await supabase
        .from("appointments")
        .select("id")
        .eq("series_id", input.seriesId)
        .eq("origin_date", input.originDate)
        .maybeSingle()

      const row: AppointmentRow = {
        id: (existing as { id: string } | null)?.id ?? newId("ap"),
        series_id: input.seriesId,
        patient_id: input.patientId,
        date: input.date ?? input.originDate,
        origin_date: input.originDate,
        status: input.status,
        rescheduled_to: input.rescheduledTo ?? null,
        time: input.time ?? null,
        checked_item_ids: input.checkedItemIds ?? [],
        snapshot_item_ids: input.snapshotItemIds ?? [],
        notes: input.notes ?? null,
        updated_at: nowIso(),
        paid: input.paid ?? false,
        paid_value: input.paidValue ?? null,
        paid_at: input.paidAt ?? null,
        payment_method_id: input.paymentMethodId ?? null,
      }
      const { data, error } = await supabase
        .from("appointments")
        .upsert(row, { onConflict: "series_id,origin_date" })
        .select()
        .single()
      if (error) throw error
      return rowToAppointment(data as AppointmentRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] })
      // attended/paid sessions feed the derived clinic income in the ledger
      qc.invalidateQueries({ queryKey: ["finance-ledger"] })
    },
  })
}

export function useUndoAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      seriesId: string
      scope: "one" | "future" | "all"
      originDate?: string
    }) => {
      const { data, error } = await supabase.rpc("bulk_delete_appointments", {
        p_series_id: input.seriesId,
        p_scope: input.scope,
        p_origin_date: input.originDate ?? null,
        p_new_appointment_id:
          input.scope === "one" ? newId("ap") : null,
      })
      if (error) throw error
      const r = (data ?? {}) as {
        ok: boolean
        removedCount: number
        cancelledCount: number
        seriesDeleted: boolean
      }
      return r
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: ["series"] })
    },
  })
}

export function usePatchAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Appointment>
    }) => {
      const row = appointmentToRow(patch)
      row.updated_at = nowIso()
      const { data, error } = await supabase
        .from("appointments")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToAppointment(data as AppointmentRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] })
      qc.invalidateQueries({ queryKey: ["finance-ledger"] })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// INSURANCES
// ════════════════════════════════════════════════════════════════
export function useInsurances() {
  return useQuery({
    queryKey: qk.insurances,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurances")
        .select("*")
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToInsurance(r as InsuranceRow))
    },
    staleTime: 60_000,
  })
}

export function useCreateInsurance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      active?: boolean
      defaultValue?: number
    }) => {
      const row: InsuranceRow = {
        id: newId("ins"),
        name: input.name,
        active: input.active ?? true,
        default_value: input.defaultValue ?? 0,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("insurances")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToInsurance(data as InsuranceRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.insurances }),
  })
}

export function useUpdateInsurance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Insurance>
    }) => {
      const { data, error } = await supabase
        .from("insurances")
        .update(insuranceToRow(patch))
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToInsurance(data as InsuranceRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.insurances }),
  })
}

export function useArchiveInsurance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("insurances")
        .update({ active: false })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToInsurance(data as InsuranceRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.insurances }),
  })
}

// ════════════════════════════════════════════════════════════════
// DISCHARGE REASONS
// ════════════════════════════════════════════════════════════════
export function useDischargeReasons() {
  return useQuery({
    queryKey: qk.dischargeReasons,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discharge_reasons")
        .select("*")
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) =>
        rowToDischargeReason(r as DischargeReasonRow),
      )
    },
    staleTime: 60_000,
  })
}

export function useCreateDischargeReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; active?: boolean }) => {
      const row: DischargeReasonRow = {
        id: newId("dr"),
        name: input.name,
        active: input.active ?? true,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("discharge_reasons")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToDischargeReason(data as DischargeReasonRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dischargeReasons }),
  })
}

export function useUpdateDischargeReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<DischargeReason>
    }) => {
      const { data, error } = await supabase
        .from("discharge_reasons")
        .update(dischargeReasonToRow(patch))
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToDischargeReason(data as DischargeReasonRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dischargeReasons }),
  })
}

export function useArchiveDischargeReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("discharge_reasons")
        .update({ active: false })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToDischargeReason(data as DischargeReasonRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dischargeReasons }),
  })
}

// ════════════════════════════════════════════════════════════════
// PATIENT DOCUMENTS (Storage)
// ════════════════════════════════════════════════════════════════
export function usePatientDocuments(patientId?: string) {
  return useQuery({
    queryKey: patientId ? qk.documents(patientId) : ["documents", "none"],
    queryFn: async (): Promise<PatientDocument[]> => {
      if (!patientId) return []
      const userId = await requireUserId()
      const { data, error } = await supabase.storage
        .from(DOCS_BUCKET)
        .list(`${userId}/${patientId}`, { limit: 1000 })
      if (error) throw error
      return (data ?? [])
        .filter((f) => f.name && !f.name.endsWith("/"))
        .map((f) => ({
          filename: f.name,
          size:
            typeof f.metadata?.size === "number"
              ? f.metadata.size
              : Number(f.metadata?.size ?? 0),
          modifiedAt:
            f.updated_at ?? f.created_at ?? new Date().toISOString(),
        }))
    },
    enabled: !!patientId,
    staleTime: 15_000,
  })
}

export function useUploadDocument(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const userId = await requireUserId()
      const path = `${userId}/${patientId}/${file.name}`
      const { error } = await supabase.storage
        .from(DOCS_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        })
      if (error) throw error
      return {
        filename: file.name,
        size: file.size,
        modifiedAt: new Date().toISOString(),
      } satisfies PatientDocument
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.documents(patientId) }),
  })
}

export function useDeleteDocument(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (filename: string) => {
      const userId = await requireUserId()
      const path = `${userId}/${patientId}/${filename}`
      const { error } = await supabase.storage
        .from(DOCS_BUCKET)
        .remove([path])
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.documents(patientId) }),
  })
}

export function useDocumentSignedUrl() {
  return useMutation({
    mutationFn: async ({
      patientId,
      filename,
    }: {
      patientId: string
      filename: string
    }) => {
      const userId = await requireUserId()
      const path = `${userId}/${patientId}/${filename}`
      const { data, error } = await supabase.storage
        .from(DOCS_BUCKET)
        .createSignedUrl(path, 3600, { download: filename })
      if (error) throw error
      return data.signedUrl
    },
  })
}

// ════════════════════════════════════════════════════════════════
// PATIENT ANNOTATIONS
// ════════════════════════════════════════════════════════════════
export function usePatientAnnotations(patientId?: string) {
  return useQuery({
    queryKey: qk.annotations(patientId),
    queryFn: async () => {
      let q = supabase.from("patient_annotations").select("*")
      if (patientId) q = q.eq("patient_id", patientId)
      const { data, error } = await q.order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) =>
        rowToAnnotation(r as PatientAnnotationRow),
      )
    },
    enabled: !!patientId,
    staleTime: 30_000,
  })
}

export function useCreatePatientAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { patientId: string; text: string }) => {
      const row: PatientAnnotationRow = {
        id: newId("an"),
        patient_id: input.patientId,
        text: input.text,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("patient_annotations")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToAnnotation(data as PatientAnnotationRow)
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.annotations(vars.patientId) })
      qc.invalidateQueries({ queryKey: qk.annotations() })
    },
  })
}

export function useDeletePatientAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("patient_annotations")
        .delete()
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToAnnotation(data as PatientAnnotationRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotations"] }),
  })
}

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// FINANCE MODULE
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════

// ─── Mappers ─────────────────────────────────────────────
interface PersonRow {
  id: string
  name: string
  notes: string | null
  avatar_id: number
  active: boolean
  created_at: string
}
function rowToPerson(r: PersonRow): Person {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    avatarId: r.avatar_id,
    active: r.active,
    createdAt: r.created_at,
  }
}

interface FinanceCategoryRow {
  id: string
  name: string
  color: string | null
  active: boolean
  created_at: string
}
function rowToCategory(r: FinanceCategoryRow): FinanceCategory {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    active: r.active,
    createdAt: r.created_at,
  }
}

interface PaymentMethodRow {
  id: string
  name: string
  is_loan: boolean
  is_credit_card: boolean
  color: string | null
  active: boolean
  created_at: string
}
function rowToPaymentMethod(r: PaymentMethodRow): PaymentMethod {
  return {
    id: r.id,
    name: r.name,
    isLoan: r.is_loan,
    isCreditCard: r.is_credit_card ?? false,
    color: r.color,
    active: r.active,
    createdAt: r.created_at,
  }
}

interface FinanceCardRow {
  id: string
  name: string
  closing_day: number
  due_day: number
  color: string | null
  credit_limit: number | null
  brand: string | null
  last4: string | null
  active: boolean
  created_at: string
}
function rowToCard(r: FinanceCardRow): FinanceCard {
  return {
    id: r.id,
    name: r.name,
    closingDay: r.closing_day,
    dueDay: r.due_day,
    color: r.color,
    creditLimit: r.credit_limit != null ? Number(r.credit_limit) : null,
    brand: r.brand,
    last4: r.last4,
    active: r.active,
    createdAt: r.created_at,
  }
}

interface RecurringRuleRow {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  category_id: string | null
  payment_method_id: string | null
  person_id: string | null
  card_id: string | null
  day_of_month: number
  start_period: string
  active: boolean
  created_at: string
}
function rowToRule(r: RecurringRuleRow): RecurringRule {
  return {
    id: r.id,
    kind: r.kind,
    scope: r.scope,
    description: r.description,
    amount: Number(r.amount),
    categoryId: r.category_id,
    paymentMethodId: r.payment_method_id,
    personId: r.person_id,
    cardId: r.card_id ?? null,
    dayOfMonth: r.day_of_month,
    startPeriod: r.start_period,
    active: r.active,
    createdAt: r.created_at,
  }
}

interface LedgerRow {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  date: string
  period: string
  category_id: string | null
  category_name: string | null
  payment_method_id: string | null
  person_id: string | null
  card_id: string | null
  invoice_period: string | null
  invoice_close_date: string | null
  invoice_due_date: string | null
  settled: boolean
  settled_at: string | null
  recurring_rule_id: string | null
  installment_group: string | null
  installment_no: number | null
  installment_total: number | null
  link_id: string | null
  source: "manual" | "clinic"
  editable: boolean
  patient_id: string | null
}
function rowToLedgerEntry(r: LedgerRow): LedgerEntry {
  return {
    id: r.id,
    kind: r.kind,
    scope: r.scope,
    description: r.description,
    amount: Number(r.amount),
    date: r.date,
    period: r.period,
    categoryId: r.category_id,
    categoryName: r.category_name,
    paymentMethodId: r.payment_method_id,
    personId: r.person_id,
    cardId: r.card_id ?? null,
    invoicePeriod: r.invoice_period ?? null,
    invoiceCloseDate: r.invoice_close_date ?? null,
    invoiceDueDate: r.invoice_due_date ?? null,
    settled: r.settled,
    settledAt: r.settled_at,
    recurringRuleId: r.recurring_rule_id,
    installmentGroup: r.installment_group,
    installmentNo: r.installment_no,
    installmentTotal: r.installment_total,
    linkId: r.link_id,
    source: r.source,
    editable: r.editable,
    patientId: r.patient_id,
  }
}

// ─── Query keys ──────────────────────────────────────────
export const fqk = {
  people: ["finance-people"] as const,
  categories: ["finance-categories"] as const,
  paymentMethods: ["finance-payment-methods"] as const,
  cards: ["finance-cards"] as const,
  rules: ["finance-rules"] as const,
  ledgerMonth: (period: string) =>
    ["finance-ledger", "month", period] as const,
  ledgerRange: (from: string, to: string) =>
    ["finance-ledger", "range", from, to] as const,
  personLedger: (personId: string) =>
    ["finance-ledger", "person", personId] as const,
  cardLedger: (cardId: string) =>
    ["finance-ledger", "card", cardId] as const,
  openLoans: ["finance-ledger", "open-loans"] as const,
}

function invalidateLedger(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["finance-ledger"] })
}

// ─── PEOPLE ──────────────────────────────────────────────
export function usePeople() {
  return useQuery({
    queryKey: fqk.people,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*")
        .order("name", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToPerson(r as PersonRow))
    },
    staleTime: 60_000,
  })
}

export function useCreatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      notes?: string | null
      avatarId?: number
    }) => {
      const row: PersonRow = {
        id: newId("per"),
        name: input.name,
        notes: input.notes ?? null,
        avatar_id: input.avatarId ?? randomMonsterAvatarId(),
        active: true,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("people")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToPerson(data as PersonRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: fqk.people }),
  })
}

export function useUpdatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<Person, "name" | "notes" | "avatarId" | "active">>
    }) => {
      const row: Partial<PersonRow> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.notes !== undefined) row.notes = patch.notes
      if (patch.avatarId !== undefined) row.avatar_id = patch.avatarId
      if (patch.active !== undefined) row.active = patch.active
      const { data, error } = await supabase
        .from("people")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToPerson(data as PersonRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.people })
      invalidateLedger(qc)
    },
  })
}

/**
 * Hard-delete a person and every finance launch / recurring rule referencing
 * them (cascade RPC). Destructive — guard with a typed confirmation in the UI.
 */
export function useDeletePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("finance_delete_person", { p_id: id })
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.people })
      invalidateLedger(qc)
    },
  })
}

/** Count finance launches referencing a category / payment method / person. */
export async function countFinanceUsage(
  field: "category_id" | "payment_method_id" | "person_id",
  id: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("finance_transactions")
    .select("id", { count: "exact", head: true })
    .eq(field, id)
  if (error) throw error
  return count ?? 0
}

/** Count appointments tagged with a payment method (kept, just untagged). */
export async function countAppointmentsWithMethod(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("payment_method_id", id)
  if (error) throw error
  return count ?? 0
}

// ─── CATEGORIES ──────────────────────────────────────────
export function useFinanceCategories() {
  return useQuery({
    queryKey: fqk.categories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_categories")
        .select("*")
        .order("name", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToCategory(r as FinanceCategoryRow))
    },
    staleTime: 60_000,
  })
}

export function useCreateFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color?: string | null }) => {
      const row: FinanceCategoryRow = {
        id: newId("cat"),
        name: input.name,
        color: input.color ?? null,
        active: true,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("finance_categories")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToCategory(data as FinanceCategoryRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: fqk.categories }),
  })
}

export function useUpdateFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<FinanceCategory, "name" | "color" | "active">>
    }) => {
      const row: Partial<FinanceCategoryRow> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.color !== undefined) row.color = patch.color
      if (patch.active !== undefined) row.active = patch.active
      const { data, error } = await supabase
        .from("finance_categories")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToCategory(data as FinanceCategoryRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.categories })
      invalidateLedger(qc)
    },
  })
}

export function useDeleteFinanceCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("finance_delete_category", {
        p_id: id,
      })
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.categories })
      invalidateLedger(qc)
    },
  })
}

// ─── PAYMENT METHODS ─────────────────────────────────────
export function usePaymentMethods() {
  return useQuery({
    queryKey: fqk.paymentMethods,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("name", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToPaymentMethod(r as PaymentMethodRow))
    },
    staleTime: 60_000,
  })
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      isLoan?: boolean
      isCreditCard?: boolean
      color?: string | null
    }) => {
      const row: PaymentMethodRow = {
        id: newId("pm"),
        name: input.name,
        is_loan: input.isLoan ?? false,
        is_credit_card: input.isCreditCard ?? false,
        color: input.color ?? null,
        active: true,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("payment_methods")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToPaymentMethod(data as PaymentMethodRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: fqk.paymentMethods }),
  })
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<
        Pick<
          PaymentMethod,
          "name" | "color" | "active" | "isLoan" | "isCreditCard"
        >
      >
    }) => {
      const row: Partial<PaymentMethodRow> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.color !== undefined) row.color = patch.color
      if (patch.active !== undefined) row.active = patch.active
      if (patch.isLoan !== undefined) row.is_loan = patch.isLoan
      if (patch.isCreditCard !== undefined)
        row.is_credit_card = patch.isCreditCard
      const { data, error } = await supabase
        .from("payment_methods")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToPaymentMethod(data as PaymentMethodRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.paymentMethods })
      invalidateLedger(qc)
    },
  })
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("finance_delete_payment_method", {
        p_id: id,
      })
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.paymentMethods })
      qc.invalidateQueries({ queryKey: ["appointments"] })
      invalidateLedger(qc)
    },
  })
}

export function useSeedFinanceDefaults() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_finance_defaults")
      if (error) throw error
      return data as { categories: number; paymentMethods: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.categories })
      qc.invalidateQueries({ queryKey: fqk.paymentMethods })
    },
  })
}

// ─── CARDS ───────────────────────────────────────────────
export function useCards() {
  return useQuery({
    queryKey: fqk.cards,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_cards")
        .select("*")
        .order("name", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToCard(r as FinanceCardRow))
    },
    staleTime: 60_000,
  })
}

export interface NewCardInput {
  name: string
  closingDay: number
  dueDay: number
  color?: string | null
  creditLimit?: number | null
  brand?: string | null
  last4?: string | null
}

export function useCreateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewCardInput) => {
      const row: FinanceCardRow = {
        id: newId("card"),
        name: input.name,
        closing_day: input.closingDay,
        due_day: input.dueDay,
        color: input.color ?? null,
        credit_limit: input.creditLimit ?? null,
        brand: input.brand ?? null,
        last4: input.last4 ?? null,
        active: true,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("finance_cards")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToCard(data as FinanceCardRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: fqk.cards }),
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<
        Pick<
          FinanceCard,
          | "name"
          | "closingDay"
          | "dueDay"
          | "color"
          | "creditLimit"
          | "brand"
          | "last4"
          | "active"
        >
      >
    }) => {
      const row: Partial<FinanceCardRow> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.closingDay !== undefined) row.closing_day = patch.closingDay
      if (patch.dueDay !== undefined) row.due_day = patch.dueDay
      if (patch.color !== undefined) row.color = patch.color
      if (patch.creditLimit !== undefined) row.credit_limit = patch.creditLimit
      if (patch.brand !== undefined) row.brand = patch.brand
      if (patch.last4 !== undefined) row.last4 = patch.last4
      if (patch.active !== undefined) row.active = patch.active
      const { data, error } = await supabase
        .from("finance_cards")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToCard(data as FinanceCardRow)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.cards })
      invalidateLedger(qc)
    },
  })
}

/**
 * Hard-delete a card, unlinking (not deleting) its transactions/rules so the
 * expense history is preserved — those launches just leave every invoice.
 */
export function useDeleteCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("finance_delete_card", { p_id: id })
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.cards })
      invalidateLedger(qc)
    },
  })
}

/** Count launches (transactions) tied to a card. */
export async function countCardUsage(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("finance_transactions")
    .select("id", { count: "exact", head: true })
    .eq("card_id", id)
  if (error) throw error
  return count ?? 0
}

/** Every launch on a card (all invoices), newest first. */
export function useCardLedger(cardId?: string) {
  return useQuery({
    queryKey: fqk.cardLedger(cardId ?? "none"),
    queryFn: async () => {
      if (!cardId) return []
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("*")
        .eq("card_id", cardId)
        .order("date", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToLedgerEntry(r as LedgerRow))
    },
    enabled: !!cardId,
    staleTime: 15_000,
  })
}

/** Settle (or reopen) every launch of one card invoice at once. */
export function usePayInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cardId,
      period,
      settled,
    }: {
      cardId: string
      period: string
      settled: boolean
    }) => {
      const { error } = await supabase
        .from("finance_transactions")
        .update({
          settled,
          settled_at: settled ? nowIso() : null,
          updated_at: nowIso(),
        })
        .eq("card_id", cardId)
        .eq("invoice_period", period)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

/** Every card-linked entry (all cards, all invoices) — feeds invoice summaries. */
export function useCardEntriesAll() {
  return useQuery({
    queryKey: ["finance-ledger", "card-entries"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("*")
        .not("card_id", "is", null)
        .order("date", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToLedgerEntry(r as LedgerRow))
    },
    staleTime: 15_000,
  })
}

/** Net amount still owed per card (used limit), across all invoices. */
export function useCardsOpenTotals() {
  return useQuery({
    queryKey: ["finance-ledger", "card-open"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("card_id, kind, amount")
        .not("card_id", "is", null)
        .eq("settled", false)
      if (error) throw error
      const map = new Map<string, number>()
      for (const r of (data ?? []) as {
        card_id: string
        kind: TransactionKind
        amount: number
      }[]) {
        const v = r.kind === "expense" ? Number(r.amount) : -Number(r.amount)
        map.set(r.card_id, (map.get(r.card_id) ?? 0) + v)
      }
      return map
    },
    staleTime: 15_000,
  })
}

/** Net open-loan balance per person (receivable/payable), across all months. */
export function usePeopleBalances() {
  return useQuery({
    queryKey: fqk.openLoans,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("person_id, kind, amount, settled")
        .not("person_id", "is", null)
        .eq("settled", false)
      if (error) throw error
      const map = new Map<string, { receivable: number; payable: number }>()
      for (const r of (data ?? []) as {
        person_id: string
        kind: TransactionKind
        amount: number
      }[]) {
        const cur = map.get(r.person_id) ?? { receivable: 0, payable: 0 }
        if (r.kind === "income") cur.receivable += Number(r.amount)
        else cur.payable += Number(r.amount)
        map.set(r.person_id, cur)
      }
      return map
    },
    staleTime: 15_000,
  })
}

// ─── LEDGER (read) ───────────────────────────────────────
export function useLedgerMonth(period: string) {
  return useQuery({
    queryKey: fqk.ledgerMonth(period),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("*")
        .eq("period", period)
        .order("date", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToLedgerEntry(r as LedgerRow))
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })
}

export function useLedgerRange(fromPeriod: string, toPeriod: string) {
  return useQuery({
    queryKey: fqk.ledgerRange(fromPeriod, toPeriod),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("*")
        .gte("period", fromPeriod)
        .lte("period", toPeriod)
        .order("date", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToLedgerEntry(r as LedgerRow))
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })
}

export function usePersonLedger(personId?: string) {
  return useQuery({
    queryKey: fqk.personLedger(personId ?? "none"),
    queryFn: async () => {
      if (!personId) return []
      const { data, error } = await supabase
        .from("finance_ledger")
        .select("*")
        .eq("person_id", personId)
        .order("date", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToLedgerEntry(r as LedgerRow))
    },
    enabled: !!personId,
    staleTime: 15_000,
  })
}

// ─── TRANSACTIONS (write) ────────────────────────────────
export interface NewTransactionInput {
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  date: string
  categoryId?: string | null
  paymentMethodId?: string | null
  personId?: string | null
  cardId?: string | null
  settled?: boolean
  settledAt?: string | null
}

function buildTxRow(input: NewTransactionInput, now: string) {
  return {
    id: newId("tx"),
    kind: input.kind,
    scope: input.scope,
    description: input.description,
    amount: input.amount,
    date: input.date,
    category_id: input.categoryId ?? null,
    payment_method_id: input.paymentMethodId ?? null,
    person_id: input.personId ?? null,
    card_id: input.cardId ?? null,
    settled: input.settled ?? false,
    settled_at: input.settled ? (input.settledAt ?? now) : null,
    created_at: now,
    updated_at: now,
  }
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewTransactionInput) => {
      const { error } = await supabase
        .from("finance_transactions")
        .insert(buildTxRow(input, nowIso()))
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

/**
 * Installment plan: N equal rows across N months (last absorbs remainder),
 * sharing an installment_group. Amounts are pre-split by the caller.
 */
export function useCreateInstallments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      base: Omit<NewTransactionInput, "amount" | "date" | "settled">
      amounts: number[]
      dates: string[]
    }) => {
      const now = nowIso()
      const group = newId("ins")
      const total = input.amounts.length
      const rows = input.amounts.map((amount, i) => ({
        ...buildTxRow(
          { ...input.base, amount, date: input.dates[i], settled: false },
          now,
        ),
        installment_group: group,
        installment_no: i + 1,
        installment_total: total,
      }))
      const { error } = await supabase
        .from("finance_transactions")
        .insert(rows)
      if (error) throw error
      return { ok: true as const, group }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

/**
 * Loan granted (case 3b): a real cash outflow (expense) linked to a
 * receivable income on the same person, both sharing a link_id.
 */
export function useCreateLoanGranted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      personId: string
      amount: number
      date: string
      description: string
      scope: FinanceScope
      outflowCategoryId?: string | null
      outflowPaymentMethodId?: string | null // the real method used to pay (PIX, cash…)
      receivablePaymentMethodId: string // the loan method (isLoan)
      outflowSettled?: boolean
    }) => {
      const now = nowIso()
      const link = newId("lnk")
      const expense = {
        ...buildTxRow(
          {
            kind: "expense",
            scope: input.scope,
            description: input.description,
            amount: input.amount,
            date: input.date,
            categoryId: input.outflowCategoryId ?? null,
            paymentMethodId: input.outflowPaymentMethodId ?? null,
            settled: input.outflowSettled ?? true,
          },
          now,
        ),
        link_id: link,
      }
      const receivable = {
        ...buildTxRow(
          {
            kind: "income",
            scope: input.scope,
            description: input.description,
            amount: input.amount,
            date: input.date,
            paymentMethodId: input.receivablePaymentMethodId,
            personId: input.personId,
            settled: false,
          },
          now,
        ),
        link_id: link,
      }
      const { error } = await supabase
        .from("finance_transactions")
        .insert([expense, receivable])
      if (error) throw error
      return { ok: true as const, link }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      installmentGroup,
    }: {
      id: string
      patch: Partial<Transaction>
      /** When editing one parcel, card/method changes mirror to the whole group. */
      installmentGroup?: string | null
    }) => {
      const row: Record<string, unknown> = { updated_at: nowIso() }
      if (patch.kind !== undefined) row.kind = patch.kind
      if (patch.scope !== undefined) row.scope = patch.scope
      if (patch.description !== undefined) row.description = patch.description
      if (patch.amount !== undefined) row.amount = patch.amount
      if (patch.date !== undefined) row.date = patch.date
      if (patch.categoryId !== undefined) row.category_id = patch.categoryId
      if (patch.paymentMethodId !== undefined)
        row.payment_method_id = patch.paymentMethodId
      if (patch.personId !== undefined) row.person_id = patch.personId
      if (patch.cardId !== undefined) row.card_id = patch.cardId
      if (patch.settled !== undefined) row.settled = patch.settled
      if (patch.settledAt !== undefined) row.settled_at = patch.settledAt
      const { error } = await supabase
        .from("finance_transactions")
        .update(row)
        .eq("id", id)
      if (error) throw error
      // Card/method are attributes of the purchase, not of one parcel: mirror
      // them on the sibling installments so every parcel lands in its own
      // successive invoice (the DB trigger recomputes each one by its date).
      if (
        installmentGroup &&
        (patch.cardId !== undefined || patch.paymentMethodId !== undefined)
      ) {
        const sibling: Record<string, unknown> = { updated_at: nowIso() }
        if (patch.paymentMethodId !== undefined)
          sibling.payment_method_id = patch.paymentMethodId
        if (patch.cardId !== undefined) sibling.card_id = patch.cardId
        const { error: e2 } = await supabase
          .from("finance_transactions")
          .update(sibling)
          .eq("installment_group", installmentGroup)
          .neq("id", id)
        if (e2) throw e2
      }
      return { ok: true as const }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

/** Toggle pago/recebido on a manual transaction. */
export function useSetTransactionSettled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, settled }: { id: string; settled: boolean }) => {
      const { error } = await supabase
        .from("finance_transactions")
        .update({
          settled,
          settled_at: settled ? nowIso() : null,
          updated_at: nowIso(),
        })
        .eq("id", id)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("finance_transactions")
        .delete()
        .eq("id", id)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

export function useDeleteInstallmentGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (group: string) => {
      const { error } = await supabase
        .from("finance_transactions")
        .delete()
        .eq("installment_group", group)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => invalidateLedger(qc),
  })
}

// ─── RECURRING RULES ─────────────────────────────────────
export function useRecurringRules() {
  return useQuery({
    queryKey: fqk.rules,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_recurring_rules")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToRule(r as RecurringRuleRow))
    },
    staleTime: 60_000,
  })
}

/** Generate missing monthly rows for all active rules up to a period. */
export function useEnsureRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (untilPeriod: string) => {
      const { data, error } = await supabase.rpc(
        "ensure_recurring_materialized",
        { p_until_period: untilPeriod },
      )
      if (error) throw error
      return data as { inserted: number }
    },
    onSuccess: (r) => {
      if (r.inserted > 0) invalidateLedger(qc)
    },
  })
}

export function useCreateRecurringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      kind: TransactionKind
      scope: FinanceScope
      description: string
      amount: number
      categoryId?: string | null
      paymentMethodId?: string | null
      personId?: string | null
      cardId?: string | null
      dayOfMonth: number
      startPeriod: string
      untilPeriod: string // materialize up to here on creation
    }) => {
      const row: RecurringRuleRow = {
        id: newId("rec"),
        kind: input.kind,
        scope: input.scope,
        description: input.description,
        amount: input.amount,
        category_id: input.categoryId ?? null,
        payment_method_id: input.paymentMethodId ?? null,
        person_id: input.personId ?? null,
        card_id: input.cardId ?? null,
        day_of_month: input.dayOfMonth,
        start_period: input.startPeriod,
        active: true,
        created_at: nowIso(),
      }
      const { error } = await supabase
        .from("finance_recurring_rules")
        .insert(row)
      if (error) throw error
      const { error: e2 } = await supabase.rpc(
        "ensure_recurring_materialized",
        { p_until_period: input.untilPeriod },
      )
      if (e2) throw e2
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.rules })
      invalidateLedger(qc)
    },
  })
}

export function useEditRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ruleId: string
      scope: RecurringScope
      patch: Record<string, unknown>
      fromPeriod: string
    }) => {
      const { error } = await supabase.rpc("edit_recurring", {
        p_rule_id: input.ruleId,
        p_scope: input.scope,
        p_patch: input.patch,
        p_from_period: input.fromPeriod,
      })
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.rules })
      invalidateLedger(qc)
    },
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ruleId: string
      scope: RecurringScope
      fromPeriod: string
    }) => {
      const { error } = await supabase.rpc("delete_recurring", {
        p_rule_id: input.ruleId,
        p_scope: input.scope,
        p_from_period: input.fromPeriod,
      })
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fqk.rules })
      invalidateLedger(qc)
    },
  })
}
