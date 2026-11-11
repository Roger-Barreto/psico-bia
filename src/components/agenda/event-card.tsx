import { ArrowsClockwiseIcon, MapPinIcon, WarningIcon } from "@phosphor-icons/react"
import type { AgendaCategory, EventOccurrence } from "@/db/types"
import { recurrenceLabel } from "@/domain/events"
import { eventColor, eventIcon, lighten, tint } from "./event-style"

interface Props {
  occurrence: EventOccurrence
  category?: AgendaCategory | null
  /** "Ana às 14:00" — atendimento que cai em cima deste compromisso. */
  clashLabel?: string | null
  onClick: () => void
}

/**
 * Compromisso pessoal na lista do dia. Segue o ritmo dos cartões de paciente
 * (mesma altura, hora à esquerda, selo à direita) mas não se confunde com
 * eles: faixa lateral e fundo na cor da categoria, ícone num quadrado no
 * lugar do avatar redondo, e nenhum estado de atendimento.
 */
export function AgendaEventCard({
  occurrence,
  category,
  clashLabel,
  onClick,
}: Props) {
  const { event } = occurrence
  const color = eventColor(category)
  const text = lighten(color, 0.5)
  const Icon = eventIcon(category?.icon)
  const repeats = recurrenceLabel(event)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-3 pl-4 text-left transition-[filter,background-color] hover:brightness-125"
      style={{
        borderColor: tint(color, 0.35),
        backgroundColor: tint(color, 0.08),
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />

      <span
        className="flex min-w-[3.1rem] shrink-0 flex-col items-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums leading-tight"
        style={{ backgroundColor: tint(color, 0.18), color: text }}
      >
        {event.allDay ? (
          <>
            <span>Dia</span>
            <span className="text-[10px] font-medium opacity-80">inteiro</span>
          </>
        ) : (
          <>
            <span>{event.startTime}</span>
            <span className="text-[10px] font-medium opacity-70">
              {event.endTime}
            </span>
          </>
        )}
      </span>

      <span
        className="grid size-11 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: tint(color, 0.2), color: text }}
      >
        <Icon weight="fill" className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{event.title}</p>
        <p className="flex items-center gap-x-2 truncate text-[11px] text-muted-foreground">
          {repeats && (
            <span className="inline-flex shrink-0 items-center gap-1">
              <ArrowsClockwiseIcon weight="bold" className="size-3" />
              {repeats}
            </span>
          )}
          {event.location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPinIcon weight="fill" className="size-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
          {!repeats && !event.location && <span>Compromisso pessoal</span>}
        </p>
        {clashLabel && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-300">
            <WarningIcon weight="fill" className="size-3 shrink-0" />
            <span className="truncate">Coincide com {clashLabel}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="inline-flex max-w-[8.5rem] items-center rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: tint(color, 0.2), color: text }}
        >
          <span className="truncate">{category?.name ?? "Compromisso"}</span>
        </span>
        {!event.busy && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Lembrete
          </span>
        )}
      </div>
    </button>
  )
}
