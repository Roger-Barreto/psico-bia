import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MoneyInput, parseMoney } from "@/components/ui/money-input"
import { useResolveCofrinhoSlot } from "@/api/queries"
import type { CofrinhoEntrySource } from "@/db/types"
import { formatBRL } from "@/domain/finance"
import { nextPeriod } from "@/domain/cofrinhos"

export interface ResolveTarget {
  cofrinhoId: string
  cofrinhoName: string
  slotKey: string
  date: string // YYYY-MM-DD
  period: string // YYYY-MM
  source: CofrinhoEntrySource
  expected: number
  saved: number
  pending: number
}

function formatMoneyValue(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Partial-deposit dialog: enter how much to save; for fixed goals offer to
 *  carry the leftover to next month as a new goal. */
export function CofrinhoResolveDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  target: ResolveTarget | null
}) {
  const resolve = useResolveCofrinhoSlot()
  const [amount, setAmount] = useState("")
  const [rollover, setRollover] = useState(true)

  useEffect(() => {
    if (open && target) {
      setAmount(formatMoneyValue(target.pending))
      setRollover(true)
    }
  }, [open, target])

  if (!target) return null

  const amountNum = parseMoney(amount)
  const canRollover = target.source === "fixed" || target.source === "rollover"
  const remaining = Math.max(0, Math.round((target.expected - target.saved - amountNum) * 100) / 100)
  const showRollover = canRollover && remaining > 0.005

  // Rollover lands on the same day-of-month, next month.
  const rolloverToDate = `${nextPeriod(target.period)}-${target.date.slice(8, 10)}`

  async function submit() {
    if (amountNum <= 0) return toast.error("Informe um valor")
    try {
      await resolve.mutateAsync({
        cofrinhoId: target!.cofrinhoId,
        slotKey: target!.slotKey,
        date: target!.date,
        source: target!.source,
        amount: amountNum,
        expected: target!.expected - target!.saved,
        rolloverToDate: showRollover && rollover ? rolloverToDate : null,
        parentId: target!.slotKey,
      })
      toast.success("Guardado")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar em {target.cofrinhoName}</DialogTitle>
          <DialogDescription>
            Meta do dia: {formatBRL(target.expected)}
            {target.saved > 0.005 && ` · já guardado: ${formatBRL(target.saved)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Quanto você guardou?
            </label>
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </div>

          {showRollover && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <input
                type="checkbox"
                checked={rollover}
                onChange={(e) => setRollover(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border accent-amber-500"
              />
              <span>
                Carregar o que faltou (
                <span className="font-medium text-amber-300">
                  {formatBRL(remaining)}
                </span>
                ) como meta do próximo mês.
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={resolve.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
