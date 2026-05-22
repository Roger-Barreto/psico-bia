import type {
  Appointment,
  Occurrence,
  Patient,
  RecurrenceSegment,
} from "@/db/types"
import { addDays, diffDays, fromISO, toISO } from "./dates"

interface Range {
  fromISO: string
  toISO: string
}

/**
 * Compute occurrences for a single patient within [range.fromISO, range.toISO]
 * inclusive. Pure: takes overrides (appointments) and merges them.
 *
 * Patient may have a recurrenceHistory of segments; each segment defines the
 * active config from activeFrom until the next segment begins. Past segments
 * keep producing their own occurrences (preserving historical schedule).
 *
 * Rules per segment:
 * - "once": single occurrence at anchorDate
 * - "weekly"/"biweekly": every 7/14 days from anchorDate
 * - "monthly": same day-of-month as anchor, clamped to last day
 *
 * Time:
 * - Default from segment.defaultTime.
 * - Overridden by appointment.time when set.
 *
 * Overrides:
 * - If an Appointment exists for (patientId, originDate), it replaces the
 *   generated occurrence.
 * - status "rescheduled" w/ rescheduledTo: occurrence appears at new date.
 * - status "cancelled" hides occurrence.
 */
export function occurrencesForPatient(
  patient: Patient,
  range: Range,
  overrides: Appointment[],
): Occurrence[] {
  if (!patient.active) return []

  let effectiveTo = range.toISO
  if (patient.dischargedAt && patient.dischargedAt < effectiveTo) {
    effectiveTo = patient.dischargedAt
  }

  const segments = effectiveSegments(patient)

  // Map overrides by originDate for fast lookup
  const byOrigin = new Map<string, Appointment>()
  for (const a of overrides) {
    if (a.patientId === patient.id) byOrigin.set(a.originDate, a)
  }

  const out: Occurrence[] = []
  const emitted = new Set<string>()

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const segEnd = i + 1 < segments.length
      ? prevISO(segments[i + 1].activeFrom)
      : effectiveTo

    const windowStart = max(seg.activeFrom, range.fromISO)
    const windowEnd = min(segEnd, effectiveTo)
    if (windowStart > windowEnd) continue

    const origins = generateOriginDates(
      seg,
      fromISO(windowStart),
      fromISO(windowEnd),
    )

    for (const originISO of origins) {
      if (emitted.has(originISO)) continue
      emitted.add(originISO)
      const override = byOrigin.get(originISO)
      if (override) {
        if (override.status === "cancelled") continue
        if (
          override.status === "rescheduled" &&
          override.rescheduledTo &&
          (override.rescheduledTo < range.fromISO ||
            override.rescheduledTo > range.toISO)
        ) {
          continue
        }
        out.push({
          patientId: patient.id,
          originDate: originISO,
          date:
            override.status === "rescheduled" && override.rescheduledTo
              ? override.rescheduledTo
              : override.date,
          time: override.time ?? seg.defaultTime,
          appointment: override,
          pendencyCount: 0,
        })
      } else {
        out.push({
          patientId: patient.id,
          originDate: originISO,
          date: originISO,
          time: seg.defaultTime,
          appointment: null,
          pendencyCount: 0,
        })
      }
    }
  }

  // Include overrides whose originDate is outside the range but whose
  // effective date falls inside (e.g., rescheduled INTO the range)
  for (const a of overrides) {
    if (a.patientId !== patient.id) continue
    if (a.status === "cancelled") continue
    const effective =
      a.status === "rescheduled" && a.rescheduledTo
        ? a.rescheduledTo
        : a.date
    if (effective < range.fromISO || effective > range.toISO) continue
    if (a.originDate >= range.fromISO && a.originDate <= range.toISO) continue
    const seg = segmentFor(segments, a.originDate)
    out.push({
      patientId: patient.id,
      originDate: a.originDate,
      date: effective,
      time: a.time ?? seg?.defaultTime ?? "08:00",
      appointment: a,
      pendencyCount: 0,
    })
  }

  return out
}

function effectiveSegments(patient: Patient): RecurrenceSegment[] {
  if (patient.recurrenceHistory && patient.recurrenceHistory.length > 0) {
    return [...patient.recurrenceHistory].sort((a, b) =>
      a.activeFrom < b.activeFrom ? -1 : a.activeFrom > b.activeFrom ? 1 : 0,
    )
  }
  return [
    {
      activeFrom: patient.anchorDate,
      recurrence: patient.recurrence,
      defaultWeekday: patient.defaultWeekday,
      anchorDate: patient.anchorDate,
      defaultTime: patient.defaultTime ?? "08:00",
    },
  ]
}

function segmentFor(
  segments: RecurrenceSegment[],
  iso: string,
): RecurrenceSegment | null {
  let chosen: RecurrenceSegment | null = null
  for (const seg of segments) {
    if (seg.activeFrom <= iso) chosen = seg
    else break
  }
  return chosen
}

function max(a: string, b: string): string {
  return a > b ? a : b
}

function min(a: string, b: string): string {
  return a < b ? a : b
}

function prevISO(iso: string): string {
  return toISO(addDays(fromISO(iso), -1))
}

function generateOriginDates(
  seg: RecurrenceSegment,
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  const anchor = fromISO(seg.anchorDate)
  const out: string[] = []

  switch (seg.recurrence) {
    case "once":
      if (anchor >= rangeStart && anchor <= rangeEnd) out.push(toISO(anchor))
      return out

    case "weekly":
    case "biweekly": {
      const step = seg.recurrence === "weekly" ? 7 : 14
      let cursor = new Date(anchor)
      if (cursor < rangeStart) {
        const d = diffDays(rangeStart, cursor)
        const skips = Math.ceil(d / step)
        cursor = addDays(cursor, skips * step)
      }
      while (cursor <= rangeEnd) {
        if (cursor >= rangeStart) out.push(toISO(cursor))
        cursor = addDays(cursor, step)
      }
      return out
    }

    case "monthly": {
      const day = anchor.getDate()
      let y = rangeStart.getFullYear()
      let m = rangeStart.getMonth()
      const anchorY = anchor.getFullYear()
      const anchorM = anchor.getMonth()
      if (y < anchorY || (y === anchorY && m < anchorM)) {
        y = anchorY
        m = anchorM
      }
      while (true) {
        const lastDay = new Date(y, m + 1, 0).getDate()
        const d = Math.min(day, lastDay)
        const date = new Date(y, m, d)
        if (date > rangeEnd) break
        if (date >= rangeStart && date >= anchor) out.push(toISO(date))
        m++
        if (m > 11) {
          m = 0
          y++
        }
      }
      return out
    }
  }
}
