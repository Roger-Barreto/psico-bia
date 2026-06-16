import { useEffect, useMemo, useState } from "react"
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react"
import {
  useEnsureRecurring,
  useFinanceCategories,
  useLedgerMonth,
  useLedgerRange,
  usePaymentMethods,
  usePeople,
} from "@/api/queries"
import type { LedgerEntry } from "@/db/types"
import {
  formatBRL,
  ledgerTotals,
  todayPeriod,
  yearStartPeriod,
} from "@/domain/finance"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { MonthNav } from "@/components/finance/month-nav"
import { TransactionDialog } from "@/components/finance/transaction-dialog"
import { TransactionList } from "@/components/finance/transaction-list"
import { cn } from "@/lib/utils"

export function FinanceLedgerPage() {
  const [period, setPeriod] = useState(todayPeriod())
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LedgerEntry | null>(null)

  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const categoriesQ = useFinanceCategories()
  const ensure = useEnsureRecurring()

  // Materialize recurring rows up to the viewed (future) month.
  useEffect(() => {
    if (period > todayPeriod()) ensure.mutate(period)
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
  const categoriesById = useMemo(
    () => new Map((categoriesQ.data ?? []).map((c) => [c.id, c] as const)),
    [categoriesQ.data],
  )

  const ledgerQ = useLedgerMonth(period)
  const entries = ledgerQ.data ?? []
  const totals = useMemo(() => ledgerTotals(entries), [entries])

  // Accumulated balance from January of the viewed year up to this month.
  const ytdQ = useLedgerRange(yearStartPeriod(period), period)
  const accumulated = useMemo(
    () => ledgerTotals(ytdQ.data ?? []).balance,
    [ytdQ.data],
  )

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(entry: LedgerEntry) {
    setEditing(entry)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Financeiro" }, { label: "Lançamentos" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Lançamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receitas e despesas da clínica (PJ) e pessoais (PF), mês a mês.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav period={period} onChange={setPeriod} />
          <Button onClick={openNew}>
            <PlusIcon weight="bold" />
            Novo lançamento
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:divide-x sm:divide-border/40 [&>*:nth-child(n+2)]:sm:pl-4">
            <Stat label="Entradas" value={totals.income} tone="income" />
            <Stat label="Saídas" value={totals.expense} tone="expense" />
            <Stat label="Saldo do mês" value={totals.balance} tone="auto" />
            <Stat
              label="Acumulado desde jan."
              value={accumulated}
              tone="auto"
            />
          </CardContent>
        </Card>

        <div className="relative">
          <MagnifyingGlassIcon
            weight="fill"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar por descrição, valor, categoria, data…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {ledgerQ.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carregando…
          </p>
        ) : (
          <TransactionList
            entries={entries}
            methodsById={methodsById}
            peopleById={peopleById}
            categoriesById={categoriesById}
            query={query}
            onEdit={openEdit}
          />
        )}
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        viewPeriod={period}
        editing={editing}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "income" | "expense" | "auto"
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "income" && "text-emerald-300",
          tone === "expense" && "text-rose-300",
          tone === "auto" && (value < 0 ? "text-rose-300" : "text-emerald-300"),
        )}
      >
        {formatBRL(value)}
      </p>
    </div>
  )
}
