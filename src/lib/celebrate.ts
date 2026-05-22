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
