import type { Appointment, CoupleMember, Gender, Patient } from "@/db/types"

/**
 * Terapia de casal — funções puras.
 *
 * O casal é um `Patient` com `kind = "couple"`: é o CASO clínico, dono da
 * agenda, dos pagamentos, dos pacotes e do prontuário. As pessoas ficam em
 * `members`. Ver docs/18-casais.
 */

export const MIN_COUPLE_MEMBERS = 2
export const MAX_COUPLE_MEMBERS = 4

export function isCouple(p: Pick<Patient, "kind"> | null | undefined): boolean {
  return p?.kind === "couple"
}

/**
 * Pessoa do casal com os dados que valem AGORA: se ela está ligada a um
 * cadastro individual que ainda existe, nome, gênero, nascimento, CPF e
 * avatar vêm de lá (fonte única); senão, da cópia guardada no casal.
 */
export interface ResolvedMember extends CoupleMember {
  /** Cadastro individual ligado, quando existe. */
  linked: Patient | null
}

/**
 * O cadastro individual ligado à pessoa — só se ainda for individual. Um
 * cadastro que virou casal não serve de fonte para os dados de uma pessoa.
 */
export function linkedIndividual(
  patientId: string | null,
  patientsById: Map<string, Patient>,
): Patient | null {
  if (!patientId) return null
  const p = patientsById.get(patientId)
  return p && p.kind === "individual" ? p : null
}

export function resolveMembers(
  couple: Pick<Patient, "members">,
  patientsById: Map<string, Patient>,
): ResolvedMember[] {
  return couple.members.map((m) => {
    const linked = linkedIndividual(m.patientId, patientsById)
    if (!linked) return { ...m, linked: null }
    return {
      ...m,
      name: linked.name,
      gender: linked.gender,
      birthdate: linked.birthdate,
      cpf: linked.cpf,
      avatarId: linked.avatarId,
      linked,
    }
  })
}

/** "Ana Souza" → "Ana". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
}

/** Junta em pt-BR: "Ana", "Ana & Bruno", "Ana, Bruno & Carla". */
function joinNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean)
  if (clean.length <= 1) return clean[0] ?? ""
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`
}

/**
 * Nome sugerido para o casal a partir dos primeiros nomes. A psicóloga pode
 * trocar ("Casal Souza"); enquanto não troca, o nome acompanha as pessoas.
 */
export function coupleAutoName(members: Pick<CoupleMember, "name">[]): string {
  return joinNames(members.map((m) => firstName(m.name)))
}

/**
 * Separa um nome de cadastro feito como contorno ("Ana e Bruno",
 * "Ana & Bruno", "Ana/Bruno") nas pessoas — ponto de partida para converter
 * o cadastro antigo em casal. Devolve `[]` quando não há o que separar.
 */
export function splitCoupleName(name: string): string[] {
  const cleaned = name.replace(/^\s*casal\s+/i, "").trim()
  const parts = cleaned
    .split(/\s*(?:&|\+|\/|,)\s*|\s+e\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length >= 2 ? parts.slice(0, MAX_COUPLE_MEMBERS) : []
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/**
 * Texto de busca do cadastro: o nome e, num casal, o nome de cada pessoa —
 * procurar "Bruno" acha o "Casal Souza".
 */
export function patientSearchText(p: Pick<Patient, "name" | "members">): string {
  return normalizeText([p.name, ...p.members.map((m) => m.name)].join(" "))
}

export function matchesPatient(
  p: Pick<Patient, "name" | "members">,
  query: string,
): boolean {
  const q = normalizeText(query.trim())
  return !q || patientSearchText(p).includes(q)
}

/** Casais (não arquivados) de que um paciente individual faz parte. */
export function couplesOfPatient(
  patientId: string,
  patients: Patient[],
): Patient[] {
  return patients.filter(
    (c) =>
      c.active &&
      isCouple(c) &&
      c.members.some((m) => m.patientId === patientId),
  )
}

/** Conjunto de quem veio: `null` no registro significa "todos". */
export function presentIds(
  appt: Pick<Appointment, "presentMemberIds"> | null | undefined,
  couple: Pick<Patient, "members">,
): Set<string> {
  const all = couple.members.map((m) => m.id)
  const ids = appt?.presentMemberIds
  if (!ids || ids.length === 0) return new Set(all)
  // ids de alguém que saiu do casal depois não contam — e se não sobrou
  // ninguém reconhecível, vale o padrão (todos), nunca "ninguém veio".
  const known = ids.filter((id) => all.includes(id))
  return new Set(known.length > 0 ? known : all)
}

/**
 * Para gravar: todos presentes vira `null` (o registro não precisa lembrar o
 * óbvio, e uma pessoa que entre no casal depois não aparece como ausente nas
 * sessões antigas).
 */
export function toPresenceValue(
  present: Set<string>,
  couple: Pick<Patient, "members">,
): string[] | null {
  const ids = couple.members.map((m) => m.id).filter((id) => present.has(id))
  return ids.length === couple.members.length ? null : ids
}

/**
 * "só Ana" / "sem Bruno" quando nem todos vieram; `null` quando vieram
 * todos, a sessão não é de casal ou não foi atendida.
 */
export function presenceLabel(
  appt: Pick<Appointment, "status" | "presentMemberIds"> | null | undefined,
  couple: Pick<Patient, "kind" | "members"> | null | undefined,
): string | null {
  if (!appt || !couple || !isCouple(couple) || appt.status !== "attended")
    return null
  const present = presentIds(appt, couple)
  if (present.size === couple.members.length) return null
  const came = couple.members.filter((m) => present.has(m.id))
  const missed = couple.members.filter((m) => !present.has(m.id))
  if (came.length === 1) return `só ${firstName(came[0].name)}`
  return `sem ${joinNames(missed.map((m) => firstName(m.name)))}`
}

/** "34 anos" a partir do nascimento; `null` sem data. */
function ageOf(iso: string | null): number | null {
  if (!iso) return null
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  const t = new Date()
  let age = t.getFullYear() - y
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) age--
  return age >= 0 ? age : null
}

/** "Ana, 34" / "Bruno" — para as linhas de resumo de um casal. */
export function memberShortLabel(m: Pick<CoupleMember, "name" | "birthdate">): string {
  const age = ageOf(m.birthdate)
  const n = firstName(m.name)
  return age === null ? n : `${n}, ${age}`
}

/**
 * Pessoas em tratamento, para estatísticas de gênero: cada paciente
 * individual conta uma vez, e cada pessoa de um casal também — menos quem
 * está ligado a um cadastro individual já contado, senão contaria dobrado.
 */
export function peopleGenders(patients: Patient[]): (Gender | null)[] {
  const out: (Gender | null)[] = []
  const counted = new Set<string>()
  for (const p of patients) {
    if (isCouple(p)) continue
    counted.add(p.id)
    out.push(p.gender)
  }
  for (const c of patients) {
    if (!isCouple(c)) continue
    for (const m of c.members) {
      if (m.patientId && counted.has(m.patientId)) continue
      if (m.patientId) counted.add(m.patientId)
      out.push(m.gender)
    }
  }
  return out
}
