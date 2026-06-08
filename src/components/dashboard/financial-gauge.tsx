import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts"
import { CurrencyDollarIcon } from "@phosphor-icons/react"
import { Card, CardContent } from "@/components/ui/card"
import { formatBRL } from "@/domain/finance"
import { cn } from "@/lib/utils"

interface Props {
  estimated: number
  revenue: number
  pending: number
  unpaidCount: number
  unpaidValue: number
  onClickUnpaid?: () => void
}

const COLOR_REVENUE = "rgb(16,185,129)"
const COLOR_PENDING = "rgb(245,158,11)"
const COLOR_TRACK = "rgba(148,163,184,0.18)"

export function FinancialGauge({
  estimated,
  revenue,
  pending,
  unpaidCount,
  unpaidValue,
  onClickUnpaid,
}: Props) {
  const empty = estimated <= 0
  const domainMax = Math.max(estimated, revenue + pending, 1)
  const realizedPct = empty
    ? 0
    : Math.min(
        999,
        Math.round(((revenue + pending) / Math.max(estimated, 1)) * 100),
      )

  // Order: outer ring first, inner second
  const data = [
    {
      name: "Pendente",
      value: Math.max(0, pending),
      fill: COLOR_PENDING,
    },
    {
      name: "Faturado",
      value: Math.max(0, revenue),
      fill: COLOR_REVENUE,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Financeiro do mês
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Agendados, sem faltas/reagendados de outro mês
            </p>
          </div>
          {!empty && (
            <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {realizedPct}% realizado
            </span>
          )}
        </div>

        <div className="mt-4 grid items-center gap-5 @3xl:grid-cols-[300px_1fr] @5xl:grid-cols-[340px_1fr] [&>*]:min-w-0">
          {/* Gauge */}
          <div className="relative mx-auto h-[210px] w-full max-w-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="88%"
                startAngle={180}
                endAngle={0}
                innerRadius={70}
                outerRadius={150}
                data={data}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, domainMax]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: COLOR_TRACK }}
                  dataKey="value"
                  cornerRadius={6}
                  isAnimationActive={false}
                />
              </RadialBarChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Estimado
              </p>
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {empty ? "—" : formatBRL(estimated)}
              </p>
            </div>

            {/* Endpoint axis labels */}
            <div className="pointer-events-none absolute inset-x-1 bottom-0 flex justify-between text-[10px] text-muted-foreground">
              <span>R$ 0</span>
              <span>{empty ? "—" : formatBRL(domainMax)}</span>
            </div>

            {/* Inline ring tags (above each ring on left side) */}
            {!empty && (
              <>
                <RingTag
                  top="46%"
                  tone="amber"
                  label="Pendente"
                />
                <RingTag
                  top="62%"
                  tone="emerald"
                  label="Faturado"
                />
              </>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <LegendRow
              tone="emerald"
              label="Faturado"
              sublabel="Atendidos e pagos"
              value={revenue}
            />
            <LegendRow
              tone="amber"
              label="Pendente"
              sublabel="Atendidos e não pagos"
              value={pending}
              extra={
                unpaidCount > 0 ? (
                  <button
                    type="button"
                    onClick={onClickUnpaid}
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25"
                  >
                    <CurrencyDollarIcon weight="fill" className="size-3" />
                    {unpaidCount} não pago{unpaidCount === 1 ? "" : "s"} ·{" "}
                    {formatBRL(unpaidValue)} ›
                  </button>
                ) : null
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface RingTagProps {
  top: string
  tone: "emerald" | "amber"
  label: string
}

function RingTag({ top, tone, label }: RingTagProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
        tone === "emerald" && "bg-emerald-500/20 text-emerald-300",
        tone === "amber" && "bg-amber-500/20 text-amber-300",
      )}
      style={{ top }}
    >
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          tone === "emerald" && "bg-emerald-500",
          tone === "amber" && "bg-amber-500",
        )}
      />
      {label}
    </span>
  )
}

interface LegendProps {
  tone: "emerald" | "amber"
  label: string
  sublabel: string
  value: number
  extra?: React.ReactNode
}

function LegendRow({ tone, label, sublabel, value, extra }: LegendProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2",
        tone === "emerald" && "border-emerald-500/30 bg-emerald-500/5",
        tone === "amber" && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <span
        className={cn(
          "mt-1.5 inline-block size-2.5 shrink-0 rounded-full",
          tone === "emerald" && "bg-emerald-500",
          tone === "amber" && "bg-amber-500",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider",
              tone === "emerald" && "text-emerald-300",
              tone === "amber" && "text-amber-300",
            )}
          >
            {label}
          </span>
          <span className="text-sm font-bold tabular-nums">
            {formatBRL(value)}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">{sublabel}</p>
        {extra}
      </div>
    </div>
  )
}
