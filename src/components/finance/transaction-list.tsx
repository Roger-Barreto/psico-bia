import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CaretRightIcon,
  DotsThreeVerticalIcon,
  LockSimpleIcon,
  PencilSimpleIcon,
  RepeatIcon,
  TrashIcon,
  CreditCardIcon,
  HandCoinsIcon,
} from "@phosphor-icons/react"
import type {
  FinanceCard,
  FinanceCategory,
  LedgerEntry,
  PaymentMethod,
  Person,
} from "@/db/types"
import {
  useDeleteTransaction,
  useSetTransactionSettled,
} from "@/api/queries"
import {
  formatBRL,
  matchesLedgerQuery,
  matchesTokens,
  periodShort,
  signedAmount,
} from "@/domain/finance"
import { formatLongDateBR } from "@/domain/dates"
import { colorForKey } from "@/lib/finance-colors"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** Synthetic "fatura do cartão" row shown on the due date. */
export interface InvoiceListItem {
  id: string
  cardId: string
  period: string // YYYY-MM da fatura
  cardName: string
  cardColor: string
  last4: string | null
  dueDate: string // dia em que a linha é agrupada
  amount: number // líquido a pagar
  settled: boolean
  count: number
}

interface Props {
  entries: LedgerEntry[]
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
  categoriesById?: Map<string, FinanceCategory>
  cardsById?: Map<string, FinanceCard>
  /** Card invoices to interleave (grouped on their due date). */
  invoices?: InvoiceListItem[]
  onOpenInvoice?: (inv: InvoiceListItem) => void
  /** Free-text filter over every field (description, value, tags, date…). */
  query?: string
  /** Empty-state text when there is no query (filter-aware wording). */
  emptyLabel?: string
  onEdit?: (entry: LedgerEntry) => void
}

export function TransactionList({
  entries,
  methodsById,
  peopleById,
  categoriesById,
  cardsById,
  invoices,
  onOpenInvoice,
  query,
  emptyLabel,
  onEdit,
}: Props) {
  const setSettled = useSetTransactionSettled()
  const del = useDeleteTransaction()

  const togglingId = setSettled.isPending
    ? (setSettled.variables as { id: string } | undefined)?.id
    : undefined
  const deletingId = del.isPending
    ? (del.variables as string | undefined)
    : undefined

  const q = query?.trim() ?? ""
  const filtered = q
    ? entries.filter((e) =>
        matchesLedgerQuery(e, q, {
          method: e.paymentMethodId
            ? methodsById.get(e.paymentMethodId)?.name
            : undefined,
          person: e.personId ? peopleById.get(e.personId)?.name : undefined,
        }),
      )
    : entries
  const invoiceRows = (invoices ?? []).filter(
    (r) =>
      !q ||
      matchesTokens(
        `fatura do cartão ${r.cardName} ${r.period} ${formatBRL(r.amount)} ${r.dueDate} ${r.settled ? "paga" : "a pagar"}`,
        q,
      ),
  )

  if (filtered.length === 0 && invoiceRows.length === 0) {
    return (
      <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border/60 py-14 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {q
            ? "Nenhum lançamento encontrado."
            : (emptyLabel ?? "Nenhum lançamento neste mês.")}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {q
            ? "Tente outros termos de busca."
            : "Use “Novo lançamento” para adicionar uma receita ou despesa."}
        </p>
      </div>
    )
  }

  // group by day (descending); card invoices land on their due date
  const byDay = new Map<
    string,
    { entries: LedgerEntry[]; invoices: InvoiceListItem[] }
  >()
  const slotOf = (day: string) => {
    let s = byDay.get(day)
    if (!s) {
      s = { entries: [], invoices: [] }
      byDay.set(day, s)
    }
    return s
  }
  for (const e of filtered) slotOf(e.date).entries.push(e)
  for (const r of invoiceRows) slotOf(r.dueDate).invoices.push(r)
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-5">
      {days.map((day) => {
        const slot = byDay.get(day)!
        const items = slot.entries
        const subtotal =
          items.reduce((s, e) => s + signedAmount(e), 0) -
          slot.invoices.reduce((s, r) => s + r.amount, 0)
        return (
          <section key={day}>
            <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
              <p className="text-xs font-medium text-muted-foreground">
                {formatLongDateBR(day)}
              </p>
              <p
                className={cn(
                  "text-xs font-medium tabular-nums",
                  subtotal < 0 ? "text-rose-300/80" : "text-emerald-300/80",
                )}
              >
                {subtotal >= 0 ? "+" : "−"}
                {formatBRL(Math.abs(subtotal))}
              </p>
            </div>
            <Card className="divide-y divide-border/40 overflow-hidden">
              {slot.invoices.map((r) => (
                <InvoiceRow
                  key={r.id}
                  invoice={r}
                  onOpen={onOpenInvoice ? () => onOpenInvoice(r) : undefined}
                />
              ))}
              {items.map((e) => (
                <Row
                  key={e.id}
                  entry={e}
                  method={
                    e.paymentMethodId
                      ? methodsById.get(e.paymentMethodId)
                      : undefined
                  }
                  person={e.personId ? peopleById.get(e.personId) : undefined}
                  card={e.cardId ? cardsById?.get(e.cardId) : undefined}
                  toggling={togglingId === e.id}
                  deleting={deletingId === e.id}
                  categoryColor={
                    (e.categoryId
                      ? categoriesById?.get(e.categoryId)?.color
                      : null) ??
                    (e.categoryName ? colorForKey(e.categoryName) : null)
                  }
                  onEdit={onEdit ? () => onEdit(e) : undefined}
                  onToggle={async () => {
                    // card purchases settle only via the invoice payment
                    if (!e.editable || e.cardId) return
                    try {
                      await setSettled.mutateAsync({
                        id: e.id,
                        settled: !e.settled,
                      })
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erro")
                    }
                  }}
                  onDelete={async () => {
                    if (!e.editable) return
                    if (
                      !(await confirmDialog({
                        title: "Excluir lançamento",
                        description: `Excluir "${e.description}"?`,
                        destructive: true,
                      }))
                    )
                      return
                    try {
                      await del.mutateAsync(e.id)
                      toast.success("Excluído")
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Erro")
                    }
                  }}
                />
              ))}
            </Card>
          </section>
        )
      })}
    </div>
  )
}

