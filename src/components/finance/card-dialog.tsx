import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CreditCardIcon } from "@phosphor-icons/react"
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
import { useCreateCard, useUpdateCard } from "@/api/queries"
import type { FinanceCard } from "@/db/types"
import { cardInvoiceFor } from "@/domain/finance"
import { formatLongDateBR, todayISO } from "@/domain/dates"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** When set, edits this card; otherwise creates a new one. */
  editing?: FinanceCard | null
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

/** Clamp a day-of-month string to 1..31 (empty allowed while typing). */
function clampDay(v: string): string {
  const n = v.replace(/\D/g, "")
  if (n === "") return ""
  return String(Math.max(1, Math.min(31, Number(n))))
}

export function CardDialog({ open, onOpenChange, editing, onCreated }: Props) {
  const create = useCreateCard()
  const update = useUpdateCard()

  const [name, setName] = useState("")
  const [closingDay, setClosingDay] = useState("1")
  const [dueDay, setDueDay] = useState("10")
  const [color, setColor] = useState<string | null>(null)
  const [limit, setLimit] = useState("")
  const [brand, setBrand] = useState("")
  const [last4, setLast4] = useState("")

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setClosingDay(String(editing.closingDay))
      setDueDay(String(editing.dueDay))
      setColor(editing.color)
      setLimit(editing.creditLimit != null ? formatMoneyValue(editing.creditLimit) : "")
      setBrand(editing.brand ?? "")
      setLast4(editing.last4 ?? "")
    } else {
      setName("")
      setClosingDay("1")
      setDueDay("10")
      setColor(null)
      setLimit("")
      setBrand("")
      setLast4("")
    }
  }, [open, editing])

  const closingN = Math.max(1, Math.min(31, Number(closingDay) || 1))
  const dueN = Math.max(1, Math.min(31, Number(dueDay) || 1))

  // Preview: which invoice a purchase made today would fall into.
  const preview = useMemo(
    () => cardInvoiceFor(closingN, dueN, todayISO()),
    [closingN, dueN],
  )

  const busy = create.isPending || update.isPending

  async function save() {
    if (!name.trim()) return toast.error("Informe um nome")
    try {
      const payload = {
        name: name.trim(),
        closingDay: closingN,
        dueDay: dueN,
        color,
        creditLimit: limit ? parseMoney(limit) : null,
        brand: brand.trim() || null,
        last4: last4.trim() || null,
      }
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload })
        toast.success("Cartão atualizado")
      } else {
        const c = await create.mutateAsync(payload)
        toast.success("Cartão adicionado")
        onCreated?.(c.id)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  const swatch = color ?? colorForKey(name || "cartão")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          <DialogDescription>
            Fechamento e vencimento definem em qual fatura cada compra entra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-inner"
              style={{ backgroundColor: swatch }}
            >
              <CreditCardIcon weight="fill" className="size-5" />
            </span>
            <div className="flex-1">
              <Field label="Nome">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nubank, Inter, Itaú…"
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia de fechamento" hint="Quando a fatura fecha.">
              <Input
                type="number"
                min={1}
                max={31}
                value={closingDay}
                onChange={(e) => setClosingDay(clampDay(e.target.value))}
              />
            </Field>
            <Field label="Dia de vencimento" hint="Quando a fatura vence.">
              <Input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(clampDay(e.target.value))}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Uma compra feita hoje entra na fatura que{" "}
            <span className="font-medium text-foreground">
              fecha em {formatLongDateBR(preview.closeDate)}
            </span>{" "}
            e{" "}
            <span className="font-medium text-foreground">
              vence em {formatLongDateBR(preview.dueDate)}
            </span>
            .
            {editing && (
              <span className="mt-1 block text-muted-foreground/80">
                Alterar essas datas afeta apenas novas compras — faturas já
                lançadas mantêm as datas originais.
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Bandeira (opcional)">
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Visa, Master…"
              />
            </Field>
            <Field label="Final (opcional)">
              <Input
                inputMode="numeric"
                maxLength={4}
                value={last4}
                onChange={(e) =>
                  setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="1234"
              />
            </Field>
          </div>

          <Field label="Limite (opcional)">
            <MoneyInput value={limit} onChange={setLimit} />
          </Field>

          <Field label="Cor">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy} className={cn(!name.trim() && "opacity-90")}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
