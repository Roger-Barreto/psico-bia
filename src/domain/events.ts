import type { AgendaEvent, EventOccurrence, Occurrence } from "@/db/types"
import { addDays, diffDays, formatDateBR, fromISO, toISO } from "./dates"

interface Range {
  fromISO: string
  toISO: string
}

/**
 * Quanto dura uma sessão para efeito de conflito de horário. O atendimento só
 * guarda a hora de início; 50 min é a sessão padrão (o mesmo fallback previsto
 * em docs/13-google-agenda para quando a duração for configurável).
 */
export const SESSION_MINUTES = 50

// ─── Horas ───────────────────────────────────────────────────────────
/** "HH:MM" → minutos desde 00:00. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Minutos desde 00:00 → "HH:MM", preso ao mesmo dia (máx. 23:59). */
export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)))
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function addMinutesToTime(time: string, minutes: number): string {
  return fromMinutes(toMinutes(time) + minutes)
}

/** Dois intervalos [início, fim) se sobrepõem? Encostar não conta. */
export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

// ─── Repetição ───────────────────────────────────────────────────────
/**
 * Dias da semana de uma repetição semanal. Sem `weekdays` gravado, vale o dia
 * da semana em que ela começa.
 */
export function eventWeekdays(
  event: Pick<AgendaEvent, "weekdays" | "startDate">,
): number[] {
  if (event.weekdays && event.weekdays.length > 0) return event.weekdays
  return [fromISO(event.startDate).getDay()]
}

/** Último dia de um mês (`month` de 0 a 11). */
function lastDayOf(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function originDates(event: AgendaEvent, range: Range): string[] {
  const start = event.startDate
  if (!event.frequency) {
    return start >= range.fromISO && start <= range.toISO ? [start] : []
  }

  const lo = range.fromISO > start ? range.fromISO : start
  const hi =
    event.endDate && event.endDate < range.toISO ? event.endDate : range.toISO
  if (lo > hi) return []

  const out: string[] = []
  const loDate = fromISO(lo)
  const hiDate = fromISO(hi)
  const anchor = fromISO(start)

  if (event.frequency === "daily") {
    for (let d = loDate; d <= hiDate; d = addDays(d, 1)) out.push(toISO(d))
    return out
  }

  if (event.frequency === "weekly") {
    const days = new Set(eventWeekdays(event))
    for (let d = loDate; d <= hiDate; d = addDays(d, 1)) {
      if (days.has(d.getDay())) out.push(toISO(d))
    }
    return out
  }

  if (event.frequency === "biweekly") {
    const skips = Math.ceil(diffDays(loDate, anchor) / 14)
    for (let d = addDays(anchor, skips * 14); d <= hiDate; d = addDays(d, 14)) {
      out.push(toISO(d))
    }
    return out
  }

  if (event.frequency === "monthly") {
    // Mesmo dia do mês; em mês mais curto cai no último dia (31 → 28/30).
    const day = anchor.getDate()
    let y = loDate.getFullYear()
    let m = loDate.getMonth()
    for (;;) {
      const date = new Date(y, m, Math.min(day, lastDayOf(y, m)))
      if (date > hiDate) break
      if (date >= loDate) out.push(toISO(date))
      m++
      if (m > 11) {
        m = 0
        y++
      }
    }
    return out
  }

  // yearly — 29/02 cai em 28/02 nos anos que não são bissextos.
  const month = anchor.getMonth()
  const day = anchor.getDate()
  for (let y = loDate.getFullYear(); y <= hiDate.getFullYear(); y++) {
    const date = new Date(y, month, Math.min(day, lastDayOf(y, month)))
    if (date >= loDate && date <= hiDate) out.push(toISO(date))
  }
  return out
}

/**
 * Ocorrências de um compromisso em [range.fromISO, range.toISO], inclusive.
 * Pura: a regra e as datas puladas vêm no próprio `event`.
 */
export function occurrencesForEvent(
  event: AgendaEvent,
  range: Range,
): EventOccurrence[] {
  const skipped = new Set(event.skips)
  return originDates(event, range)
    .filter((date) => !skipped.has(date))
    .map((date) => ({ event, date }))
}

export function occurrencesForEvents(
  events: AgendaEvent[],
  range: Range,
): EventOccurrence[] {
  const out: EventOccurrence[] = []
  for (const e of events) out.push(...occurrencesForEvent(e, range))
  return out
}

/** Dia inteiro primeiro; depois por hora de início e, no empate, pelo título. */
export function compareEventOccurrences(
  a: EventOccurrence,
  b: EventOccurrence,
): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1
  const t = (a.event.startTime ?? "").localeCompare(b.event.startTime ?? "")
  if (t !== 0) return t
  return a.event.title.localeCompare(b.event.title)
}

