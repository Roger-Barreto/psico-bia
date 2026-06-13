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
import type { LedgerEntry, PaymentMethod, Person } from "@/db/types"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatBRL,
  groupAmount,
  ledgerTotals,
  monthlySeries,
  periodShort,
} from "@/domain/finance"
import { cn } from "@/lib/utils"

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "rgb(16, 185, 129)",
  "rgb(245, 158, 11)",
  "rgb(244, 63, 94)",
  "rgb(168, 85, 247)",
  "rgb(59, 130, 246)",
  "rgb(20, 184, 166)",
]

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
  fromPeriod: string
  toPeriod: string
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
  fromPeriod,
  toPeriod,
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
    const m = groupAmount(expenses, (e) => e.categoryName ?? "Sem categoria")
    const arr = [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
    if (arr.length <= 8) return arr
    const top = arr.slice(0, 7)
    const rest = arr.slice(7).reduce((s, x) => s + x.value, 0)
    return [...top, { name: "Outros", value: rest }]
  }, [expenses])

  const byMethod = useMemo(() => {
    const m = groupAmount(expenses, (e) => e.paymentMethodId)
    return [...m.entries()]
      .map(([id, value]) => ({
        name: methodsById.get(id)?.name ?? "—",
        value,
      }))
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Receitas" value={totals.income} tone="income" />
        <Stat label="Despesas" value={totals.expense} tone="expense" />
        <Stat label="Saldo" value={totals.balance} tone="neutral" />
        <Stat label="A receber" value={totals.receivable} tone="amber" />
        <Stat label="A pagar" value={totals.payable} tone="amber" />
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
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
              <Bar dataKey="value" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
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
