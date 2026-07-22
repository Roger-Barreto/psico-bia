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
            "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
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

const GOAL_HINT: Record<CofrinhoGoalType, string> = {
  none: "Guarde quando quiser. Sem meta e sem lembretes mensais.",
  target:
    "Junte um valor total, ex.: R$ 2.000 para uma viagem. O guardado pode passar da meta.",
  fixed: "Guardar um valor fixo todo mês, sem data para acabar.",
  percent: "A cada recebimento, uma % vira meta de guardar no dia.",
}

export function CofrinhoDialog({ open, onOpenChange, editing, onCreated }: Props) {
  const create = useCreateCofrinho()
  const update = useUpdateCofrinho()

  const [name, setName] = useState("")
  const [color, setColor] = useState<string | null>(null)
  const [goalType, setGoalType] = useState<CofrinhoGoalType>("none")
  const [percent, setPercent] = useState("")
  const [incomeScope, setIncomeScope] = useState<CofrinhoIncomeScope>("all")
  const [fixedAmount, setFixedAmount] = useState("")
  const [fixedDay, setFixedDay] = useState("5")
  const [targetAmount, setTargetAmount] = useState("")
  const [monthly, setMonthly] = useState(false) // target: aporte mensal opcional
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
      setTargetAmount(
        editing.targetAmount != null
          ? formatMoneyValue(editing.targetAmount)
          : "",
      )
      setMonthly(editing.goalType === "target" && editing.fixedAmount != null)
      setInitialAmount(
        editing.initialAmount ? formatMoneyValue(editing.initialAmount) : "",
      )
    } else {
      setName("")
      setColor("#eab308")
      setGoalType("none")
      setPercent("")
      setIncomeScope("all")
      setFixedAmount("")
      setFixedDay("5")
      setTargetAmount("")
      setMonthly(false)
      setInitialAmount("")
    }
  }, [open, editing])

  const busy = create.isPending || update.isPending
  const percentNum = Math.max(0, Math.min(100, Number(percent) || 0))
  const fixedDayNum = Math.max(1, Math.min(31, Number(fixedDay) || 1))
  const withMonthly = goalType === "fixed" || (goalType === "target" && monthly)

  async function save() {
    if (!name.trim()) return toast.error("Informe um nome")
    if (goalType === "percent" && percentNum <= 0)
      return toast.error("Informe a porcentagem")
    if (goalType === "fixed" && parseMoney(fixedAmount) <= 0)
      return toast.error("Informe o valor mensal")
    if (goalType === "target" && parseMoney(targetAmount) <= 0)
      return toast.error("Informe o valor do objetivo")
    if (goalType === "target" && monthly && parseMoney(fixedAmount) <= 0)
      return toast.error("Informe o valor a guardar por mês")
    try {
      const payload = {
        name: name.trim(),
        color,
        goalType,
        percent: goalType === "percent" ? percentNum : null,
        fixedAmount: withMonthly ? parseMoney(fixedAmount) : null,
        fixedDay: withMonthly ? fixedDayNum : null,
        incomeScope,
        targetAmount: goalType === "target" ? parseMoney(targetAmount) : null,
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
            Uma reserva de dinheiro: livre, com objetivo de valor, meta mensal
            ou % do faturamento.
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

          <Field label="Tipo de meta" hint={GOAL_HINT[goalType]}>
            <Segmented
              value={goalType}
              onChange={setGoalType}
              options={[
                { value: "none", label: "Livre" },
                { value: "target", label: "Objetivo" },
                { value: "fixed", label: "Mensal" },
                { value: "percent", label: "% receita" },
              ]}
            />
          </Field>

          {goalType === "target" && (
            <div className="space-y-3">
              <Field label="Objetivo (quanto juntar)">
                <MoneyInput value={targetAmount} onChange={setTargetAmount} />
              </Field>
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={monthly}
                    onChange={(e) => setMonthly(e.target.checked)}
                    className="size-4 rounded border-border accent-amber-500"
                  />
                  Guardar um valor por mês até atingir
                </label>
                {monthly && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor por mês">
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
                )}
                {!monthly && (
                  <p className="text-xs text-muted-foreground/80">
                    Sem aporte mensal: você adiciona valores quando quiser.
                  </p>
                )}
              </div>
            </div>
          )}

          {goalType === "fixed" && (
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
          )}

          {goalType === "percent" && (
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
