import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { addPeriod, todayPeriod } from "@/domain/finance"
import { cn } from "@/lib/utils"

interface Props {
  period: string // YYYY-MM
  onChange: (period: string) => void
  className?: string
}

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

/** Month stepper matching the home dashboard's MonthSelector, driven by a period. */
export function MonthNav({ period, onChange, className }: Props) {
  const [year, month] = period.split("-").map(Number)
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addPeriod(period, -1))}
        aria-label="Mês anterior"
      >
        <CaretLeftIcon weight="bold" />
      </Button>
      <div className="min-w-40 text-center">
        <p className="text-2xl font-semibold tracking-tight">
          {monthNames[month - 1]}
        </p>
        <p className="text-xs text-muted-foreground">{year}</p>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addPeriod(period, 1))}
        aria-label="Próximo mês"
      >
        <CaretRightIcon weight="bold" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onChange(todayPeriod())}>
        Hoje
      </Button>
    </div>
  )
}
