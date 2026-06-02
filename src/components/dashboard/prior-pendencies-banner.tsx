import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

interface Props {
  total: number
  overdue: number
  oldestYear: number
  oldestMonth: number
  monthsWithPendencies: number
  selectedYear: number
  onJump: (year: number, month: number) => void
}

export function PriorPendenciesBanner({
  total,
  overdue,
  oldestYear,
  oldestMonth,
  monthsWithPendencies,
  selectedYear,
  onJump,
}: Props) {
  if (total === 0) return null

  const tone: "red" | "amber" = overdue > 0 ? "red" : "amber"
  const oldestLabel =
    oldestYear === selectedYear
      ? monthNames[oldestMonth - 1]
      : `${monthNames[oldestMonth - 1]} de ${oldestYear}`

  const phrase =
    monthsWithPendencies === 1
      ? `pendência${total === 1 ? "" : "s"} em ${oldestLabel}`
      : `pendências em meses anteriores`

  const tooltip =
    monthsWithPendencies > 1
      ? `Mais antiga em ${oldestLabel}`
      : undefined

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-2xl border px-4 py-2",
        tone === "red" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "amber" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-300",
      )}
      title={tooltip}
    >
      <div className="flex items-baseline gap-2 leading-tight">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-base font-medium">{phrase}</span>
      </div>
      <Button
        variant={tone === "red" ? "destructive" : "outline"}
        size="sm"
        onClick={() => onJump(oldestYear, oldestMonth)}
      >
        Conferir
      </Button>
    </div>
  )
}
