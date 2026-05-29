import {
  ArrowUUpLeftIcon,
  CalendarBlankIcon,
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
import { formatLongDateBR } from "@/domain/dates"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  patientName: string
  targetDate: string
  targetTime: string
  pending: boolean
  /** Desfazer o atendimento que está sendo reagendado (mantém o existente). */
  onKeepExisting: () => void
  /** Desfazer o atendimento já existente e concluir o reagendamento. */
  onReplaceExisting: () => void
}

export function RescheduleConflictDialog({
  open,
  onOpenChange,
  patientName,
  targetDate,
  targetTime,
  pending,
  onKeepExisting,
  onReplaceExisting,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conflito de horário</DialogTitle>
          <DialogDescription>
            {patientName} já tem um atendimento em {formatLongDateBR(targetDate)}{" "}
            às {targetTime}. Para não duplicar, escolha o que manter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <ChoiceButton
            icon={ArrowUUpLeftIcon}
            label="Desfazer este atendimento"
            hint="Mantém o atendimento já existente nesta data e remove o que você está reagendando."
            disabled={pending}
            onClick={onKeepExisting}
          />
          <ChoiceButton
            icon={CalendarBlankIcon}
            label="Desfazer o atendimento existente"
            hint="Remove o atendimento que já estava nesta data e conclui o reagendamento."
            disabled={pending}
            onClick={onReplaceExisting}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChoiceButton({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: PhosphorIcon
  label: string
  hint: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn("h-auto w-full justify-start gap-3 py-3 text-left")}
    >
      <Icon weight="fill" className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </span>
    </Button>
  )
}
