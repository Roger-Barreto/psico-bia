import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { api } from "./client"
import type {
  Appointment,
  DischargeReason,
  IndividualChecklistItem,
  Insurance,
  Patient,
  PatientAnnotation,
  PatientDocument,
  SharedChecklistItem,
} from "@/db/types"

export const qk = {
  patients: ["patients"] as const,
  shared: ["shared-checklist"] as const,
  individual: (patientId?: string) =>
    ["individual-checklist", patientId ?? "all"] as const,
  appointments: (from: string, to: string) =>
    ["appointments", from, to] as const,
  insurances: ["insurances"] as const,
  documents: (patientId: string) => ["documents", patientId] as const,
  dischargeReasons: ["discharge-reasons"] as const,
  annotations: (patientId?: string) =>
    ["annotations", patientId ?? "all"] as const,
}

// ─── PATIENTS ────────────────────────────────────────────
export function usePatients(opts?: Partial<UseQueryOptions<Patient[]>>) {
  return useQuery({
    queryKey: qk.patients,
    queryFn: () => api.get<Patient[]>("/api/patients"),
    staleTime: 30_000,
    ...opts,
  })
}

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<Patient, "id" | "createdAt">) =>
      api.post<Patient>("/api/patients", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

export function useUpdatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Patient> }) =>
      api.patch<Patient>(`/api/patients/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

export function useArchivePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Patient>(`/api/patients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.patients }),
  })
}

// ─── SHARED CHECKLIST ────────────────────────────────────
export function useSharedChecklist() {
  return useQuery({
    queryKey: qk.shared,
    queryFn: () => api.get<SharedChecklistItem[]>("/api/shared-checklist"),
    staleTime: 60_000,
  })
}

export function useCreateSharedItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<SharedChecklistItem, "id">) =>
      api.post<SharedChecklistItem>("/api/shared-checklist", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

export function useUpdateSharedItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<SharedChecklistItem>
    }) =>
      api.patch<SharedChecklistItem>(`/api/shared-checklist/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

export function useArchiveSharedItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<SharedChecklistItem>(`/api/shared-checklist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.shared }),
  })
}

// ─── INDIVIDUAL CHECKLIST ────────────────────────────────
export function useIndividualChecklist(patientId?: string) {
  return useQuery({
    queryKey: qk.individual(patientId),
    queryFn: () =>
      api.get<IndividualChecklistItem[]>(
        "/api/individual-checklist",
        patientId ? { patientId } : undefined,
      ),
    staleTime: 60_000,
  })
}

export function useCreateIndividualItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<IndividualChecklistItem, "id">) =>
      api.post<IndividualChecklistItem>("/api/individual-checklist", input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.individual(vars.patientId) })
      qc.invalidateQueries({ queryKey: qk.individual() })
    },
  })
}

export function useUpdateIndividualItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<IndividualChecklistItem>
    }) =>
      api.patch<IndividualChecklistItem>(
        `/api/individual-checklist/${id}`,
        patch,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["individual-checklist"] }),
  })
}

export function useArchiveIndividualItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<IndividualChecklistItem>(`/api/individual-checklist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["individual-checklist"] }),
  })
}

// ─── APPOINTMENTS ────────────────────────────────────────
export function useAppointmentsInRange(from: string, to: string) {
  return useQuery({
    queryKey: qk.appointments(from, to),
    queryFn: () =>
      api.get<Appointment[]>("/api/appointments", { from, to }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })
}

export function useUpsertAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      patientId: string
      originDate: string
      date?: string
      status: Appointment["status"]
      rescheduledTo?: string | null
      time?: string | null
      checkedItemIds?: string[]
      snapshotItemIds?: string[]
      notes?: string | null
    }) => api.post<Appointment>("/api/appointments", input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["appointments"] }),
  })
}

export function usePatchAppointment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Appointment>
    }) => api.patch<Appointment>(`/api/appointments/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  })
}

// ─── INSURANCES ──────────────────────────────────────────
export function useInsurances() {
  return useQuery({
    queryKey: qk.insurances,
    queryFn: () => api.get<Insurance[]>("/api/insurances"),
    staleTime: 60_000,
  })
}

export function useCreateInsurance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string
      active?: boolean
      defaultValue?: number
    }) => api.post<Insurance>("/api/insurances", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.insurances }),
  })
}

export function useUpdateInsurance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Insurance> }) =>
      api.patch<Insurance>(`/api/insurances/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.insurances }),
  })
}

export function useArchiveInsurance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<Insurance>(`/api/insurances/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.insurances }),
  })
}

// ─── PATIENT DOCUMENTS ───────────────────────────────────
export function usePatientDocuments(patientId?: string) {
  return useQuery({
    queryKey: patientId ? qk.documents(patientId) : ["documents", "none"],
    queryFn: () =>
      api.get<PatientDocument[]>(`/api/patients/${patientId}/documents`),
    enabled: !!patientId,
    staleTime: 15_000,
  })
}

export function useUploadDocument(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) =>
      api.upload<PatientDocument>(
        `/api/patients/${patientId}/documents`,
        file,
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.documents(patientId) }),
  })
}

export function useDeleteDocument(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (filename: string) =>
      api.delete<{ ok: boolean }>(
        `/api/patients/${patientId}/documents/${encodeURIComponent(filename)}`,
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.documents(patientId) }),
  })
}

export function useOpenPatientFolder() {
  return useMutation({
    mutationFn: (patientId: string) =>
      api.post<{ ok: boolean; path: string }>(
        `/api/patients/${patientId}/open-folder`,
      ),
  })
}

// ─── DISCHARGE REASONS ───────────────────────────────────
export function useDischargeReasons() {
  return useQuery({
    queryKey: qk.dischargeReasons,
    queryFn: () => api.get<DischargeReason[]>("/api/discharge-reasons"),
    staleTime: 60_000,
  })
}

export function useCreateDischargeReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; active?: boolean }) =>
      api.post<DischargeReason>("/api/discharge-reasons", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dischargeReasons }),
  })
}

export function useUpdateDischargeReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<DischargeReason>
    }) => api.patch<DischargeReason>(`/api/discharge-reasons/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dischargeReasons }),
  })
}

export function useArchiveDischargeReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<DischargeReason>(`/api/discharge-reasons/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.dischargeReasons }),
  })
}

// ─── PATIENT ANNOTATIONS ─────────────────────────────────
export function usePatientAnnotations(patientId?: string) {
  return useQuery({
    queryKey: qk.annotations(patientId),
    queryFn: () =>
      api.get<PatientAnnotation[]>(
        "/api/patient-annotations",
        patientId ? { patientId } : undefined,
      ),
    enabled: !!patientId,
    staleTime: 30_000,
  })
}

export function useCreatePatientAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { patientId: string; text: string }) =>
      api.post<PatientAnnotation>("/api/patient-annotations", input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.annotations(vars.patientId) })
      qc.invalidateQueries({ queryKey: qk.annotations() })
    },
  })
}

export function useDeletePatientAnnotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<PatientAnnotation>(`/api/patient-annotations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotations"] }),
  })
}
