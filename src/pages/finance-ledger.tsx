import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  MagnifyingGlassIcon,
  PiggyBankIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import {
  useAllCofrinhoEntries,
  useCardEntriesAll,
  useCards,
  useCofrinhos,
  useCofrinhoPurchaseDescriptions,
  useCofrinhoWithdrawals,
  useEnsureRecurring,
  useFinanceCategories,
  useLedgerMonth,
  useLedgerRange,
  usePaymentMethods,
  usePeople,
  useResolveCofrinhoSlot,
  useSkipCofrinhoSlot,
} from "@/api/queries"
import type { LedgerEntry } from "@/db/types"
import {
  cardInvoiceSummaries,
  formatBRL,
  invoiceDatesForPeriod,
  ledgerTotals,
  todayPeriod,
  yearStartPeriod,
} from "@/domain/finance"
import { cofrinhoSlots, incomeByDay } from "@/domain/cofrinhos"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { LedgerMiniCalendar } from "@/components/finance/ledger-mini-calendar"
import { TransactionDialog } from "@/components/finance/transaction-dialog"
import {
  TransactionList,
  type CofrinhoAction,
  type CofrinhoDepositItem,
  type CofrinhoListItem,
  type InvoiceListItem,
} from "@/components/finance/transaction-list"
import {
  CofrinhoResolveDialog,
  type ResolveTarget,
} from "@/components/finance/cofrinho-resolve-dialog"
import { CofrinhoDepositDialog } from "@/components/finance/cofrinho-deposit-dialog"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

type LedgerFilter = "all" | "payable" | "receivable" | "card" | "cofrinho"

const FILTERS: { id: LedgerFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "payable", label: "A pagar" },
  { id: "receivable", label: "A receber" },
  { id: "card", label: "Compras no cartão" },
  { id: "cofrinho", label: "Cofrinho" },
]

