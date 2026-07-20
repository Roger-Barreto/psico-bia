import { useMemo, useState } from "react"
import {
  useFinanceCategories,
  useLedgerRange,
  usePaymentMethods,
  usePeople,
} from "@/api/queries"
import {
  addPeriod,
  ledgerTotals,
  todayPeriod,
  yearStartPeriod,
} from "@/domain/finance"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { FinanceDashboard } from "@/components/finance/finance-dashboard"
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
        />
      )}
    </div>
  )
}
