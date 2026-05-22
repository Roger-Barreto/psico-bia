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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { formatBRL } from "@/domain/finance"

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "rgb(16, 185, 129)", // emerald
  "rgb(245, 158, 11)", // amber
  "rgb(244, 63, 94)", // rose
  "rgb(168, 85, 247)", // purple
  "rgb(59, 130, 246)", // blue
]

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  height?: number
}

export function ChartCard({
  title,
  subtitle,
  children,
  height = 240,
}: ChartCardProps) {
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

interface RevenueByDayProps {
  data: { day: string; value: number }[]
}

export function RevenueByDayChart({ data }: RevenueByDayProps) {
  return (
    <BarChart data={data}>
      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="day" {...axisProps} />
      <YAxis
        {...axisProps}
        tickFormatter={(v) => (typeof v === "number" ? `R$${v}` : String(v))}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        formatter={(v) =>
          typeof v === "number" ? [formatBRL(v), "Faturado"] : [String(v), ""]
        }
      />
      <Bar
        dataKey="value"
        fill="hsl(var(--primary))"
        radius={[4, 4, 0, 0]}
      />
    </BarChart>
  )
}

interface PieDatum {
  name: string
  value: number
}

export function CategoryPie({ data }: { data: PieDatum[] }) {
  if (data.every((d) => d.value === 0)) {
    return (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        Sem dados.
      </div>
    )
  }
  return (
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        innerRadius={50}
        outerRadius={80}
        paddingAngle={2}
      >
        {data.map((_, i) => (
          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip contentStyle={tooltipStyle} />
      <Legend
        verticalAlign="bottom"
        height={36}
        wrapperStyle={{ fontSize: 12 }}
      />
    </PieChart>
  )
}

interface TopPatientsProps {
  data: { name: string; sessions: number }[]
}

export function TopPatientsChart({ data }: TopPatientsProps) {
  if (!data.length) {
    return (
      <div className="grid h-full place-items-center text-xs text-muted-foreground">
        Sem sessões no mês.
      </div>
    )
  }
  return (
    <BarChart data={data} layout="vertical">
      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
      <XAxis type="number" {...axisProps} allowDecimals={false} />
      <YAxis
        type="category"
        dataKey="name"
        width={120}
        {...axisProps}
      />
      <Tooltip contentStyle={tooltipStyle} />
      <Bar
        dataKey="sessions"
        fill="hsl(var(--secondary))"
        radius={[0, 4, 4, 0]}
      />
    </BarChart>
  )
}

interface MonthlyRevenueProps {
  data: { month: string; value: number }[]
}

export function MonthlyRevenueChart({ data }: MonthlyRevenueProps) {
  return (
    <LineChart data={data}>
      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="month" {...axisProps} />
      <YAxis
        {...axisProps}
        tickFormatter={(v) => (typeof v === "number" ? `R$${v}` : String(v))}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        formatter={(v) =>
          typeof v === "number" ? [formatBRL(v), "Faturado"] : [String(v), ""]
        }
      />
      <Line
        type="monotone"
        dataKey="value"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        dot={{ r: 3, fill: "hsl(var(--primary))" }}
      />
    </LineChart>
  )
}
