import { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput, parseMoney } from "@/components/ui/money-input"
import { ColorPicker } from "@/components/finance/color-picker"
import { useCreateCofrinho, useUpdateCofrinho } from "@/api/queries"
import type {
  Cofrinho,
  CofrinhoGoalType,
  CofrinhoIncomeScope,
} from "@/db/types"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing?: Cofrinho | null
  onCreated?: (id: string) => void
}

function formatMoneyValue(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-amber-500/15 text-amber-300"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function clampDay(v: string): string {
  const n = v.replace(/\D/g, "")
  if (n === "") return ""
  return String(Math.max(1, Math.min(31, Number(n))))
}

function clampPercent(v: string): string {
  const n = v.replace(/[^\d.,]/g, "").replace(",", ".")
  if (n === "") return ""
  const num = Number(n)
  if (!Number.isFinite(num)) return ""
  return String(Math.max(0, Math.min(100, num)))
}

export function CofrinhoDialog({ open, onOpenChange, editing, onCreated }: Props) {
  const create = useCreateCofrinho()
  const update = useUpdateCofrinho()

  const [name, setName] = useState("")
  const [color, setColor] = useState<string | null>(null)
  const [goalType, setGoalType] = useState<CofrinhoGoalType>("fixed")
  const [percent, setPercent] = useState("")
  const [incomeScope, setIncomeScope] = useState<CofrinhoIncomeScope>("all")
  const [fixedAmount, setFixedAmount] = useState("")
  const [fixedDay, setFixedDay] = useState("5")
  const [initialAmount, setInitialAmount] = useState("")

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setColor(editing.color)
      setGoalType(editing.goalType)
      setPercent(editing.percent != null ? String(editing.percent) : "")
      setIncomeScope(editing.incomeScope)
      setFixedAmount(
        editing.fixedAmount != null ? formatMoneyValue(editing.fixedAmount) : "",
      )
      setFixedDay(editing.fixedDay != null ? String(editing.fixedDay) : "5")
      setInitialAmount(
        editing.initialAmount ? formatMoneyValue(editing.initialAmount) : "",
      )
    } else {
      setName("")
      setColor("#eab308")
      setGoalType("fixed")
      setPercent("")
      setIncomeScope("all")
      setFixedAmount("")
      setFixedDay("5")
      setInitialAmount("")
    }
  }, [open, editing])

  const busy = create.isPending || update.isPending
  const percentNum = Math.max(0, Math.min(100, Number(percent) || 0))
  const fixedDayNum = Math.max(1, Math.min(31, Number(fixedDay) || 1))

  async function save() {
    if (!name.trim()) return toast.error("Informe um nome")
    if (goalType === "percent" && percentNum <= 0)
      return toast.error("Informe a porcentagem")
    if (goalType === "fixed" && parseMoney(fixedAmount) <= 0)
      return toast.error("Informe o valor mensal")
    try {
      const payload = {
        name: name.trim(),
        color,
        goalType,
        percent: goalType === "percent" ? percentNum : null,
        fixedAmount: goalType === "fixed" ? parseMoney(fixedAmount) : null,
        fixedDay: goalType === "fixed" ? fixedDayNum : null,
        incomeScope,
        initialAmount: initialAmount ? parseMoney(initialAmount) : 0,
      }
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload })
        toast.success("Cofrinho atualizado")
      } else {
        const c = await create.mutateAsync(payload)
        toast.success("Cofrinho criado")
        onCreated?.(c.id)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  const swatch = color ?? colorForKey(name || "cofrinho")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cofrinho" : "Novo cofrinho"}</DialogTitle>
          <DialogDescription>
            Uma reserva com meta mensal: uma % do que você recebe, ou um valor
            fixo num dia do mês.
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
            <div className="flex-1">
              <Field label="Nome">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Reserva de emergência, Viagem…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      save()
                    }
                  }}
                />
              </Field>
            </div>
          </div>

          <Field label="Tipo de meta">
            <Segmented
              value={goalType}
              onChange={setGoalType}
              options={[
                { value: "fixed", label: "Valor fixo mensal" },
                { value: "percent", label: "% do faturamento" },
              ]}
            />
          </Field>

          {goalType === "fixed" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor mensal">
                <MoneyInput value={fixedAmount} onChange={setFixedAmount} />
              </Field>
              <Field label="Dia do mês" hint="Quando o lembrete aparece.">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={fixedDay}
                  onChange={(e) => setFixedDay(clampDay(e.target.value))}
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-4">
              <Field
                label="Porcentagem"
                hint="A cada recebimento, esta % vira uma meta de guardar no dia."
              >
                <div className="relative">
                  <Input
                    inputMode="decimal"
                    value={percent}
                    onChange={(e) => setPercent(clampPercent(e.target.value))}
                    placeholder="10"
                    className="pr-8"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    %
                  </span>
                </div>
              </Field>
              <Field label="Incide sobre">
                <Segmented
                  value={incomeScope}
                  onChange={setIncomeScope}
                  options={[
                    { value: "all", label: "Toda receita" },
                    { value: "clinic", label: "Só a clínica" },
                  ]}
                />
              </Field>
            </div>
          )}

          <Field
            label="Valor inicial (opcional)"
            hint="Quanto o cofrinho já tem guardado hoje."
          >
            <MoneyInput value={initialAmount} onChange={setInitialAmount} />
          </Field>

          <Field label="Cor">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
