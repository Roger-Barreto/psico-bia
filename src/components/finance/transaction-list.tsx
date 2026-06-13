import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  DotsThreeVerticalIcon,
  LockSimpleIcon,
  RepeatIcon,
  TrashIcon,
  CreditCardIcon,
  HandCoinsIcon,
} from "@phosphor-icons/react"
import type { LedgerEntry, PaymentMethod, Person } from "@/db/types"
import {
  useDeleteTransaction,
  useSetTransactionSettled,
} from "@/api/queries"
import { formatBRL } from "@/domain/finance"
import { formatDateBR } from "@/domain/dates"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Props {
  entries: LedgerEntry[]
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
}

export function TransactionList({ entries, methodsById, peopleById }: Props) {
  const setSettled = useSetTransactionSettled()
  const del = useDeleteTransaction()

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum lançamento neste mês.
      </p>
    )
  }

  // group by day (descending)
  const byDay = new Map<string, LedgerEntry[]>()
  for (const e of entries) {
    const arr = byDay.get(e.date) ?? []
    arr.push(e)
    byDay.set(e.date, arr)
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day} className="space-y-1.5">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {formatDateBR(day)}
          </p>
          {byDay.get(day)!.map((e) => (
            <Row
              key={e.id}
              entry={e}
              method={
                e.paymentMethodId
                  ? methodsById.get(e.paymentMethodId)
                  : undefined
              }
              person={e.personId ? peopleById.get(e.personId) : undefined}
              onToggle={async () => {
                if (!e.editable) return
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
        </div>
      ))}
    </div>
  )
}

function Row({
  entry: e,
  method,
  person,
  onToggle,
  onDelete,
}: {
  entry: LedgerEntry
  method?: PaymentMethod
  person?: Person
  onToggle: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const income = e.kind === "income"
  const Icon = income ? ArrowUpRightIcon : ArrowDownLeftIcon
  const isLoan = method?.isLoan ?? false

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={!e.editable}
        title={
          e.editable
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
          !e.editable && "cursor-default opacity-90",
        )}
      >
        <Icon weight="bold" className="size-4" />
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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{e.categoryName ?? "Sem categoria"}</span>
          {method && (
            <span className="flex items-center gap-1">
              {isLoan ? (
                <HandCoinsIcon className="size-3" />
              ) : (
                <CreditCardIcon className="size-3" />
              )}
              {method.name}
            </span>
          )}
          {person && <span className="text-primary/80">· {person.name}</span>}
          <span
            className={cn(
              "rounded px-1",
              e.scope === "clinic"
                ? "bg-sky-500/10 text-sky-300/90"
                : "bg-muted/40",
            )}
          >
            {e.scope === "clinic" ? "Clínica" : "Pessoal"}
          </span>
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
            {income ? "a receber" : "a pagar"}
          </p>
        )}
      </div>

      {e.editable && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
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
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:bg-destructive/15"
            >
              <TrashIcon weight="fill" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
