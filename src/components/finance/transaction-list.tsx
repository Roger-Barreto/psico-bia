import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CaretRightIcon,
  CheckIcon,
  DotsThreeVerticalIcon,
  LockSimpleIcon,
  PencilSimpleIcon,
  PiggyBankIcon,
  ProhibitIcon,
  RepeatIcon,
  TrashIcon,
  CreditCardIcon,
  HandCoinsIcon,
} from "@phosphor-icons/react"
import type {
  Cofrinho,
  FinanceCard,
  FinanceCategory,
  LedgerEntry,
  PaymentMethod,
  Person,
} from "@/db/types"
import {
  useDeleteRecurring,
  useDeleteTransaction,
  useSetTransactionSettled,
} from "@/api/queries"
import {
  formatBRL,
  matchesLedgerQuery,
  matchesTokens,
  periodLabel,
  periodShort,
  signedAmount,
} from "@/domain/finance"
import { formatLongDateBR } from "@/domain/dates"
import { colorForKey } from "@/lib/finance-colors"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { RecurringDeleteDialog } from "@/components/finance/recurring-delete-dialog"
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

/** Synthetic "guardar no cofrinho" prompt (expected saving) shown on its day. */
export interface CofrinhoListItem {
  id: string // `${cofrinhoId}:${slotKey}`
  cofrinhoId: string
  cofrinhoName: string
  cofrinhoColor: string
  slotKey: string
  date: string
  period: string
  source: "fixed" | "percent" | "rollover" | "repay" | "repeat"
  expected: number
  saved: number
  pending: number
  status: "pending" | "saved" | "partial" | "skipped"
  /** For repay prompts: description of the purchase being repaid. */
  description?: string | null
}

/** A manual "Adicionar valor" deposit, shown as a ledger line (neutral to the
 *  day subtotal, like the cofrinho prompts). */
export interface CofrinhoDepositItem {
  id: string // entry id
  cofrinhoId: string
  cofrinhoName: string
  cofrinhoColor: string
  date: string
  amount: number
  description: string | null
}

export type CofrinhoAction = "save" | "partial" | "skip"