export function eventOccurrencesByDate(
  occurrences: EventOccurrence[],
): Map<string, EventOccurrence[]> {
  const map = new Map<string, EventOccurrence[]>()
  for (const o of occurrences) {
    const list = map.get(o.date)
    if (list) list.push(o)
    else map.set(o.date, [o])
  }
  for (const list of map.values()) list.sort(compareEventOccurrences)
  return map
}

// ─── Conflito com atendimentos ───────────────────────────────────────
export type EventTiming = Pick<AgendaEvent, "allDay" | "startTime" | "endTime">

/**
 * Uma sessão que começa em `time` cai em cima do compromisso? Compromisso de
 * dia inteiro toma o dia todo. Quem chama já filtrou pelo mesmo dia.
 */
export function eventCoversSession(
  event: EventTiming,
  time: string,
  minutes = SESSION_MINUTES,
): boolean {
  if (event.allDay) return true
  if (!event.startTime || !event.endTime || !time) return false
  const start = toMinutes(time)
  return overlaps(
    start,
    start + minutes,
    toMinutes(event.startTime),
    toMinutes(event.endTime),
  )
}

/**
 * Compromissos que OCUPAM o horário (`busy`) e batem com uma sessão em
 * `date` às `time`. Lembretes (`busy = false`) nunca conflitam.
 */
export function eventsClashingWithSession(
  occurrences: EventOccurrence[],
  date: string,
  time: string,
): EventOccurrence[] {
  return occurrences.filter(
    (o) => o.date === date && o.event.busy && eventCoversSession(o.event, time),
  )
}

/** Atendimentos que caem em cima de um compromisso num dia. */
export function sessionsClashingWithEvent(
  sessions: Occurrence[],
  event: EventTiming,
  date: string,
): Occurrence[] {
  return sessions.filter(
    (s) =>
      s.date === date &&
      // Falta já registrada não ocupa mais o horário.
      s.appointment?.status !== "missed" &&
      (event.allDay || (!!s.time && eventCoversSession(event, s.time))),
  )
}

// ─── Textos ──────────────────────────────────────────────────────────
const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const WEEKDAY_EVERY = [
  "Todo domingo",
  "Toda segunda",
  "Toda terça",
  "Toda quarta",
  "Toda quinta",
  "Toda sexta",
  "Todo sábado",
]

/** Segunda primeiro: é como a semana é lida por aqui. */
function mondayFirst(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
}

/** "14:00 – 15:00" ou "Dia inteiro". */
export function eventTimeLabel(event: EventTiming): string {
  if (event.allDay || !event.startTime) return "Dia inteiro"
  return event.endTime
    ? `${event.startTime} – ${event.endTime}`
    : event.startTime
}

/** "Toda terça", "Toda semana · ter e qui", "Todo mês, dia 12"… ou `null`. */
export function recurrenceLabel(
  event: Pick<AgendaEvent, "frequency" | "weekdays" | "startDate" | "endDate">,
): string | null {
  if (!event.frequency) return null
  let base: string
  if (event.frequency === "daily") {
    base = "Todo dia"
  } else if (event.frequency === "weekly") {
    const days = mondayFirst(eventWeekdays(event))
    if (days.length === 7) base = "Todo dia"
    else if (days.length === 1) base = WEEKDAY_EVERY[days[0]]
    else if (days.join() === "1,2,3,4,5") base = "De segunda a sexta"
    else {
      const names = days.map((d) => WEEKDAY_SHORT[d])
      base = `Toda semana · ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`
    }
  } else if (event.frequency === "biweekly") {
    base = "A cada 2 semanas"
  } else if (event.frequency === "monthly") {
    base = `Todo mês, dia ${fromISO(event.startDate).getDate()}`
  } else {
    base = "Todo ano"
  }
  return event.endDate ? `${base} · até ${formatDateBR(event.endDate)}` : base
}
