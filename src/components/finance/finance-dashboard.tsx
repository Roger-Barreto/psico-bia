import { useMemo } from "react"
import { PiggyBankIcon } from "@phosphor-icons/react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type {
  FinanceCategory,
  LedgerEntry,
  PaymentMethod,
  Person,
} from "@/db/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatBRL,
  ledgerTotals,
  monthlySeries,
  periodShort,
} from "@/domain/finance"
import { colorForKey } from "@/lib/finance-colors"
import { brl, chartAxis as axisProps, chartTooltip } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

export interface CofrinhoBalance {
  name: string
  value: number
  color: string
}

export interface CofrinhoGoal {
  name: string
  color: string
  meta: number // expected saving over the period
  saved: number // actually saved over the period
}

interface Props {
  entries: LedgerEntry[]
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
  categoriesById: Map<string, FinanceCategory>
  fromPeriod: string
  toPeriod: string
  /** Accumulated balance since January of the current year. */
  accumulated: number
  /** Reserve balance per cofrinho (deposits − withdrawals). */
  cofrinhoBalances: CofrinhoBalance[]
  /** Amount deposited into cofrinhos per month across the range. */
  cofrinhoMonthly: { label: string; total: number }[]
  /** Goal vs saved per cofrinho across the range. */
  cofrinhoGoals: CofrinhoGoal[]
}

