import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  CaretLeftIcon,
  CaretRightIcon,
  CreditCardIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"
import { toast } from "sonner"
import type {
  FinanceCard,
  FinanceCategory,
  LedgerEntry,
  PaymentMethod,
  Person,
} from "@/db/types"
import {
  countCardUsage,
  useCardEntriesAll,
  useCards,
  useDeleteCard,
  useFinanceCategories,
  usePayInvoice,
  usePaymentMethods,
  usePeople,
} from "@/api/queries"
import {
  addPeriod,
  cardOpenTotal,
  currentInvoicePeriod,
  formatBRL,
  periodLabel,
  periodShort,
  summarizeInvoice,
  todayPeriod,
  type CardInvoice,
} from "@/domain/finance"
import { formatLongDateBR, todayISO } from "@/domain/dates"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CardDialog } from "@/components/finance/card-dialog"
import { TransactionDialog } from "@/components/finance/transaction-dialog"
import { TransactionList } from "@/components/finance/transaction-list"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { colorForKey } from "@/lib/finance-colors"
import { brl, chartAxis, chartTooltip } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

/** Whole days from today until an ISO date (negative = past). */
function daysUntil(dueISO: string): number {
  const a = Date.parse(todayISO())
  const b = Date.parse(dueISO)
  return Math.round((b - a) / 86_400_000)
}

