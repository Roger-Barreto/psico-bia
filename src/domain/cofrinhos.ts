import type {
  Cofrinho,
  CofrinhoEntry,
  CofrinhoIncomeScope,
  LedgerEntry,
} from "@/db/types"
import { addPeriod, periodOf } from "@/domain/finance"

// ════════════════════════════════════════════════════════════════
// Cofrinhos — pure helpers (no React, no fetch). Expected saving slots
// are computed here from the goal config + received income; only the
// user's resolutions (deposit/skip) and planned obligations (repay/
// rollover) are stored in finance_cofrinho_entries.
// ════════════════════════════════════════════════════════════════

/**
 * Net of a cofrinho's own entries: deposits add, withdraws (cash-out / transfer
 * out) subtract. Skips/plans don't move money. Not scoped by cofrinho — filter
 * first if needed.
 */
export function entriesNet(entries: CofrinhoEntry[]): number {
  let net = 0
  for (const e of entries) {
    if (e.kind === "deposit") net += e.amount
    else if (e.kind === "withdraw") net -= e.amount
  }
  return net
}

/**
 * Reserve balance = initial + deposits − entry-withdraws − ledger-withdrawals
 * (purchases paid from the cofrinho).
 */
export function cofrinhoBalance(
  entries: CofrinhoEntry[],
  withdrawals: LedgerEntry[],
  initial = 0,
): number {
  let withdrawn = 0
  for (const w of withdrawals) {
    // a purchase paid with the cofrinho is an expense funded by the reserve
    withdrawn += w.kind === "expense" ? w.amount : -w.amount
  }
  return initial + entriesNet(entries) - withdrawn
}

/** Total deposited into a cofrinho in a given YYYY-MM. */
export function depositedInPeriod(
  entries: CofrinhoEntry[],
  period: string,
): number {
  let sum = 0
  for (const e of entries) {
    if (e.kind === "deposit" && e.period === period) sum += e.amount
  }
  return sum
}

/**
 * Received income per day (YYYY-MM-DD → amount) for a cofrinho's percent base.
 * "Received" = kind='income' && settled. `scope='clinic'` restricts to clinic
 * revenue; `'all'` includes personal income too.
 */
export function incomeByDay(
  entries: LedgerEntry[],
  scope: CofrinhoIncomeScope,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of entries) {
    if (e.kind !== "income" || !e.settled) continue
    if (scope === "clinic" && e.scope !== "clinic") continue
    m.set(e.date, (m.get(e.date) ?? 0) + e.amount)
  }
  return m
}

export type CofrinhoSlotSource =
  | "fixed"
  | "percent"
  | "rollover"
  | "repay"
  | "repeat"
export type CofrinhoSlotStatus = "pending" | "saved" | "partial" | "skipped"

/** One expected-saving prompt for a cofrinho on a given day. */
export interface CofrinhoSlot {
  cofrinhoId: string
  slotKey: string // fixed:YYYY-MM | pct:YYYY-MM-DD | plan:<id>
  date: string // YYYY-MM-DD (where the prompt shows on the ledger)
  period: string // YYYY-MM
  source: CofrinhoSlotSource
  expected: number
  saved: number
  pending: number
  skipped: boolean
  status: CofrinhoSlotStatus
  planId?: string // for stored plans (repay/rollover)
  purchaseTxId?: string | null // for repay plans: the purchase being repaid
}

