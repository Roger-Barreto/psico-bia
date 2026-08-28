export function ageFromBirthdate(
  iso: string | null | undefined,
): number | null {
  if (!iso) return null
  const parts = iso.split("-").map(Number)
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null
  const [y, m, d] = parts
  const today = new Date()
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return Math.max(0, age)
}

/**
 * "12 anos" — ou `null` quando o paciente não tem data de nascimento
 * (o campo é opcional). Use com `filter(Boolean).join(" · ")` para montar a
 * linha de resumo sem deixar separadores órfãos.
 */
export function ageLabel(iso: string | null | undefined): string | null {
  const age = ageFromBirthdate(iso)
  if (age === null) return null
  return `${age} ${age === 1 ? "ano" : "anos"}`
}
