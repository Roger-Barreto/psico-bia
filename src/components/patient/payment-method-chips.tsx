import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowClockwiseIcon,
  CheckIcon,
  PlusIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { PaymentMethod } from "@/db/types"
import { useCreatePaymentMethod, usePaymentMethods } from "@/api/queries"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

/**
 * Formas de pagamento que valem para receber de paciente (ativas, sem as de
 * empréstimo) e a que está escolhida — `null` quando o id não existe mais na
 * lista: se a forma foi excluída ou desativada, confirmar gravaria um id morto.
 */
export function usePaymentMethodChoice(methodId: string | null) {
  const methodsQ = usePaymentMethods()
  const methods = useMemo(
    () => (methodsQ.data ?? []).filter((m) => m.active && !m.isLoan),
    [methodsQ.data],
  )
  const selected: PaymentMethod | null =
    methods.find((m) => m.id === methodId) ?? null
  return { methodsQ, methods, selected }
}

interface Props {
  value: string | null
  onChange: (id: string) => void
  /** Só mostra o aviso de obrigatório depois da 1ª tentativa de enviar. */
  submitted: boolean
  /** Texto do aviso de obrigatório. */
  requiredMessage?: string
}

/**
 * Forma de pagamento como chips, com criação inline.
 *
 * Chips no lugar de um `<select>` flutuante: no drawer o menu suspenso é
 * posicionado dentro de um elemento com transform + overflow e em alguns
 * aparelhos simplesmente não aparecia.
 */
export function PaymentMethodChips({
  value,
  onChange,
  submitted,
  requiredMessage = "Escolha como o paciente pagou.",
}: Props) {
  const { methodsQ, methods, selected } = usePaymentMethodChoice(value)
  const createMethod = useCreatePaymentMethod()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  // Só existe uma forma cadastrada? Já vem escolhida — um toque a menos.
  useEffect(() => {
    if (value) return
    if (methods.length === 1) onChange(methods[0].id)
    // `onChange` fica fora: é recriado a cada render de quem usa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, methods])

  async function createInline() {
    const name = newName.trim()
    if (!name || createMethod.isPending) return
    try {
      const m = await createMethod.mutateAsync({ name })
      onChange(m.id)
      setCreating(false)
      setNewName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar")
    }
  }

  return (
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
          <div
            role="radiogroup"
            aria-label="Forma de pagamento"
            className="flex flex-wrap gap-2"
          >
            {methods.map((m) => {
              const on = value === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(m.id)}
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
        <p className="text-xs text-rose-300">{requiredMessage}</p>
      )}
    </div>
  )
}
