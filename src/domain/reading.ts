import type { Book, BookFormat, BookStatus, ReadingSession } from "@/db/types"
import { diffDays, fromISO, toISO, todayISO } from "./dates"

// ════════════════════════════════════════════════════════════════
// Status & format helpers
// ════════════════════════════════════════════════════════════════
export type Tone = "muted" | "primary" | "success" | "warning" | "destructive"

/** Ordem de exibição das estantes na Track. */
export const STATUS_ORDER: BookStatus[] = [
  "reading",
  "want",
  "paused",
  "finished",
  "dnf",
]

export function statusLabel(s: BookStatus): string {
  switch (s) {
    case "want":
      return "Quero ler"
    case "reading":
      return "Lendo"
    case "finished":
      return "Lido"
    case "dnf":
      return "Abandonado"
    case "paused":
      return "Pausado"
  }
}

export function statusTone(s: BookStatus): Tone {
  switch (s) {
    case "reading":
      return "primary"
    case "finished":
      return "success"
    case "want":
      return "muted"
    case "paused":
      return "warning"
    case "dnf":
      return "destructive"
  }
}

export function formatLabel(f: BookFormat): string {
  switch (f) {
    case "physical":
      return "Físico"
    case "ebook":
      return "E-book"
    case "audiobook":
      return "Audiolivro"
  }
}

