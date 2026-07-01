// Utilitários de CPF: normalização, máscara de exibição e validação.

/** Remove tudo que não for dígito. */
export function onlyDigits(v: string): string {
  return v.replace(/\D/g, "")
}

/** Aplica a máscara 000.000.000-00 progressivamente (até 11 dígitos). */
export function formatCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`
  return d
}

/** Valida CPF (11 dígitos + dígitos verificadores). Vazio não é válido. */
export function isValidCpf(v: string): boolean {
  const d = onlyDigits(v)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false // rejeita sequências repetidas
  const digit = (sliceLen: number, factor: number): number => {
    let sum = 0
    for (let i = 0; i < sliceLen; i++) sum += Number(d[i]) * (factor - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return digit(9, 10) === Number(d[9]) && digit(10, 11) === Number(d[10])
}
