import { useEffect, useId, useState } from "react"
import { MinusIcon, PlusIcon } from "@phosphor-icons/react"
import { MoneyInput, parseMoney } from "@/components/ui/money-input"
import { formatBRL } from "@/domain/finance"
import { cn } from "@/lib/utils"

export const MIN_PACKAGE_SESSIONS = 1
export const MAX_PACKAGE_SESSIONS = 200

/** Tamanhos de pacote mais comuns — um toque em vez de digitar. */
const QUICK_SIZES = [4, 5, 8, 10]

function moneyText(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export interface PackageFieldsState {
  sessionsRaw: string
  setSessionsRaw: (v: string) => void
  valueRaw: string
  setValueRaw: (v: string) => void
  /** Quantidade resolvida; `null` quando o texto não é um número válido. */
  sessions: number | null
  /** Valor total resolvido; `null` quando vazio. */
  value: number | null
  sessionsError: string | null
  valueError: string | null
  /** Menor quantidade aceita (na edição: as sessões já realizadas). */
  minSessions: number
  /** Valor que as sessões custariam avulsas, para comparar. */
  fullPrice: number | null
}

/**
 * Estado dos campos "quantas sessões" e "quanto custou o pacote".
 *
 * Enquanto o usuário não mexe no valor, ele acompanha a quantidade
 * (`sessões × valor da consulta`) — é só um ponto de partida: pacote quase
 * sempre tem desconto, e o valor combinado varia de paciente para paciente.
 * Depois da primeira edição o valor é dele e não muda mais sozinho.
 *
 * `resetKey` zera tudo quando o formulário fecha/reabre.
 */
export function usePackageFields(
  opts: {
    initialSessions?: number
    initialValue?: number
    /** Valor de uma sessão avulsa do paciente (sugestão e comparação). */
    unitPrice?: number
    /** Sessões já realizadas — o pacote não pode encolher abaixo disso. */
    minSessions?: number
  },
  resetKey: unknown,
): PackageFieldsState {
  const {
    initialSessions = 4,
    initialValue,
    unitPrice = 0,
    minSessions = MIN_PACKAGE_SESSIONS,
  } = opts
  const suggested = (n: number) => (unitPrice > 0 ? n * unitPrice : 0)
  const startValue = initialValue ?? suggested(initialSessions)

  const [sessionsRaw, setSessionsRawState] = useState(String(initialSessions))
  const [valueRaw, setValueRawState] = useState(
    startValue > 0 ? moneyText(startValue) : "",
  )
  // Valor já veio preenchido (edição)? Então é do usuário desde o começo.
  const [valueTouched, setValueTouched] = useState(initialValue !== undefined)

  useEffect(() => {
    setSessionsRawState(String(initialSessions))
    setValueRawState(startValue > 0 ? moneyText(startValue) : "")
    setValueTouched(initialValue !== undefined)
    // Reabre limpo; os valores iniciais só importam nesse momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Trocou o paciente (cada um tem o seu preço)? Refaz só a SUGESTÃO de
  // valor, e só se o usuário ainda não digitou o dele. A quantidade fica.
  useEffect(() => {
    if (valueTouched) return
    const n = Number(sessionsRaw)
    if (!Number.isFinite(n) || n <= 0) return
    setValueRawState(unitPrice > 0 ? moneyText(n * unitPrice) : "")
    // Só a troca de preço dispara; quantidade e edição têm os seus caminhos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitPrice])

  const floor = Math.max(MIN_PACKAGE_SESSIONS, minSessions)
  const parsed = /^\d+$/.test(sessionsRaw.trim())
    ? Number(sessionsRaw.trim())
    : null
  const sessionsError =
    parsed === null
      ? "Informe quantas sessões o pacote tem."
      : parsed < floor
        ? floor > MIN_PACKAGE_SESSIONS
          ? `Este pacote já teve ${floor} ${floor === 1 ? "sessão realizada" : "sessões realizadas"} — não dá para ficar menor que isso.`
          : "O pacote precisa ter ao menos 1 sessão."
        : parsed > MAX_PACKAGE_SESSIONS
          ? `No máximo ${MAX_PACKAGE_SESSIONS} sessões por pacote.`
          : null

  const value = valueRaw.trim() === "" ? null : parseMoney(valueRaw)
  const valueError =
    value === null
      ? "Informe o valor total do pacote."
      : value < 0
        ? "O valor não pode ser negativo."
        : null

  function setSessionsRaw(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, 3)
    setSessionsRawState(clean)
    if (!valueTouched && unitPrice > 0 && clean) {
      setValueRawState(moneyText(suggested(Number(clean))))
    }
  }

  function setValueRaw(next: string) {
    setValueTouched(true)
    setValueRawState(next)
  }

  return {
    sessionsRaw,
    setSessionsRaw,
    valueRaw,
    setValueRaw,
    sessions: sessionsError ? null : parsed,
    value: valueError ? null : value,
    sessionsError,
    valueError,
    minSessions: floor,
    fullPrice: parsed !== null && unitPrice > 0 ? parsed * unitPrice : null,
  }
}

/**
 * Campos do pacote: quantidade (com − / + e atalhos) e valor total, com o
 * preço por sessão calculado na hora. Compartilhado por quem vende o pacote
 * numa sessão (`PaymentControl`) e pelo diálogo de novo/editar pacote.
 */
export function PackageFields({
  state,
  submitted,
}: {
  state: PackageFieldsState
  /** Só mostra os erros depois da primeira tentativa de enviar. */
  submitted: boolean
}) {
  const sessionsId = useId()
  const valueId = useId()
  const n = state.sessions
  const canStep = (delta: number) => {
    const cur = Number(state.sessionsRaw) || 0
    const next = cur + delta
    return next >= state.minSessions && next <= MAX_PACKAGE_SESSIONS
  }
  const step = (delta: number) => {
    const cur = Number(state.sessionsRaw) || 0
    const next = Math.min(
      MAX_PACKAGE_SESSIONS,
      Math.max(state.minSessions, cur + delta),
    )
    state.setSessionsRaw(String(next))
  }

  const perSession =
    n !== null && state.value !== null && n > 0 ? state.value / n : null
  // Em centavos: 3 × 10,05 em ponto flutuante dá 30,150000000000002, que é
  // "maior" que 30,15 e fazia aparecer um desconto de R$ 0,00.
  const discountCents =
    state.fullPrice !== null && state.value !== null
      ? Math.round(state.fullPrice * 100) - Math.round(state.value * 100)
      : 0
  const discount = discountCents > 0 ? discountCents / 100 : null

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={sessionsId} className="text-xs text-muted-foreground">
          Quantidade de sessões
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canStep(-1)}
            aria-label="Uma sessão a menos"
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-border/60 bg-background/40 transition-colors hover:bg-muted/40 disabled:opacity-40"
          >
            <MinusIcon weight="bold" className="size-4" />
          </button>
          <input
            id={sessionsId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={state.sessionsRaw}
            onChange={(e) => state.setSessionsRaw(e.target.value)}
            aria-invalid={submitted && !!state.sessionsError}
            className="h-11 w-full min-w-0 flex-1 rounded-md border border-input bg-background/40 px-3 text-center text-base font-semibold tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canStep(1)}
            aria-label="Uma sessão a mais"
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-border/60 bg-background/40 transition-colors hover:bg-muted/40 disabled:opacity-40"
          >
            <PlusIcon weight="bold" className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_SIZES.filter((q) => q >= state.minSessions).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => state.setSessionsRaw(String(q))}
              className={cn(
                "inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
                n === q
                  ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {q} sessões
            </button>
          ))}
        </div>
        {submitted && state.sessionsError && (
          <p className="text-xs text-rose-300">{state.sessionsError}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={valueId} className="text-xs text-muted-foreground">
          Valor total do pacote
        </label>
        <MoneyInput
          id={valueId}
          value={state.valueRaw}
          onChange={state.setValueRaw}
          aria-invalid={submitted && !!state.valueError}
        />
        {perSession !== null && (
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{formatBRL(perSession)}</strong>{" "}
            por sessão
            {discount !== null && (
              <> · {formatBRL(discount)} a menos que as sessões avulsas</>
            )}
          </p>
        )}
        {submitted && state.valueError && (
          <p className="text-xs text-rose-300">{state.valueError}</p>
        )}
      </div>
    </div>
  )
}
