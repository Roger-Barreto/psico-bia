import confetti from "canvas-confetti"

const happyEmojis = ["🎉", "✨", "💚", "🌟", "🥳"]
const sadEmojis = ["💔", "😔", "🌧️", "💧"]

export type CelebrateKind = "happy" | "sad"

export function celebrate(kind: CelebrateKind) {
  const emojis = kind === "happy" ? happyEmojis : sadEmojis
  const shapes = emojis.map((text) =>
    confetti.shapeFromText({ text, scalar: 2 }),
  )
  confetti({
    particleCount: kind === "happy" ? 36 : 18,
    spread: kind === "happy" ? 80 : 55,
    startVelocity: kind === "happy" ? 45 : 25,
    gravity: kind === "happy" ? 0.9 : 1.4,
    origin: { y: 0.7 },
    shapes,
    scalar: 2,
    ticks: 140,
    colors:
      kind === "happy"
        ? ["#22c55e", "#fbbf24", "#a78bfa", "#38bdf8"]
        : ["#64748b", "#94a3b8"],
  })
}

/**
 * Comemoração ao concluir um livro (módulo Leituras): rajada central + canhões
 * laterais por ~1,2s, com emojis de livro. Reaproveita canvas-confetti.
 */
export function celebrateBook() {
  const emojis = ["📚", "📖", "✨", "🎉", "🌟"]
  const shapes = emojis.map((text) =>
    confetti.shapeFromText({ text, scalar: 2 }),
  )
  confetti({
    particleCount: 140,
    spread: 100,
    startVelocity: 48,
    gravity: 0.9,
    origin: { y: 0.6 },
    shapes,
    scalar: 2,
    ticks: 200,
    colors: ["#f43f5e", "#fbbf24", "#22c55e", "#a78bfa", "#38bdf8"],
  })
  const end = Date.now() + 1200
  const frame = () => {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 60,
      origin: { x: 0 },
      shapes,
      scalar: 2,
    })
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 60,
      origin: { x: 1 },
      shapes,
      scalar: 2,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
