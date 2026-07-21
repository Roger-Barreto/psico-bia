import { formatBRL } from "@/domain/finance"

/**
 * Shared recharts theming for the finance charts. The tooltip explicitly sets
 * `contentStyle` + `itemStyle` + `labelStyle` to the popover foreground so text
 * is always readable (recharts defaults to dark text, invisible on dark bg).
 */
export const chartAxis = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
    boxShadow: "0 8px 30px -15px rgba(0,0,0,0.6)",
  },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 600 },
  cursor: { fill: "hsl(var(--muted) / 0.35)" },
} as const

/** BRL formatter for chart tooltips/axes. */
export const brl = (v: unknown): string =>
  typeof v === "number" ? formatBRL(v) : String(v)