export function FinanceLedgerPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState(todayPeriod())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filter, setFilter] = useState<LedgerFilter>("all")
  const [query, setQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LedgerEntry | null>(null)

  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const categoriesQ = useFinanceCategories()
  const cardsQ = useCards()
  const ensure = useEnsureRecurring()

  // Materialize recurring rows up to the viewed (future) month.
  useEffect(() => {
    if (period > todayPeriod()) ensure.mutate(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  // The day filter is month-scoped: changing the month clears it.
  useEffect(() => {
    setSelectedDay(null)
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
  const cardsById = useMemo(
    () => new Map((cardsQ.data ?? []).map((c) => [c.id, c] as const)),
    [cardsQ.data],
  )

  const ledgerQ = useLedgerMonth(period)
  const entries = ledgerQ.data ?? []

  // Every card entry ever → one summary per (card, fatura).
  const cardAllQ = useCardEntriesAll()
  const invoicesAll = useMemo(
    () => cardInvoiceSummaries(cardAllQ.data ?? []),
    [cardAllQ.data],
  )

  // Faturas que VENCEM no mês visto (> 0) — viram item da lista e saída do mês.
  const monthInvoices = useMemo(
    () => invoicesAll.filter((r) => r.period === period && r.amount > 0.005),
    [invoicesAll, period],
  )

  // Indicadores: compras no cartão ficam de fora (uma a uma); no lugar delas
  // entra a fatura do mês como uma única saída (paga ou a pagar).
  const totals = useMemo(
    () =>
      ledgerTotals([
        ...entries.filter((e) => !e.cardId),
        ...monthInvoices.map((r) => ({
          kind: "expense" as const,
          amount: r.amount,
          settled: r.settled,
        })),
      ]),
    [entries, monthInvoices],
  )

  // Accumulated balance from January of the viewed year up to this month,
  // with the same card treatment (invoices due in the window, not purchases).
  const ytdQ = useLedgerRange(yearStartPeriod(period), period)
  const accumulated = useMemo(() => {
    const jan = yearStartPeriod(period)
    return ledgerTotals([
      ...(ytdQ.data ?? []).filter((e) => !e.cardId),
      ...invoicesAll
        .filter((r) => r.period >= jan && r.period <= period && r.amount > 0.005)
        .map((r) => ({
          kind: "expense" as const,
          amount: r.amount,
          settled: r.settled,
        })),
    ]).balance
  }, [ytdQ.data, invoicesAll, period])

  // Synthetic "Fatura do cartão X" rows, grouped on the invoice due date.
  const invoiceItems: InvoiceListItem[] = useMemo(
    () =>
      monthInvoices.map((r) => {
        const card = cardsById.get(r.cardId)
        const dueDate =
          r.dueDate ||
          (card
            ? invoiceDatesForPeriod(card.closingDay, card.dueDay, r.period)
                .dueDate
            : `${r.period}-01`)
        return {
          id: `inv_${r.cardId}_${r.period}`,
          cardId: r.cardId,
          period: r.period,
          cardName: card?.name ?? "Cartão",
          cardColor: card?.color ?? colorForKey(card?.name ?? "Cartão"),
          last4: card?.last4 ?? null,
          dueDate,
          amount: r.amount,
          settled: r.settled,
          count: r.count,
        }
      }),
    [monthInvoices, cardsById],
  )

  // Cofrinho savings prompts for the month (computed from goals + income).
  const cofrinhosQ = useCofrinhos()
  const cofrinhosById = useMemo(
    () => new Map((cofrinhosQ.data ?? []).map((c) => [c.id, c] as const)),
    [cofrinhosQ.data],
  )
  const cofrinhoEntriesQ = useAllCofrinhoEntries()
  const repayDescQ = useCofrinhoPurchaseDescriptions()
  const resolveSlot = useResolveCofrinhoSlot()
  const skipSlot = useSkipCofrinhoSlot()
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [cofrinhoBusyKey, setCofrinhoBusyKey] = useState<string | null>(null)

  const cofrinhoItems: CofrinhoListItem[] = useMemo(() => {
    const active = (cofrinhosQ.data ?? []).filter((c) => c.active)
    const cofEntries = cofrinhoEntriesQ.data ?? []
    const descById = repayDescQ.data ?? new Map<string, string>()
    const out: CofrinhoListItem[] = []
    for (const c of active) {
      const income = incomeByDay(entries, c.incomeScope)
      for (const s of cofrinhoSlots(c, period, income, cofEntries)) {
        out.push({
          id: `${c.id}:${s.slotKey}`,
          cofrinhoId: c.id,
          cofrinhoName: c.name,
          cofrinhoColor: c.color ?? colorForKey(c.name),
          slotKey: s.slotKey,
          date: s.date,
          period: s.period,
          source: s.source,
          expected: s.expected,
          saved: s.saved,
          pending: s.pending,
          status: s.status,
          description: s.purchaseTxId
            ? (descById.get(s.purchaseTxId) ?? null)
            : null,
        })
      }
    }
    return out
  }, [cofrinhosQ.data, cofrinhoEntriesQ.data, repayDescQ.data, entries, period])

  // Manual "Adicionar valor" deposits for the month, shown as ledger lines.
  const cofrinhoDepositItems: CofrinhoDepositItem[] = useMemo(() => {
    const out: CofrinhoDepositItem[] = []
    for (const e of cofrinhoEntriesQ.data ?? []) {
      if (e.kind !== "deposit" || e.source !== "manual" || e.period !== period)
        continue
      const c = cofrinhosById.get(e.cofrinhoId)
      out.push({
        id: e.id,
        cofrinhoId: e.cofrinhoId,
        cofrinhoName: c?.name ?? "Cofrinho",
        cofrinhoColor: c?.color ?? colorForKey(c?.name ?? "Cofrinho"),
        date: e.date,
        amount: e.amount,
        description: e.description,
      })
    }
    return out
  }, [cofrinhoEntriesQ.data, cofrinhosById, period])

  async function handleCofrinhoAction(
    item: CofrinhoListItem,
    action: CofrinhoAction,
  ) {
    if (action === "partial") {
      setResolveTarget({
        cofrinhoId: item.cofrinhoId,
        cofrinhoName: item.cofrinhoName,
        slotKey: item.slotKey,
        date: item.date,
        period: item.period,
        source: item.source,
        expected: item.expected,
        saved: item.saved,
        pending: item.pending,
      })
      setResolveOpen(true)
      return
    }
    setCofrinhoBusyKey(item.id)
    try {
      if (action === "save") {
        await resolveSlot.mutateAsync({
          cofrinhoId: item.cofrinhoId,
          slotKey: item.slotKey,
          date: item.date,
          source: item.source,
          amount: item.pending,
          expected: item.pending,
        })
        toast.success("Guardado")
      } else {
        await skipSlot.mutateAsync({
          cofrinhoId: item.cofrinhoId,
          slotKey: item.slotKey,
          date: item.date,
          source: item.source,
          expected: item.expected,
        })
        toast.success("Pulado")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setCofrinhoBusyKey(null)
    }
  }

  // Cofrinho insight figures for the indicator strip.
  const cofrinhoWithdrawalsQ = useCofrinhoWithdrawals()
  const cofrinhoInsights = useMemo(() => {
    const cofEntries = cofrinhoEntriesQ.data ?? []
    const withdrawals = cofrinhoWithdrawalsQ.data ?? new Map<string, number>()
    let deposited = 0
    let depositedMonth = 0
    for (const e of cofEntries) {
      if (e.kind !== "deposit") continue
      deposited += e.amount
      if (e.period === period) depositedMonth += e.amount
    }
    let withdrawn = 0
    for (const v of withdrawals.values()) withdrawn += v
    const active = (cofrinhosQ.data ?? []).filter((c) => c.active)
    const initial = active.reduce((s, c) => s + (c.initialAmount ?? 0), 0)
    const pending = cofrinhoItems.reduce((s, r) => s + r.pending, 0)
    return {
      reserved: initial + deposited - withdrawn,
      savedMonth: depositedMonth,
      toSave: pending,
      hasCofrinhos: active.length > 0,
    }
  }, [
    cofrinhoEntriesQ.data,
    cofrinhoWithdrawalsQ.data,
    cofrinhoItems,
    cofrinhosQ.data,
    period,
  ])

  // Cofrinho prompts show in "Todos" and in the dedicated "Cofrinho" view.
  const typeCofrinhos = useMemo(
    () =>
      filter === "all" || filter === "cofrinho" ? cofrinhoItems : [],
    [cofrinhoItems, filter],
  )
  const shownCofrinhos = useMemo(
    () =>
      selectedDay
        ? typeCofrinhos.filter((r) => r.date === selectedDay)
        : typeCofrinhos,
    [typeCofrinhos, selectedDay],
  )

  // Manual deposits show alongside prompts ("Todos" + "Cofrinho" views).
  const typeCofrinhoDeposits = useMemo(
    () =>
      filter === "all" || filter === "cofrinho" ? cofrinhoDepositItems : [],
    [cofrinhoDepositItems, filter],
  )
  const shownCofrinhoDeposits = useMemo(
    () =>
      selectedDay
        ? typeCofrinhoDeposits.filter((r) => r.date === selectedDay)
        : typeCofrinhoDeposits,
    [typeCofrinhoDeposits, selectedDay],
  )

  // Type filter (button group). Card purchases NEVER count as "a pagar" —
  // there the invoice shows up instead; they get their own "card" view.
  const typeEntries = useMemo(() => {
    switch (filter) {
      case "payable":
        return entries.filter(
          (e) => e.kind === "expense" && !e.settled && !e.cardId,
        )
      case "receivable":
        return entries.filter(
          (e) => e.kind === "income" && !e.settled && !e.cardId,
        )
      case "card":
        return entries.filter((e) => !!e.cardId)
      case "cofrinho":
        return entries.filter((e) => !!e.cofrinhoId)
      default:
        return entries
    }
  }, [entries, filter])

  const typeInvoices = useMemo(() => {
    if (filter === "all") return invoiceItems
    if (filter === "payable") return invoiceItems.filter((r) => !r.settled)
    return [] // a receber / compras no cartão: sem linha de fatura
  }, [invoiceItems, filter])

  // Launches per day for the mini calendar (invoices on their due date),
  // following the active type filter so badges match the list.
  const dayCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of typeEntries) m.set(e.date, (m.get(e.date) ?? 0) + 1)
    for (const r of typeInvoices)
      m.set(r.dueDate, (m.get(r.dueDate) ?? 0) + 1)
    for (const r of typeCofrinhos) m.set(r.date, (m.get(r.date) ?? 0) + 1)
    for (const r of typeCofrinhoDeposits)
      m.set(r.date, (m.get(r.date) ?? 0) + 1)
    return m
  }, [typeEntries, typeInvoices, typeCofrinhos, typeCofrinhoDeposits])

  const shownEntries = useMemo(
    () =>
      selectedDay
        ? typeEntries.filter((e) => e.date === selectedDay)
        : typeEntries,
    [typeEntries, selectedDay],
  )
  const shownInvoices = useMemo(
    () =>
      selectedDay
        ? typeInvoices.filter((r) => r.dueDate === selectedDay)
        : typeInvoices,
    [typeInvoices, selectedDay],
  )

  const emptyLabel = useMemo(() => {
    const scope = selectedDay ? "neste dia" : "neste mês"
    switch (filter) {
      case "payable":
        return `Nada a pagar ${scope}.`
      case "receivable":
        return `Nada a receber ${scope}.`
      case "card":
        return `Nenhuma compra no cartão ${scope}.`
      case "cofrinho":
        return `Nada de cofrinho ${scope}.`
      default:
        return selectedDay ? "Nenhum lançamento neste dia." : undefined
    }
  }, [filter, selectedDay])

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
            Compras no cartão de crédito entram pela fatura.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon weight="bold" />
          Novo lançamento
        </Button>
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

        {cofrinhoInsights.hasCofrinhos && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 text-amber-300">
              <PiggyBankIcon weight="fill" className="size-4" />
              <span className="font-medium">Cofrinhos</span>
            </span>
            <CofStat label="Reservado" value={cofrinhoInsights.reserved} />
            <CofStat label="Guardado no mês" value={cofrinhoInsights.savedMonth} />
            <CofStat label="A guardar" value={cofrinhoInsights.toSave} muted />
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => setDepositOpen(true)}
            >
              <PlusIcon weight="bold" />
              Adicionar valor
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 @3xl:flex-row @3xl:items-center">
          <div className="flex flex-wrap gap-1 self-start rounded-lg border border-border/60 bg-background/40 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
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
        </div>

        <div className="grid gap-4 @4xl:grid-cols-[320px_1fr] @6xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <LedgerMiniCalendar
              period={period}
              counts={dayCounts}
              selected={selectedDay}
              onSelectDay={setSelectedDay}
              onChangePeriod={setPeriod}
            />
          </div>

          <div>
            {ledgerQ.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando…
              </p>
            ) : (
              <TransactionList
                entries={shownEntries}
                methodsById={methodsById}
                peopleById={peopleById}
                categoriesById={categoriesById}
                cardsById={cardsById}
                cofrinhosById={cofrinhosById}
                emptyLabel={emptyLabel}
                invoices={shownInvoices}
                onOpenInvoice={(inv) =>
                  navigate(
                    `/financeiro/cartoes?cartao=${inv.cardId}&fatura=${inv.period}`,
                  )
                }
                cofrinhos={shownCofrinhos}
                onCofrinhoAction={handleCofrinhoAction}
                cofrinhoBusyKey={cofrinhoBusyKey}
                cofrinhoDeposits={shownCofrinhoDeposits}
                query={query}
                onEdit={openEdit}
              />
            )}
          </div>
        </div>
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        viewPeriod={period}
        editing={editing}
      />
      <CofrinhoResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        target={resolveTarget}
      />
      <CofrinhoDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
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

function CofStat({
  label,
  value,
  muted,
}: {
  label: string
  value: number
  muted?: boolean
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          muted ? "text-amber-300/90" : "text-foreground",
        )}
      >
        {formatBRL(value)}
      </span>
    </span>
  )
}
