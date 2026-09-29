import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  CheckCircleIcon,
  CurrencyDollarIcon,
  PackageIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import type { Appointment, Patient } from "@/db/types"
import {
  packageErrorMessage,
  qk,
  useCreateSessionPackage,
  usePatchAppointment,
  usePaymentMethods,
  useSessionPackages,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { celebrate } from "@/lib/celebrate"
import { effectiveValue, formatBRL } from "@/domain/finance"
import {
  openPackage,
  packageRemaining,
  packagesOfPatient,
  positionInPackage,
  sessionOrdinal,
  sessionsLabel,
} from "@/domain/packages"
import {
  SessionValueField,
  useSessionValue,
} from "./session-value-field"
import {
  PaymentMethodChips,
  usePaymentMethodChoice,
} from "./payment-method-chips"
import {
  PackageFields,
  usePackageFields,
} from "@/components/packages/package-fields"
import { formatDateTimeBR } from "@/domain/dates"
import { cn } from "@/lib/utils"

interface Props {
  appointment: Appointment
  patient: Patient
}

/**
 * Como esta sessão está sendo paga:
 *   `single`  — sessão avulsa, com valor e forma de pagamento;
 *   `package` — o paciente está fechando um pacote agora;
 *   `balance` — descontar de um pacote que ele já tem.
 */
type Mode = "single" | "package" | "balance"

export function PaymentControl({ appointment, patient }: Props) {
  const patch = usePatchAppointment()
  const createPackage = useCreateSessionPackage()
  const methodsQ = usePaymentMethods()
  const packagesQ = useSessionPackages()

  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<Mode>("single")
  const [methodId, setMethodId] = useState<string | null>(
    appointment.paymentMethodId,
  )
  const [includeThis, setIncludeThis] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [modeChosen, setModeChosen] = useState(false)
  const qc = useQueryClient()

  const methodName = appointment.paymentMethodId
    ? methodsQ.data?.find((m) => m.id === appointment.paymentMethodId)?.name
    : undefined

  const patientPackages = useMemo(
    () => packagesOfPatient(packagesQ.data ?? [], patient.id),
    [packagesQ.data, patient.id],
  )
  const linkedPackage = appointment.packageId
    ? (patientPackages.find((p) => p.id === appointment.packageId) ?? null)
    : null
  // Pacote aberto com vaga (o mais antigo): o que "descontar do pacote" usa.
  const balance = useMemo(() => openPackage(patientPackages), [patientPackages])
  // Onde esta sessão entra na ordem do pacote (é pela data).
  const position = {
    appointmentId: appointment.id,
    date: appointment.date,
    time: appointment.time,
  }

  // `effectiveValue` e não `consultationValue`: uma falta cobrada pode já ter
  // um valor próprio gravado em `paidValue` no momento em que foi marcada, e
  // o pagamento tem de partir dele — não do valor cheio do cadastro.
  const defaultValue = effectiveValue(appointment, patient)
  const hasSessionValue = appointment.paidValue != null

  const valueState = useSessionValue(defaultValue, editing)
  const packageFields = usePackageFields(
    { initialSessions: 4, unitPrice: patient.consultationValue ?? 0 },
    editing,
  )
  const { selected } = usePaymentMethodChoice(methodId)

  // Fecha/reabre limpo: nenhum resto do preenchimento anterior.
  useEffect(() => {
    if (editing) return
    setMethodId(appointment.paymentMethodId)
    setIncludeThis(true)
    setSubmitted(false)
  }, [editing, appointment.paymentMethodId])

  // Parte do caminho mais provável: quem tem pacote com saldo quase sempre
  // quer descontar dele. Vale também para o saldo que chega DEPOIS de o
  // formulário abrir (pacotes ainda carregando) — mas só enquanto o usuário
  // não escolheu nada; depois disso a escolha é dele.
  useEffect(() => {
    if (!editing) {
      setModeChosen(false)
      return
    }
    if (modeChosen) return
    setMode(balance ? "balance" : "single")
  }, [editing, balance, modeChosen])

  // O pacote com saldo sumiu enquanto o formulário estava aberto (usado em
  // outro aparelho, encerrado)? Volta para a sessão avulsa.
  useEffect(() => {
    if (mode === "balance" && !balance) setMode("single")
  }, [mode, balance])

  const value = valueState.value
  const valueError = valueState.error
  const pending = patch.isPending || createPackage.isPending

  function changeMode(next: Mode) {
    setMode(next)
    setModeChosen(true)
    setSubmitted(false)
  }

  // O erro veio porque a tela estava desatualizada (pacote cheio, encerrado
  // ou apagado em outro aparelho): recarrega para a opção errada sumir.
  function refreshPackages() {
    qc.invalidateQueries({ queryKey: qk.packages })
    qc.invalidateQueries({ queryKey: ["appointments"] })
  }

  async function confirmSingle() {
    if (valueError || value === null) {
      return toast.error(valueError ?? "Valor inválido")
    }
    if (!selected) {
      return toast.error("Escolha a forma de pagamento")
    }
    try {
      await patch.mutateAsync({
        id: appointment.id,
        patch: {
          paid: true,
          paidValue: value,
          paidAt: new Date().toISOString(),
          paymentMethodId: selected.id,
        },
      })
      celebrate("happy")
      toast.success("Sessão marcada como paga")
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function confirmNewPackage() {
    if (packageFields.sessions === null) {
      return toast.error(packageFields.sessionsError ?? "Quantidade inválida")
    }
    if (packageFields.value === null) {
      return toast.error(packageFields.valueError ?? "Valor inválido")
    }
    if (!selected) {
      return toast.error("Escolha a forma de pagamento")
    }
    try {
      await createPackage.mutateAsync({
        patientId: patient.id,
        totalSessions: packageFields.sessions,
        totalValue: packageFields.value,
        paymentMethodId: selected.id,
        startDate: appointment.date,
        appointmentId: includeThis ? appointment.id : null,
      })
      celebrate("happy")
      toast.success(
        includeThis
          ? `Pacote de ${sessionsLabel(packageFields.sessions)} registrado · esta é a 1ª`
          : `Pacote de ${sessionsLabel(packageFields.sessions)} registrado`,
      )
      setEditing(false)
    } catch (err) {
      toast.error(packageErrorMessage(err))
      refreshPackages()
    }
  }

  async function confirmBalance() {
    if (!balance) return
    try {
      // Só o vínculo: pago, valor 0 e forma de pagamento quem grava é o
      // banco, junto com a checagem de vaga (trigger de 034).
      await patch.mutateAsync({
        id: appointment.id,
        patch: { packageId: balance.id },
      })
      celebrate("happy")
      toast.success(
        `Descontada do pacote · sessão ${positionInPackage(balance, position)} de ${balance.totalSessions}`,
      )
      setEditing(false)
    } catch (err) {
      toast.error(packageErrorMessage(err))
      refreshPackages()
    }
  }

  async function confirmPaid() {
    setSubmitted(true)
    if (pending) return
    if (mode === "package") return confirmNewPackage()
    if (mode === "balance") return confirmBalance()
    return confirmSingle()
  }

  async function unmark() {
    if (pending) return
    if (
      !(await confirmDialog({
        title: "Desmarcar pagamento",
        description: "Desmarcar pagamento desta sessão?",
        destructive: true,
      }))
    )
      return
    try {
      await patch.mutateAsync({
        id: appointment.id,
        patch: {
          paid: false,
          paidValue: null,
          paidAt: null,
          paymentMethodId: null,
        },
      })
      toast.success("Pagamento desmarcado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function removeFromPackage() {
    if (pending) return
    if (
      !(await confirmDialog({
        title: "Tirar do pacote",
        description:
          "A sessão volta para o saldo do pacote e esta fica como não paga — dá para cobrá-la à parte em seguida.",
        confirmLabel: "Tirar do pacote",
      }))
    )
      return
    try {
      await patch.mutateAsync({
        id: appointment.id,
        patch: {
          packageId: null,
          paid: false,
          paidValue: null,
          paidAt: null,
          paymentMethodId: null,
        },
      })
      toast.success("Sessão tirada do pacote")
    } catch (err) {
      toast.error(packageErrorMessage(err))
    }
  }

  if (appointment.packageId) {
    const ordinal = linkedPackage
      ? sessionOrdinal(linkedPackage, appointment.id)
      : null
    const remaining = linkedPackage ? packageRemaining(linkedPackage) : null
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <PackageIcon weight="fill" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block font-medium">
              Paga pelo pacote
              {linkedPackage && ordinal !== null && (
                <>
                  {" "}
                  · sessão {ordinal} de {linkedPackage.totalSessions}
                </>
              )}
            </span>
            {linkedPackage && remaining !== null && (
              <span className="block text-xs opacity-80">
                {linkedPackage.closedAt
                  ? "Pacote encerrado"
                  : remaining === 0
                    ? ordinal === linkedPackage.totalSessions
                      ? "Era a última do pacote"
                      : "Pacote concluído"
                    : remaining === 1
                      ? "Resta 1 sessão no pacote"
                      : `Restam ${remaining} sessões no pacote`}
              </span>
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={removeFromPackage}
          disabled={pending}
          className="-mr-1 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs text-emerald-300/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300 disabled:opacity-60"
        >
          {pending ? (
            <Spinner className="size-3.5" />
          ) : (
            <XCircleIcon weight="fill" className="size-3.5" />
          )}
          Tirar do pacote
        </button>
      </div>
    )
  }

  if (appointment.paid) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <CheckCircleIcon weight="fill" className="size-4 shrink-0" />
          Pago {formatBRL(appointment.paidValue ?? 0)}
          {methodName && (
            <span className="rounded bg-emerald-500/20 px-1.5 text-xs">
              {methodName}
            </span>
          )}
          {appointment.paidAt && (
            <span className="text-xs opacity-80">
              em {formatDateTimeBR(appointment.paidAt)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={unmark}
          disabled={pending}
          className="-mr-1 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs text-emerald-300/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300 disabled:opacity-60"
        >
          {pending ? (
            <Spinner className="size-3.5" />
          ) : (
            <XCircleIcon weight="fill" className="size-3.5" />
          )}
          Desmarcar
        </button>
      </div>
    )
  }

  if (!editing) {
    return (
      <Button
        type="button"
        onClick={() => setEditing(true)}
        className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-600/90"
      >
        <CurrencyDollarIcon weight="fill" />
        Marcar como paga
      </Button>
    )
  }

  const modes: { id: Mode; label: string; hint: string }[] = [
    ...(balance
      ? [
          {
            id: "balance" as const,
            label: "Descontar do pacote",
            hint:
              packageRemaining(balance) === 1
                ? "Resta 1 sessão"
                : `Restam ${packageRemaining(balance)} sessões`,
          },
        ]
      : []),
    { id: "single", label: "Sessão avulsa", hint: "Paga só esta sessão" },
    { id: "package", label: "Novo pacote", hint: "Várias sessões" },
  ]

  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Confirmar pagamento</p>
      </div>

      <div
        role="radiogroup"
        aria-label="Tipo de pagamento"
        className="grid grid-cols-2 gap-2"
      >
        {modes.map((m) => {
          const on = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => changeMode(m.id)}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-colors",
                // O pacote com saldo ocupa a linha inteira; as outras duas
                // dividem a de baixo.
                m.id === "balance" && "col-span-2",
                on
                  ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                  : "border-border/60 bg-background/40 hover:bg-muted/40",
              )}
            >
              <span className="text-sm font-medium">{m.label}</span>
              <span
                className={cn(
                  "text-xs",
                  on ? "text-emerald-200/80" : "text-muted-foreground",
                )}
              >
                {m.hint}
              </span>
            </button>
          )
        })}
      </div>

      {mode === "single" && (
        <>
          <SessionValueField
            state={valueState}
            defaultValue={defaultValue}
            defaultLabel={
              hasSessionValue
                ? "Valor definido para esta sessão:"
                : "Valor padrão do cadastro:"
            }
            submitted={submitted}
          />
          <PaymentMethodChips
            value={methodId}
            onChange={setMethodId}
            submitted={submitted}
          />
        </>
      )}

      {mode === "package" && (
        <>
          <PackageFields state={packageFields} submitted={submitted} />

          {/* Alvo de toque grande: a linha inteira alterna a opção. */}
          <label className="-mx-1 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm">
            <Checkbox
              checked={includeThis}
              onCheckedChange={(v) => setIncludeThis(v === true)}
              className="data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-600"
            />
            Esta sessão já é a 1ª do pacote
          </label>
          {!includeThis && (
            <p className="text-xs text-muted-foreground">
              O pacote vale a partir das próximas sessões; esta continua em
              aberto para ser paga à parte.
            </p>
          )}

          <PaymentMethodChips
            value={methodId}
            onChange={setMethodId}
            submitted={submitted}
            requiredMessage="Escolha como o paciente pagou o pacote."
          />
        </>
      )}

      {mode === "balance" && balance && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm">
          <PackageIcon
            weight="fill"
            className="mt-0.5 size-4 shrink-0 text-emerald-300"
          />
          <div className="min-w-0">
            <p className="font-medium">
              Sessão {positionInPackage(balance, position)} de{" "}
              {balance.totalSessions}
            </p>
            <p className="text-xs text-muted-foreground">
              Pacote de {formatBRL(balance.totalValue)}, já pago. Nada a receber
              nesta sessão
              {packageRemaining(balance) - 1 > 0
                ? ` — depois dela ${packageRemaining(balance) - 1 === 1 ? "resta 1" : `restam ${packageRemaining(balance) - 1}`}.`
                : " — é a última do pacote."}
            </p>
          </div>
        </div>
      )}

      {/* linha, não coluna: `flex-1` num container de coluna zeraria a base
          de altura e os botões encolhiam abaixo do alvo de toque. */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={pending}
          className="h-11 flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={confirmPaid}
          loading={pending}
          className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          {mode === "package" ? "Registrar pacote" : "Confirmar"}
        </Button>
      </div>
    </div>
  )
}