/** Day (YYYY-MM-DD) from which a cofrinho's goals apply — its creation date. */
export function cofrinhoStartDate(cofrinho: { createdAt: string }): string {
  return cofrinho.createdAt.slice(0, 10)
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

function statusOf(expected: number, saved: number, skipped: boolean): CofrinhoSlotStatus {
  if (skipped) return "skipped"
  if (saved <= 0.005) return "pending"
  if (saved + 0.005 >= expected) return "saved"
  return "partial"
}

/**
 * Compute the cofrinho's expected-saving slots for one month, reconciled
 * against stored deposits/skips. Handles the goal sources:
 * - fixed  → one slot on `fixedDay` (expected = fixedAmount)
 * - percent→ one slot per day with received income (expected = %·income),
 *   which recomputes live and shows a "complemento" when income grows
 * - target → like fixed when a monthly saving is set, but capped at what is
 *   still missing to reach `targetAmount` — needs `balance`; once the goal
 *   is met, no more prompts (goalType 'none' never prompts)
 * - plans  → repay/rollover obligations stored as entries (kind='plan')
 */
export function cofrinhoSlots(
  cofrinho: Cofrinho,
  period: string,
  income: Map<string, number>,
  entries: CofrinhoEntry[],
  /** Current reserve balance — required to cap 'target' monthly slots. */
  balance = 0,
): CofrinhoSlot[] {
  const mine = entries.filter((e) => e.cofrinhoId === cofrinho.id)
  // Goals only apply from the cofrinho's creation date onward (no retroactive).
  const start = cofrinhoStartDate(cofrinho)
  const depositsBySlot = new Map<string, number>()
  const skippedSlots = new Set<string>()
  for (const e of mine) {
    if (!e.slotKey) continue
    if (e.kind === "deposit")
      depositsBySlot.set(e.slotKey, (depositsBySlot.get(e.slotKey) ?? 0) + e.amount)
    else if (e.kind === "skip") skippedSlots.add(e.slotKey)
  }

  const out: CofrinhoSlot[] = []
  const push = (
    slotKey: string,
    date: string,
    source: CofrinhoSlotSource,
    expected: number,
    planId?: string,
    purchaseTxId?: string | null,
  ) => {
    const saved = roundCents(depositsBySlot.get(slotKey) ?? 0)
    const skipped = skippedSlots.has(slotKey)
    const pending = skipped ? 0 : Math.max(0, roundCents(expected - saved))
    // Hide a slot that has nothing expected and nothing done (e.g. %-day of 0).
    if (expected <= 0.005 && saved <= 0.005 && !skipped) return
    out.push({
      cofrinhoId: cofrinho.id,
      slotKey,
      date,
      period,
      source,
      expected: roundCents(expected),
      saved,
      pending,
      skipped,
      status: statusOf(expected, saved, skipped),
      planId,
      purchaseTxId,
    })
  }

  // A paused cofrinho keeps its balance and stored plans, but its automatic
  // monthly/percent goal prompts stop showing until it is resumed.
  if (!cofrinho.paused) {
    if (cofrinho.goalType === "fixed" && cofrinho.fixedAmount && cofrinho.fixedDay) {
      const day = String(Math.min(31, cofrinho.fixedDay)).padStart(2, "0")
      const date = `${period}-${day}`
      if (date >= start) push(`fixed:${period}`, date, "fixed", cofrinho.fixedAmount)
    }

    // Target goal with an optional monthly saving: prompt like a fixed goal,
    // capped at what is still missing to reach the target. The cap excludes
    // this slot's own deposits so the expected value stays stable while the
    // user saves against it; once the goal is met, no further prompts.
    if (
      cofrinho.goalType === "target" &&
      cofrinho.fixedAmount &&
      cofrinho.fixedDay
    ) {
      const day = String(Math.min(31, cofrinho.fixedDay)).padStart(2, "0")
      const date = `${period}-${day}`
      const slotKey = `fixed:${period}`
      if (date >= start) {
        const savedThisSlot = depositsBySlot.get(slotKey) ?? 0
        const target = cofrinho.targetAmount ?? 0
        const missing =
          target > 0
            ? Math.max(0, roundCents(target - (balance - savedThisSlot)))
            : cofrinho.fixedAmount
        push(slotKey, date, "fixed", Math.min(cofrinho.fixedAmount, missing))
      }
    }

    if (cofrinho.goalType === "percent" && cofrinho.percent) {
      for (const [date, amount] of income) {
        if (periodOf(date) !== period || date < start) continue
        const expected = (cofrinho.percent / 100) * amount
        push(`pct:${date}`, date, "percent", expected)
      }
    }
  }

  // Stored plans (repay / rollover / scheduled repeat) due in this period.
  // These are explicit commitments, so they show even while paused.
  for (const e of mine) {
    if (e.kind !== "plan" || e.period !== period) continue
    const slotKey = `plan:${e.id}`
    const saved = roundCents(
      mine
        .filter((d) => d.kind === "deposit" && d.slotKey === slotKey)
        .reduce((s, d) => s + d.amount, 0),
    )
    const skipped = mine.some(
      (s) => s.kind === "skip" && s.slotKey === slotKey,
    )
    const expected = roundCents(e.expected ?? 0)
    const pending = skipped ? 0 : Math.max(0, roundCents(expected - saved))
    out.push({
      cofrinhoId: cofrinho.id,
      slotKey,
      date: e.date,
      period,
      source:
        e.source === "rollover"
          ? "rollover"
          : e.source === "repeat"
            ? "repeat"
            : "repay",
      expected,
      saved,
      pending,
      skipped,
      status: statusOf(expected, saved, skipped),
      planId: e.id,
      purchaseTxId: e.purchaseTxId,
    })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** The month that follows `period` (YYYY-MM). Used for fixed-goal rollover. */
export function nextPeriod(period: string): string {
  return addPeriod(period, 1)
}

/** Total deposited grouped by source (fixed/percent/rollover/repay/manual). */
export function depositsBySource(
  entries: CofrinhoEntry[],
): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of entries) {
    if (e.kind !== "deposit") continue
    m.set(e.source, (m.get(e.source) ?? 0) + e.amount)
  }
  return m
}

/** Deposited total per month across [fromPeriod, toPeriod] (inclusive). */
export function monthlyDeposited(
  entries: CofrinhoEntry[],
  fromPeriod: string,
  toPeriod: string,
): { period: string; total: number }[] {
  const by = new Map<string, number>()
  let p = fromPeriod
  while (p <= toPeriod) {
    by.set(p, 0)
    p = addPeriod(p, 1)
  }
  for (const e of entries) {
    if (e.kind !== "deposit") continue
    if (by.has(e.period)) by.set(e.period, (by.get(e.period) ?? 0) + e.amount)
  }
  return [...by.entries()].map(([period, total]) => ({ period, total }))
}

/** Cumulative reserve after each month (initial + deposits − withdrawals). */
export function reserveTimeline(
  entries: CofrinhoEntry[],
  withdrawals: LedgerEntry[],
  fromPeriod: string,
  toPeriod: string,
  initial = 0,
): { period: string; balance: number }[] {
  const delta = new Map<string, number>()
  const add = (period: string, v: number) =>
    delta.set(period, (delta.get(period) ?? 0) + v)
  for (const e of entries) {
    if (e.kind === "deposit") add(e.period, e.amount)
    else if (e.kind === "withdraw") add(e.period, -e.amount)
  }
  for (const w of withdrawals)
    add(w.period, -(w.kind === "expense" ? w.amount : -w.amount))

  const out: { period: string; balance: number }[] = []
  let running = initial
  // fold everything before the window into the opening balance
  for (const [p, v] of delta) if (p < fromPeriod) running += v
  let p = fromPeriod
  while (p <= toPeriod) {
    running += delta.get(p) ?? 0
    out.push({ period: p, balance: roundCents(running) })
    p = addPeriod(p, 1)
  }
  return out
}
