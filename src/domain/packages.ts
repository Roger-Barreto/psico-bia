import type {
  Appointment,
  Occurrence,
  Patient,
  SessionPackage,
} from "@/db/types"
import { isBillable } from "./finance"

/**
 * Pacotes de sessões — funções puras.
 *
 * O consumo de verdade acontece no banco (trigger de 034_pacotes_sessoes.sql).
 * O que está aqui só **lê** esse resultado e o projeta para a tela; nada
 * neste arquivo decide quem paga o quê.
 */

/** `active`: tem vaga · `finished`: todas usadas · `closed`: encerrado antes. */
export type PackageState = "active" | "finished" | "closed"

export function packageUsed(pkg: SessionPackage): number {
  return pkg.sessions.length
}

/** Vagas que ainda podem ser consumidas (pacote encerrado não tem nenhuma). */
export function packageRemaining(pkg: SessionPackage): number {
  if (pkg.closedAt) return 0
  return Math.max(0, pkg.totalSessions - packageUsed(pkg))
}

/** Vagas que sobraram sem uso — inclusive as perdidas num pacote encerrado. */
export function packageUnused(pkg: SessionPackage): number {
  return Math.max(0, pkg.totalSessions - packageUsed(pkg))
}

export function packageState(pkg: SessionPackage): PackageState {
  if (packageUsed(pkg) >= pkg.totalSessions) return "finished"
  if (pkg.closedAt) return "closed"
  return "active"
}

/** Quanto cada sessão do pacote custou ao paciente. */
export function packageUnitValue(pkg: SessionPackage): number {
  return pkg.totalSessions > 0 ? pkg.totalValue / pkg.totalSessions : 0
}

/** "4 sessões" / "1 sessão". */
export function sessionsLabel(n: number): string {
  return `${n} ${n === 1 ? "sessão" : "sessões"}`
}

/**
 * Posição (1…N) de uma sessão dentro do pacote, pela ordem das datas.
 * `null` quando a sessão não está no pacote.
 */
export function sessionOrdinal(
  pkg: SessionPackage,
  appointmentId: string,
): number | null {
  const i = pkg.sessions.findIndex((s) => s.appointmentId === appointmentId)
  return i === -1 ? null : i + 1
}

/**
 * Posição que uma sessão ocupa (ou ocuparia, se entrasse agora) no pacote.
 * É pela **data**, não pela ordem em que foi descontada: confirmar hoje uma
 * sessão antiga a coloca antes das que vieram depois dela — e é essa a
 * posição que todas as telas mostram.
 */
export function positionInPackage(
  pkg: SessionPackage,
  session: { appointmentId?: string | null; date: string; time?: string | null },
): number {
  const before = pkg.sessions.filter(
    (s) =>
      s.appointmentId !== session.appointmentId &&
      (s.date < session.date ||
        (s.date === session.date && (s.time ?? "") <= (session.time ?? ""))),
  ).length
  return before + 1
}

