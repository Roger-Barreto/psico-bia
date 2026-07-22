import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowRightIcon, PiggyBankIcon } from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput, parseMoney } from "@/components/ui/money-input"
import {
  useAllCofrinhoEntries,
  useCofrinhos,
  useCofrinhoWithdrawals,
  useTransferCofrinho,
} from "@/api/queries"
import { entriesNet } from "@/domain/cofrinhos"
import { formatBRL } from "@/domain/finance"
import { todayISO } from "@/domain/dates"
import { colorForKey } from "@/lib/finance-colors"

/** Move money from one cofrinho to another. Opens locked to a source (from its
 *  panel/menu) or with a source picker. Neutral to the ledger. */
export function CofrinhoTransferDialog({
  open,
  onOpenChange,
  fromId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  fromId?: string
}) {
  const cofrinhosQ = useCofrinhos()
  const entriesQ = useAllCofrinhoEntries()
  const withdrawalsQ = useCofrinhoWithdrawals()
  const transfer = useTransferCofrinho()

  const active = useMemo(
    () => (cofrinhosQ.data ?? []).filter((c) => c.active),
    [cofrinhosQ.data],
  )

  // Balance per cofrinho: initial + entry-net − ledger withdrawals.
  const balanceById = useMemo(() => {
    const withdrawals = withdrawalsQ.data ?? new Map<string, number>()
    const byId = new Map<string, number>()
    const entries = entriesQ.data ?? []
    for (const c of active) {
      const mine = entries.filter((e) => e.cofrinhoId === c.id)
      byId.set(
        c.id,
        (c.initialAmount ?? 0) + entriesNet(mine) - (withdrawals.get(c.id) ?? 0),
      )
    }
    return byId
  }, [active, entriesQ.data, withdrawalsQ.data])

  const [pickedFrom, setPickedFrom] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      setPickedFrom(null)
      setToId(null)
      setAmount("")
      setDate(todayISO())
      setNote("")
    }
  }, [open])

  const sourceId = fromId ?? pickedFrom ?? active[0]?.id ?? ""
  const source = active.find((c) => c.id === sourceId) ?? null
  const targets = active.filter((c) => c.id !== sourceId)
  const sourceBalance = balanceById.get(sourceId) ?? 0
  const amountNum = parseMoney(amount)

  async function submit() {
    if (!source) return toast.error("Escolha o cofrinho de origem")
    if (!toId) return toast.error("Escolha o cofrinho de destino")
    if (toId === sourceId) return toast.error("Escolha cofrinhos diferentes")
    if (amountNum <= 0) return toast.error("Informe um valor")
    if (amountNum > sourceBalance + 0.005)
      return toast.error("Valor maior que o saldo do cofrinho de origem")
    const target = active.find((c) => c.id === toId)
    if (!target) return
    try {
      await transfer.mutateAsync({
        fromId: source.id,
        toId: target.id,
        fromName: source.name,
        toName: target.name,
        amount: amountNum,
        date,
        note,
      })
      toast.success(`Transferido para ${target.name}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir entre cofrinhos</DialogTitle>
          <DialogDescription>
            Move dinheiro de um cofrinho para outro. Não entra como despesa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                De
              </label>
              {fromId ? (
                <div className="flex h-9 items-center gap-2 rounded-md border border-border/60 px-2.5 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        source?.color ?? colorForKey(source?.name ?? ""),
                    }}
                  />
                  <span className="truncate">{source?.name ?? "Cofrinho"}</span>
                </div>
              ) : (
                <Select
                  value={sourceId}
                  onValueChange={(v) => {
                    setPickedFrom(v)
                    if (v === toId) setToId(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {active.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <ArrowRightIcon
              weight="bold"
              className="mb-2 size-4 shrink-0 text-muted-foreground"
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Para
              </label>
              <Select value={toId ?? undefined} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Destino" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <PiggyBankIcon weight="fill" className="size-3.5 text-amber-400" />
            Saldo disponível em {source?.name ?? "origem"}:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatBRL(sourceBalance)}
            </span>
          </div>

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
              Observação{" "}
              <span className="font-normal text-muted-foreground/60">
                (opcional)
              </span>
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: sobrou da viagem"
              maxLength={80}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={transfer.isPending}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
