import { useMemo } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { FinanceCategory, LedgerEntry } from "@/db/types"
import { formatBRL } from "@/domain/finance"
import { categoryKeyOf } from "@/components/finance/ledger-filters"
import { Card, CardContent } from "@/components/ui/card"
import { colorForKey } from "@/lib/finance-colors"
import { brl, chartTooltip } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

interface Slice {
  key: string
  name: string
  color: string
  value: number
  share: number
}

/**
 * Expense breakdown of a card invoice: donut + full legend. Every category is
 * listed (nothing is hidden behind a "top N") — the legend scrolls instead of
 * growing the card. Clicking a row toggles that category in `selected`, which
 * both dims its slice and filters the transaction list below.
 */
export function InvoiceCategories({
  entries,
  categoriesById,
  selected,
  onToggle,
}: {
  /** Entries of the invoice being shown (incomes/estornos are ignored). */
  entries: LedgerEntry[]
  categoriesById: Map<string, FinanceCategory>
  /** Category keys currently filtered (from `categoryKeyOf`). */
  selected: string[]
  onToggle: (key: string) => void
}) {
  const { rows, total } = useMemo(() => {
    const m = new Map<string, Omit<Slice, "share">>()
    for (const e of entries) {
      if (e.kind !== "expense") continue
      const name = e.categoryName ?? "Sem categoria"
      const cur = m.get(name)
      if (cur) {
        cur.value += e.amount
        continue
      }
      m.set(name, {
        key: categoryKeyOf(e),
        name,
        value: e.amount,
        color:
          (e.categoryId ? categoriesById.get(e.categoryId)?.color : null) ??
          colorForKey(name),
      })
    }
    const list = [...m.values()].sort((a, b) => b.value - a.value)
    const sum = list.reduce((s, r) => s + r.value, 0)
    return {
      rows: list.map((r) => ({ ...r, share: sum > 0 ? r.value / sum : 0 })),
      total: sum,
    }
  }, [entries, categoriesById])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold">Por categoria</p>
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "categoria" : "categorias"} ·{" "}
              <span className="tabular-nums">{formatBRL(total)}</span>
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="grid h-[140px] place-items-center text-xs text-muted-foreground">
            Sem lançamentos nesta fatura.
          </p>
        ) : (
          <div className="grid items-center gap-4 @2xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {/* absolute inset-0: o ResponsiveContainer mede uma caixa cujo
                tamanho não depende do próprio gráfico — sem isso o recharts
                mantém a largura antiga ao encolher e vaza para fora do card. */}
            <div className="relative h-44 min-w-0 overflow-hidden">
              <ResponsiveContainer
                width="100%"
                height="100%"
                className="!absolute inset-0"
              >
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {rows.map((r) => (
                      <Cell
                        key={r.name}
                        fill={r.color}
                        fillOpacity={
                          selected.length === 0 || selected.includes(r.key)
                            ? 1
                            : 0.25
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltip} formatter={brl} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Duas colunas quando sobra largura: a legenda inteira cabe sem
                rolar e as linhas não esticam pela tela toda. */}
            <ul className="grid max-h-44 min-w-0 gap-x-4 gap-y-0.5 overflow-y-auto overscroll-contain pr-1 @4xl:grid-cols-2">
              {rows.map((r) => {
                const on = selected.includes(r.key)
                return (
                  <li key={r.name} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggle(r.key)}
                      title={`Filtrar os lançamentos por “${r.name}”`}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
                        on ? "bg-primary/15" : "hover:bg-muted/30",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {Math.round(r.share * 100)}%
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatBRL(r.value)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
