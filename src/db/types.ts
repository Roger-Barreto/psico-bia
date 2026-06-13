export type Gender = "male" | "female" | "other"
export type Frequency = "weekly" | "biweekly" | "monthly"
export type AppointmentStatus =
  | "scheduled"
  | "attended"
  | "missed"
  | "rescheduled"
  | "cancelled"

export interface Patient {
  id: string
  name: string
  gender: Gender
  birthdate: string
  avatarId: number
  active: boolean
  createdAt: string
  consultationValue: number
  insuranceId: string | null
  individualChecklistItemIds: string[]
  dischargedAt: string | null
  dischargeReasonId: string | null
}

export interface AppointmentSeries {
  id: string
  patientId: string
  startDate: string
  time: string
  frequency: Frequency | null
  endDate: string | null
  createdAt: string
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
  seriesId: string
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
  paymentMethodId: string | null
}

export interface Occurrence {
  seriesId: string
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

// ════════════════════════════════════════════════════════════════
// Finance module
// ════════════════════════════════════════════════════════════════
export type TransactionKind = "income" | "expense"
export type FinanceScope = "clinic" | "personal"
export type LedgerSource = "manual" | "clinic"
/** Edit/delete scope for recurring rules (mirrors appointment "undo" scopes). */
export type RecurringScope = "one" | "future" | "all"

export interface Person {
  id: string
  name: string
  notes: string | null
  active: boolean
  createdAt: string
}

export interface FinanceCategory {
  id: string
  name: string
  color: string | null
  active: boolean
  createdAt: string
}

export interface PaymentMethod {
  id: string
  name: string
  isLoan: boolean
  active: boolean
  createdAt: string
}

export interface RecurringRule {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  categoryId: string | null
  paymentMethodId: string | null
  personId: string | null
  dayOfMonth: number
  startPeriod: string // YYYY-MM
  active: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  date: string // YYYY-MM-DD (competência)
  categoryId: string | null
  paymentMethodId: string | null
  personId: string | null
  settled: boolean
  settledAt: string | null
  recurringRuleId: string | null
  installmentGroup: string | null
  installmentNo: number | null
  installmentTotal: number | null
  linkId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Unified ledger row: manual transactions + derived (read-only) clinic income.
 * Backed by the `finance_ledger` Postgres view.
 */
export interface LedgerEntry {
  id: string
  kind: TransactionKind
  scope: FinanceScope
  description: string
  amount: number
  date: string
  period: string // YYYY-MM
  categoryId: string | null
  categoryName: string | null
  paymentMethodId: string | null
  personId: string | null
  settled: boolean
  settledAt: string | null
  recurringRuleId: string | null
  installmentGroup: string | null
  installmentNo: number | null
  installmentTotal: number | null
  linkId: string | null
  source: LedgerSource
  editable: boolean
  patientId: string | null
}
