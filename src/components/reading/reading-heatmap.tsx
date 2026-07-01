import type { HeatCell } from "@/domain/reading"
import { addDays, diffDays, formatDateBR, toISO } from "@/domain/dates"
import { Card, CardContent } from "@/components/ui/card"

const LEVEL_COLORS = [
  "hsl(var(--muted))",
  "rgba(16,185,129,0.35)",
  "rgba(16,185,129,0.55)",
  "rgba(16,185,129,0.78)",
  "rgb(16,185,129)",
]

function level(minutes: number, max: number): number {
  if (minutes <= 0) return 0
  const r = minutes / (max || 1)
  if (r > 0.66) return 4
  if (r > 0.33) return 3
  if (r > 0.1) return 2
  return 1
}

/** Mapa de calor de dias lidos no ano (estilo contribuições do GitHub). */
export function ReadingHeatmap({
  data,
  year,
}: {
  data: HeatCell[]
  year: number
}) {
  const map = new Map(data.map((d) => [d.date, d.minutes]))
  const max = data.reduce((m, d) => Math.max(m, d.minutes), 0)
  const activeDays = data.filter((d) => d.minutes > 0).length
  const totalHours = Math.round(data.reduce((s, d) => s + d.minutes, 0) / 60)

  const first = new Date(year, 0, 1)
  const last = new Date(year, 11, 31)
  const start = addDays(first, -first.getDay())
  const end = addDays(last, 6 - last.getDay())
  const days = Array.from({ length: diffDays(end, start) + 1 }, (_, i) =>
    addDays(start, i),
  )
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Dias de leitura</p>
            <p className="text-xs text-muted-foreground">
              {activeDays} dias · {totalHours} h em {year}
            </p>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <span className="text-[10px] text-muted-foreground">menos</span>
            {LEVEL_COLORS.map((c, i) => (
              <span
                key={i}
                className="size-3 rounded-sm"
                style={{ backgroundColor: c }}
              />
            ))}
            <span className="text-[10px] text-muted-foreground">mais</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((d) => {
                  const iso = toISO(d)
                  const inYear = d.getFullYear() === year
                  const minutes = map.get(iso) ?? 0
                  return (
                    <span
                      key={iso}
                      title={inYear ? `${formatDateBR(iso)}: ${minutes} min` : undefined}
                      className="size-3 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: inYear
                          ? LEVEL_COLORS[level(minutes, max)]
                          : "transparent",
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
