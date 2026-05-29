import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  useCreateIndividualItem,
  useCreateSharedItem,
  useIndividualChecklist,
  useSharedChecklist,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { nextOrder } from "@/lib/checklist"
import { cn } from "@/lib/utils"

type Scope = "shared" | "individual"

interface Props {
  patientId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function AddChecklistItemDialog({ patientId, open, onOpenChange }: Props) {
  const [scope, setScope] = useState<Scope>("individual")
  const [label, setLabel] = useState("")
  const sharedQ = useSharedChecklist()
  const indivQ = useIndividualChecklist(patientId)
  const createShared = useCreateSharedItem()
  const createIndividual = useCreateIndividualItem()

  useEffect(() => {
    if (!open) {
      setScope("individual")
      setLabel("")
    }
  }, [open])

  const pending = createShared.isPending || createIndividual.isPending
  const trimmed = label.trim()

  async function submit() {
    if (!trimmed) return
    try {
      if (scope === "shared") {
        const order = nextOrder(sharedQ.data ?? [])
        await createShared.mutateAsync({
          label: trimmed,
          order,
          archived: false,
        })
      } else {
        const order = nextOrder(
          (indivQ.data ?? []).filter((i) => i.patientId === patientId),
        )
        await createIndividual.mutateAsync({
          patientId,
          label: trimmed,
          order,
          archived: false,
        })
      }
      toast.success(
        scope === "shared"
          ? "Item adicionado ao checklist compartilhado"
          : "Item adicionado ao checklist individual",
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar item ao checklist</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tipo
            </p>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as Scope)}
              className="gap-2"
            >
              <ScopeOption
                value="individual"
                title="Individual"
                subtitle="Apenas para este paciente"
                checked={scope === "individual"}
              />
              <ScopeOption
                value="shared"
                title="Compartilhado"
                subtitle="Aplica-se a todos os pacientes"
                checked={scope === "shared"}
              />
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Texto do item
            </p>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Ex.: Confirmar próxima sessão"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!trimmed || pending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeOption({
  value,
  title,
  subtitle,
  checked,
}: {
  value: Scope
  title: string
  subtitle: string
  checked: boolean
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        checked
          ? "border-primary/60 bg-primary/10"
          : "border-border/60 bg-background/40 hover:bg-muted/30",
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </label>
  )
}
