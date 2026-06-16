import { useMemo } from "react"
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
import { cn } from "@/lib/utils"

const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
} as const

const brl = (v: unknown) =>
  typeof v === "number" ? formatBRL(v) : String(v)

interface Props {
  entries: LedgerEntry[]
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
  categoriesById: Map<string, FinanceCategory>
  fromPeriod: string
  toPeriod: string
  /** Accumulated balance since January of the current year. */
  accumulated: number
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
}: Props) {
  const totals = useMemo(() => ledgerTotals(entries), [entries])

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
            <Tooltip contentStyle={tooltipStyle} formatter={brl} />
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
            <Tooltip contentStyle={tooltipStyle} formatter={brl} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={brl} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={brl} />
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
            <Tooltip contentStyle={tooltipStyle} formatter={brl} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={brl} />
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
      </div>
    </div>
  )
}
