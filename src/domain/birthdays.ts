import type { Patient } from "@/db/types"

/**
 * Aniversários. `patients.birthdate` é texto ISO `YYYY-MM-DD` (ou `null`,
 * pois o campo é opcional), então tudo aqui trabalha com fatias de string —
 * mesmo padrão de `domain/dates.ts`, que evita `new Date()` e fuso horário.
 */

/** "MM-DD" de uma data ISO; `null` quando não há data ou o formato é inválido. */
export function monthDay(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return iso.slice(5)
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * A chave de aniversário que a data `onISO` celebra. Normalmente é o próprio
 * "MM-DD" — mas em 1º de março de ano não bissexto ela celebra **também**
 * 29/02, senão quem nasceu nesse dia simplesmente não faria aniversário.
 */
function keysCelebratedOn(onISO: string): string[] {
  const md = monthDay(onISO)
  if (!md) return []
  const year = Number(onISO.slice(0, 4))
  if (md === "03-01" && !isLeapYear(year)) return [md, "02-29"]
  return [md]
}

/**
 * Idade que a pessoa completa em `onISO`. `null` sem data de nascimento, ou
 * quando a data cai depois de `onISO` (paciente cadastrado com data futura).
 */
export function ageOn(
  birthdate: string | null | undefined,
  onISO: string,
): number | null {
  if (!monthDay(birthdate) || !birthdate) return null
  const age = Number(onISO.slice(0, 4)) - Number(birthdate.slice(0, 4))
  return age >= 0 ? age : null
}

/**
 * Quem faz aniversário. Num casal, cada pessoa conta — `patient` é o
 * cadastro que abre ao tocar (o do casal), e `coupleName` diz de qual casal.
 */
export interface BirthdayPerson {
  /** Único na lista: o id do paciente, ou `casal:pessoa`. */
  key: string
  patient: Patient
  name: string
  birthdate: string
  avatarId: number
  coupleName: string | null
}

/**
 * Aniversariantes por data ISO, restrito às datas informadas (as 42 células
 * visíveis do mini-calendário). Considera todo cadastro **não arquivado** —
 * inclusive quem já teve alta, que a UI marca à parte.
 *
 * Pessoas de casal entram também, exceto quem está ligado a um cadastro
 * individual ativo: essa pessoa já aparece pelo cadastro dela.
 */
export function birthdayIndex(
  patients: Patient[],
  isoDates: string[],
): Map<string, BirthdayPerson[]> {
  const activeIds = new Set(
    patients
      .filter((p) => p.active && p.kind !== "couple")
      .map((p) => p.id),
  )
  const people: BirthdayPerson[] = []
  for (const p of patients) {
    if (!p.active) continue
    if (p.kind === "couple") {
      for (const m of p.members) {
        if (m.patientId && activeIds.has(m.patientId)) continue
        if (!monthDay(m.birthdate) || !m.birthdate) continue
        people.push({
          key: `${p.id}:${m.id}`,
          patient: p,
          name: m.name,
          birthdate: m.birthdate,
          avatarId: m.avatarId,
          coupleName: p.name,
        })
      }
      continue
    }
    if (!monthDay(p.birthdate) || !p.birthdate) continue
    people.push({
      key: p.id,
      patient: p,
      name: p.name,
      birthdate: p.birthdate,
      avatarId: p.avatarId,
      coupleName: null,
    })
  }

  const byKey = new Map<string, BirthdayPerson[]>()
  for (const person of people) {
    const key = monthDay(person.birthdate)!
    const list = byKey.get(key)
    if (list) list.push(person)
    else byKey.set(key, [person])
  }
  if (byKey.size === 0) return new Map()

  const out = new Map<string, BirthdayPerson[]>()
  for (const iso of isoDates) {
    const found: BirthdayPerson[] = []
    for (const key of keysCelebratedOn(iso)) {
      const list = byKey.get(key)
      if (list) found.push(...list)
    }
    if (found.length > 0) {
      out.set(iso, found.sort((a, b) => a.name.localeCompare(b.name)))
    }
  }
  return out
}

/** "faz 34 anos" / "faz 1 ano" — `null` quando a idade não é calculável. */
export function turningAgeLabel(
  birthdate: string | null | undefined,
  onISO: string,
): string | null {
  const age = ageOn(birthdate, onISO)
  if (age === null) return null
  return `faz ${age} ${age === 1 ? "ano" : "anos"}`
}
