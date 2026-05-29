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
 * Pendência só existe APÓS o atendimento. Decomposta em duas naturezas:
 *   - checklist: itens do snapshot não marcados numa sessão atendida.
 *   - overdue: sessão passada não confirmada (precisa atender/faltar/reagendar)
 *     — é o estado "Pendente".
 * Regras: attended → checklist incompleto; missed/cancelled → 0;
 * scheduled (ou sem linha) → overdue 1 se passou da data; futuro → 0.
 *
 * Sessões atendidas não pagas NÃO entram aqui — são tratadas separadamente
 * via {@link isUnpaidAttended} / {@link unpaidIndex}.
 */
export function pendencyBreakdown(
  occ: Occurrence,
  today: string = todayISO(),
): { checklist: number; overdue: number } {
  if (occ.date > today) return { checklist: 0, overdue: 0 }
  const appt = occ.appointment
  if (appt && appt.status === "attended") {
    const unchecked = appt.snapshotItemIds.filter(
      (id) => !appt.checkedItemIds.includes(id),
    ).length
    return { checklist: unchecked, overdue: 0 }
  }
  if (appt && (appt.status === "missed" || appt.status === "cancelled")) {
    return { checklist: 0, overdue: 0 }
  }
  // scheduled / rescheduled-legado / sem linha
  return { checklist: 0, overdue: occ.date < today ? 1 : 0 }
}

export function pendencyCount(
  occ: Occurrence,
  today: string = todayISO(),
): number {
  const b = pendencyBreakdown(occ, today)
  return b.checklist + b.overdue
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

  const itemMap = new Map<
    string,
    { label: string; source: "shared" | "individual"; order: number }
  >()
  for (const s of sharedItems)
    itemMap.set(s.id, { label: s.label, source: "shared", order: s.order })
  for (const i of individualItems)
    itemMap.set(i.id, { label: i.label, source: "individual", order: i.order })

  const byOrder = <T extends { order: number }>(arr: T[]) =>
    arr.slice().sort((a, b) => a.order - b.order)

  let ids: string[]
  if (useSnapshot) {
    // Preserve the historical set, but display shared-then-individual, each
    // ordered by the item's current order.
    const sharedIds: string[] = []
    const indIds: string[] = []
    for (const itemId of appt!.snapshotItemIds) {
      if (itemMap.get(itemId)?.source === "individual") indIds.push(itemId)
      else sharedIds.push(itemId)
    }
    const byCurrentOrder = (a: string, b: string) =>
      (itemMap.get(a)?.order ?? Infinity) - (itemMap.get(b)?.order ?? Infinity)
    ids = [...sharedIds.sort(byCurrentOrder), ...indIds.sort(byCurrentOrder)]
  } else {
    ids = [
      ...byOrder(allShared).map((s) => s.id),
      ...byOrder(allInd).map((i) => i.id),
    ]
  }

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
  today: string = todayISO(),
): Map<string, { count: number; pendencies: number }> {
  const map = new Map<string, { count: number; pendencies: number }>()
  for (const o of occurrences) {
    const cur = map.get(o.date) ?? { count: 0, pendencies: 0 }
    cur.count++
    cur.pendencies += pendencyCount(o, today)
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
    ...sharedItems
      .filter((s) => !s.archived)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id),
    ...individualItems
      .filter((i) => i.patientId === patientId && !i.archived)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((i) => i.id),
  ]
}
