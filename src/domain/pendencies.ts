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
 * Pendency includes:
 *   - Unchecked checklist items on past attended/missed/scheduled occurrences
 *   - Attended sessions that are not paid yet
 *   - Scheduled occurrences whose date is past (not confirmed as attended/missed yet)
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
    // scheduled / no appointment yet — all current items are pending checklist
    const sharedActive = sharedItems.filter((s) => !s.archived).length
    const individualActive = individualItems.filter(
      (i) => i.patientId === occ.patientId && !i.archived,
    ).length
    count += sharedActive + individualActive
  }

  // Attended session not paid yet
  if (appt && appt.status === "attended" && !appt.paid) {
    count += 1
  }

  // Scheduled occurrence past its date with no confirmation yet
  if (occ.date < today && (!appt || appt.status === "scheduled")) {
    count += 1
  }

  return count
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
