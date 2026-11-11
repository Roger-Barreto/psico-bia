import { useMemo } from "react"
import { CalendarDotsIcon, WarningIcon } from "@phosphor-icons/react"
import { useAgendaCategories } from "@/api/agenda"
import type { AgendaEvent, EventOccurrence } from "@/db/types"
import { formatLongDateBR } from "@/domain/dates"
import { eventTimeLabel } from "@/domain/events"
import { cn } from "@/lib/utils"
import { NEUTRAL_EVENT_COLOR } from "./event-style"

interface Props {
  /** Compromissos que ocupam o horário pretendido para o atendimento. */
  clashes: EventOccurrence[]
  /** Outros compromissos do mesmo dia, fora do horário (só informativo). */
  sameDay?: EventOccurrence[]
  className?: string
}

interface Group {
  event: AgendaEvent
  dates: string[]
}

function groupByEvent(occurrences: EventOccurrence[]): Group[] {
  const map = new Map<string, Group>()
  for (const o of occurrences) {
    const g = map.get(o.event.id)
    if (g) g.dates.push(o.date)
    else map.set(o.event.id, { event: o.event, dates: [o.date] })
  }
  return [...map.values()]
}

/**
 * Aviso mostrado ao agendar/reagendar um paciente: o horário bate com um
 * compromisso pessoal. Avisa e deixa seguir — quem decide é a profissional
 * (ela pode faltar ao pilates; o sistema não sabe).
 */
export function EventClashNotice({ clashes, sameDay = [], className }: Props) {
  const categoriesQ = useAgendaCategories()
  const colorOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categoriesQ.data ?? []) m.set(c.id, c.color)
    return (e: AgendaEvent) =>
      (e.categoryId && m.get(e.categoryId)) || NEUTRAL_EVENT_COLOR
  }, [categoriesQ.data])

  const groups = useMemo(() => groupByEvent(clashes), [clashes])

  if (clashes.length === 0 && sameDay.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      {groups.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100"
        >
          <WarningIcon
            weight="fill"
            className="mt-0.5 size-4 shrink-0 text-amber-400"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-medium">
              {clashes.length === 1
                ? "Você tem um compromisso neste horário"
                : `${clashes.length} sessões caem em cima de compromissos seus`}
            </p>
            <ul className="space-y-1">
              {groups.slice(0, 4).map((g) => (
                <li
                  key={g.event.id}
                  className="flex items-start gap-2 text-xs text-amber-100/90"
                >
                  <span
                    aria-hidden
                    className="mt-1 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf(g.event) }}
                  />
                  <span className="min-w-0">
                    <b className="font-semibold">{g.event.title}</b>
                    {" · "}
                    {eventTimeLabel(g.event)}
                    {" · "}
                    {g.dates.length === 1
                      ? formatLongDateBR(g.dates[0])
                      : `${g.dates.length} datas, a partir de ${formatLongDateBR(g.dates[0]).toLowerCase()}`}
                  </span>
                </li>
              ))}
              {groups.length > 4 && (
                <li className="text-xs text-amber-100/70">
                  e mais {groups.length - 4}…
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {sameDay.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <CalendarDotsIcon weight="fill" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="mb-1 font-medium text-foreground/90">
              Neste dia você também tem
            </p>
            <ul className="space-y-0.5">
              {sameDay.slice(0, 5).map((o) => (
                <li
                  key={`${o.event.id}-${o.date}`}
                  className="flex items-center gap-2"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf(o.event) }}
                  />
                  <span className="truncate">
                    {o.event.title} · {eventTimeLabel(o.event)}
                  </span>
                </li>
              ))}
              {sameDay.length > 5 && <li>e mais {sameDay.length - 5}…</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
