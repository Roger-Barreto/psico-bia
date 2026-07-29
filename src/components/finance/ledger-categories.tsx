import { useMemo, useState } from "react"
import type { FinanceCategory, LedgerEntry } from "@/db/types"
import {
  CategoryBreakdown,
  categorySlices,
} from "@/components/finance/category-breakdown"
import {
  CardBasisToggle,
  cardBasisNote,
  type CardBasis,
} from "@/components/finance/card-basis"
import { cn } from "@/lib/utils"

/**
 * Quebra por categoria dos lançamentos que estão **na tela** — os mesmos que a
 * lista mostra (tipo, dia e busca já aplicados; a categoria não, senão o donut
 * viraria uma fatia só). Clicar na legenda liga/desliga aquela categoria no
 * filtro da lista, igual à fatura do cartão.
 */
export function LedgerCategories({
  entries,
  categoriesById,
  selected,
  onToggle,
  basis,
  onBasisChange,
}: {
  entries: LedgerEntry[]
  categoriesById: Map<string, FinanceCategory>
  selected: string[]
  onToggle: (key: string) => void
  /** Ausentes = o regime do cartão não muda nada nesta visão (sem controle). */
  basis?: CardBasis
  onBasisChange?: (next: CardBasis) => void
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense")

  const expense = useMemo(
    () => categorySlices(entries, "expense", categoriesById),
    [entries, categoriesById],
  )
  const income = useMemo(
    () => categorySlices(entries, "income", categoriesById),
    [entries, categoriesById],
  )

  // Se o lado escolhido está vazio e o outro tem dados (ex.: filtro "A receber"),
  // mostra o que existe em vez de um card vazio.
  const shown =
    expense.rows.length === 0 && income.rows.length > 0
      ? "income"
      : income.rows.length === 0 && expense.rows.length > 0
        ? "expense"
        : kind
  const { rows, total } = shown === "expense" ? expense : income

  const side = shown === "expense" ? "Saídas na tela" : "Entradas na tela"

  return (
    <CategoryBreakdown
      title="Por categoria"
      subtitle={basis ? `${side} · ${cardBasisNote(basis)}` : side}
      rows={rows}
      total={total}
      selected={selected}
      onToggle={onToggle}
      empty="Sem lançamentos nesta seleção."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border/60 bg-background/40 p-0.5">
            {(
              [
                { id: "expense", label: "Saídas" },
                { id: "income", label: "Entradas" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setKind(v.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                  shown === v.id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          {basis && onBasisChange && (
            <CardBasisToggle value={basis} onChange={onBasisChange} />
          )}
        </div>
      }
    />
  )
}
