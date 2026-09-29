import { useMemo } from "react"
import type { Occurrence } from "@/db/types"
import {
  useAppointmentSeries,
  useAppointmentsInRange,
  usePatients,
  useSessionPackages,
} from "@/api/queries"
import {
  packageRemaining,
  projectedCoverage,
  type PackageCoverage,
} from "@/domain/packages"
import { occurrencesForPatient } from "@/domain/recurrence"

const NONE: PackageCoverage = new Map()

/**
 * Quais sessões **ainda não concluídas**, até `untilISO`, serão pagas pelo
 * saldo de um pacote.
 *
 * A conta precisa de todas as ocorrências do paciente desde o dia da venda —
 * uma sessão pendente do mês passado gasta o saldo antes das deste mês. Por
 * isso o hook busca os atendimentos desde o pacote aberto mais antigo, e não
 * só os do mês que a tela mostra. Sem pacote aberto, não busca nada.
 */
export function usePackageCoverage(untilISO: string): {
  covered: PackageCoverage
  isLoading: boolean
} {
  const packagesQ = useSessionPackages()
  const patientsQ = usePatients()
  const seriesQ = useAppointmentSeries()

  const open = useMemo(
    () => (packagesQ.data ?? []).filter((p) => packageRemaining(p) > 0),
    [packagesQ.data],
  )
  const fromISO = useMemo(
    () =>
      open.reduce(
        (min, p) => (p.startDate < min ? p.startDate : min),
        untilISO,
      ),
    [open, untilISO],
  )
  const enabled = open.length > 0
  const apptsQ = useAppointmentsInRange(fromISO, untilISO, { enabled })

  const covered = useMemo(() => {
    if (!enabled) return NONE
    const withPackage = new Set(open.map((p) => p.patientId))
    const occurrences: Occurrence[] = []
    for (const p of patientsQ.data ?? []) {
      if (!withPackage.has(p.id)) continue
      occurrences.push(
        ...occurrencesForPatient(
          p,
          seriesQ.data ?? [],
          { fromISO, toISO: untilISO },
          apptsQ.data ?? [],
        ),
      )
    }
    return projectedCoverage(occurrences, open)
  }, [
    enabled,
    open,
    patientsQ.data,
    seriesQ.data,
    apptsQ.data,
    fromISO,
    untilISO,
  ])

  return { covered, isLoading: enabled && apptsQ.isLoading }
}