interface Props {
  entries: LedgerEntry[]
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
  categoriesById?: Map<string, FinanceCategory>
  cardsById?: Map<string, FinanceCard>
  cofrinhosById?: Map<string, Cofrinho>
  /** Card invoices to interleave (grouped on their due date). */
  invoices?: InvoiceListItem[]
  onOpenInvoice?: (inv: InvoiceListItem) => void
  /** Cofrinho savings prompts to interleave (grouped on their date). */
  cofrinhos?: CofrinhoListItem[]
  onCofrinhoAction?: (item: CofrinhoListItem, action: CofrinhoAction) => void
  cofrinhoBusyKey?: string | null
  /** Manual cofrinho deposits to interleave (grouped on their date). */
  cofrinhoDeposits?: CofrinhoDepositItem[]
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
  cofrinhosById,
  invoices,
  onOpenInvoice,
  cofrinhos,
  onCofrinhoAction,
  cofrinhoBusyKey,
  cofrinhoDeposits,
  query,
  emptyLabel,
  onEdit,
}: Props) {
  const setSettled = useSetTransactionSettled()
  const del = useDeleteTransaction()
  const delRecurring = useDeleteRecurring()
  const [recurringDelete, setRecurringDelete] = useState<LedgerEntry | null>(
    null,
  )
  const [cancelingRuleId, setCancelingRuleId] = useState<string | null>(null)

  const togglingId = setSettled.isPending
    ? (setSettled.variables as { id: string } | undefined)?.id
    : undefined
  const deletingId = del.isPending
    ? (del.variables as string | undefined)
    : undefined

  /** "Cancelar recorrência": from this month on it stops showing up —
   *  unsettled rows (this month included) are removed, settled ones stay. */
  async function cancelRecurrence(e: LedgerEntry) {
    if (!e.recurringRuleId) return
    const ok = await confirmDialog({
      title: "Cancelar recorrência",
      description: `“${e.description}” deixa de se repetir a partir de ${periodLabel(e.period)}. Lançamentos deste mês em diante ainda não pagos serão removidos; os já pagos e os meses anteriores são mantidos.`,
      confirmLabel: "Cancelar recorrência",
      cancelLabel: "Voltar",
      destructive: true,
    })
    if (!ok) return
    setCancelingRuleId(e.recurringRuleId)
    try {
      await delRecurring.mutateAsync({
        ruleId: e.recurringRuleId,
        scope: "future",
        fromPeriod: e.period,
      })
      toast.success("Recorrência cancelada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setCancelingRuleId(null)
    }
  }

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
  const cofrinhoRows = (cofrinhos ?? []).filter(
    (r) =>
      !q ||
      matchesTokens(
        `cofrinho guardar ${r.cofrinhoName} ${formatBRL(r.expected)} ${r.date} ${r.status}`,
        q,
      ),
  )
  const cofrinhoDepositRows = (cofrinhoDeposits ?? []).filter(
    (r) =>
      !q ||
      matchesTokens(
        `cofrinho guardado avulso ${r.cofrinhoName} ${r.description ?? ""} ${formatBRL(r.amount)} ${r.date}`,
        q,
      ),
  )

  if (
    filtered.length === 0 &&
    invoiceRows.length === 0 &&
    cofrinhoRows.length === 0 &&
    cofrinhoDepositRows.length === 0
  ) {
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

  // group by day (descending); card invoices + cofrinho prompts land on their day
  const byDay = new Map<
    string,
    {
      entries: LedgerEntry[]
      invoices: InvoiceListItem[]
      cofrinhos: CofrinhoListItem[]
      deposits: CofrinhoDepositItem[]
    }
  >()
  const slotOf = (day: string) => {
    let s = byDay.get(day)
    if (!s) {
      s = { entries: [], invoices: [], cofrinhos: [], deposits: [] }
      byDay.set(day, s)
    }
    return s
  }
  for (const e of filtered) slotOf(e.date).entries.push(e)
  for (const r of invoiceRows) slotOf(r.dueDate).invoices.push(r)
  for (const r of cofrinhoRows) slotOf(r.date).cofrinhos.push(r)
  for (const r of cofrinhoDepositRows) slotOf(r.date).deposits.push(r)
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
              {slot.cofrinhos.map((r) => (
                <CofrinhoRow
                  key={r.id}
                  item={r}
                  busy={cofrinhoBusyKey === r.id}
                  onAction={
                    onCofrinhoAction
                      ? (action) => onCofrinhoAction(r, action)
                      : undefined
                  }
                />
              ))}
              {slot.deposits.map((r) => (
                <CofrinhoDepositRow key={r.id} item={r} />
              ))}
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
                  cofrinho={
                    e.cofrinhoId ? cofrinhosById?.get(e.cofrinhoId) : undefined
                  }
                  toggling={togglingId === e.id}
                  deleting={
                    deletingId === e.id ||
                    (!!e.recurringRuleId &&
                      cancelingRuleId === e.recurringRuleId)
                  }
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
                  onCancelRecurrence={
                    e.recurringRuleId
                      ? () => cancelRecurrence(e)
                      : undefined
                  }
                  onDelete={async () => {
                    if (!e.editable) return
                    // Recurring rows get the two-choice dialog: only this
                    // month, or this one + cancel the recurrence.
                    if (e.recurringRuleId) {
                      setRecurringDelete(e)
                      return
                    }
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

      <RecurringDeleteDialog
        open={!!recurringDelete}
        onOpenChange={(v) => {
          if (!v) setRecurringDelete(null)
        }}
        entry={recurringDelete}
      />
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
  cofrinho,
  categoryColor,
  toggling,
  deleting,
  onEdit,
  onToggle,
  onDelete,
  onCancelRecurrence,
}: {
  entry: LedgerEntry
  method?: PaymentMethod
  person?: Person
  card?: FinanceCard
  cofrinho?: Cofrinho
  categoryColor?: string | null
  toggling?: boolean
  deleting?: boolean
  onEdit?: () => void
  onToggle: () => void
  onDelete: () => void
  /** Recurring rows only: stop the recurrence from this month onward. */
  onCancelRecurrence?: () => void
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
          {cofrinho && (
            <Chip
              className="bg-transparent"
              style={{
                color: cofrinho.color ?? undefined,
                boxShadow: `inset 0 0 0 1px ${cofrinho.color ?? "hsl(var(--border))"}`,
              }}
            >
              <PiggyBankIcon className="size-3" />
              {cofrinho.name}
            </Chip>
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
            {onCancelRecurrence && (
              <DropdownMenuItem onClick={onCancelRecurrence}>
                <ProhibitIcon weight="bold" /> Cancelar recorrência
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

const COFRINHO_SOURCE_TAG: Record<CofrinhoListItem["source"], string> = {
  fixed: "meta do mês",
  percent: "% do faturamento",
  rollover: "sobra do mês anterior",
  repay: "repor o cofrinho",
  repeat: "guardar programado",
}

/** Row background + icon-circle color per resolution status. */
const COFRINHO_TONE: Record<
  CofrinhoListItem["status"],
  { bg: string; circle: string }
> = {
  pending: { bg: "bg-amber-500/[0.06]", circle: "" },
  partial: { bg: "bg-amber-500/[0.08]", circle: "bg-amber-500" },
  saved: { bg: "bg-emerald-500/[0.07]", circle: "bg-emerald-500" },
  skipped: { bg: "bg-rose-500/[0.06]", circle: "bg-rose-500" },
}

/** "Guardar no cofrinho X" — an expected-saving prompt, styled by status:
 *  pending = amber + actions; partial = amber + discreet edit; saved = green;
 *  skipped = red. Repay prompts show the purchase being repaid. */
function CofrinhoRow({
  item: r,
  busy,
  onAction,
}: {
  item: CofrinhoListItem
  busy?: boolean
  onAction?: (action: CofrinhoAction) => void
}) {
  const tone = COFRINHO_TONE[r.status]
  const title =
    r.source === "repay"
      ? `Repor o cofrinho ${r.cofrinhoName}`
      : `Guardar no ${r.cofrinhoName}`

  return (
    <div className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", tone.bg)}>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-white shadow-inner"
        style={tone.circle ? undefined : { backgroundColor: r.cofrinhoColor }}
      >
        <span className={cn("grid size-9 place-items-center rounded-full", tone.circle)}>
          {r.status === "skipped" ? (
            <ProhibitIcon weight="bold" className="size-4" />
          ) : r.status === "saved" ? (
            <CheckIcon weight="bold" className="size-4" />
          ) : (
            <PiggyBankIcon weight="fill" className="size-4" />
          )}
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip className="bg-amber-500/15 text-amber-200/90">
            {COFRINHO_SOURCE_TAG[r.source]}
          </Chip>
          {r.source === "repay" && r.description ? (
            <Chip className="max-w-[16rem] truncate">{r.description}</Chip>
          ) : (
            <Chip>meta {formatBRL(r.expected)}</Chip>
          )}
          {r.status === "partial" && (
            <Chip className="bg-amber-500/20 text-amber-200">
              parcial · {formatBRL(r.saved)} de {formatBRL(r.expected)}
            </Chip>
          )}
        </div>
      </div>

      {onAction && r.status === "pending" ? (
        <div className="flex shrink-0 items-center gap-1">
          {busy ? (
            <Spinner className="mr-1 size-4" />
          ) : (
            <>
              <button
                type="button"
                onClick={() => onAction("save")}
                className="rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/30"
                title={`Guardar ${formatBRL(r.pending)}`}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => onAction("partial")}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Parcial
              </button>
              <button
                type="button"
                onClick={() => onAction("skip")}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Pular
              </button>
            </>
          )}
        </div>
      ) : r.status === "partial" ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-amber-300">
            {formatBRL(r.saved)}
          </span>
          {onAction &&
            (busy ? (
              <Spinner className="size-4" />
            ) : (
              <button
                type="button"
                onClick={() => onAction("partial")}
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                title="Editar / guardar o restante"
              >
                <PencilSimpleIcon weight="fill" className="size-3.5" />
              </button>
            ))}
        </div>
      ) : (
        <div className="shrink-0 text-right">
          {r.status === "saved" && (
            <p className="text-sm font-semibold tabular-nums text-emerald-300">
              +{formatBRL(r.saved)}
            </p>
          )}
          <p
            className={cn(
              "text-[10px]",
              r.status === "saved" && "text-emerald-300",
              r.status === "skipped" && "text-rose-300",
            )}
          >
            {r.status === "saved" ? "guardado" : "pulado"}
          </p>
        </div>
      )}
    </div>
  )
}

/** "Guardado no cofrinho X" — a manual deposit ("Adicionar valor"), shown as a
 *  ledger line. Neutral to the day subtotal; mirrors the cofrinho's own
 *  movimentações. */
function CofrinhoDepositRow({ item: r }: { item: CofrinhoDepositItem }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-white shadow-inner"
        style={{ backgroundColor: r.cofrinhoColor }}
      >
        <PiggyBankIcon weight="fill" className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {r.description?.trim() || `Guardado em ${r.cofrinhoName}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip
            className="bg-transparent"
            style={{
              color: r.cofrinhoColor,
              boxShadow: `inset 0 0 0 1px ${r.cofrinhoColor}`,
            }}
          >
            <PiggyBankIcon className="size-3" />
            {r.cofrinhoName}
          </Chip>
          <Chip className="bg-emerald-500/10 text-emerald-200/90">avulso</Chip>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-emerald-300">
          +{formatBRL(r.amount)}
        </p>
        <p className="text-[10px] text-muted-foreground">no cofrinho</p>
      </div>
    </div>
  )
}
