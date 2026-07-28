import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { FinanceCategory, LedgerEntry } from "@/db/types"
import { formatBRL } from "@/domain/finance"
import {
  categoryKeyOf,
  categoryNameOf,
} from "@/components/finance/ledger-filters"
import { Card, CardContent } from "@/components/ui/card"
import { colorForKey } from "@/lib/finance-colors"
import { brl, chartTooltip } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

export interface CategorySlice {
  key: string
  name: string
  color: string
  value: number
  /** Fração do total (0–1). */
  share: number
}

/**
 * Agrupa os lançamentos de um tipo por categoria, do maior total para o menor.
 * A chave é a mesma de `categoryKeyOf`, então clicar na legenda casa com o
 * filtro de categorias das listas.
 */
export function categorySlices(
  entries: LedgerEntry[],
  kind: "expense" | "income",
  categoriesById?: Map<string, FinanceCategory>,
): { rows: CategorySlice[]; total: number } {
  const m = new Map<string, Omit<CategorySlice, "share">>()
  for (const e of entries) {
    if (e.kind !== kind) continue
    const key = categoryKeyOf(e)
    const cur = m.get(key)
    if (cur) {
      cur.value += e.amount
      continue
    }
    const name = categoryNameOf(e)
    m.set(key, {
      key,
      name,
      value: e.amount,
      color:
        (e.categoryId ? categoriesById?.get(e.categoryId)?.color : null) ??
        colorForKey(name),
    })
  }
  const list = [...m.values()].sort((a, b) => b.value - a.value)
  const total = list.reduce((s, r) => s + r.value, 0)
  return {
    rows: list.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 })),
    total,
  }
}

/**
 * Quebra por categoria: donut + legenda completa. Toda categoria é listada
 * (nada fica escondido atrás de um "top N") — a legenda rola em vez de esticar
 * o card. Com `onToggle`, clicar numa linha liga/desliga aquela categoria em
 * `selected`, o que apaga a fatia e filtra a lista que estiver ao lado.
 */
export function CategoryBreakdown({
  title,
  subtitle,
  rows,
  total,
  selected = [],
  onToggle,
  empty = "Sem lançamentos.",
  action,
  className,
}: {
  title: string
  subtitle?: string
  rows: CategorySlice[]
  total: number
  /** Chaves de categoria filtradas (de `categoryKeyOf`). */
  selected?: string[]
  /** Ausente = legenda só informativa (não filtra nada). */
  onToggle?: (key: string) => void
  empty?: string
  /** Controle extra no canto direito do cabeçalho. */
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      {/* @container: o layout responde à largura do próprio card — ele vive
          tanto na coluna estreita do calendário quanto numa linha inteira. */}
      <CardContent className="@container p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {rows.length} {rows.length === 1 ? "categoria" : "categorias"} ·{" "}
                <span className="tabular-nums">{formatBRL(total)}</span>
              </p>
            )}
            {action}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="grid h-[140px] place-items-center text-xs text-muted-foreground">
            {empty}
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
                        key={r.key}
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
                const inner = (
                  <>
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
                  </>
                )
                const base =
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm"
                return (
                  <li key={r.key} className="min-w-0">
                    {onToggle ? (
                      <button
                        type="button"
                        onClick={() => onToggle(r.key)}
                        title={`Filtrar os lançamentos por “${r.name}”`}
                        className={cn(
                          base,
                          "transition-colors",
                          on ? "bg-primary/15" : "hover:bg-muted/30",
                        )}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className={base}>{inner}</div>
                    )}
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
