export function ageFromBirthdate(iso: string | null | undefined): number {
  if (!iso) return 0
  const parts = iso.split("-").map(Number)
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return 0
  const [y, m, d] = parts
  const today = new Date()
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return Math.max(0, age)
}
