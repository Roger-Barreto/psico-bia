import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { PiggyBankIcon } from "@phosphor-icons/react"
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
  useAddCofrinhoDeposit,
  useAllCofrinhoEntries,
  useCofrinhos,
  useCofrinhoWithdrawals,
  useScheduleCofrinhoRepeat,
  useWithdrawCofrinho,
} from "@/api/queries"
import { entriesNet } from "@/domain/cofrinhos"
import { formatBRL, installmentDates } from "@/domain/finance"
import { todayISO } from "@/domain/dates"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

type Op = "guardar" | "retirar"
type Dest = "abater" | "extra"

/** Move money in/out of a cofrinho at any time. "Guardar" deposits (once or
 *  scheduled for N months); "Retirar" takes money back out of the reserve.
 *  Opened locked to one cofrinho (from its panel) or with a picker. */
export function CofrinhoDepositDialog({
  open,
  onOpenChange,
  cofrinhoId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  cofrinhoId?: string
}) {
  const cofrinhosQ = useCofrinhos()
  const entriesQ = useAllCofrinhoEntries()
  const withdrawalsQ = useCofrinhoWithdrawals()
  const add = useAddCofrinhoDeposit()
  const withdraw = useWithdrawCofrinho()
  const schedule = useScheduleCofrinhoRepeat()

  const active = useMemo(
    () => (cofrinhosQ.data ?? []).filter((c) => c.active),
    [cofrinhosQ.data],
  )

  const [op, setOp] = useState<Op>("guardar")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState("")
  const [dest, setDest] = useState<Dest>("abater")
  const [repeat, setRepeat] = useState(false)
  const [months, setMonths] = useState("6")
  const [pickedId, setPickedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setOp("guardar")
      setAmount("")
      setDate(todayISO())
      setDescription("")
      setDest("abater")
      setRepeat(false)
      setMonths("6")
      setPickedId(null)
    }
  }, [open])

  const locked = !!cofrinhoId
  const selectedId = cofrinhoId ?? pickedId ?? active[0]?.id ?? ""
  const selected = active.find((c) => c.id === selectedId) ?? null
  const swatch = selected
    ? (selected.color ?? colorForKey(selected.name))
    : "#eab308"

  // Balance of the selected cofrinho (for "retirar" validation).
  const balance = useMemo(() => {
    if (!selected) return 0
    const mine = (entriesQ.data ?? []).filter(
      (e) => e.cofrinhoId === selected.id,
    )
    const w = withdrawalsQ.data ?? new Map<string, number>()
    return (
      (selected.initialAmount ?? 0) +
      entriesNet(mine) -
      (w.get(selected.id) ?? 0)
    )
  }, [selected, entriesQ.data, withdrawalsQ.data])

  const nMonths = Math.max(2, Math.min(360, Number(months) || 2))

  // Livre ('none') e objetivo sem aporte mensal não têm meta para abater.
  const hasGoalSlot =
    !!selected &&
    (selected.goalType === "fixed" ||
      selected.goalType === "percent" ||
      (selected.goalType === "target" && selected.fixedAmount != null))

  // Which slot an immediate deposit lands on decides whether it abates a goal.
  const slotKey =
    dest === "extra" || !selected || !hasGoalSlot
      ? null
      : selected.goalType === "percent"
        ? `pct:${date}`
        : `fixed:${date.slice(0, 7)}`

  async function submit() {
    const amountNum = parseMoney(amount)
    if (!selected) return toast.error("Escolha um cofrinho")
    if (amountNum <= 0) return toast.error("Informe um valor")
    try {
      if (op === "retirar") {
        if (amountNum > balance + 0.005)
          return toast.error("Valor maior que o saldo do cofrinho")
        await withdraw.mutateAsync({
          cofrinhoId: selected.id,
          amount: amountNum,
          date,
          description,
        })
        toast.success("Valor retirado")
      } else if (repeat) {
        await schedule.mutateAsync({
          cofrinhoId: selected.id,
          amount: amountNum,
          dates: installmentDates(date, nMonths),
        })
        toast.success(`Programado para ${nMonths} meses`)
      } else {
        await add.mutateAsync({
          cofrinhoId: selected.id,
          amount: amountNum,
          date,
          slotKey,
          description,
        })
        toast.success("Valor adicionado")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  const busy = add.isPending || withdraw.isPending || schedule.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar cofrinho</DialogTitle>
          <DialogDescription>
            {locked && selected
              ? `Guardar ou retirar valor de ${selected.name}, a qualquer momento.`
              : "Guarde ou retire um valor de um cofrinho, a qualquer momento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-flow-col gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
            {(
              [
                { value: "guardar", label: "Guardar" },
                { value: "retirar", label: "Retirar" },
              ] as { value: Op; label: string }[]
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOp(o.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  op === o.value
                    ? o.value === "retirar"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-emerald-500/15 text-emerald-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-inner"
              style={{ backgroundColor: swatch }}
            >
              <PiggyBankIcon weight="fill" className="size-5" />
            </span>
            {locked ? (
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">
                  {selected?.name ?? "Cofrinho"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Saldo: {formatBRL(balance)}
                </p>
              </div>
            ) : (
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Cofrinho
                </label>
                <Select
                  value={selectedId}
                  onValueChange={(v) => setPickedId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um cofrinho" />
                  </SelectTrigger>
                  <SelectContent>
                    {active.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: c.color ?? colorForKey(c.name),
                            }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                {op === "guardar" && repeat ? "1º mês" : "Data"}
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {!locked && op === "retirar" && selected && (
            <p className="text-xs text-muted-foreground">
              Saldo disponível:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatBRL(balance)}
              </span>
            </p>
          )}

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
              placeholder={
                op === "retirar"
                  ? "Ex: usei numa emergência"
                  : "Ex: sobra do mês, 13º salário…"
              }
              maxLength={80}
            />
          </div>

          {op === "guardar" && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                  className="size-4 rounded border-border accent-amber-500"
                />
                Repetir este valor por vários meses
              </label>
              {repeat && (
                <div className="grid grid-cols-2 items-end gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Quantos meses
                    </label>
                    <Input
                      type="number"
                      min={2}
                      max={360}
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                    />
                  </div>
                  <p className="pb-2.5 text-xs text-muted-foreground">
                    Vira um lembrete de guardar por {nMonths} meses.
                  </p>
                </div>
              )}
            </div>
          )}

          {op === "guardar" && !repeat && hasGoalSlot && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Destino
              </label>
              <div className="grid grid-flow-col gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
                {(
                  [
                    { value: "abater", label: "Abater da meta" },
                    { value: "extra", label: "Somar como extra" },
                  ] as { value: Dest; label: string }[]
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setDest(o.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      dest === o.value
                        ? "bg-amber-500/15 text-amber-300"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/80">
                {dest === "abater"
                  ? "Conta para o que você precisa guardar no mês (reduz “A guardar”)."
                  : "Vai direto para a reserva, sem mexer na meta do mês."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
            {op === "retirar" ? "Retirar" : repeat ? "Programar" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
