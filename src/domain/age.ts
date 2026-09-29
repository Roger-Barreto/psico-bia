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

/**
 * Valida uma data de nascimento **opcional**: vazio passa. Devolve a
 * mensagem de erro, ou `null` quando está tudo certo.
 */
export function birthdateError(iso: string, todayIso: string): string | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return "Data inválida"
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1900 || y > Number(todayIso.slice(0, 4))) return "Ano fora do intervalo"
  const date = new Date(y, mo - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return "Data inválida"
  if (iso > todayIso) return "Data não pode estar no futuro"
  return null
}
