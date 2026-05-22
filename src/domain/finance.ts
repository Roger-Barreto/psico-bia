import type { Appointment, Patient } from "@/db/types"

export function effectiveValue(
  appt: Appointment,
  patient: Patient | undefined,
): number {
  if (appt.paidValue !== null && appt.paidValue !== undefined) {
    return appt.paidValue
  }
  return patient?.consultationValue ?? 0
}

/**
 * Sum of paid sessions in the given appointment list.
 */
export function totalRevenue(
  appts: Appointment[],
  patientsById: Map<string, Patient>,
): number {
  let sum = 0
  for (const a of appts) {
    if (!a.paid) continue
    sum += effectiveValue(a, patientsById.get(a.patientId))
  }
  return sum
}

/**
 * Sum of pending revenue: attended sessions not paid + scheduled-past sessions.
 * For scheduled-past, uses patient.consultationValue as expectation.
 */
export function pendingRevenue(
  appts: Appointment[],
  patientsById: Map<string, Patient>,
  today: string,
): number {
  let sum = 0
  for (const a of appts) {
    const patient = patientsById.get(a.patientId)
    if (!patient) continue
    if (a.status === "attended" && !a.paid) {
      sum += effectiveValue(a, patient)
    } else if (a.status === "scheduled" && a.date < today) {
      sum += patient.consultationValue ?? 0
    }
  }
  return sum
}

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}
