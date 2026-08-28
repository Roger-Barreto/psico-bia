// Cópia para a área de transferência com fallback.
//
// `navigator.clipboard` exige contexto seguro (HTTPS/localhost) e gesto do
// usuário. Em iPadOS — onde todos os navegadores rodam sobre WebKit — a API
// pode não existir (contexto não-seguro) ou rejeitar; nesses casos caímos no
// caminho legado `execCommand("copy")`, que precisa de um textarea visível o
// bastante para o WebKit aceitar a seleção.

function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea")
  ta.value = text
  ta.setAttribute("readonly", "")
  // Fora da tela, mas não `display:none`/`visibility:hidden` — o WebKit ignora
  // a seleção de elementos realmente invisíveis.
  ta.style.position = "fixed"
  ta.style.top = "0"
  ta.style.left = "-9999px"
  ta.style.opacity = "0"
  document.body.appendChild(ta)
  try {
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, ta.value.length) // iOS ignora select() sozinho
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    ta.remove()
  }
}

/** Copia `text`. Resolve `true` se algum dos caminhos funcionou. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // cai no fallback
  }
  return legacyCopy(text)
}
