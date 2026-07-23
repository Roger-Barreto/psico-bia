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
import { Input } from "@/components/ui/input"
import { MoneyInput, parseMoney } from "@/components/ui/money-input"
import { useUpdateCofrinhoEntry } from "@/api/queries"
import type { CofrinhoEntry } from "@/db/types"

function formatMoneyValue(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Edit a saved cofrinho movement (a deposit or a withdraw): amount, date and
 *  note. Gives the user full control over records already in the history. */
export function CofrinhoEntryDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  entry: CofrinhoEntry | null
}) {
  const update = useUpdateCofrinhoEntry()
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (open && entry) {
      setAmount(formatMoneyValue(entry.amount))
      setDate(entry.date)
      setDescription(entry.description ?? "")
    }
  }, [open, entry])

  if (!entry) return null
  const isWithdraw = entry.kind === "withdraw"

  async function submit() {
    const amountNum = parseMoney(amount)
    if (amountNum <= 0) return toast.error("Informe um valor")
    try {
      await update.mutateAsync({
        id: entry!.id,
        amount: amountNum,
        date,
        description,
      })
      toast.success("Registro atualizado")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isWithdraw ? "Editar retirada" : "Editar guardado"}
          </DialogTitle>
          <DialogDescription>
            Ajuste o valor, a data ou a descrição deste registro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Valor
              </label>
              <MoneyInput value={amount} onChange={setAmount} autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Data
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Descrição{" "}
              <span className="font-normal text-muted-foreground/60">
                (opcional)
              </span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={80}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={update.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
