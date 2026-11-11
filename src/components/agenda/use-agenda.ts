import { useEffect, useMemo, useRef } from "react"
import {
  useAppointmentSeries,
  useAppointmentsInRange,
  usePatients,
} from "@/api/queries"
import {
  useAgendaCategories,
  useAgendaEvents,
  useSeedAgendaDefaults,
} from "@/api/agenda"
import type {
  AgendaCategory,
  EventOccurrence,
  Occurrence,
  Patient,
} from "@/db/types"
import { occurrencesForEvents } from "@/domain/events"
import { occurrencesForPatient } from "@/domain/recurrence"

/**
 * Categorias de compromisso, criando as iniciais na primeira vez que a conta
 * abre a agenda (mesmo desenho do seed do financeiro).
 */
export function useAgendaCategoriesWithDefaults() {
  const categoriesQ = useAgendaCategories()
  const seed = useSeedAgendaDefaults()
  const seeded = useRef(false)

  useEffect(() => {
    if (seeded.current) return
    if (!categoriesQ.isSuccess || (categoriesQ.data?.length ?? 0) > 0) return
    seeded.current = true
    seed.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesQ.isSuccess, categoriesQ.data?.length])

  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data])
  const byId = useMemo(() => {
    const m = new Map<string, AgendaCategory>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  return { categories, byId, isLoading: categoriesQ.isLoading }
}

/** Ocorrências de compromissos pessoais em [from, to]. */
export function useEventOccurrences(
  from: string,
  to: string,
  opts?: { enabled?: boolean },
): EventOccurrence[] {
  const eventsQ = useAgendaEvents({ enabled: opts?.enabled })
  return useMemo(
    () =>
      from && to && from <= to
        ? occurrencesForEvents(eventsQ.data ?? [], { fromISO: from, toISO: to })
        : [],
    [eventsQ.data, from, to],
  )
}

/**
 * Atendimentos (de todos os pacientes ativos) em [from, to], para checar se
 * um compromisso cai em cima de alguma sessão.
 */
export function useSessionsInRange(
  from: string,
  to: string,
  opts?: { enabled?: boolean },
): { sessions: Occurrence[]; patientById: Map<string, Patient> } {
  const enabled = (opts?.enabled ?? true) && !!from && !!to && from <= to
  const patientsQ = usePatients()
  const seriesQ = useAppointmentSeries(undefined, { enabled })
  const apptsQ = useAppointmentsInRange(from, to, { enabled })

  const patientById = useMemo(() => {
    const m = new Map<string, Patient>()
    for (const p of patientsQ.data ?? []) m.set(p.id, p)
    return m
  }, [patientsQ.data])

  const sessions = useMemo(() => {
    if (!enabled) return []
    const out: Occurrence[] = []
    for (const p of patientsQ.data ?? []) {
      if (!p.active) continue
      out.push(
        ...occurrencesForPatient(
          p,
          seriesQ.data ?? [],
          { fromISO: from, toISO: to },
          apptsQ.data ?? [],
        ),
      )
    }
    return out
  }, [enabled, patientsQ.data, seriesQ.data, apptsQ.data, from, to])

  return { sessions, patientById }
}