// ════════════════════════════════════════════════════════════════
// Progresso e cor
// ════════════════════════════════════════════════════════════════
export function progressPct(
  book: Pick<Book, "currentPage" | "pageCount" | "status">,
): number {
  if (book.status === "finished") return 100
  if (!book.pageCount || book.pageCount <= 0) return 0
  return Math.max(
    0,
    Math.min(100, Math.round((book.currentPage / book.pageCount) * 100)),
  )
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Cor do progresso do início ao fim: 0% rosa (353°, `--primary`) → 50% âmbar
 * (46°, `--secondary`) → 100% verde (145°). Passa pelas cores da marca.
 */
export function progressColor(pct: number): string {
  const t = Math.max(0, Math.min(100, pct)) / 100
  const hue =
    t < 0.5
      ? lerp(353, 360 + 46, t / 0.5) % 360 // 353 → 46 (sobe cruzando 360)
      : lerp(46, 145, (t - 0.5) / 0.5) // 46 → 145 (âmbar → verde)
  return `hsl(${Math.round(hue)} 80% 60%)`
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}min`
  return `${s}s`
}

// ════════════════════════════════════════════════════════════════
// Agregações de sessões
// ════════════════════════════════════════════════════════════════
export interface BookTotals {
  seconds: number
  pages: number
  count: number
}

export function bookTotals(sessions: ReadingSession[]): BookTotals {
  return sessions.reduce<BookTotals>(
    (acc, s) => ({
      seconds: acc.seconds + (s.durationSeconds || 0),
      pages: acc.pages + (s.pagesRead || 0),
      count: acc.count + 1,
    }),
    { seconds: 0, pages: 0, count: 0 },
  )
}

/** Velocidade média em páginas por hora. */
export function readingSpeedPph(sessions: ReadingSession[]): number {
  const { seconds, pages } = bookTotals(sessions)
  if (seconds <= 0) return 0
  return Math.round((pages / seconds) * 3600)
}

export function avgSessionMinutes(sessions: ReadingSession[]): number {
  if (sessions.length === 0) return 0
  return Math.round(bookTotals(sessions).seconds / sessions.length / 60)
}

// ════════════════════════════════════════════════════════════════
// Sequências (streaks) e calendário
// ════════════════════════════════════════════════════════════════
/** Conjunto de datas (YYYY-MM-DD) que tiveram ≥1 sessão. */
export function readingDays(sessions: ReadingSession[]): Set<string> {
  return new Set(sessions.map((s) => s.date))
}

/** Sequência atual: dias consecutivos terminando hoje (ou ontem, ainda "viva"). */
export function currentStreak(days: Set<string>, today = todayISO()): number {
  const cur = fromISO(today)
  if (!days.has(today)) {
    cur.setDate(cur.getDate() - 1)
    if (!days.has(toISO(cur))) return 0
  }
  let streak = 0
  while (days.has(toISO(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

export function longestStreak(days: Set<string>): number {
  if (days.size === 0) return 0
  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(fromISO(sorted[i]), fromISO(sorted[i - 1])) === 1) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  return best
}

export interface HeatCell {
  date: string
  minutes: number
}

/** Minutos lidos por dia, para o mapa de calor de um ano. */
export function heatmapData(
  sessions: ReadingSession[],
  year: number,
): HeatCell[] {
  const byDate = new Map<string, number>()
  const prefix = `${year}-`
  for (const s of sessions) {
    if (!s.date.startsWith(prefix)) continue
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.durationSeconds / 60)
  }
  return [...byDate.entries()].map(([date, minutes]) => ({
    date,
    minutes: Math.round(minutes),
  }))
}

// ════════════════════════════════════════════════════════════════
// Ritmo e previsão de término
// ════════════════════════════════════════════════════════════════
export interface Projection {
  daysLeft: number | null
  date: string | null
  pagesPerDay: number
}

export function projectedFinish(
  book: Book,
  sessions: ReadingSession[],
): Projection {
  const remaining = (book.pageCount ?? 0) - book.currentPage
  if (!book.pageCount || remaining <= 0) {
    return { daysLeft: 0, date: book.finishedAt, pagesPerDay: 0 }
  }
  const days = readingDays(sessions).size || 1
  const perDay = bookTotals(sessions).pages / days
  if (perDay <= 0) return { daysLeft: null, date: null, pagesPerDay: 0 }
  const daysLeft = Math.ceil(remaining / perDay)
  const d = fromISO(todayISO())
  d.setDate(d.getDate() + daysLeft)
  return { daysLeft, date: toISO(d), pagesPerDay: Math.round(perDay) }
}

// ════════════════════════════════════════════════════════════════
// Estatísticas da biblioteca (Dashboard)
// ════════════════════════════════════════════════════════════════
export interface NamedValue {
  name: string
  value: number
}

export const MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
]

export interface MonthPoint {
  month: string
  value: number
}

export interface ReadingStats {
  booksFinished: number
  pagesRead: number
  secondsRead: number
  speedPph: number
  readingNow: number
  avgRating: number | null
  currentStreak: number
  longestStreak: number
  byGenre: NamedValue[]
  byFormat: NamedValue[]
  byRating: NamedValue[]
  booksByMonth: MonthPoint[]
  pagesByMonth: MonthPoint[]
}

/**
 * Métricas do ano selecionado. Livros lidos e páginas/tempo são do ano; as
 * **sequências (streaks) são sempre all-time** (usam todas as sessões).
 */
export function libraryStats(
  books: Book[],
  sessions: ReadingSession[],
  year: number,
): ReadingStats {
  const prefix = `${year}-`
  const finished = books.filter(
    (b) => b.status === "finished" && b.finishedAt?.startsWith(prefix),
  )
  const yearSessions = sessions.filter((s) => s.date.startsWith(prefix))
  const totals = bookTotals(yearSessions)
  const rated = finished.filter((b) => b.rating != null)
  const avgRating = rated.length
    ? rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length
    : null
  const allDays = readingDays(sessions) // streaks são all-time

  const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)
  const genreMap = new Map<string, number>()
  const formatMap = new Map<string, number>()
  const ratingMap = new Map<string, number>()
  for (const b of finished) {
    inc(genreMap, b.genre?.trim() || "Sem gênero")
    inc(formatMap, formatLabel(b.format))
    if (b.rating != null) inc(ratingMap, `${b.rating}★`)
  }

  const booksMonth = Array.from({ length: 12 }, () => 0)
  for (const b of finished) {
    const m = Number(b.finishedAt!.slice(5, 7)) - 1
    if (m >= 0 && m < 12) booksMonth[m]++
  }
  const pagesMonth = Array.from({ length: 12 }, () => 0)
  for (const s of yearSessions) {
    const m = Number(s.date.slice(5, 7)) - 1
    if (m >= 0 && m < 12) pagesMonth[m] += s.pagesRead || 0
  }

  const toArr = (m: Map<string, number>): NamedValue[] =>
    [...m.entries()].map(([name, value]) => ({ name, value }))

  return {
    booksFinished: finished.length,
    pagesRead: totals.pages,
    secondsRead: totals.seconds,
    speedPph: readingSpeedPph(yearSessions),
    readingNow: books.filter((b) => b.status === "reading").length,
    avgRating,
    currentStreak: currentStreak(allDays),
    longestStreak: longestStreak(allDays),
    byGenre: toArr(genreMap).sort((a, b) => b.value - a.value),
    byFormat: toArr(formatMap).sort((a, b) => b.value - a.value),
    byRating: toArr(ratingMap).sort((a, b) => a.name.localeCompare(b.name)),
    booksByMonth: MONTHS_SHORT.map((month, i) => ({ month, value: booksMonth[i] })),
    pagesByMonth: MONTHS_SHORT.map((month, i) => ({ month, value: pagesMonth[i] })),
  }
}
