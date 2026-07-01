import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { MonthPoint, NamedValue } from "@/domain/reading"

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "rgb(16, 185, 129)",
  "rgb(245, 158, 11)",
  "rgb(244, 63, 94)",
  "rgb(168, 85, 247)",
  "rgb(59, 130, 246)",
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

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-xs text-muted-foreground">
      Sem dados neste período.
    </div>
  )
}

export function BooksByMonthChart({ data }: { data: MonthPoint[] }) {
  return (
    <BarChart data={data}>
      <CartesianGrid
        stroke="hsl(var(--border))"
        strokeDasharray="3 3"
        vertical={false}
      />
      <XAxis dataKey="month" {...axisProps} />
      <YAxis {...axisProps} allowDecimals={false} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}

export function PagesByMonthChart({ data }: { data: MonthPoint[] }) {
  return (
    <BarChart data={data}>
      <CartesianGrid
        stroke="hsl(var(--border))"
        strokeDasharray="3 3"
        vertical={false}
      />
      <XAxis dataKey="month" {...axisProps} />
      <YAxis {...axisProps} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
      <Bar dataKey="value" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}

export function DistributionDonut({ data }: { data: NamedValue[] }) {
  if (!data.length) return <EmptyChart />
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
      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  )
}

export function RatingBarChart({ data }: { data: NamedValue[] }) {
  if (!data.length) return <EmptyChart />
  return (
    <BarChart data={data}>
      <CartesianGrid
        stroke="hsl(var(--border))"
        strokeDasharray="3 3"
        vertical={false}
      />
      <XAxis dataKey="name" {...axisProps} />
      <YAxis {...axisProps} allowDecimals={false} />
      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
      <Bar dataKey="value" fill="rgb(245, 158, 11)" radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}
