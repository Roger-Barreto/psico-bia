import { useEffect, useId, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CheckIcon,
  CurrencyDollarIcon,
  PlusIcon,
  WarningCircleIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { Appointment, Patient } from "@/db/types"
import {
  useCreatePaymentMethod,
  usePatchAppointment,
  usePaymentMethods,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { celebrate } from "@/lib/celebrate"
import { colorForKey } from "@/lib/finance-colors"
import { formatBRL } from "@/domain/finance"
import { formatDateTimeBR } from "@/domain/dates"
import { cn } from "@/lib/utils"

interface Props {
  appointment: Appointment
  patient: Patient
}

/**
 * Aceita o que um teclado de celular pt-BR produz: "150", "150,50",
 * "1.234,56" e também o formato com ponto decimal. Retorna `null` quando não
 * dá para ler um número — antes isto virava `0` silenciosamente e a sessão era
 * marcada como paga com R$ 0,00.
 */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s|R\$/gi, "").trim()
  if (!s) return null
  const normalized = s
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de milhar
    .replace(",", ".")
  if (!/^-?\d*\.?\d*$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function PaymentControl({ appointment, patient }: Props) {
  const patch = usePatchAppointment()
  const methodsQ = usePaymentMethods()
  const createMethod = useCreatePaymentMethod()

  const [editing, setEditing] = useState(false)
  const [customValue, setCustomValue] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [methodId, setMethodId] = useState<string | null>(
    appointment.paymentMethodId,
  )
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const customId = useId()
  const valueId = useId()

  const methods = useMemo(
    () => (methodsQ.data ?? []).filter((m) => m.active && !m.isLoan),
    [methodsQ.data],
  )
  const methodName = appointment.paymentMethodId
    ? methodsQ.data?.find((m) => m.id === appointment.paymentMethodId)?.name
    : undefined

  const defaultValue = patient.consultationValue ?? 0

  // Fecha/reabre limpo: nenhum resto do preenchimento anterior.
  useEffect(() => {
    if (editing) return
    setCustomValue(String(defaultValue))
    setUseCustom(false)
    setMethodId(appointment.paymentMethodId)
    setCreating(false)
    setNewName("")
    setSubmitted(false)
  }, [editing, defaultValue, appointment.paymentMethodId])

  // Só existe uma forma cadastrada? Já vem escolhida — um toque a menos.
  useEffect(() => {
    if (!editing || methodId) return
    if (methods.length === 1) setMethodId(methods[0].id)
  }, [editing, methodId, methods])

  // Vale só uma forma que ainda existe na lista: se a escolhida foi excluída
  // ou desativada, nenhum chip fica marcado e confirmar gravaria um id morto.
  const selected = methods.find((m) => m.id === methodId) ?? null

  const parsedCustom = parseAmount(customValue)
  const value = useCustom ? parsedCustom : defaultValue
  const valueError = !useCustom
    ? null
    : parsedCustom === null
      ? "Informe um valor válido (ex.: 150,00)."
      : parsedCustom < 0
        ? "O valor não pode ser negativo."
        : null

  async function createInline() {
    const name = newName.trim()
    if (!name || createMethod.isPending) return
    try {
      const m = await createMethod.mutateAsync({ name })
      setMethodId(m.id)
      setCreating(false)
      setNewName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar")
    }
  }

  async function confirmPaid() {
    setSubmitted(true)
    if (patch.isPending) return
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

  async function unmark() {
    if (patch.isPending) return
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
          disabled={patch.isPending}
          className="-mr-1 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs text-emerald-300/70 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300 disabled:opacity-60"
        >
          {patch.isPending ? (
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

  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Confirmar pagamento</p>
        <p className="text-xs text-muted-foreground">
          Valor padrão do cadastro:{" "}
          <strong className="text-foreground">{formatBRL(defaultValue)}</strong>
        </p>
      </div>

      {/* Alvo de toque grande: a linha inteira alterna o valor personalizado. */}
      <label
        htmlFor={customId}
        className="-mx-1 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm"
      >
        <Checkbox
          id={customId}
          checked={useCustom}
          onCheckedChange={(v) => setUseCustom(v === true)}
          className="data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-600"
        />
        Usar valor diferente nesta sessão
      </label>

      {useCustom && (
        <div className="space-y-1">
          <label htmlFor={valueId} className="text-xs text-muted-foreground">
            Valor (R$)
          </label>
          {/* text + inputMode decimal: em teclado pt-BR o usuário digita
              vírgula, e um input[type=number] devolveria string vazia — o
              pagamento era gravado como R$ 0,00 sem aviso. */}
          <Input
            id={valueId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            aria-invalid={submitted && !!valueError}
            autoFocus
          />
          {submitted && valueError && (
            <p className="text-xs text-rose-300">{valueError}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Forma de pagamento</p>

        {methodsQ.isLoading ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-24" />
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-20" />
          </div>
        ) : methodsQ.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <span className="flex items-center gap-1.5">
              <WarningCircleIcon weight="fill" className="size-4 shrink-0" />
              Não foi possível carregar as formas de pagamento.
            </span>
            <button
              type="button"
              onClick={() => methodsQ.refetch()}
              className="inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 font-medium text-rose-100 hover:bg-rose-500/20"
            >
              <ArrowClockwiseIcon weight="bold" className="size-3.5" />
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            {/* Chips no lugar de um <select> flutuante: no drawer o menu
                suspenso é posicionado dentro de um elemento com transform +
                overflow e em alguns aparelhos simplesmente não aparecia. */}
            <div
              role="radiogroup"
              aria-label="Forma de pagamento"
              className="flex flex-wrap gap-2"
            >
              {methods.map((m) => {
                const on = methodId === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMethodId(m.id)}
                    className={cn(
                      "inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      on
                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                        : "border-border/60 bg-background/40 hover:bg-muted/40",
                    )}
                  >
                    {on ? (
                      <CheckIcon
                        weight="bold"
                        className="size-4 shrink-0 text-emerald-300"
                      />
                    ) : (
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: m.color ?? colorForKey(m.name),
                        }}
                      />
                    )}
                    <span className="truncate">{m.name}</span>
                  </button>
                )
              })}

              {!creating && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <PlusIcon weight="bold" className="size-3.5" />
                  Nova forma
                </button>
              )}
            </div>

            {methods.length === 0 && !creating && (
              <p className="text-xs text-muted-foreground">
                Nenhuma forma de pagamento cadastrada — use “Nova forma” para
                criar a primeira.
              </p>
            )}

            {creating && (
              <div className="flex items-center gap-1.5 pt-1">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: PIX"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      createInline()
                    } else if (e.key === "Escape") {
                      setCreating(false)
                      setNewName("")
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={createInline}
                  disabled={createMethod.isPending || !newName.trim()}
                  className="grid size-11 shrink-0 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
                  aria-label="Confirmar nova forma"
                >
                  {createMethod.isPending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <CheckIcon weight="bold" className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false)
                    setNewName("")
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                  aria-label="Cancelar nova forma"
                >
                  <XIcon weight="bold" className="size-4" />
                </button>
              </div>
            )}
          </>
        )}

        {submitted && !selected && !methodsQ.isLoading && (
          <p className="text-xs text-rose-300">
            Escolha como o paciente pagou.
          </p>
        )}
      </div>

      {/* linha, não coluna: `flex-1` num container de coluna zeraria a base
          de altura e os botões encolhiam abaixo do alvo de toque. */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={patch.isPending}
          className="h-11 flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={confirmPaid}
          loading={patch.isPending}
          className="h-11 flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          Confirmar
        </Button>
      </div>
    </div>
  )
}
