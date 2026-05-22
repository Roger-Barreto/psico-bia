export type Gender = "male" | "female" | "other"
export type Recurrence = "once" | "weekly" | "biweekly" | "monthly"
export type AppointmentStatus =
  | "scheduled"
  | "attended"
  | "missed"
  | "rescheduled"
  | "cancelled"

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface RecurrenceSegment {
  activeFrom: string
  recurrence: Recurrence
  defaultWeekday: Weekday
  anchorDate: string
  defaultTime: string
}

export interface Patient {
  id: string
  name: string
  gender: Gender
  age: number
  defaultWeekday: Weekday
  recurrence: Recurrence
  anchorDate: string
  defaultTime: string
  recurrenceHistory: RecurrenceSegment[]
  individualChecklistItemIds: string[]
  active: boolean
  createdAt: string
  consultationValue: number
  insuranceId: string | null
  dischargedAt: string | null
  dischargeReasonId: string | null
}

export interface Insurance {
  id: string
  name: string
  active: boolean
  createdAt: string
  defaultValue: number
}

export interface DischargeReason {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export interface PatientDocument {
  filename: string
  size: number
  modifiedAt: string
}

export interface SharedChecklistItem {
  id: string
  label: string
  order: number
  archived: boolean
}

export interface IndividualChecklistItem extends SharedChecklistItem {
  patientId: string
}

export interface Appointment {
  id: string
  patientId: string
  date: string
  originDate: string
  status: AppointmentStatus
  rescheduledTo: string | null
  time: string | null
  checkedItemIds: string[]
  snapshotItemIds: string[]
  notes: string | null
  updatedAt: string
  paid: boolean
  paidValue: number | null
  paidAt: string | null
}

export interface Occurrence {
  patientId: string
  originDate: string
  date: string
  time: string
  appointment: Appointment | null
  pendencyCount: number
}

export interface PatientAnnotation {
  id: string
  patientId: string
  text: string
  createdAt: string
}
