import { useEffect, useMemo, useState } from "react"
import {
  useAllCofrinhoEntries,
  useCardEntriesAll,
  useCofrinhos,
  useCofrinhoWithdrawals,
  useEnsureRecurring,
  useFinanceCategories,
  useLedgerRange,
  usePaymentMethods,
  usePeople,
} from "@/api/queries"
import {
  addPeriod,
  ledgerTotals,
  periodLabel,
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
import { MonthPicker } from "@/components/finance/month-picker"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

type RangeId = "1" | "3" | "6" | "12" | "year" | "next" | "next3" | "month"

const RANGES: { id: RangeId; label: string }[] = [
  { id: "1", label: "Mês atual" },
  { id: "3", label: "3 meses" },
  { id: "6", label: "6 meses" },
  { id: "12", label: "12 meses" },
  { id: "year", label: "Este ano" },
  { id: "next", label: "Próximo mês" },
  { id: "next3", label: "Próximos 3 meses" },
]

/** Janela [from, to] de cada atalho — `month` usa o mês escolhido à mão. */
function rangeWindow(
  id: RangeId,
  today: string,
  month: string,
): { from: string; to: string } {
  switch (id) {
    case "3":
      return { from: addPeriod(today, -2), to: today }
    case "6":
      return { from: addPeriod(today, -5), to: today }
    case "12":
      return { from: addPeriod(today, -11), to: today }
    case "year":
      return { from: yearStartPeriod(today), to: today }
    case "next":
      return { from: addPeriod(today, 1), to: addPeriod(today, 1) }
    case "next3":
      return { from: addPeriod(today, 1), to: addPeriod(today, 3) }
    case "month":
      return { from: month, to: month }
    default:
      return { from: today, to: today }
  }
}

export function FinanceDashboardPage() {
  const [rangeId, setRangeId] = useState<RangeId>("1")
  const [month, setMonth] = useState(() => todayPeriod())

  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const categoriesQ = useFinanceCategories()
  const ensure = useEnsureRecurring()

  const today = todayPeriod()
  const { from: fromPeriod, to: toPeriod } = useMemo(
    () => rangeWindow(rangeId, today, month),
    [rangeId, today, month],
  )

  // Materializa as recorrências até o mês visto, senão um período futuro
  // aparece vazio até alguém navegar até ele nos Lançamentos.
  useEffect(() => {
    if (toPeriod > today) ensure.mutate(toPeriod)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toPeriod])

  const rangeQ = useLedgerRange(fromPeriod, toPeriod)
  const entries = rangeQ.data ?? []

  // Todas as compras no cartão (qualquer mês) — o gráfico por categoria escolhe
  // entre contá-las pela fatura ou pela data da compra.
  const cardEntriesQ = useCardEntriesAll()

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
    const net = new Map<string, number>()
    for (const e of cofEntriesQ.data ?? []) {
      if (e.kind === "deposit")
        net.set(e.cofrinhoId, (net.get(e.cofrinhoId) ?? 0) + e.amount)
      else if (e.kind === "withdraw")
        net.set(e.cofrinhoId, (net.get(e.cofrinhoId) ?? 0) - e.amount)
    }
    const withdrawals = cofWithdrawalsQ.data ?? new Map<string, number>()
    return (cofrinhosQ.data ?? [])
      .filter((c) => c.active)
      .map((c) => ({
        name: c.name,
        value:
          (c.initialAmount ?? 0) +
          (net.get(c.id) ?? 0) -
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
    const netById = new Map<string, number>()
    for (const e of cofEntries) {
      if (e.kind === "deposit")
        netById.set(e.cofrinhoId, (netById.get(e.cofrinhoId) ?? 0) + e.amount)
      else if (e.kind === "withdraw")
        netById.set(e.cofrinhoId, (netById.get(e.cofrinhoId) ?? 0) - e.amount)
    }
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
          (netById.get(c.id) ?? 0) -
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

      <div className="space-y-1.5">
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
          <MonthPicker
            value={month}
            active={rangeId === "month"}
            onChange={(p) => {
              setMonth(p)
              setRangeId("month")
            }}
          />
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          <span className="first-letter:uppercase">
            {periodLabel(fromPeriod)}
          </span>
          {fromPeriod !== toPeriod && <> até {periodLabel(toPeriod)}</>}
          {toPeriod > today && " · período futuro (previsão)"}
        </p>
      </div>

      {rangeQ.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando…
        </p>
      ) : (
        <FinanceDashboard
          entries={entries}
          cardEntries={cardEntriesQ.data ?? []}
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
