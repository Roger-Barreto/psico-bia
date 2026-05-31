import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { supabase, DOCS_BUCKET } from "@/lib/supabase"
import type {
  Appointment,
  AppointmentSeries,
  AppointmentStatus,
  DischargeReason,
  Frequency,
  Gender,
  IndividualChecklistItem,
  Insurance,
  Patient,
  PatientAnnotation,
  PatientDocument,
  SharedChecklistItem,
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
  // bucket-flat: tudo em {patientId}/
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .list(patientId, { limit: 1000 })
  if (error) return []
  return (data ?? []).map((f) => `${patientId}/${f.name}`)
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
      }
      const { data, error } = await supabase
        .from("appointments")
        .upsert(row, { onConflict: "series_id,origin_date" })
        .select()
        .single()
      if (error) throw error
      return rowToAppointment(data as AppointmentRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
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
      const { data, error } = await supabase.storage
        .from(DOCS_BUCKET)
        .list(patientId, { limit: 1000 })
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
      const path = `${patientId}/${file.name}`
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
      const path = `${patientId}/${filename}`
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
      const path = `${patientId}/${filename}`
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
