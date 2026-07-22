import { useMemo, useState } from "react"
import {
  useAllCofrinhoEntries,
  useCofrinhos,
  useCofrinhoWithdrawals,
  useFinanceCategories,
  useLedgerRange,
  usePaymentMethods,
  usePeople,
} from "@/api/queries"
import {
  addPeriod,
  ledgerTotals,
  periodShort,
  todayPeriod,
  yearStartPeriod,
} from "@/domain/finance"
import {
  cofrinhoSlots,
  incomeByDay,
  monthlyDeposited,
} from "@/domain/cofrinhos"
import { Breadcrumbs } from "@/components/breadcrumbs"
import {
  FinanceDashboard,
  type CofrinhoBalance,
  type CofrinhoGoal,
} from "@/components/finance/finance-dashboard"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

const RANGES = [
  { id: "1", label: "Mês atual", months: 1 },
  { id: "3", label: "3 meses", months: 3 },
  { id: "6", label: "6 meses", months: 6 },
  { id: "12", label: "12 meses", months: 12 },
  { id: "year", label: "Este ano", months: 0 },
] as const

export function FinanceDashboardPage() {
  const [rangeId, setRangeId] = useState<string>("1")

  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const categoriesQ = useFinanceCategories()

  const toPeriod = todayPeriod()
  const fromPeriod = useMemo(() => {
    const r = RANGES.find((x) => x.id === rangeId) ?? RANGES[2]
    return r.id === "year"
      ? yearStartPeriod(toPeriod)
      : addPeriod(toPeriod, -(r.months - 1))
  }, [rangeId, toPeriod])

  const rangeQ = useLedgerRange(fromPeriod, toPeriod)
  const entries = rangeQ.data ?? []

  // Accumulated balance since January (independent of the selected range).
  const ytdQ = useLedgerRange(yearStartPeriod(toPeriod), toPeriod)
  const accumulated = useMemo(
    () => ledgerTotals(ytdQ.data ?? []).balance,
    [ytdQ.data],
  )

  const methodsById = useMemo(
    () => new Map((methodsQ.data ?? []).map((m) => [m.id, m] as const)),
    [methodsQ.data],
  )
  const peopleById = useMemo(
    () => new Map((peopleQ.data ?? []).map((p) => [p.id, p] as const)),
    [peopleQ.data],
  )
  const categoriesById = useMemo(
    () => new Map((categoriesQ.data ?? []).map((c) => [c.id, c] as const)),
    [categoriesQ.data],
  )

  // Cofrinho reserves (balance per cofrinho = deposits − withdrawals).
  const cofrinhosQ = useCofrinhos()
  const cofEntriesQ = useAllCofrinhoEntries()
  const cofWithdrawalsQ = useCofrinhoWithdrawals()
  const cofrinhoBalances = useMemo<CofrinhoBalance[]>(() => {
    const deposits = new Map<string, number>()
    for (const e of cofEntriesQ.data ?? []) {
      if (e.kind === "deposit")
        deposits.set(e.cofrinhoId, (deposits.get(e.cofrinhoId) ?? 0) + e.amount)
    }
    const withdrawals = cofWithdrawalsQ.data ?? new Map<string, number>()
    return (cofrinhosQ.data ?? [])
      .filter((c) => c.active)
      .map((c) => ({
        name: c.name,
        value:
          (c.initialAmount ?? 0) +
          (deposits.get(c.id) ?? 0) -
          (withdrawals.get(c.id) ?? 0),
        color: c.color ?? colorForKey(c.name),
      }))
      .sort((a, b) => b.value - a.value)
  }, [cofrinhosQ.data, cofEntriesQ.data, cofWithdrawalsQ.data])

  const cofrinhoMonthly = useMemo(
    () =>
      monthlyDeposited(cofEntriesQ.data ?? [], fromPeriod, toPeriod).map((p) => ({
        label: periodShort(p.period),
        total: p.total,
      })),
    [cofEntriesQ.data, fromPeriod, toPeriod],
  )

  // Goal vs saved per cofrinho, summed over every month in the range.
  const cofrinhoGoals = useMemo<CofrinhoGoal[]>(() => {
    const active = (cofrinhosQ.data ?? []).filter((c) => c.active)
    const cofEntries = cofEntriesQ.data ?? []
    const incomeAll = incomeByDay(entries, "all")
    const incomeClinic = incomeByDay(entries, "clinic")
    // Reserve balance per cofrinho — caps the 'target' monthly slots.
    const depositsById = new Map<string, number>()
    for (const e of cofEntries)
      if (e.kind === "deposit")
        depositsById.set(
          e.cofrinhoId,
          (depositsById.get(e.cofrinhoId) ?? 0) + e.amount,
        )
    const withdrawals = cofWithdrawalsQ.data ?? new Map<string, number>()
    const periods: string[] = []
    let p = fromPeriod
    while (p <= toPeriod) {
      periods.push(p)
      p = addPeriod(p, 1)
    }
    return active
      .map((c) => {
        const income = c.incomeScope === "clinic" ? incomeClinic : incomeAll
        const balance =
          (c.initialAmount ?? 0) +
          (depositsById.get(c.id) ?? 0) -
          (withdrawals.get(c.id) ?? 0)
        let meta = 0
        let saved = 0
        for (const per of periods) {
          for (const s of cofrinhoSlots(c, per, income, cofEntries, balance)) {
            meta += s.expected
            saved += s.saved
          }
        }
        return {
          name: c.name,
          color: c.color ?? colorForKey(c.name),
          meta: Math.round(meta * 100) / 100,
          saved: Math.round(saved * 100) / 100,
        }
      })
      .filter((x) => x.meta > 0.005 || x.saved > 0.005)
  }, [
    cofrinhosQ.data,
    cofEntriesQ.data,
    cofWithdrawalsQ.data,
    entries,
    fromPeriod,
    toPeriod,
  ])

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Financeiro" }, { label: "Dashboard" }]} />
        <h1 className="text-2xl font-semibold tracking-tight">
          Dashboard financeiro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Receitas, despesas e saldos por período.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRangeId(r.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              rangeId === r.id
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {rangeQ.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando…
        </p>
      ) : (
        <FinanceDashboard
          entries={entries}
          methodsById={methodsById}
          peopleById={peopleById}
          categoriesById={categoriesById}
          fromPeriod={fromPeriod}
          toPeriod={toPeriod}
          accumulated={accumulated}
          cofrinhoBalances={cofrinhoBalances}
          cofrinhoMonthly={cofrinhoMonthly}
          cofrinhoGoals={cofrinhoGoals}
        />
      )}
    </div>
  )
}
