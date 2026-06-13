import { useEffect, useMemo, useRef, useState } from "react"
import {
  CaretLeftIcon,
  CaretRightIcon,
  ChartPieSliceIcon,
  GearSixIcon,
  ListBulletsIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import {
  useEnsureRecurring,
  useFinanceCategories,
  useLedgerMonth,
  useLedgerRange,
  usePaymentMethods,
  usePeople,
  useSeedFinanceDefaults,
} from "@/api/queries"
import {
  addPeriod,
  formatBRL,
  ledgerTotals,
  periodLabel,
  todayPeriod,
} from "@/domain/finance"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionDialog } from "@/components/finance/transaction-dialog"
import { TransactionList } from "@/components/finance/transaction-list"
import { FinanceDashboard } from "@/components/finance/finance-dashboard"
import { PeopleTab } from "@/components/finance/people-tab"
import { ConfigTab } from "@/components/finance/config-tab"
import { cn } from "@/lib/utils"

type Tab = "ledger" | "people" | "dashboard" | "config"

const TABS: { id: Tab; label: string; icon: typeof ListBulletsIcon }[] = [
  { id: "ledger", label: "Lançamentos", icon: ListBulletsIcon },
  { id: "dashboard", label: "Dashboard", icon: ChartPieSliceIcon },
  { id: "people", label: "Pessoas", icon: UsersThreeIcon },
  { id: "config", label: "Configurações", icon: GearSixIcon },
]

const RANGES = [
  { id: "1", label: "Mês atual", months: 1 },
  { id: "3", label: "3 meses", months: 3 },
  { id: "6", label: "6 meses", months: 6 },
  { id: "12", label: "12 meses", months: 12 },
] as const

export function FinancePage() {
  const [tab, setTab] = useState<Tab>("ledger")
  const [period, setPeriod] = useState(todayPeriod())
  const [rangeMonths, setRangeMonths] = useState(6)
  const [dialogOpen, setDialogOpen] = useState(false)

  const categoriesQ = useFinanceCategories()
  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const seed = useSeedFinanceDefaults()
  const ensure = useEnsureRecurring()
  const seededRef = useRef(false)

  // First-use seed of default categories + payment methods
  useEffect(() => {
    if (seededRef.current) return
    if (!categoriesQ.isSuccess || !methodsQ.isSuccess) return
    if ((categoriesQ.data?.length ?? 0) > 0 || (methodsQ.data?.length ?? 0) > 0)
      return
    seededRef.current = true
    seed.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesQ.isSuccess, methodsQ.isSuccess])

  // Materialize recurring rows up to the viewed (or current) month
  useEffect(() => {
    const target = period > todayPeriod() ? period : todayPeriod()
    ensure.mutate(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const methodsById = useMemo(
    () => new Map((methodsQ.data ?? []).map((m) => [m.id, m] as const)),
    [methodsQ.data],
  )
  const peopleById = useMemo(
    () => new Map((peopleQ.data ?? []).map((p) => [p.id, p] as const)),
    [peopleQ.data],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Financeiro" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receitas e despesas da clínica (PJ) e pessoais (PF), em um só lugar.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon weight="bold" />
          Novo lançamento
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border/60 bg-background/40 p-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon weight="fill" className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "ledger" && (
        <LedgerTab
          period={period}
          setPeriod={setPeriod}
          methodsById={methodsById}
          peopleById={peopleById}
        />
      )}

      {tab === "dashboard" && (
        <DashboardTab
          rangeMonths={rangeMonths}
          setRangeMonths={setRangeMonths}
          methodsById={methodsById}
          peopleById={peopleById}
        />
      )}

      {tab === "people" && <PeopleTab />}
      {tab === "config" && <ConfigTab />}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        viewPeriod={period}
      />
    </div>
  )
}

function LedgerTab({
  period,
  setPeriod,
  methodsById,
  peopleById,
}: {
  period: string
  setPeriod: (p: string) => void
  methodsById: Map<string, import("@/db/types").PaymentMethod>
  peopleById: Map<string, import("@/db/types").Person>
}) {
  const ledgerQ = useLedgerMonth(period)
  const entries = ledgerQ.data ?? []
  const totals = useMemo(() => ledgerTotals(entries), [entries])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPeriod(addPeriod(period, -1))}
            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
            aria-label="Mês anterior"
          >
            <CaretLeftIcon weight="bold" className="size-4" />
          </button>
          <span className="min-w-44 text-center text-sm font-medium capitalize">
            {periodLabel(period)}
          </span>
          <button
            type="button"
            onClick={() => setPeriod(addPeriod(period, 1))}
            className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
            aria-label="Próximo mês"
          >
            <CaretRightIcon weight="bold" className="size-4" />
          </button>
          {period !== todayPeriod() && (
            <button
              type="button"
              onClick={() => setPeriod(todayPeriod())}
              className="ml-1 text-xs text-primary hover:underline"
            >
              Hoje
            </button>
          )}
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              totals.balance < 0 ? "text-rose-300" : "text-emerald-300",
            )}
          >
            Saldo {formatBRL(totals.balance)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBRL(totals.income)} entradas · {formatBRL(totals.expense)}{" "}
            saídas
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          {ledgerQ.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : (
            <TransactionList
              entries={entries}
              methodsById={methodsById}
              peopleById={peopleById}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardTab({
  rangeMonths,
  setRangeMonths,
  methodsById,
  peopleById,
}: {
  rangeMonths: number
  setRangeMonths: (m: number) => void
  methodsById: Map<string, import("@/db/types").PaymentMethod>
  peopleById: Map<string, import("@/db/types").Person>
}) {
  const toPeriod = todayPeriod()
  const fromPeriod = addPeriod(toPeriod, -(rangeMonths - 1))
  const rangeQ = useLedgerRange(fromPeriod, toPeriod)
  const entries = rangeQ.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRangeMonths(r.months)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              rangeMonths === r.months
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
          fromPeriod={fromPeriod}
          toPeriod={toPeriod}
        />
      )}
    </div>
  )
}