function Chip({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

function Row({
  entry: e,
  method,
  person,
  card,
  categoryColor,
  toggling,
  deleting,
  onEdit,
  onToggle,
  onDelete,
}: {
  entry: LedgerEntry
  method?: PaymentMethod
  person?: Person
  card?: FinanceCard
  categoryColor?: string | null
  toggling?: boolean
  deleting?: boolean
  onEdit?: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const income = e.kind === "income"
  const Icon = income ? ArrowUpRightIcon : ArrowDownLeftIcon
  const isLoan = method?.isLoan ?? false
  // Card purchases are settled by paying the invoice, never one by one.
  const invoiceLocked = !!e.cardId

  return (
    <div className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/20 sm:px-4">
      <button
        type="button"
        onClick={onToggle}
        disabled={!e.editable || toggling || invoiceLocked}
        title={
          invoiceLocked
            ? e.settled
              ? "Paga pela fatura do cartão"
              : "Será paga junto com a fatura do cartão"
            : e.editable
              ? e.settled
                ? income
                  ? "Recebido"
                  : "Pago"
                : "Marcar como " + (income ? "recebido" : "pago")
              : "Faturamento da clínica (automático)"
        }
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border transition-colors",
          e.settled
            ? income
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/15 text-rose-300"
            : "border-border/60 text-muted-foreground hover:border-foreground/40",
          (!e.editable || invoiceLocked) &&
            "cursor-default opacity-90 hover:border-border/60",
        )}
      >
        {toggling ? <Spinner className="size-4" /> : <Icon weight="bold" className="size-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{e.description}</p>
          {e.installmentTotal && (
            <span className="shrink-0 rounded bg-muted/50 px-1 text-[10px] text-muted-foreground">
              {e.installmentNo}/{e.installmentTotal}
            </span>
          )}
          {e.recurringRuleId && (
            <RepeatIcon
              weight="bold"
              className="size-3 shrink-0 text-muted-foreground"
            />
          )}
          {!e.editable && (
            <LockSimpleIcon
              weight="fill"
              className="size-3 shrink-0 text-muted-foreground"
            />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: categoryColor ?? "hsl(var(--muted-foreground))" }}
            />
            {e.categoryName ?? "Sem categoria"}
          </Chip>
          {method && (
            <Chip>
              {isLoan ? (
                <HandCoinsIcon className="size-3" />
              ) : (
                <CreditCardIcon className="size-3" />
              )}
              {method.name}
            </Chip>
          )}
          {card && (
            <Chip
              className="bg-transparent"
              style={{
                color: card.color ?? undefined,
                boxShadow: `inset 0 0 0 1px ${card.color ?? "hsl(var(--border))"}`,
              }}
            >
              {card.name}
              {card.last4 ? ` •••• ${card.last4}` : ""}
            </Chip>
          )}
          {e.cardId && e.invoicePeriod && (
            <Chip>fatura {periodShort(e.invoicePeriod)}</Chip>
          )}
          {person && (
            <Chip className="bg-primary/10 text-primary/90">{person.name}</Chip>
          )}
          <Chip
            className={cn(
              e.scope === "clinic"
                ? "bg-sky-500/10 text-sky-300/90"
                : "bg-muted/40",
            )}
          >
            {e.scope === "clinic" ? "Clínica" : "Pessoal"}
          </Chip>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            income ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {income ? "+" : "−"}
          {formatBRL(e.amount)}
        </p>
        {!e.settled && (
          <p className="text-[10px] text-amber-400/90">
            {invoiceLocked ? "na fatura" : income ? "a receber" : "a pagar"}
          </p>
        )}
      </div>

      {e.editable ? (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={deleting}
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 disabled:opacity-60"
              aria-label="Ações"
            >
              {deleting ? (
                <Spinner className="size-4" />
              ) : (
                <DotsThreeVerticalIcon weight="bold" className="size-4" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <PencilSimpleIcon weight="fill" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:bg-destructive/15"
            >
              <TrashIcon weight="fill" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="size-8 shrink-0" aria-hidden />
      )}
    </div>
  )
}

/** "Fatura do cartão X" — aggregated invoice due this day; click opens it. */
function InvoiceRow({
  invoice: r,
  onOpen,
}: {
  invoice: InvoiceListItem
  onOpen?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/20 disabled:cursor-default sm:px-4"
      title="Abrir a fatura do cartão"
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-white shadow-inner"
        style={{ backgroundColor: r.cardColor }}
      >
        <CreditCardIcon weight="fill" className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          Fatura do cartão {r.cardName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip>fatura {periodShort(r.period)}</Chip>
          <Chip>
            {r.count} {r.count === 1 ? "lançamento" : "lançamentos"}
          </Chip>
          {r.last4 && <Chip>•••• {r.last4}</Chip>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-rose-300">
          −{formatBRL(r.amount)}
        </p>
        {r.settled ? (
          <p className="text-[10px] text-emerald-300">paga</p>
        ) : (
          <p className="text-[10px] text-amber-400/90">a pagar</p>
        )}
      </div>

      <CaretRightIcon
        weight="bold"
        className="size-4 shrink-0 text-muted-foreground"
      />
    </button>
  )
}
