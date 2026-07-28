import { useEffect, useState } from "react"
import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react"
import { periodLabel, todayPeriod } from "@/domain/finance"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
]

/**
 * Escolha de um mês qualquer (passado ou futuro), no visual dos atalhos de
 * período ao lado. `active` marca que o período em uso veio daqui.
 */
export function MonthPicker({
  value,
  active,
  onChange,
}: {
  /** Mês selecionado, YYYY-MM. */
  value: string
  active: boolean
  onChange: (period: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(value.slice(0, 4)))

  // Ao reabrir, começa no ano do mês em uso (e não onde o usuário parou).
  useEffect(() => {
    if (open) setYear(Number(value.slice(0, 4)))
  }, [open, value])

  const today = todayPeriod()
  const selectedMonth = active ? value : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          title="Escolher um mês específico"
        >
          <CalendarBlankIcon weight="fill" className="size-4" />
          {/* first-letter, não `capitalize`: senão vira "Março De 2026". */}
          <span className="first-letter:uppercase">
            {active ? periodLabel(value) : "Escolher mês"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-label="Ano anterior"
          >
            <CaretLeftIcon weight="bold" className="size-3.5" />
          </button>
          <span className="text-sm font-semibold tabular-nums">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-label="Próximo ano"
          >
            <CaretRightIcon weight="bold" className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS_SHORT.map((m, i) => {
            const period = `${year}-${String(i + 1).padStart(2, "0")}`
            const on = period === selectedMonth
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(period)
                  setOpen(false)
                }}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm font-medium capitalize transition-colors",
                  on
                    ? "bg-primary/20 text-foreground ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  !on && period === today && "text-foreground ring-1 ring-border",
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
