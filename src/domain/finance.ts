import type {
  Appointment,
  LedgerEntry,
  Patient,
  TransactionKind,
} from "@/db/types"
import { formatDateBR, formatLongDateBR, todayISO } from "@/domain/dates"

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

// ════════════════════════════════════════════════════════════════
// Finance module — pure helpers (no React, no fetch)
// ════════════════════════════════════════════════════════════════

const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

/** YYYY-MM-DD → YYYY-MM */
export function periodOf(iso: string): string {
  return iso.slice(0, 7)
}

export function todayPeriod(): string {
  return todayISO().slice(0, 7)
}

/** Shift a YYYY-MM period by N months (can be negative). */
export function addPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number)
  const idx = m - 1 + months
  const year = y + Math.floor(idx / 12)
  const mi = ((idx % 12) + 12) % 12
  return `${year}-${String(mi + 1).padStart(2, "0")}`
}

/** YYYY-MM → the January period of its year, "YYYY-01". */
export function yearStartPeriod(period: string): string {
  return `${period.slice(0, 4)}-01`
}

/** YYYY-MM → "junho de 2026" */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number)
  if (!y || !m) return period
  return `${MONTHS_LONG[m - 1]} de ${y}`
}

/** YYYY-MM → "jun/26" */
export function periodShort(period: string): string {
  const [y, m] = period.split("-").map(Number)
  if (!y || !m) return period
  return `${MONTHS_LONG[m - 1].slice(0, 3)}/${String(y).slice(2)}`
}

/**
 * Shift an ISO date by N months, clamping the day to the target month's
 * last day (e.g. Jan 31 + 1 month → Feb 28/29). Mirrors the monthly
 * recurrence fallback used for appointment series.
 */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const idx = m - 1 + months
  const year = y + Math.floor(idx / 12)
  const mi = ((idx % 12) + 12) % 12
  const lastDay = new Date(year, mi + 1, 0).getDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Competence date of each installment: month 1 = start, then +1 month each. */
export function installmentDates(startISO: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonthsISO(startISO, i))
}

/**
 * Split a total into N equal installments (2-decimal BRL). The last
 * installment absorbs the rounding remainder, so the sum is exact.
 */
export function splitInstallments(total: number, n: number): number[] {
  if (n <= 0) return []
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / n)
  const out = Array.from({ length: n }, () => base / 100)
  const remainder = cents - base * n
  out[n - 1] = (base + remainder) / 100
  return out
}

/** Signed value: income positive, expense negative. */
export function signedAmount(e: {
  kind: TransactionKind
  amount: number
}): number {
  return e.kind === "income" ? e.amount : -e.amount
}

export interface LedgerTotals {
  income: number
  expense: number
  balance: number // income − expense (all)
  receivable: number // income not settled
  payable: number // expense not settled
  realizedBalance: number // settled income − settled expense
}

export function ledgerTotals(entries: LedgerEntry[]): LedgerTotals {
  let income = 0
  let expense = 0
  let receivable = 0
  let payable = 0
  let incomeSettled = 0
  let expenseSettled = 0
  for (const e of entries) {
    if (e.kind === "income") {
      income += e.amount
      if (e.settled) incomeSettled += e.amount
      else receivable += e.amount
    } else {
      expense += e.amount
      if (e.settled) expenseSettled += e.amount
      else payable += e.amount
    }
  }
  return {
    income,
    expense,
    balance: income - expense,
    receivable,
    payable,
    realizedBalance: incomeSettled - expenseSettled,
  }
}

/** Sum of raw amounts grouped by a key (null keys dropped). */
export function groupAmount(
  entries: LedgerEntry[],
  keyFn: (e: LedgerEntry) => string | null,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of entries) {
    const k = keyFn(e)
    if (k == null) continue
    out.set(k, (out.get(k) ?? 0) + e.amount)
  }
  return out
}

export interface MonthlyPoint {
  period: string
  income: number
  expense: number
  balance: number
}

/** Income/expense/balance per period across [fromPeriod, toPeriod]. */
export function monthlySeries(
  entries: LedgerEntry[],
  fromPeriod: string,
  toPeriod: string,
): MonthlyPoint[] {
  const byPeriod = new Map<string, { income: number; expense: number }>()
  let p = fromPeriod
  while (p <= toPeriod) {
    byPeriod.set(p, { income: 0, expense: 0 })
    p = addPeriod(p, 1)
  }
  for (const e of entries) {
    const slot = byPeriod.get(e.period)
    if (!slot) continue
    if (e.kind === "income") slot.income += e.amount
    else slot.expense += e.amount
  }
  return [...byPeriod.entries()].map(([period, v]) => ({
    period,
    income: v.income,
    expense: v.expense,
    balance: v.income - v.expense,
  }))
}

export interface PersonBalance {
  receivable: number // they owe me (unsettled income loans)
  payable: number // I owe them (unsettled expense loans)
  net: number // receivable − payable (positive = they owe me)
}

/**
 * Net loan balance with a person. Expects entries already filtered to that
 * person. Only unsettled loans count toward the outstanding balance.
 */
export function personBalance(entries: LedgerEntry[]): PersonBalance {
  let receivable = 0
  let payable = 0
  for (const e of entries) {
    if (e.settled) continue
    if (e.kind === "income") receivable += e.amount
    else payable += e.amount
  }
  return { receivable, payable, net: receivable - payable }
}

// ════════════════════════════════════════════════════════════════
// Ledger search — accent-insensitive, multi-token over every field
// ════════════════════════════════════════════════════════════════

/** Lowercase + strip diacritics so "Clínica" matches "clinica". */
function foldText(s: string): string {
  // U+0300–U+036F = combining diacritical marks split out by NFD.
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

/**
 * Full searchable text of a ledger entry: description, value, category,
 * payment method, person, date, scope and settlement status. The caller
 * resolves method/person names (it holds the lookup maps).
 */
export function ledgerSearchText(
  e: LedgerEntry,
  parts: { method?: string; person?: string } = {},
): string {
  const income = e.kind === "income"
  const status = e.settled
    ? income
      ? "recebido quitado"
      : "pago quitado"
    : income
      ? "a receber pendente"
      : "a pagar pendente"
  const bits = [
    e.description,
    e.categoryName ?? "sem categoria",
    parts.method ?? "",
    parts.person ?? "",
    e.scope === "clinic" ? "clínica pj" : "pessoal pf",
    income ? "receita entrada" : "despesa saída",
    status,
    formatBRL(e.amount),
    String(e.amount),
    formatLongDateBR(e.date),
    formatDateBR(e.date),
    e.date,
    e.installmentTotal ? `${e.installmentNo}/${e.installmentTotal}` : "",
  ]
  return foldText(bits.join(" "))
}

/** True when every whitespace-separated token of `query` is present. */
export function matchesLedgerQuery(
  e: LedgerEntry,
  query: string,
  parts: { method?: string; person?: string } = {},
): boolean {
  const q = foldText(query.trim())
  if (!q) return true
  const hay = ledgerSearchText(e, parts)
  return q.split(/\s+/).every((tok) => hay.includes(tok))
}
