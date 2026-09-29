import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  CircleIcon,
  PackageIcon,
  ProhibitIcon,
  UserIcon,
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
import {
  SessionValueField,
  useSessionValue,
} from "@/components/patient/session-value-field"
import { formatBRL } from "@/domain/finance"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  patientName: string
  /** Valor de consulta do cadastro — padrão da cobrança. */
  consultationValue: number
  pending: boolean
  /**
   * Pacote com saldo que cobre a data desta sessão. Quando existe, cobrar a
   * falta é descontá-la do pacote (quem faz isso é o banco) — não há valor
   * para escolher, então o segundo passo não aparece.
   */
  packageBalance?: { remaining: number; total: number } | null
  /**
   * `charged` decide se a falta continua gerando receita. `paidValue` só vem
   * preenchido quando o usuário escolheu um valor diferente do padrão —
   * `null` deixa a sessão seguir o valor do cadastro, como as atendidas.
   */
  onConfirm: (charged: boolean, paidValue: number | null) => void
  /**
   * Pessoas, quando a sessão é de casal. Aí aparece a opção "Só parte do
   * casal veio", que registra a sessão como ATENDIDA com a presença certa —
   * é atendimento, não falta: gera checklist e cobrança normalmente.
   */
  members?: { id: string; name: string }[]
  onPartial?: (presentMemberIds: string[]) => void
}

/**
 * Escolha no momento de marcar falta. Substitui o `confirmDialog` de sim/não:
 * a decisão agora tem duas saídas de peso igual, e o alvo de toque grande
 * (cartão inteiro) é o padrão do projeto — ver `reschedule-conflict-dialog`.
 *
 * "Cobrar" abre um segundo passo com o mesmo seletor de valor do controle de
 * pagamento (`SessionValueField`), para que dê para cobrar menos que a
 * consulta cheia já na hora de registrar a falta — e não só ao pagar.
 */
export function MissedAppointmentDialog({
  open,
  onOpenChange,
  patientName,
  consultationValue,
  pending,
  packageBalance,
  onConfirm,
  members,
  onPartial,
}: Props) {
  const [step, setStep] = useState<"choice" | "value" | "partial">("choice")
  const [present, setPresent] = useState<string[]>([])
  const couple = !!members && members.length >= 2 && !!onPartial
  const [submitted, setSubmitted] = useState(false)
  const valueState = useSessionValue(consultationValue, open)

  // Fecha/reabre sempre na primeira pergunta.
  useEffect(() => {
    if (open) return
    setStep("choice")
    setSubmitted(false)
    setPresent([])
  }, [open])

  function confirmCharged() {
    setSubmitted(true)
    if (pending) return
    if (valueState.error || valueState.value === null) return
    onConfirm(true, valueState.isCustom ? valueState.value : null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar falta</DialogTitle>
          <DialogDescription>
            {step === "value"
              ? `Quanto cobrar da falta de ${patientName}?`
              : step === "partial"
                ? "Quem veio à sessão?"
                : couple
                  ? packageBalance
                    ? `${patientName} faltaram. A falta desconta uma sessão do pacote?`
                    : `${patientName} faltaram. O contrato prevê cobrança desta sessão?`
                  : packageBalance
                    ? `${patientName} faltou. A falta desconta uma sessão do pacote?`
                    : `${patientName} faltou. O contrato prevê cobrança desta sessão?`}
          </DialogDescription>
        </DialogHeader>

        {step === "choice" ? (
          <div className="space-y-2">
            <ChoiceButton
              icon={ProhibitIcon}
              label="Não cobrar"
              hint={
                packageBalance
                  ? "A falta fica registrada e o saldo do pacote não muda."
                  : "A falta fica registrada e a sessão não entra no financeiro."
              }
              disabled={pending}
              onClick={() => onConfirm(false, null)}
            />
            {packageBalance ? (
              <ChoiceButton
                icon={PackageIcon}
                tone="charged"
                label="Descontar do pacote"
                hint={`A falta conta como uma sessão do pacote (${
                  packageBalance.remaining === 1
                    ? "resta 1"
                    : `restam ${packageBalance.remaining}`
                } de ${packageBalance.total}). Nada a receber.`}
                disabled={pending}
                onClick={() => onConfirm(true, null)}
              />
            ) : (
              <ChoiceButton
                icon={CurrencyDollarIcon}
                tone="charged"
                label="Cobrar esta sessão"
                hint={
                  consultationValue > 0
                    ? `Vale ${formatBRL(consultationValue)} como uma sessão atendida — dá para cobrar outro valor no passo seguinte.`
                    : "O valor continua entrando como receita, igual a uma sessão atendida."
                }
                disabled={pending}
                onClick={() => setStep("value")}
              />
            )}
            {couple && (
              <ChoiceButton
                icon={UserIcon}
                label="Só parte do casal veio"
                hint="Registra como atendimento, marcando quem compareceu."
                disabled={pending}
                onClick={() => setStep("partial")}
              />
            )}
          </div>
        ) : step === "partial" && members && onPartial ? (
          <div className="space-y-3">
            <div
              role="group"
              aria-label="Quem veio"
              className="flex flex-wrap gap-2"
            >
              {members.map((m) => {
                const on = present.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      setPresent((cur) =>
                        on ? cur.filter((x) => x !== m.id) : [...cur, m.id],
                      )
                    }
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                      on
                        ? "border-emerald-400/60 bg-emerald-500/15"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {on ? (
                      <CheckCircleIcon weight="fill" className="size-4 text-emerald-400" />
                    ) : (
                      <CircleIcon weight="bold" className="size-4" />
                    )}
                    {m.name}
                  </button>
                )
              })}
            </div>
            {present.length === members.length && (
              <p className="text-xs text-muted-foreground">
                Se todos vieram, é só marcar “Atendido”.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("choice")}
                disabled={pending}
                className="h-11 flex-1"
              >
                <ArrowLeftIcon weight="bold" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={() => onPartial(present)}
                loading={pending}
                disabled={present.length === 0 || present.length === members.length}
                className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
              >
                Registrar atendimento
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <SessionValueField
              state={valueState}
              defaultValue={consultationValue}
              submitted={submitted}
              label="Cobrar um valor diferente desta falta"
            />

            {/* linha, não coluna: `flex-1` num container de coluna zeraria a
                base de altura e os botões encolhiam abaixo do alvo de toque. */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("choice")}
                disabled={pending}
                className="h-11 flex-1"
              >
                <ArrowLeftIcon weight="bold" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={confirmCharged}
                loading={pending}
                className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
              >
                Registrar falta cobrada
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ChoiceButton({
  icon: Icon,
  label,
  hint,
  tone,
  disabled,
  onClick,
}: {
  icon: PhosphorIcon
  label: string
  hint: string
  tone?: "charged"
  disabled?: boolean
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
        tone === "charged" &&
          "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60 hover:bg-emerald-500/10",
      )}
    >
      <Icon
        weight="fill"
        className={cn(
          "size-5 shrink-0",
          tone === "charged" && "text-emerald-400",
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </span>
    </Button>
  )
}
