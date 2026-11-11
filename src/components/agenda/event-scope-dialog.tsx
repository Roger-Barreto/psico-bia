import {
  CalendarBlankIcon,
  CalendarDotsIcon,
  StackIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { EventScope } from "@/db/types"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "edit" | "delete"
  title: string
  /** "Quinta, 12 de novembro" — o dia em que o usuário clicou. */
  dateLabel: string
  /**
   * Falso quando a edição mexeu na própria repetição (frequência, dias, fim):
   * aí "só este dia" não tem como valer.
   */
  allowOne?: boolean
  /** Alcance em andamento (mostra o spinner na opção e trava as outras). */
  pending: EventScope | null
  onChoose: (scope: EventScope) => void
}

/**
 * Alcance de uma edição ou exclusão num compromisso que se repete. Mesmo
 * desenho do "Desfazer atendimento": cartões inteiros clicáveis.
 */
export function EventScopeDialog({
  open,
  onOpenChange,
  mode,
  title,
  dateLabel,
  allowOne = true,
  pending,
  onChoose,
}: Props) {
  const del = mode === "delete"
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {del ? "Excluir compromisso repetido" : "Salvar em quais dias?"}
          </DialogTitle>
          <DialogDescription>
            “{title}” se repete.{" "}
            {del ? "O que você quer excluir?" : "Onde a alteração vale?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {allowOne && (
            <ScopeOption
              icon={CalendarBlankIcon}
              label="Só este dia"
              hint={
                del
                  ? `Remove apenas ${dateLabel}. Os outros dias continuam.`
                  : `Muda apenas ${dateLabel}. Os outros dias ficam como estão.`
              }
              busy={pending === "one"}
              disabled={!!pending}
              onClick={() => onChoose("one")}
            />
          )}
          <ScopeOption
            icon={CalendarDotsIcon}
            label="Este e os próximos"
            hint={
              del
                ? "Encerra a repetição aqui. O que já passou continua na agenda."
                : "Vale daqui em diante. O que já passou fica como estava."
            }
            busy={pending === "future"}
            disabled={!!pending}
            onClick={() => onChoose("future")}
          />
          <ScopeOption
            icon={StackIcon}
            label="Todos"
            hint={
              del
                ? "Apaga o compromisso inteiro, incluindo os dias que já passaram."
                : "Vale para a repetição inteira, incluindo os dias que já passaram."
            }
            destructive={del}
            busy={pending === "all"}
            disabled={!!pending}
            onClick={() => onChoose("all")}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={!!pending}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeOption({
  icon: Icon,
  label,
  hint,
  busy,
  disabled,
  destructive,
  onClick,
}: {
  icon: PhosphorIcon
  label: string
  hint: string
  busy?: boolean
  disabled?: boolean
  destructive?: boolean
  onClick: () => void
}) {
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
      {busy ? (
        <Spinner className="size-5 shrink-0" />
      ) : (
        <Icon weight="fill" className="size-5 shrink-0" />
      )}
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </span>
    </Button>
  )
}
