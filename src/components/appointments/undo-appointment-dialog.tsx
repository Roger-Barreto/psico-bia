import { toast } from "sonner"
import {
  ArrowUUpLeftIcon,
  CalendarBlankIcon,
  StackIcon,
  WarningIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { useUndoAppointment } from "@/api/queries"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  seriesId: string
  originDate: string
  hasOverride: boolean
  onDone?: () => void
}

const ONE_WARNING =
  "A ocorrência será removida do calendário (em séries recorrentes ela é marcada como cancelada e oculta; em atendimentos avulsos a série inteira é apagada). Status, pagamento, anotações e checklist daquela sessão são limpos. Não pode ser desfeita."
const FUTURE_WARNING =
  "Esta ocorrência e todas as futuras desta série serão deletadas. A série é encerrada na data anterior. Ocorrências passadas permanecem. Não pode ser desfeita."
const ALL_WARNING =
  "A série inteira e todos os atendimentos (passados e futuros) serão deletados permanentemente. Não pode ser desfeita."

export function UndoAppointmentDialog({
  open,
  onOpenChange,
  seriesId,
  originDate,
  hasOverride,
  onDone,
}: Props) {
  const undoMut = useUndoAppointment()

  async function run(
    scope: "one" | "future" | "all",
    confirmTitle: string,
    description: string,
    destructive = false,
  ) {
    if (
      !(await confirmDialog({
        title: confirmTitle,
        description,
        confirmLabel: "Desfazer",
        cancelLabel: "Cancelar",
        destructive,
      }))
    )
      return
    try {
      const result = await undoMut.mutateAsync({
        seriesId,
        scope,
        originDate: scope === "all" ? undefined : originDate,
      })
      const n = result.removedCount + result.cancelledCount
      toast.success(
        n === 0
          ? "Nada para desfazer"
          : `${n} ${n === 1 ? "atendimento desfeito" : "atendimentos desfeitos"}`,
      )
      onOpenChange(false)
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desfazer")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Desfazer atendimento</DialogTitle>
          <DialogDescription>
            Escolha o alcance da operação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <ScopeButton
            icon={ArrowUUpLeftIcon}
            label="Apenas este atendimento"
            hint="Remove esta ocorrência do calendário."
            disabled={undoMut.isPending}
            onClick={() =>
              run("one", "Desfazer este atendimento?", ONE_WARNING)
            }
          />
          <ScopeButton
            icon={CalendarBlankIcon}
            label="Este e os próximos"
            hint="Encerra a série nesta data e apaga as ocorrências daqui em diante."
            disabled={undoMut.isPending}
            onClick={() =>
              run(
                "future",
                "Desfazer este e os próximos atendimentos?",
                FUTURE_WARNING,
              )
            }
          />
          <ScopeButton
            icon={StackIcon}
            label="Todos os atendimentos desta série"
            hint="Apaga a série inteira e todas as ocorrências (passadas e futuras)."
            destructive
            disabled={undoMut.isPending}
            onClick={() =>
              run(
                "all",
                "Desfazer todos os atendimentos desta série?",
                ALL_WARNING,
                true,
              )
            }
          />
        </div>

        {!hasOverride && (
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-2 text-xs text-muted-foreground">
            <WarningIcon weight="fill" className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Em séries recorrentes sem registro próprio, "Apenas este" cria um
              cancelamento para esconder a data; em atendimentos avulsos
              apaga a série.
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ScopeBtnProps {
  icon: PhosphorIcon
  label: string
  hint: string
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}

function ScopeButton({
  icon: Icon,
  label,
  hint,
  disabled,
  destructive,
  onClick,
}: ScopeBtnProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-auto w-full justify-start gap-3 py-3 text-left",
        destructive &&
          "border-destructive/40 text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon weight="fill" className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      </span>
    </Button>
  )
}