function ChartCard({
  title,
  subtitle,
  height = 240,
  children,
}: {
  title: string
  subtitle?: string
  height?: number
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as never}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "income" | "expense" | "neutral" | "amber"
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            tone === "income" && "text-emerald-300",
            tone === "expense" && "text-rose-300",
            tone === "amber" && "text-amber-400",
            (!tone || tone === "neutral") &&
              (value < 0 ? "text-rose-300" : "text-foreground"),
          )}
        >
          {formatBRL(value)}
        </p>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ label = "Sem dados." }: { label?: string }) {
  return (
    <div className="grid h-full place-items-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

export function FinanceDashboard({
  entries,
  methodsById,
  peopleById,
  categoriesById,
  fromPeriod,
  toPeriod,
  accumulated,
  cofrinhoBalances,
  cofrinhoMonthly,
  cofrinhoGoals,
}: Props) {
  const totals = useMemo(() => ledgerTotals(entries), [entries])
  const reservedTotal = useMemo(
    () => cofrinhoBalances.reduce((s, c) => s + c.value, 0),
    [cofrinhoBalances],
  )
  const goalTotals = useMemo(() => {
    const meta = cofrinhoGoals.reduce((s, c) => s + c.meta, 0)
    const saved = cofrinhoGoals.reduce((s, c) => s + c.saved, 0)
    return { meta, saved, pct: meta > 0 ? (saved / meta) * 100 : 0 }
  }, [cofrinhoGoals])

  const monthly = useMemo(
    () =>
      monthlySeries(entries, fromPeriod, toPeriod).map((p) => ({
        ...p,
        label: periodShort(p.period),
      })),
    [entries, fromPeriod, toPeriod],
  )

  const cumulative = useMemo(() => {
    let acc = 0
    return monthly.map((p) => {
      acc += p.balance
      return { label: p.label, saldo: acc }
    })
  }, [monthly])

  const expenses = useMemo(
    () => entries.filter((e) => e.kind === "expense"),
    [entries],
  )

  const byCategory = useMemo(() => {
    const m = new Map<string, { value: number; color: string }>()
    for (const e of expenses) {
      const name = e.categoryName ?? "Sem categoria"
      const color =
        (e.categoryId ? categoriesById.get(e.categoryId)?.color : null) ??
        colorForKey(name)
      const cur = m.get(name)
      if (cur) cur.value += e.amount
      else m.set(name, { value: e.amount, color })
    }
    const arr = [...m.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const top = arr.slice(0, 7)
    const rest = arr.slice(7).reduce((s, x) => s + x.value, 0)
    return [...top, { name: "Outros", value: rest, color: colorForKey("Outros") }]
  }, [expenses, categoriesById])

  const byMethod = useMemo(() => {
    const m = new Map<string, { value: number; color: string }>()
    for (const e of expenses) {
      if (!e.paymentMethodId) continue
      const pm = methodsById.get(e.paymentMethodId)
      const name = pm?.name ?? "—"
      const color = pm?.color ?? colorForKey(name)
      const cur = m.get(name)
      if (cur) cur.value += e.amount
      else m.set(name, { value: e.amount, color })
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value)
  }, [expenses, methodsById])

  const incomeByCategory = useMemo(() => {
    const m = new Map<string, { value: number; color: string }>()
    for (const e of entries) {
      if (e.kind !== "income") continue
      const name =
        e.categoryName ?? (e.scope === "clinic" ? "Atendimentos" : "Sem categoria")
      const color =
        (e.categoryId ? categoriesById.get(e.categoryId)?.color : null) ??
        colorForKey(name)
      const cur = m.get(name)
      if (cur) cur.value += e.amount
      else m.set(name, { value: e.amount, color })
    }
    const arr = [...m.entries()]
      .map(([name, v]) => ({ name, value: v.value, color: v.color }))
      .sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const top = arr.slice(0, 7)
    const rest = arr.slice(7).reduce((s, x) => s + x.value, 0)
    return [...top, { name: "Outros", value: rest, color: colorForKey("Outros") }]
  }, [entries, categoriesById])

  const byScope = useMemo(() => {
    const mk = (scope: "personal" | "clinic") => {
      let income = 0
      let expense = 0
      for (const e of entries) {
        if (e.scope !== scope) continue
        if (e.kind === "income") income += e.amount
        else expense += e.amount
      }
      return { income, expense }
    }
    return [
      { name: "Pessoal", ...mk("personal") },
      { name: "Clínica", ...mk("clinic") },
    ]
  }, [entries])

  const peopleBalances = useMemo(() => {
    const acc = new Map<string, number>()
    for (const e of entries) {
      if (!e.personId || e.settled) continue
      const cur = acc.get(e.personId) ?? 0
      acc.set(e.personId, cur + (e.kind === "income" ? e.amount : -e.amount))
    }
    return [...acc.entries()]
      .map(([id, net]) => ({
        name: peopleById.get(id)?.name ?? "—",
        net,
      }))
      .filter((x) => Math.abs(x.net) > 0.001)
      .sort((a, b) => b.net - a.net)
  }, [entries, peopleById])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Receitas" value={totals.income} tone="income" />
        <Stat label="Despesas" value={totals.expense} tone="expense" />
        <Stat label="Saldo" value={totals.balance} tone="neutral" />
        <Stat label="A receber" value={totals.receivable} tone="amber" />
        <Stat label="A pagar" value={totals.payable} tone="amber" />
        <Stat
          label="Acumulado (desde jan)"
          value={accumulated}
          tone="neutral"
        />
      </div>

      {cofrinhoGoals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  Metas dos cofrinhos no período
                </p>
                <p className="text-xs text-muted-foreground">
                  Quanto você deveria guardar × quanto guardou
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums">
                  <span className="text-emerald-300">
                    {formatBRL(goalTotals.saved)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {formatBRL(goalTotals.meta)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(goalTotals.pct)}% da meta guardado · reservado{" "}
                  {formatBRL(reservedTotal)}
                </p>
              </div>
            </div>
            <div
              className="grid gap-3"
              style={{
                // Up to 3 share the row (1 → full, 2 → halves, 3 → thirds);
                // 4+ wrap to the next line (max 3 per row).
                gridTemplateColumns: `repeat(${Math.min(cofrinhoGoals.length, 3)}, minmax(0, 1fr))`,
              }}
            >
              {cofrinhoGoals.map((c) => {
                const pct =
                  c.meta > 0
                    ? (c.saved / c.meta) * 100
                    : c.saved > 0
                      ? 100
                      : 0
                const done = pct >= 99.5
                return (
                  <div
                    key={c.name}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
                  >
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-inner"
                      style={{ backgroundColor: c.color }}
                    >
                      <PiggyBankIcon weight="fill" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p
                          className={cn(
                            "shrink-0 text-xs font-semibold tabular-nums",
                            done ? "text-emerald-300" : "text-muted-foreground",
                          )}
                        >
                          {Math.round(pct)}%
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                            backgroundColor: c.color,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums">
                        <span className="font-medium text-emerald-300">
                          {formatBRL(c.saved)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          de {formatBRL(c.meta)}
                        </span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Receitas × Despesas por mês"
          subtitle="Inclui faturamento da clínica"
        >
          <BarChart data={monthly}>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => `R$${v}`} />
            <Tooltip {...chartTooltip} formatter={brl} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              name="Receitas"
              dataKey="income"
              fill="rgb(16, 185, 129)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              name="Despesas"
              dataKey="expense"
              fill="rgb(244, 63, 94)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Fluxo de caixa acumulado"
          subtitle="Saldo somado ao longo do período"
        >
          <LineChart data={cumulative}>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => `R$${v}`} />
            <Tooltip {...chartTooltip} formatter={brl} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Line
              type="monotone"
              dataKey="saldo"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ChartCard>

        <ChartCard title="Despesas por categoria">
          {byCategory.length === 0 ? (
            <EmptyChart />
          ) : (
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {byCategory.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip {...chartTooltip} formatter={brl} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          )}
        </ChartCard>

        <ChartCard
          title="Receitas por categoria"
          subtitle="Inclui faturamento da clínica"
        >
          {incomeByCategory.length === 0 ? (
            <EmptyChart />
          ) : (
            <PieChart>
              <Pie
                data={incomeByCategory}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {incomeByCategory.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip {...chartTooltip} formatter={brl} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          )}
        </ChartCard>

        <ChartCard title="Despesas por forma de pagamento">
          {byMethod.length === 0 ? (
            <EmptyChart />
          ) : (
            <BarChart data={byMethod} layout="vertical">
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...chartTooltip} formatter={brl} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byMethod.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartCard>

        <ChartCard title="Clínica (PJ) × Pessoal (PF)">
          <BarChart data={byScope}>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => `R$${v}`} />
            <Tooltip {...chartTooltip} formatter={brl} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="Receitas" dataKey="income" fill="rgb(16, 185, 129)" radius={[4, 4, 0, 0]} />
            <Bar name="Despesas" dataKey="expense" fill="rgb(244, 63, 94)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Saldo por pessoa"
          subtitle="Verde = te devem · Vermelho = você deve (em aberto)"
        >
          {peopleBalances.length === 0 ? (
            <EmptyChart label="Sem empréstimos em aberto." />
          ) : (
            <BarChart data={peopleBalances} layout="vertical">
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...chartTooltip} formatter={brl} />
              <ReferenceLine x={0} stroke="hsl(var(--border))" />
              <Bar dataKey="net" radius={[0, 4, 4, 0]}>
                {peopleBalances.map((p, i) => (
                  <Cell
                    key={i}
                    fill={p.net >= 0 ? "rgb(16, 185, 129)" : "rgb(244, 63, 94)"}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartCard>

        {cofrinhoBalances.length > 0 && (
          <ChartCard
            title="Reservas nos cofrinhos"
            subtitle={`Total reservado: ${formatBRL(reservedTotal)}`}
          >
            <BarChart data={cofrinhoBalances} layout="vertical">
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis type="number" {...axisProps} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...chartTooltip} formatter={brl} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {cofrinhoBalances.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        )}

        {cofrinhoBalances.length > 0 && (
          <ChartCard
            title="Guardado nos cofrinhos por mês"
            subtitle="Quanto você separou em reservas a cada mês"
          >
            <BarChart data={cofrinhoMonthly}>
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={(v) => `R$${v}`} />
              <Tooltip {...chartTooltip} formatter={brl} />
              <Bar
                name="Guardado"
                dataKey="total"
                fill="rgb(245, 158, 11)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartCard>
        )}
      </div>
    </div>
  )
}
