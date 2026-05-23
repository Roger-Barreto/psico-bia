import type {
  IndividualChecklistItem,
  Occurrence,
  SharedChecklistItem,
} from "@/db/types"
import { todayISO } from "./dates"

export interface ChecklistEntry {
  id: string
  label: string
  checked: boolean
  source: "shared" | "individual"
}

/**
 * Compute pendency count for a single occurrence.
 * Pendency = ações que o psicólogo precisa tomar:
 *   - Itens de checklist não marcados em sessões passadas (attended/missed)
 *   - Itens de checklist abertos quando ocorrência scheduled passou da data
 *   - Ocorrência scheduled com data passada (precisa confirmar atendido/falta)
 *
 * Sessões atendidas não pagas NÃO entram aqui — são tratadas separadamente
 * via {@link isUnpaidAttended} / {@link unpaidIndex}.
 */
export function pendencyCount(
  occ: Occurrence,
  sharedItems: SharedChecklistItem[],
  individualItems: IndividualChecklistItem[],
  today: string = todayISO(),
): number {
  if (occ.date > today) return 0
  const appt = occ.appointment
  if (appt && (appt.status === "cancelled" || appt.status === "rescheduled"))
    return 0

  let count = 0

  if (appt && (appt.status === "attended" || appt.status === "missed")) {
    const unchecked = appt.snapshotItemIds.filter(
      (id) => !appt.checkedItemIds.includes(id),
    )
    count += unchecked.length
  } else {
    const sharedActive = sharedItems.filter((s) => !s.archived).length
    const individualActive = individualItems.filter(
      (i) => i.patientId === occ.patientId && !i.archived,
    ).length
    count += sharedActive + individualActive
  }

  if (occ.date < today && (!appt || appt.status === "scheduled")) {
    count += 1
  }

  return count
}

/**
 * Atendimento atendido porém não pago. Não conta como pendência —
 * é um alerta financeiro tratado em UI separada.
 */
export function isUnpaidAttended(occ: Occurrence): boolean {
  const a = occ.appointment
  return !!a && a.status === "attended" && !a.paid
}

/**
 * Agrega ocorrências não pagas por data ISO.
 * `valueFor(occ)` deve retornar o valor financeiro daquela sessão
 * (geralmente `effectiveValue(appointment, patient)`).
 */
export function unpaidIndex(
  occurrences: Occurrence[],
  valueFor: (occ: Occurrence) => number,
): Map<string, { count: number; value: number }> {
  const map = new Map<string, { count: number; value: number }>()
  for (const o of occurrences) {
    if (!isUnpaidAttended(o)) continue
    const cur = map.get(o.date) ?? { count: 0, value: 0 }
    cur.count++
    cur.value += valueFor(o)
    map.set(o.date, cur)
  }
  return map
}

export function checklistFor(
  occ: Occurrence,
  sharedItems: SharedChecklistItem[],
  individualItems: IndividualChecklistItem[],
): ChecklistEntry[] {
  const appt = occ.appointment
  const useSnapshot =
    appt && (appt.status === "attended" || appt.status === "missed")

  const allShared = sharedItems.filter((s) => !s.archived)
  const allInd = individualItems.filter(
    (i) => i.patientId === occ.patientId && !i.archived,
  )

  const itemMap = new Map<string, { label: string; source: "shared" | "individual" }>()
  for (const s of sharedItems) itemMap.set(s.id, { label: s.label, source: "shared" })
  for (const i of individualItems)
    itemMap.set(i.id, { label: i.label, source: "individual" })

  const ids = useSnapshot
    ? appt!.snapshotItemIds
    : [...allShared.map((s) => s.id), ...allInd.map((i) => i.id)]

  const checked = new Set(appt?.checkedItemIds ?? [])

  return ids.map((id) => {
    const meta = itemMap.get(id)
    return {
      id,
      label: meta?.label ?? "(item removido)",
      checked: checked.has(id),
      source: meta?.source ?? "shared",
    }
  })
}

/**
 * Aggregate pendencies per ISO date for a list of occurrences.
 * Used to colorize mini-calendar cells.
 */
export function pendencyIndex(
  occurrences: Occurrence[],
  sharedItems: SharedChecklistItem[],
  individualItems: IndividualChecklistItem[],
  today: string = todayISO(),
): Map<string, { count: number; pendencies: number }> {
  const map = new Map<string, { count: number; pendencies: number }>()
  for (const o of occurrences) {
    const cur = map.get(o.date) ?? { count: 0, pendencies: 0 }
    cur.count++
    cur.pendencies += pendencyCount(o, sharedItems, individualItems, today)
    map.set(o.date, cur)
  }
  return map
}

export function buildSnapshotIds(
  patientId: string,
  sharedItems: SharedChecklistItem[],
  individualItems: IndividualChecklistItem[],
): string[] {
  return [
    ...sharedItems.filter((s) => !s.archived).map((s) => s.id),
    ...individualItems
      .filter((i) => i.patientId === patientId && !i.archived)
      .map((i) => i.id),
  ]
}