export function FinanceCardsPage() {
  const cardsQ = useCards()
  const cardEntriesQ = useCardEntriesAll()
  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const categoriesQ = useFinanceCategories()
  const deleteCard = useDeleteCard()

  // Deep-link from the ledger's "Fatura do cartão" item:
  // /financeiro/cartoes?cartao=<id>&fatura=<YYYY-MM>
  const [searchParams] = useSearchParams()
  const urlCard = searchParams.get("cartao")
  const rawPeriod = searchParams.get("fatura")
  const urlPeriod =
    rawPeriod && /^\d{4}-\d{2}$/.test(rawPeriod) ? rawPeriod : null

  const [selected, setSelected] = useState<string | null>(urlCard)
  // Shared invoice period across the whole page: the sidebar chips and the
  // detail panel all reflect this month. `null` = each card's own current
  // invoice (the default) until the user navigates to a specific month.
  const [period, setPeriod] = useState<string | null>(urlPeriod)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FinanceCard | null>(null)

  const [txOpen, setTxOpen] = useState(false)
  const [txEditing, setTxEditing] = useState<LedgerEntry | null>(null)

  const cards = (cardsQ.data ?? []).filter((c) => c.active)

  // All card-linked entries grouped per card, so each sidebar chip can show
  // that card's invoice total for the selected period.
  const entriesByCard = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>()
    for (const e of cardEntriesQ.data ?? []) {
      if (!e.cardId) continue
      const arr = m.get(e.cardId)
      if (arr) arr.push(e)
      else m.set(e.cardId, [e])
    }
    return m
  }, [cardEntriesQ.data])

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

  // Auto-select the first card (also when the URL points at a missing card).
  useEffect(() => {
    if (cards.length === 0) return
    if (!selected || !cards.some((c) => c.id === selected))
      setSelected(cards[0].id)
  }, [cards, selected])

  const selectedCard = cards.find((c) => c.id === selected) ?? null

  // Resolve the shared period: once the user navigates it sticks; otherwise
  // fall back to the selected card's current invoice (or today's month).
  const effectivePeriod =
    period ??
    (selectedCard
      ? currentInvoicePeriod(selectedCard.closingDay, selectedCard.dueDay)
      : todayPeriod())

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(c: FinanceCard) {
    setEditing(c)
    setDialogOpen(true)
  }
  function openEditTx(entry: LedgerEntry) {
    setTxEditing(entry)
    setTxOpen(true)
  }
  function openNewTx() {
    setTxEditing(null)
    setTxOpen(true)
  }
  async function askDelete(c: FinanceCard) {
    let count = 0
    try {
      count = await countCardUsage(c.id)
    } catch {
      /* best-effort count */
    }
    const ok = await confirmDialog({
      title: `Excluir “${c.name}”?`,
      description:
        count > 0
          ? `${count} ${count === 1 ? "lançamento será desvinculado" : "lançamentos serão desvinculados"} deste cartão, mas ${count === 1 ? "continuará" : "continuarão"} no financeiro como despesa. O cadastro do cartão será removido.`
          : "O cadastro do cartão será removido.",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteCard.mutateAsync(c.id)
      toast.success("Cartão excluído")
      if (selected === c.id) setSelected(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Financeiro" }, { label: "Cartões" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Cartões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faturas de cartão de crédito, mês a mês, por cartão.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon weight="bold" />
          Novo cartão
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-1.5">
          {cards.length === 0 && (
            <Card>
              <CardContent className="grid place-items-center gap-1 py-10 text-center text-sm text-muted-foreground">
                Nenhum cartão cadastrado.
                <button
                  type="button"
                  onClick={openNew}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Adicionar o primeiro
                </button>
              </CardContent>
            </Card>
          )}
          {cards.map((c) => {
            // Open amount of this card's invoice for the selected period.
            const open = summarizeInvoice(
              effectivePeriod,
              entriesByCard.get(c.id) ?? [],
              c,
            ).openTotal
            const swatch = c.color ?? colorForKey(c.name)
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                  selected === c.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border/50 bg-card/40 hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-white shadow-inner"
                    style={{ backgroundColor: swatch }}
                  >
                    <CreditCardIcon weight="fill" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {c.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.brand ? `${c.brand} ` : ""}
                      {c.last4 ? `•••• ${c.last4}` : `fecha dia ${c.closingDay}`}
                    </span>
                  </span>
                  {open > 0.005 && (
                    <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-300">
                      {formatBRL(open)}
                    </span>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                      aria-label="Ações"
                    >
                      <DotsThreeVerticalIcon weight="bold" className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <PencilSimpleIcon weight="fill" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => askDelete(c)}
                      className="text-destructive focus:bg-destructive/15"
                    >
                      <TrashIcon weight="fill" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>

        <div>
          {selectedCard ? (
            <CardInvoicePanel
              key={selectedCard.id}
              card={selectedCard}
              period={effectivePeriod}
              onPeriodChange={setPeriod}
              entries={entriesByCard.get(selectedCard.id) ?? []}
              loading={cardEntriesQ.isLoading}
              methodsById={methodsById}
              peopleById={peopleById}
              categoriesById={categoriesById}
              onEditTx={openEditTx}
              onNewTx={openNewTx}
            />
          ) : (
            <Card>
              <CardContent className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <CreditCardIcon weight="duotone" className="size-8 opacity-60" />
                Cadastre um cartão para acompanhar suas faturas.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onCreated={(id) => setSelected(id)}
      />
      <TransactionDialog
        open={txOpen}
        onOpenChange={setTxOpen}
        viewPeriod={currentInvoicePeriod(
          selectedCard?.closingDay ?? 1,
          selectedCard?.dueDay ?? 10,
        )}
        editing={txEditing}
        presetCardId={!txEditing ? selectedCard?.id : undefined}
      />
    </div>
  )
}

const STATUS_META: Record<
  CardInvoice["status"],
  { label: string; cls: string }
> = {
  open: { label: "Aberta", cls: "bg-sky-500/15 text-sky-300" },
  closed: { label: "Fechada", cls: "bg-amber-500/15 text-amber-300" },
  paid: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-300" },
}

function CardInvoicePanel({
  card,
  period,
  onPeriodChange,
  entries,
  loading,
  methodsById,
  peopleById,
  categoriesById,
  onEditTx,
  onNewTx,
}: {
  card: FinanceCard
  /** Invoice month currently shown (shared with the sidebar chips). */
  period: string
  onPeriodChange: (period: string) => void
  /** This card's ledger entries (all invoices), passed from the page. */
  entries: LedgerEntry[]
  loading: boolean
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
  categoriesById: Map<string, FinanceCategory>
  onEditTx: (entry: LedgerEntry) => void
  onNewTx: () => void
}) {
  const payInvoice = usePayInvoice()
  const all = entries
  const currentPeriod = currentInvoicePeriod(card.closingDay, card.dueDay)
  const [query, setQuery] = useState("")

  const invoice = useMemo(
    () => summarizeInvoice(period, all, card),
    [period, all, card],
  )

  // Recent invoices (net total per invoice period) for the mini bar chart.
  const recent = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of all) {
      if (!e.invoicePeriod) continue
      const v = e.kind === "expense" ? e.amount : -e.amount
      totals.set(e.invoicePeriod, (totals.get(e.invoicePeriod) ?? 0) + v)
    }
    totals.set(period, totals.get(period) ?? 0)
    return [...totals.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([p, total]) => ({
        period: p,
        label: periodShort(p),
        total,
        current: p === period,
      }))
  }, [all, period])

  // Category breakdown for the selected invoice.
  const byCategory = useMemo(() => {
    const m = new Map<string, { value: number; color: string }>()
    for (const e of invoice.entries) {
      if (e.kind !== "expense") continue
      const name = e.categoryName ?? "Sem categoria"
      const color =
        (e.categoryId ? categoriesById.get(e.categoryId)?.color : null) ??
        colorForKey(name)
      const cur = m.get(name)
      if (cur) cur.value += e.amount
      else m.set(name, { value: e.amount, color })
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [invoice.entries, categoriesById])

  const used = cardOpenTotal(all)
  const dueIn = daysUntil(invoice.dueDate)
  const status = STATUS_META[invoice.status]
  const swatch = card.color ?? colorForKey(card.name)

  async function togglePaid() {
    const pay = invoice.status !== "paid"
    if (invoice.count === 0) return
    if (
      !(await confirmDialog({
        title: pay ? "Marcar fatura como paga" : "Reabrir fatura",
        description: pay
          ? `Marcar os ${invoice.count} lançamentos de ${periodLabel(period)} como pagos?`
          : `Reabrir a fatura de ${periodLabel(period)} (marcar como não paga)?`,
      }))
    )
      return
    try {
      await payInvoice.mutateAsync({
        cardId: card.id,
        period,
        settled: pay,
      })
      toast.success(pay ? "Fatura paga" : "Fatura reaberta")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <div className="space-y-4">
      {/* Invoice header: navigation + due date + status */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPeriodChange(addPeriod(period, -1))}
                aria-label="Fatura anterior"
              >
                <CaretLeftIcon weight="bold" />
              </Button>
              <div className="min-w-40 text-center">
                <p className="text-lg font-semibold capitalize tracking-tight">
                  {periodLabel(period)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vence em {formatLongDateBR(invoice.dueDate)}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPeriodChange(addPeriod(period, 1))}
                aria-label="Próxima fatura"
              >
                <CaretRightIcon weight="bold" />
              </Button>
              {period !== currentPeriod && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPeriodChange(currentPeriod)}
                >
                  Atual
                </Button>
              )}
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold",
                status.cls,
              )}
            >
              {status.label}
            </span>
          </div>

          {/* KPI row (scoped to this card's invoice) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total da fatura" value={invoice.total} tone="neutral" />
            <Stat label="Em aberto" value={invoice.openTotal} tone="amber" />
            <Stat label="Pago" value={invoice.paidTotal} tone="income" />
            <div>
              <p className="text-xs text-muted-foreground">Fechamento</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatLongDateBR(invoice.closeDate).replace(/ de \d{4}$/, "")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {invoice.count} {invoice.count === 1 ? "lançamento" : "lançamentos"}
              </p>
            </div>
          </div>

          {/* Due countdown + pay button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {invoice.status === "paid" ? (
                <span className="text-emerald-300">Fatura quitada ✓</span>
              ) : dueIn > 0 ? (
                <>
                  Vence em{" "}
                  <span className="font-medium text-foreground">
                    {dueIn} {dueIn === 1 ? "dia" : "dias"}
                  </span>
                </>
              ) : dueIn === 0 ? (
                <span className="font-medium text-amber-300">Vence hoje</span>
              ) : (
                <span className="font-medium text-rose-300">
                  Vencida há {Math.abs(dueIn)} {Math.abs(dueIn) === 1 ? "dia" : "dias"}
                </span>
              )}
            </p>
            {invoice.count > 0 && (
              <Button
                variant={invoice.status === "paid" ? "outline" : "default"}
                size="sm"
                onClick={togglePaid}
                loading={payInvoice.isPending}
              >
                {invoice.status === "paid"
                  ? "Reabrir fatura"
                  : "Marcar fatura como paga"}
              </Button>
            )}
          </div>

          {/* Limit usage */}
          {card.creditLimit != null && card.creditLimit > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Limite usado</span>
                <span className="tabular-nums">
                  {formatBRL(Math.max(0, used))} / {formatBRL(card.creditLimit)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    used / card.creditLimit > 0.9
                      ? "bg-rose-500"
                      : used / card.creditLimit > 0.7
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, (used / card.creditLimit) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Disponível: {formatBRL(Math.max(0, card.creditLimit - used))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent invoices + category breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold">Faturas recentes</p>
            {recent.length === 0 ? (
              <p className="grid h-[140px] place-items-center text-xs text-muted-foreground">
                Sem faturas.
              </p>
            ) : (
              <div style={{ width: "100%", height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recent}>
                    <XAxis dataKey="label" {...chartAxis} />
                    <Tooltip
                      {...chartTooltip}
                      formatter={brl}
                      labelFormatter={(l) => `Fatura ${l}`}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {recent.map((r, i) => (
                        <Cell
                          key={i}
                          fill={
                            r.current
                              ? swatch
                              : "hsl(var(--muted-foreground)/0.45)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold">Por categoria</p>
            {byCategory.length === 0 ? (
              <p className="grid h-[140px] place-items-center text-xs text-muted-foreground">
                Sem lançamentos nesta fatura.
              </p>
            ) : (
              <ul className="space-y-2">
                {byCategory.map((c) => (
                  <li key={c.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatBRL(c.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search + launches in this invoice */}
      <div className="flex items-center gap-2">
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
        <Button onClick={onNewTx} className="shrink-0">
          <PlusIcon weight="bold" />
          <span className="hidden sm:inline">Novo lançamento</span>
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Carregando…
        </p>
      ) : (
        <TransactionList
          entries={invoice.entries}
          methodsById={methodsById}
          peopleById={peopleById}
          categoriesById={categoriesById}
          query={query}
          onEdit={onEditTx}
        />
      )}
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
  tone: "income" | "expense" | "amber" | "neutral"
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "income" && "text-emerald-300",
          tone === "expense" && "text-rose-300",
          tone === "amber" && "text-amber-400",
          tone === "neutral" && (value < 0 ? "text-emerald-300" : "text-foreground"),
        )}
      >
        {formatBRL(value)}
      </p>
    </div>
  )
}
