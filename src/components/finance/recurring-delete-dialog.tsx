import { useState } from "react"
import { toast } from "sonner"
import { ProhibitIcon, TrashIcon } from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDeleteRecurring } from "@/api/queries"
import type { LedgerEntry } from "@/db/types"
import { periodLabel } from "@/domain/finance"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** The recurring ledger row being deleted (must have recurringRuleId). */
  entry: LedgerEntry | null
}

type Choice = "one" | "one_and_future"

/**
 * Delete flow for a recurring launch: either remove only the clicked month
 * (it never comes back — the month is tombstoned) or remove it and cancel
 * the recurrence (future months are wiped; past/settled ones stay).
 */
export function RecurringDeleteDialog({ open, onOpenChange, entry }: Props) {
  const del = useDeleteRecurring()
  const [pending, setPending] = useState<Choice | null>(null)

  if (!entry) return null

  const month = periodLabel(entry.period)

  async function run(scope: Choice) {
    if (!entry?.recurringRuleId || pending) return
    setPending(scope)
    try {
      await del.mutateAsync({
        ruleId: entry.recurringRuleId,
        scope,
        fromPeriod: entry.period,
      })
      toast.success(
        scope === "one"
          ? "Lançamento excluído"
          : "Lançamento excluído e recorrência cancelada",
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setPending(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir lançamento recorrente</DialogTitle>
          <DialogDescription>
            “{entry.description}” se repete todo mês. O que você quer excluir?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <OptionButton
            icon={<TrashIcon weight="fill" className="size-4" />}
            title="Excluir somente este"
            description={`Apaga só o lançamento de ${month}. Os próximos meses continuam aparecendo.`}
            busy={pending === "one"}
            disabled={!!pending}
            onClick={() => run("one")}
          />
          <OptionButton
            icon={<ProhibitIcon weight="bold" className="size-4" />}
            title="Excluir e cancelar recorrência"
            description={`Apaga o de ${month} e os meses seguintes. Meses anteriores e lançamentos já pagos são mantidos.`}
            busy={pending === "one_and_future"}
            disabled={!!pending}
            strong
            onClick={() => run("one_and_future")}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={!!pending}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionButton({
  icon,
  title,
  description,
  busy,
  disabled,
  strong,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  busy?: boolean
  disabled?: boolean
  strong?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
        strong
          ? "border-destructive/40 bg-destructive/10 hover:bg-destructive/20"
          : "border-border/60 hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md",
          strong
            ? "bg-destructive/20 text-destructive"
            : "bg-muted/40 text-muted-foreground",
        )}
      >
        {busy ? <Spinner className="size-4" /> : icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-medium",
            strong && "text-destructive",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}
