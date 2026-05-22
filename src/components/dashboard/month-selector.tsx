import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

interface Props {
  year: number
  month: number // 1..12
  onChange: (year: number, month: number) => void
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

export function MonthSelector({ year, month, onChange }: Props) {
  function shift(delta: number) {
    const idx = (month - 1 + delta + 12) % 12
    const newYear = year + Math.floor((month - 1 + delta) / 12)
    onChange(newYear, idx + 1)
  }

  function jumpToday() {
    const now = new Date()
    onChange(now.getFullYear(), now.getMonth() + 1)
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(-1)}
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
        onClick={() => shift(1)}
        aria-label="Próximo mês"
      >
        <CaretRightIcon weight="bold" />
      </Button>
      <Button variant="ghost" size="sm" onClick={jumpToday}>
        Hoje
      </Button>
    </div>
  )
}
