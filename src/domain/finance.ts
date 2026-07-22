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

/**
 * Months materialized ahead of the current one, so recurring launches — and the
 * card invoices they fall into (invoices land 1–2 months after competência) —
 * show for the next few months without having to navigate there first.
 */
export const MATERIALIZE_AHEAD_MONTHS = 3

/** The default period recurring rows are materialized up to (current + ahead). */
export function materializeUntilPeriod(): string {
  return addPeriod(todayPeriod(), MATERIALIZE_AHEAD_MONTHS)
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

/** Minimal shape ledgerTotals needs — lets synthetic rows (card invoices) in. */
export type LedgerTotalsInput = Pick<LedgerEntry, "kind" | "amount" | "settled">

export function ledgerTotals(entries: LedgerTotalsInput[]): LedgerTotals {
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
// Credit card invoices (faturas) — pure helpers, mirror the SQL trigger
// ════════════════════════════════════════════════════════════════

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Last calendar day of a 1-based month. */
function lastDayOfMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

export interface InvoiceDates {
  period: string // YYYY-MM (month the invoice is due)
  closeDate: string // YYYY-MM-DD — dia de fechamento
  dueDate: string // YYYY-MM-DD — dia de vencimento
}

/**
 * Which invoice a purchase on `dateISO` falls into, given the card's closing
 * and due days. Mirrors `public.finance_card_invoice` in SQL 1:1 so the
 * client preview matches what the trigger stores.
 */
export function cardInvoiceFor(
  closingDay: number,
  dueDay: number,
  dateISO: string,
): InvoiceDates {
  const y = Number(dateISO.slice(0, 4))
  const m = Number(dateISO.slice(5, 7))
  const d = Number(dateISO.slice(8, 10))

  const effClose = Math.min(closingDay, lastDayOfMonth(y, m))
  let cy = y
  let cm = m
  // On the closing day itself the invoice is already closed → next invoice
  // ("a partir do dia de fechamento", melhor dia de compra). Mirrors SQL.
  if (d >= effClose) {
    cm = m + 1
    if (cm > 12) {
      cm = 1
      cy = y + 1
    }
  }

  let dy = cy
  let dmo = cm
  if (dueDay <= closingDay) {
    dmo = cm + 1
    if (dmo > 12) {
      dmo = 1
      dy = cy + 1
    }
  }

  const closeD = Math.min(closingDay, lastDayOfMonth(cy, cm))
  const dueD = Math.min(dueDay, lastDayOfMonth(dy, dmo))
  return {
    period: `${dy}-${pad2(dmo)}`,
    closeDate: `${cy}-${pad2(cm)}-${pad2(closeD)}`,
    dueDate: `${dy}-${pad2(dmo)}-${pad2(dueD)}`,
  }
}

/**
 * Close/due dates of the invoice due in `period` (YYYY-MM). Used to render an
 * empty (future/current) invoice that has no transactions yet.
 */
export function invoiceDatesForPeriod(
  closingDay: number,
  dueDay: number,
  period: string,
): InvoiceDates {
  const dy = Number(period.slice(0, 4))
  const dmo = Number(period.slice(5, 7))
  let cy = dy
  let cm = dmo
  if (dueDay <= closingDay) {
    // due comes the month after closing → close month is one before the due month
    cm = dmo - 1
    if (cm < 1) {
      cm = 12
      cy = dy - 1
    }
  }
  const closeD = Math.min(closingDay, lastDayOfMonth(cy, cm))
  const dueD = Math.min(dueDay, lastDayOfMonth(dy, dmo))
  return {
    period,
    closeDate: `${cy}-${pad2(cm)}-${pad2(closeD)}`,
    dueDate: `${dy}-${pad2(dmo)}-${pad2(dueD)}`,
  }
}

/** Period of the invoice currently open for purchases (based on today). */
export function currentInvoicePeriod(
  closingDay: number,
  dueDay: number,
): string {
  return cardInvoiceFor(closingDay, dueDay, todayISO()).period
}

export type InvoiceStatus = "open" | "closed" | "paid"

export interface CardInvoice {
  period: string
  closeDate: string
  dueDate: string
  entries: LedgerEntry[]
  /** Net amount owed (expenses positive, refunds/credits negative). */
  total: number
  paidTotal: number // settled portion
  openTotal: number // still to pay
  count: number
  status: InvoiceStatus
}

/** Signed contribution of a card entry to its invoice (expense +, income −). */
function invoiceSigned(e: LedgerEntry): number {
  return e.kind === "expense" ? e.amount : -e.amount
}

/**
 * Summarize the invoice for `period`: totals, paid/open split and status.
 * Uses the dates stored on the transactions; falls back to the card config
 * for an empty invoice.
 */
export function summarizeInvoice(
  period: string,
  entries: LedgerEntry[],
  card: { closingDay: number; dueDay: number },
  today: string = todayISO(),
): CardInvoice {
  const inv = entries.filter((e) => e.invoicePeriod === period)
  let total = 0
  let paidTotal = 0
  let openTotal = 0
  for (const e of inv) {
    const v = invoiceSigned(e)
    total += v
    if (e.settled) paidTotal += v
    else openTotal += v
  }
  const dates =
    inv.find((e) => e.invoiceCloseDate && e.invoiceDueDate) ?? null
  const closeDate =
    dates?.invoiceCloseDate ??
    invoiceDatesForPeriod(card.closingDay, card.dueDay, period).closeDate
  const dueDate =
    dates?.invoiceDueDate ??
    invoiceDatesForPeriod(card.closingDay, card.dueDay, period).dueDate

  const paid = inv.length > 0 && Math.abs(openTotal) < 0.005
  const status: InvoiceStatus = paid
    ? "paid"
    : closeDate <= today
      ? "closed"
      : "open"

  return {
    period,
    closeDate,
    dueDate,
    entries: inv,
    total,
    paidTotal,
    openTotal,
    count: inv.length,
    status,
  }
}

/** Distinct invoice periods present in the entries, newest first. */
export function invoicePeriods(entries: LedgerEntry[]): string[] {
  const set = new Set<string>()
  for (const e of entries) if (e.invoicePeriod) set.add(e.invoicePeriod)
  return [...set].sort((a, b) => b.localeCompare(a))
}

/** Net amount still owed on the card across every unsettled entry (used limit). */
export function cardOpenTotal(entries: LedgerEntry[]): number {
  let sum = 0
  for (const e of entries) {
    if (e.settled) continue
    sum += invoiceSigned(e)
  }
  return sum
}

export interface CardInvoiceSummary {
  cardId: string
  period: string // YYYY-MM da fatura (mês de vencimento)
  closeDate: string
  dueDate: string
  amount: number // líquido (compras − estornos)
  settled: boolean // toda a fatura quitada
  count: number
}

/**
 * Aggregate card-linked entries into one summary per (card, invoice period).
 * Dates come from what is stored on the transactions (history-preserving);
 * when parcels disagree (card days edited midway) the latest due date wins.
 */
export function cardInvoiceSummaries(
  entries: LedgerEntry[],
): CardInvoiceSummary[] {
  const map = new Map<string, CardInvoiceSummary>()
  for (const e of entries) {
    if (!e.cardId || !e.invoicePeriod) continue
    const key = `${e.cardId}|${e.invoicePeriod}`
    let s = map.get(key)
    if (!s) {
      s = {
        cardId: e.cardId,
        period: e.invoicePeriod,
        closeDate: e.invoiceCloseDate ?? "",
        dueDate: e.invoiceDueDate ?? "",
        amount: 0,
        settled: true,
        count: 0,
      }
      map.set(key, s)
    }
    s.amount += invoiceSigned(e)
    if (!e.settled) s.settled = false
    s.count += 1
    if (e.invoiceDueDate && e.invoiceDueDate > s.dueDate) {
      s.dueDate = e.invoiceDueDate
      s.closeDate = e.invoiceCloseDate ?? s.closeDate
    }
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period))
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

/** True when every whitespace-separated token of `query` occurs in `hay`. */
export function matchesTokens(hay: string, query: string): boolean {
  const q = foldText(query.trim())
  if (!q) return true
  const h = foldText(hay)
  return q.split(/\s+/).every((tok) => h.includes(tok))
}

/** True when every whitespace-separated token of `query` is present. */
export function matchesLedgerQuery(
  e: LedgerEntry,
  query: string,
  parts: { method?: string; person?: string } = {},
): boolean {
  return matchesTokens(ledgerSearchText(e, parts), query)
}