/** Mesma ordem que o banco usa para escolher o pacote: o mais antigo primeiro. */
function byAge(a: SessionPackage, b: SessionPackage): number {
  return (
    a.startDate.localeCompare(b.startDate) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

export function packagesOfPatient(
  packages: SessionPackage[],
  patientId: string,
): SessionPackage[] {
  return packages.filter((p) => p.patientId === patientId).sort(byAge)
}

/**
 * Pacote que o banco usaria para uma sessão do paciente em `dateISO`: o mais
 * antigo que esteja aberto, com vaga e que já valesse naquela data. Espelha a
 * regra (3) do trigger — serve para a tela **avisar** o que vai acontecer.
 */
export function packageForDate(
  patientPackages: SessionPackage[],
  dateISO: string,
): SessionPackage | null {
  return (
    patientPackages
      .slice()
      .sort(byAge)
      .find((p) => packageRemaining(p) > 0 && p.startDate <= dateISO) ?? null
  )
}

/**
 * Pacote aberto com vaga, sem olhar a data. É o que vale para o vínculo
 * **manual** ("pagar com o pacote"), que pode cobrir uma sessão anterior à
 * venda — uma dívida antiga que o paciente resolveu quitar com o pacote.
 */
export function openPackage(
  patientPackages: SessionPackage[],
): SessionPackage | null {
  return (
    patientPackages
      .slice()
      .sort(byAge)
      .find((p) => packageRemaining(p) > 0) ?? null
  )
}

export interface PackageTotals {
  /** Pacotes abertos com vaga. */
  active: number
  /** Sessões já pagas e ainda não realizadas (só de pacotes abertos). */
  sessionsToDeliver: number
  /** Valor dessas sessões, pelo preço unitário de cada pacote. */
  valueToDeliver: number
}

export function packageTotals(packages: SessionPackage[]): PackageTotals {
  const out: PackageTotals = {
    active: 0,
    sessionsToDeliver: 0,
    valueToDeliver: 0,
  }
  for (const p of packages) {
    const remaining = packageRemaining(p)
    if (remaining === 0) continue
    out.active++
    out.sessionsToDeliver += remaining
    out.valueToDeliver += remaining * packageUnitValue(p)
  }
  return out
}

/**
 * Pacotes vendidos no intervalo (pelo dia da venda), só de pacientes que
 * contam nas métricas — o mesmo filtro que o dashboard aplica às sessões.
 */
export function packagesSoldInRange(
  packages: SessionPackage[],
  fromISO: string,
  toISO: string,
  patientsById: Map<string, Patient>,
): SessionPackage[] {
  return packages.filter(
    (p) =>
      p.startDate >= fromISO &&
      p.startDate <= toISO &&
      patientsById.has(p.patientId),
  )
}

/** `seriesId|originDate` → id do pacote que vai pagar aquela ocorrência. */
export type PackageCoverage = Map<string, string>

const occKey = (o: Pick<Occurrence, "seriesId" | "originDate">) =>
  `${o.seriesId}|${o.originDate}`

/** A ocorrência ainda pode virar uma sessão cobrável (não foi concluída)? */
function isPending(appt: Appointment | null): boolean {
  if (!appt) return true
  if (isBillable(appt)) return false
  return appt.status === "scheduled" || appt.status === "rescheduled"
}

/**
 * Projeção: quais ocorrências **ainda não concluídas** cairão num pacote
 * quando forem marcadas como atendidas. Distribui o saldo de cada pacote
 * aberto pelas ocorrências do paciente em ordem de data — exatamente a ordem
 * em que o banco as consumiria se fossem atendidas nessa sequência.
 *
 * Só enxerga as ocorrências que recebe — por isso quem chama precisa passar
 * TODAS as do paciente desde o dia da venda, e não só as do mês na tela:
 * uma sessão pendente do mês passado gasta o saldo antes das deste mês.
 * `usePackageCoverage` monta essa lista.
 *
 * Devolve `seriesId|originDate` → id do pacote que vai pagar a sessão.
 */
export function projectedCoverage(
  occurrences: Occurrence[],
  packages: SessionPackage[],
): PackageCoverage {
  const covered: PackageCoverage = new Map()
  const open = packages.filter((p) => packageRemaining(p) > 0)
  if (open.length === 0) return covered

  const byPatient = new Map<string, SessionPackage[]>()
  for (const p of open) {
    const list = byPatient.get(p.patientId) ?? []
    list.push(p)
    byPatient.set(p.patientId, list)
  }

  const pending = occurrences
    .filter((o) => byPatient.has(o.patientId) && isPending(o.appointment))
    // Sessão pendente que já tem pagamento próprio (paga e depois
    // reagendada) não consome pacote ao ser atendida.
    .filter((o) => !o.appointment?.paid)
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time ?? "").localeCompare(b.time ?? ""),
    )

  const left = new Map<string, number>()
  for (const p of open) left.set(p.id, packageRemaining(p))

  for (const o of pending) {
    const candidates = (byPatient.get(o.patientId) ?? []).slice().sort(byAge)
    for (const p of candidates) {
      const n = left.get(p.id) ?? 0
      if (n <= 0 || p.startDate > o.date) continue
      left.set(p.id, n - 1)
      covered.set(occKey(o), p.id)
      break
    }
  }
  return covered
}

export function isCovered(
  covered: PackageCoverage,
  o: Pick<Occurrence, "seriesId" | "originDate">,
): boolean {
  return covered.has(occKey(o))
}

/** Id do pacote que vai pagar a ocorrência, ou `null` se nenhum. */
export function coveringPackageId(
  covered: PackageCoverage,
  o: Pick<Occurrence, "seriesId" | "originDate">,
): string | null {
  return covered.get(occKey(o)) ?? null
}
