import { useCallback, useState } from "react"
import { CreditCardIcon } from "@phosphor-icons/react"
import type { LedgerEntry } from "@/db/types"
import type { LedgerFilter } from "@/components/finance/ledger-filters"
import { cn } from "@/lib/utils"

/**
 * Como as compras no cartão de crédito entram na quebra por categoria:
 *
 * - `invoice` — pela **fatura**: entram as compras da fatura que vence no
 *   período (feitas antes) e ficam de fora as compras do período, que só serão
 *   cobradas na fatura seguinte. É a visão do dinheiro que sai do caixa.
 * - `purchase` — pela **compra**: entram as compras feitas no período (que vão
 *   para a fatura seguinte) e fica de fora a fatura que vence agora, comprada
 *   nos meses anteriores.
 */
export type CardBasis = "invoice" | "purchase"

/** Padrão: fatura — é o regime que os indicadores dos Lançamentos usam. */
export const DEFAULT_CARD_BASIS: CardBasis = "invoice"

const STORAGE_KEY = "financeiro:grafico-cartao"

/** Escolha do regime, compartilhada entre Lançamentos e Dashboard. */
export function useCardBasis(): [CardBasis, (next: CardBasis) => void] {
  const [basis, setBasis] = useState<CardBasis>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "purchase"
        ? "purchase"
        : DEFAULT_CARD_BASIS
    } catch {
      /* localStorage unavailable */
      return DEFAULT_CARD_BASIS
    }
  })
  const set = useCallback((next: CardBasis) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* localStorage unavailable */
    }
    setBasis(next)
  }, [])
  return [basis, set]
}

/**
 * As compras no cartão que caem na janela [from, to] segundo o regime — trocam
 * de mês conforme se conta a fatura (`invoicePeriod`) ou a compra (`period`).
 * `cardEntries` são todos os lançamentos de cartão, de qualquer mês.
 */
export function cardEntriesForBasis(
  cardEntries: LedgerEntry[],
  basis: CardBasis,
  fromPeriod: string,
  toPeriod: string,
): LedgerEntry[] {
  if (basis === "purchase")
    return cardEntries.filter(
      (e) => e.period >= fromPeriod && e.period <= toPeriod,
    )
  return cardEntries.filter(
    (e) =>
      !!e.invoicePeriod &&
      e.invoicePeriod >= fromPeriod &&
      e.invoicePeriod <= toPeriod,
  )
}

/**
 * As compras no cartão que entram no gráfico da tela de Lançamentos. Diferente
 * da lista (que no mês mostra só a fatura, numa linha), aqui elas entram uma a
 * uma para virarem fatias — pela fatura que vence no mês ou pelas compras
 * feitas nele.
 */
export function ledgerChartCardEntries(
  cardEntries: LedgerEntry[],
  opts: {
    basis: CardBasis
    /** Mês visto, YYYY-MM. */
    period: string
    /** Visão de tipo ativa na página. */
    filter: LedgerFilter
    /** Dia filtrado no minicalendário, ou null. */
    selectedDay: string | null
  },
): LedgerEntry[] {
  const { basis, period, filter, selectedDay } = opts
  // Nestas visões o cartão não entra de jeito nenhum.
  if (filter === "receivable" || filter === "cofrinho") return []
  let rows = cardEntriesForBasis(cardEntries, basis, period, period)
  // "A pagar": só a fatura em aberto é saída deste mês; a compra do mês vira
  // conta a pagar apenas quando a fatura dela vencer.
  if (filter === "payable")
    rows = basis === "invoice" ? rows.filter((e) => !e.settled) : []
  // No regime de fatura a compra "acontece" no vencimento — o mesmo dia em que
  // a lista já mostra a linha da fatura.
  if (selectedDay)
    rows = rows.filter(
      (e) => (basis === "invoice" ? e.invoiceDueDate : e.date) === selectedDay,
    )
  return rows
}

/** Nota curta para o subtítulo do card (a explicação inteira vai no tooltip). */
export function cardBasisNote(basis: CardBasis): string {
  return basis === "invoice" ? "cartão pela fatura" : "cartão pela compra"
}

const OPTIONS: { id: CardBasis; label: string; title: string }[] = [
  {
    id: "invoice",
    label: "Fatura",
    title:
      "Cartão pela fatura: conta as compras da fatura que vence no período (feitas antes) e deixa de fora as compras do período, que vão para a fatura seguinte.",
  },
  {
    id: "purchase",
    label: "Compra",
    title:
      "Cartão pela compra: conta as compras feitas no período (que vão para a fatura seguinte) e deixa de fora a fatura que vence agora, comprada nos meses anteriores.",
  },
]

/** Alterna entre os dois regimes de cartão do gráfico. */
export function CardBasisToggle({
  value,
  onChange,
}: {
  value: CardBasis
  onChange: (next: CardBasis) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/40 p-0.5">
      <CreditCardIcon
        weight="fill"
        className="mx-1 size-3.5 shrink-0 text-muted-foreground"
      />
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          title={o.title}
          className={cn(
            "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
            value === o.id
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
