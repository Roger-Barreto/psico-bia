import { useEffect, useId, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { formatBRL } from "@/domain/finance"

/**
 * Aceita o que um teclado de celular pt-BR produz: "150", "150,50",
 * "1.234,56" e também o formato com ponto decimal. Retorna `null` quando não
 * dá para ler um número — antes isto virava `0` silenciosamente e a sessão era
 * marcada como paga com R$ 0,00.
 */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s|R\$/gi, "").trim()
  if (!s) return null
  const normalized = s
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de milhar
    .replace(",", ".")
  if (!/^-?\d*\.?\d*$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export interface SessionValueState {
  useCustom: boolean
  setUseCustom: (v: boolean) => void
  raw: string
  setRaw: (v: string) => void
  /** Valor resolvido; `null` quando o texto digitado é inválido. */
  value: number | null
  /** Mensagem de erro, ou `null` quando está válido. */
  error: string | null
  /** `true` quando o usuário escolheu um valor diferente do padrão. */
  isCustom: boolean
}

/**
 * Estado do seletor de valor da sessão. Vive num hook para que o valor e o
 * erro fiquem legíveis por quem envia o formulário (o botão Confirmar precisa
 * bloquear em valor inválido).
 *
 * `resetKey` zera o preenchimento quando o formulário fecha/reabre — sem isso
 * sobra o resto da digitação anterior.
 */
export function useSessionValue(
  defaultValue: number,
  resetKey: unknown,
): SessionValueState {
  const [useCustom, setUseCustom] = useState(false)
  const [raw, setRaw] = useState(String(defaultValue))

  useEffect(() => {
    setUseCustom(false)
    setRaw(String(defaultValue))
  }, [resetKey, defaultValue])

  const parsed = parseAmount(raw)
  const value = useCustom ? parsed : defaultValue
  const error = !useCustom
    ? null
    : parsed === null
      ? "Informe um valor válido (ex.: 150,00)."
      : parsed < 0
        ? "O valor não pode ser negativo."
        : null

  return {
    useCustom,
    setUseCustom,
    raw,
    setRaw,
    value,
    error,
    isCustom: useCustom,
  }
}

/**
 * Seletor "usar valor diferente" — compartilhado pelo controle de pagamento e
 * pelo diálogo de falta cobrada, para que os dois se comportem igual.
 */
export function SessionValueField({
  state,
  defaultValue,
  defaultLabel = "Valor padrão do cadastro:",
  submitted,
  tone = "emerald",
  label = "Usar valor diferente nesta sessão",
}: {
  state: SessionValueState
  defaultValue: number
  defaultLabel?: string
  /** Só mostra o erro depois da primeira tentativa de enviar. */
  submitted: boolean
  tone?: "emerald" | "primary"
  label?: string
}) {
  const customId = useId()
  const valueId = useId()

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {defaultLabel}{" "}
        <strong className="text-foreground">{formatBRL(defaultValue)}</strong>
      </p>

      {/* Alvo de toque grande: a linha inteira alterna o valor personalizado. */}
      <label
        htmlFor={customId}
        className="-mx-1 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm"
      >
        <Checkbox
          id={customId}
          checked={state.useCustom}
          onCheckedChange={(v) => state.setUseCustom(v === true)}
          className={
            tone === "emerald"
              ? "data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-600"
              : undefined
          }
        />
        {label}
      </label>

      {state.useCustom && (
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
            value={state.raw}
            onChange={(e) => state.setRaw(e.target.value)}
            aria-invalid={submitted && !!state.error}
            autoFocus
          />
          {submitted && state.error && (
            <p className="text-xs text-rose-300">{state.error}</p>
          )}
        </div>
      )}
    </>
  )
}
