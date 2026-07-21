import { useMemo } from "react"
import { CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react"
import { monthMatrix, todayISO, toISO, formatDateBR } from "@/domain/dates"
import { addPeriod } from "@/domain/finance"
import { cn } from "@/lib/utils"

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

interface Props {
  /** Viewed month, YYYY-MM (same state as the page's MonthNav). */
  period: string
  /** Launches per day (ISO date → count); invoices count on their due date. */
  counts: Map<string, number>
  /** Day filter currently applied, or null (whole month). */
  selected: string | null
  /** Click a day → filter it; click the selected day again → clear. */
  onSelectDay: (day: string | null) => void
  onChangePeriod: (period: string) => void
}

/**
 * Mini month calendar for the ledger, mirroring the agenda's MiniCalendar:
 * each day shows how many launches it has; clicking filters the list to that
 * day (toggle). Out-of-month cells just move the visible month.
 */
export function LedgerMiniCalendar({
  period,
  counts,
  selected,
  onSelectDay,
  onChangePeriod,
}: Props) {
  const [year, month] = period.split("-").map(Number)
  const visibleMonth = useMemo(
    () => new Date(year, month - 1, 1),
    [year, month],
  )
  const cells = useMemo(() => monthMatrix(visibleMonth), [visibleMonth])
  const monthIdx = month - 1
  const today = todayISO()

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-[0_8px_30px_-15px_rgba(0,0,0,0.6)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {year}
          </p>
          <p className="text-base font-semibold">{monthLabel[monthIdx]}</p>
        </div>
        <div className="flex items-center gap-1">
          {period !== today.slice(0, 7) && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              onClick={() => onChangePeriod(today.slice(0, 7))}
            >
              Hoje
            </button>
          )}
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => onChangePeriod(addPeriod(period, -1))}
            aria-label="Mês anterior"
          >
            <CaretLeftIcon weight="bold" className="size-3.5" />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => onChangePeriod(addPeriod(period, 1))}
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
          const count = counts.get(iso) ?? 0
          const isSelected = iso === selected
          const isToday = iso === today

          return (
            <button
              key={iso}
              type="button"
              onClick={() => {
                // out-of-month cells only move the visible month
                if (!inMonth) {
                  onChangePeriod(iso.slice(0, 7))
                  return
                }
                onSelectDay(isSelected ? null : iso)
              }}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-xs font-medium transition-colors",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                !isSelected && "hover:bg-muted/40",
                isSelected && "bg-primary/15 ring-2 ring-primary",
                isToday && !isSelected && "border-primary/40",
              )}
              aria-label={iso}
              aria-pressed={isSelected}
            >
              <span className="leading-none">{d.getDate()}</span>
              {inMonth && count > 0 && (
                <span
                  className="grid min-w-[14px] place-items-center rounded-full bg-primary/25 px-1 py-0 text-[9px] font-bold leading-none tabular-nums text-primary"
                  aria-label={`${count} lançamentos`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex min-h-6 items-center justify-between gap-2 text-[11px] text-muted-foreground">
        {selected ? (
          <>
            <span>
              Exibindo só{" "}
              <span className="font-medium text-foreground">
                {formatDateBR(selected)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onSelectDay(null)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
            >
              <XIcon weight="bold" className="size-3" />
              Limpar
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="grid min-w-[14px] place-items-center rounded-full bg-primary/25 px-1 text-[9px] font-bold leading-none text-primary">
              N
            </span>
            lançamentos no dia — clique para filtrar
          </span>
        )}
      </div>
    </div>
  )
}
