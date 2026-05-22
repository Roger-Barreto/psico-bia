import { useMemo } from "react"
import {
  CaretLeftIcon,
  CaretRightIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  endOfMonth,
  fromISO,
  monthMatrix,
  sameDay,
  startOfMonth,
  toISO,
  todayISO,
} from "@/domain/dates"

const weekdayShort = ["D", "S", "T", "Q", "Q", "S", "S"]
const monthLabel = [
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

export interface DayMeta {
  count: number
  pendencies: number
}

interface Props {
  visibleMonth: Date
  selectedISO: string
  byDate: Map<string, DayMeta>
  onChangeMonth: (next: Date) => void
  onSelect: (iso: string) => void
}

export function MiniCalendar({
  visibleMonth,
  selectedISO,
  byDate,
  onChangeMonth,
  onSelect,
}: Props) {
  const cells = useMemo(() => monthMatrix(visibleMonth), [visibleMonth])
  const monthIdx = visibleMonth.getMonth()
  const today = todayISO()

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[0_8px_30px_-15px_rgba(0,0,0,0.6)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {visibleMonth.getFullYear()}
          </p>
          <p className="text-base font-semibold">{monthLabel[monthIdx]}</p>
        </div>
        <div className="flex gap-1">
          <button
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() =>
              onChangeMonth(
                new Date(visibleMonth.getFullYear(), monthIdx - 1, 1),
              )
            }
            aria-label="Mês anterior"
          >
            <CaretLeftIcon weight="bold" className="size-3.5" />
          </button>
          <button
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() =>
              onChangeMonth(
                new Date(visibleMonth.getFullYear(), monthIdx + 1, 1),
              )
            }
            aria-label="Próximo mês"
          >
            <CaretRightIcon weight="bold" className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {weekdayShort.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const iso = toISO(d)
          const inMonth = d.getMonth() === monthIdx
          const meta = byDate.get(iso)
          const selected = iso === selectedISO
          const isToday = iso === today
          const hasPatients = !!meta && meta.count > 0
          const hasPendency = !!meta && meta.pendencies > 0

          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className={cn(
                "group relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-xs font-medium transition-colors",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                !selected && "hover:bg-muted/40",
                selected && "ring-2 ring-primary",
                isToday && !selected && "border-primary/40",
                hasPendency && "bg-destructive/15",
              )}
              aria-label={iso}
              aria-selected={selected}
            >
              <span className="leading-none">{d.getDate()}</span>
              {hasPatients && (
                <span
                  className="grid min-w-[14px] place-items-center rounded-full bg-amber-400 px-1 py-0 text-[9px] font-bold leading-none tabular-nums text-amber-950 shadow-sm"
                  aria-label={`${meta!.count} pacientes`}
                >
                  {meta!.count}
                </span>
              )}
              {hasPendency && (
                <span className="absolute right-1 top-1 text-destructive">
                  <WarningIcon weight="fill" className="size-3" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="grid min-w-[14px] place-items-center rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-none text-amber-950">
            N
          </span>
          pacientes
        </span>
        <span className="flex items-center gap-1.5">
          <WarningIcon weight="fill" className="size-3 text-destructive" />{" "}
          pendência
        </span>
      </div>
    </div>
  )
}

export function monthRange(d: Date) {
  return { fromISO: toISO(startOfMonth(d)), toISO: toISO(endOfMonth(d)) }
}

export function isToday(iso: string) {
  return sameDay(fromISO(iso), new Date())
}
