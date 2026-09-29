import type {
  Appointment,
  AppointmentSeries,
  Occurrence,
  Patient,
} from "@/db/types"
import { addDays, fromISO, toISO, todayISO } from "./dates"
import { occurrencesForPatient } from "./recurrence"

export interface UnarchivePreview {
  /** Dia do registro mais recente do paciente antes de hoje (qualquer status). */
  lastRecordedDate: string | null
  /**
   * Sessões passadas sem nenhum registro depois de `lastRecordedDate`. Arquivar
   * não encerra as séries — elas só ficam escondidas — então tudo o que a
   * recorrência gerou enquanto o paciente esteve fora volta como "Pendente".
   */
  staleSessions: Occurrence[]
  /** Séries que voltam a pôr horários na agenda de hoje em diante. */
  resumingSeries: AppointmentSeries[]
}

/**
 * O que muda na agenda ao desarquivar. O paciente não guarda quando foi
 * arquivado; a última sessão registrada é o melhor marco de quando ele parou
 * de vir. Sessões esquecidas antes dela já eram pendência e continuam sendo.
 */
export function unarchivePreview(
  patient: Patient,
  series: AppointmentSeries[],
  appointments: Appointment[],
  today: string = todayISO(),
): UnarchivePreview {
  const own = series.filter((s) => s.patientId === patient.id)
  const appts = appointments.filter((a) => a.patientId === patient.id)

  // Uma sessão da semana passada remarcada para amanhã também é registro:
  // conta a data de origem, a da linha e a remarcada.
  let lastRecordedDate: string | null = null
  for (const a of appts) {
    for (const d of [a.originDate, a.date, a.rescheduledTo]) {
      if (d && d < today && (!lastRecordedDate || d > lastRecordedDate)) {
        lastRecordedDate = d
      }
    }
  }

  const yesterday = toISO(addDays(fromISO(today), -1))
  const firstStart = own.reduce<string | null>(
    (min, s) => (min === null || s.startDate < min ? s.startDate : min),
    null,
  )
  const from = lastRecordedDate
    ? toISO(addDays(fromISO(lastRecordedDate), 1))
    : firstStart
  const staleSessions =
    from && from <= yesterday
      ? occurrencesForPatient(
          { ...patient, active: true },
          own,
          { fromISO: from, toISO: yesterday },
          appts,
        )
          .filter((o) => o.appointment === null)
          .sort((a, b) => a.date.localeCompare(b.date))
      : []

  const discharged = !!patient.dischargedAt && patient.dischargedAt < today
  const resumingSeries = discharged
    ? []
    : own.filter((s) =>
        s.frequency === null
          ? s.startDate >= today
          : s.endDate === null || s.endDate >= today,
      )

  return { lastRecordedDate, staleSessions, resumingSeries }
}
