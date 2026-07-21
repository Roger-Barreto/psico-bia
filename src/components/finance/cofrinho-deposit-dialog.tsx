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
import { useAddCofrinhoDeposit, useCofrinhos } from "@/api/queries"
import { todayISO } from "@/domain/dates"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

type Dest = "abater" | "extra"

/** Add a value to a cofrinho at any time (not tied to a generated prompt). The
 *  user chooses whether it abates the month's goal or is just an extra deposit.
 *  Opened locked to one cofrinho (from its panel) or with a picker (from the
 *  ledger). */
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
  const add = useAddCofrinhoDeposit()

  const active = useMemo(
    () => (cofrinhosQ.data ?? []).filter((c) => c.active),
    [cofrinhosQ.data],
  )

  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState("")
  const [dest, setDest] = useState<Dest>("abater")
  const [pickedId, setPickedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmount("")
      setDate(todayISO())
      setDescription("")
      setDest("abater")
      setPickedId(null)
    }
  }, [open])

  const locked = !!cofrinhoId
  const selectedId = cofrinhoId ?? pickedId ?? active[0]?.id ?? ""
  const selected = active.find((c) => c.id === selectedId) ?? null
  const swatch = selected
    ? (selected.color ?? colorForKey(selected.name))
    : "#eab308"

  // Which slot the deposit lands on decides whether it abates a goal.
  const slotKey =
    dest === "extra" || !selected
      ? null
      : selected.goalType === "fixed"
        ? `fixed:${date.slice(0, 7)}`
        : `pct:${date}`

  async function submit() {
    const amountNum = parseMoney(amount)
    if (!selected) return toast.error("Escolha um cofrinho")
    if (amountNum <= 0) return toast.error("Informe um valor")
    try {
      await add.mutateAsync({
        cofrinhoId: selected.id,
        amount: amountNum,
        date,
        slotKey,
        description,
      })
      toast.success("Valor adicionado")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar valor</DialogTitle>
          <DialogDescription>
            {locked && selected
              ? `Guardar um valor em ${selected.name}, a qualquer momento.`
              : "Guarde um valor num cofrinho, a qualquer momento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-inner"
              style={{ backgroundColor: swatch }}
            >
              <PiggyBankIcon weight="fill" className="size-5" />
            </span>
            {locked ? (
              <p className="text-lg font-semibold tracking-tight">
                {selected?.name ?? "Cofrinho"}
              </p>
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
              placeholder="Ex: sobra do mês, 13º salário…"
              maxLength={80}
            />
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={add.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
