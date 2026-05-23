import type {
  Appointment,
  AppointmentSeries,
  Occurrence,
  Patient,
} from "@/db/types"
import { addDays, diffDays, fromISO, toISO } from "./dates"

interface Range {
  fromISO: string
  toISO: string
}

/**
 * Compute occurrences for a single AppointmentSeries within
 * [range.fromISO, range.toISO] inclusive. Pure: takes overrides
 * (Appointment rows) and merges them.
 *
 * - frequency === null: single occurrence at startDate.
 * - "weekly" / "biweekly": every 7 / 14 days from startDate.
 * - "monthly": same day-of-month as startDate, clamped to last day.
 *
 * Overrides are matched by (seriesId, originDate). Caller is expected
 * to pre-filter `overrides` so all entries belong to this series.
 */
export function occurrencesForSeries(
  series: AppointmentSeries,
  range: Range,
  overrides: Appointment[],
): Occurrence[] {
  const seriesEnd = series.endDate
    ? series.endDate < range.toISO
      ? series.endDate
      : range.toISO
    : range.toISO

  if (range.fromISO > seriesEnd) {
    return collectOutOfRangeReschedules(series, range, overrides, new Set())
  }

  const origins = generateOriginDates(
    series,
    fromISO(maxISO(range.fromISO, series.startDate)),
    fromISO(seriesEnd),
  )

  const byOrigin = new Map<string, Appointment>()
  for (const a of overrides) {
    if (a.seriesId !== series.id) continue
    byOrigin.set(a.originDate, a)
  }

  const out: Occurrence[] = []
  const emitted = new Set<string>()

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
        seriesId: series.id,
        patientId: series.patientId,
        originDate: originISO,
        date:
          override.status === "rescheduled" && override.rescheduledTo
            ? override.rescheduledTo
            : override.date,
        time: override.time ?? series.time,
        appointment: override,
        pendencyCount: 0,
      })
    } else {
      out.push({
        seriesId: series.id,
        patientId: series.patientId,
        originDate: originISO,
        date: originISO,
        time: series.time,
        appointment: null,
        pendencyCount: 0,
      })
    }
  }

  out.push(...collectOutOfRangeReschedules(series, range, overrides, emitted))
  return out
}

function collectOutOfRangeReschedules(
  series: AppointmentSeries,
  range: Range,
  overrides: Appointment[],
  emitted: Set<string>,
): Occurrence[] {
  const out: Occurrence[] = []
  for (const a of overrides) {
    if (a.seriesId !== series.id) continue
    if (a.status === "cancelled") continue
    if (emitted.has(a.originDate)) continue
    const effective =
      a.status === "rescheduled" && a.rescheduledTo ? a.rescheduledTo : a.date
    if (effective < range.fromISO || effective > range.toISO) continue
    out.push({
      seriesId: series.id,
      patientId: series.patientId,
      originDate: a.originDate,
      date: effective,
      time: a.time ?? series.time,
      appointment: a,
      pendencyCount: 0,
    })
  }
  return out
}

/**
 * Aggregate occurrences across all of a patient's series, applying the
 * discharge cap.
 */
export function occurrencesForPatient(
  patient: Patient,
  series: AppointmentSeries[],
  range: Range,
  overrides: Appointment[],
): Occurrence[] {
  if (!patient.active) return []
  let to = range.toISO
  if (patient.dischargedAt && patient.dischargedAt < to) {
    to = patient.dischargedAt
  }
  if (to < range.fromISO) return []
  const cappedRange = { fromISO: range.fromISO, toISO: to }

  const out: Occurrence[] = []
  for (const s of series) {
    if (s.patientId !== patient.id) continue
    const subset = overrides.filter((a) => a.seriesId === s.id)
    out.push(...occurrencesForSeries(s, cappedRange, subset))
  }
  return out
}

function maxISO(a: string, b: string): string {
  return a > b ? a : b
}

function generateOriginDates(
  series: AppointmentSeries,
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  const anchor = fromISO(series.startDate)
  const out: string[] = []

  if (series.frequency === null) {
    if (anchor >= rangeStart && anchor <= rangeEnd) out.push(toISO(anchor))
    return out
  }

  if (series.frequency === "weekly" || series.frequency === "biweekly") {
    const step = series.frequency === "weekly" ? 7 : 14
    let cursor = new Date(anchor)
    if (cursor < rangeStart) {
      const d = diffDays(rangeStart, cursor)
      const skips = Math.ceil(d / step)
      cursor = addDays(cursor, skips * step)
    }
    while (cursor <= rangeEnd) {
      if (cursor >= rangeStart && cursor >= anchor) out.push(toISO(cursor))
      cursor = addDays(cursor, step)
    }
    return out
  }

  if (series.frequency === "monthly") {
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

  return out
}
