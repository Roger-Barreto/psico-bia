/**
 * Shared finance palette for the category/payment-method pickers and charts.
 * The first 16 entries mirror the Postgres seed palette (`seed_finance_defaults`,
 * migration 017); the rest are extra hand-picked options the user can choose.
 */
export const FINANCE_COLORS = [
  // Base (mirrors the SQL seed set) — vivid 500s
  "#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6", "#6366f1",
  "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#22c55e",
  "#84cc16", "#eab308", "#f59e0b", "#f97316",
  // Light variants (300/400)
  "#fb7185", "#f9a8d4", "#e879f9", "#c084fc", "#a78bfa", "#818cf8",
  "#60a5fa", "#38bdf8", "#22d3ee", "#2dd4bf", "#34d399", "#4ade80",
  "#a3e635", "#facc15", "#fbbf24", "#fdba74",
  // Deep variants (600/700)
  "#e11d48", "#be123c", "#a21caf", "#7c3aed", "#4f46e5", "#1d4ed8",
  "#0369a1", "#0e7490", "#0f766e", "#15803d", "#4d7c0f", "#b45309",
  // Reds + neutrals
  "#ef4444", "#dc2626", "#64748b", "#78716c", "#52525b", "#94a3b8",
] as const

/** Deterministic palette color from any key — fallback when color is null. */
export function colorForKey(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return FINANCE_COLORS[h % FINANCE_COLORS.length]
}
