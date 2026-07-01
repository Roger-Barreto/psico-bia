import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { COVERS_BUCKET, requireUserId, supabase } from "@/lib/supabase"
import type {
  Book,
  BookFormat,
  BookQuote,
  BookStatus,
  ReadingGoal,
  ReadingSession,
} from "@/db/types"

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════
function newId(prefix: string) {
  return `${prefix}_${nanoid(10)}`
}
function nowIso() {
  return new Date().toISOString()
}

// ════════════════════════════════════════════════════════════════
// Mappers snake_case ↔ camelCase
// ════════════════════════════════════════════════════════════════
interface BookRow {
  id: string
  title: string
  subtitle: string | null
  author: string | null
  cover_url: string | null
  cover_path: string | null
  page_count: number | null
  current_page: number
  format: BookFormat
  genre: string | null
  publisher: string | null
  published_year: number | null
  isbn: string | null
  status: BookStatus
  rating: number | null
  review: string | null
  notes: string | null
  tags: string[]
  is_favorite: boolean
  color: string | null
  started_at: string | null
  finished_at: string | null
  reread_count: number
  active: boolean
  created_at: string
  updated_at: string
}

function rowToBook(r: BookRow): Book {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    author: r.author,
    coverUrl: r.cover_url,
    coverPath: r.cover_path,
    pageCount: r.page_count,
    currentPage: r.current_page ?? 0,
    format: r.format,
    genre: r.genre,
    publisher: r.publisher,
    publishedYear: r.published_year,
    isbn: r.isbn,
    status: r.status,
    rating: r.rating != null ? Number(r.rating) : null,
    review: r.review,
    notes: r.notes,
    tags: r.tags ?? [],
    isFavorite: r.is_favorite ?? false,
    color: r.color,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    rereadCount: r.reread_count ?? 0,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function bookToRow(b: Partial<Book>): Partial<BookRow> {
  const row: Partial<BookRow> = {}
  if (b.id !== undefined) row.id = b.id
  if (b.title !== undefined) row.title = b.title
  if (b.subtitle !== undefined) row.subtitle = b.subtitle
  if (b.author !== undefined) row.author = b.author
  if (b.coverUrl !== undefined) row.cover_url = b.coverUrl
  if (b.coverPath !== undefined) row.cover_path = b.coverPath
  if (b.pageCount !== undefined) row.page_count = b.pageCount
  if (b.currentPage !== undefined) row.current_page = b.currentPage
  if (b.format !== undefined) row.format = b.format
  if (b.genre !== undefined) row.genre = b.genre
  if (b.publisher !== undefined) row.publisher = b.publisher
  if (b.publishedYear !== undefined) row.published_year = b.publishedYear
  if (b.isbn !== undefined) row.isbn = b.isbn
  if (b.status !== undefined) row.status = b.status
  if (b.rating !== undefined) row.rating = b.rating
  if (b.review !== undefined) row.review = b.review
  if (b.notes !== undefined) row.notes = b.notes
  if (b.tags !== undefined) row.tags = b.tags
  if (b.isFavorite !== undefined) row.is_favorite = b.isFavorite
  if (b.color !== undefined) row.color = b.color
  if (b.startedAt !== undefined) row.started_at = b.startedAt
  if (b.finishedAt !== undefined) row.finished_at = b.finishedAt
  if (b.rereadCount !== undefined) row.reread_count = b.rereadCount
  if (b.active !== undefined) row.active = b.active
  if (b.updatedAt !== undefined) row.updated_at = b.updatedAt
  return row
}

interface SessionRow {
  id: string
  book_id: string
  date: string
  started_at: string | null
  ended_at: string | null
  duration_seconds: number
  start_page: number | null
  end_page: number | null
  pages_read: number
  notes: string | null
  created_at: string
}

function rowToSession(r: SessionRow): ReadingSession {
  return {
    id: r.id,
    bookId: r.book_id,
    date: r.date,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds ?? 0,
    startPage: r.start_page,
    endPage: r.end_page,
    pagesRead: r.pages_read ?? 0,
    notes: r.notes,
    createdAt: r.created_at,
  }
}

interface GoalRow {
  id: string
  year: number
  target_books: number | null
  target_pages: number | null
  target_minutes: number | null
  created_at: string
  updated_at: string
}

function rowToGoal(r: GoalRow): ReadingGoal {
  return {
    id: r.id,
    year: r.year,
    targetBooks: r.target_books,
    targetPages: r.target_pages,
    targetMinutes: r.target_minutes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

interface QuoteRow {
  id: string
  book_id: string
  text: string
  page: number | null
  created_at: string
}

function rowToQuote(r: QuoteRow): BookQuote {
  return {
    id: r.id,
    bookId: r.book_id,
    text: r.text,
    page: r.page,
    createdAt: r.created_at,
  }
}

// ════════════════════════════════════════════════════════════════
// Query keys
// ════════════════════════════════════════════════════════════════
export const rqk = {
  books: ["reading-books"] as const,
  sessions: (bookId?: string) =>
    ["reading-sessions", bookId ?? "all"] as const,
  goal: (year: number) => ["reading-goal", year] as const,
  quotes: (bookId: string) => ["reading-quotes", bookId] as const,
}

/** Resolve a URL de exibição da capa (upload próprio > URL externa > null). */
export function coverSrc(
  book: Pick<Book, "coverPath" | "coverUrl">,
): string | null {
  if (book.coverPath) {
    return supabase.storage.from(COVERS_BUCKET).getPublicUrl(book.coverPath).data
      .publicUrl
  }
  return book.coverUrl ?? null
}

// ════════════════════════════════════════════════════════════════
// BOOKS
// ════════════════════════════════════════════════════════════════
export function useBooks(opts?: Partial<UseQueryOptions<Book[]>>) {
  return useQuery({
    queryKey: rqk.books,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToBook(r as BookRow))
    },
    staleTime: 30_000,
    ...opts,
  })
}

export interface NewBookInput {
  title: string
  subtitle?: string | null
  author?: string | null
  coverUrl?: string | null
  coverPath?: string | null
  pageCount?: number | null
  currentPage?: number
  format?: BookFormat
  genre?: string | null
  publisher?: string | null
  publishedYear?: number | null
  isbn?: string | null
  status?: BookStatus
  tags?: string[]
  startedAt?: string | null
}

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBookInput) => {
      const ts = nowIso()
      const row: BookRow = {
        id: newId("bk"),
        title: input.title,
        subtitle: input.subtitle ?? null,
        author: input.author ?? null,
        cover_url: input.coverUrl ?? null,
        cover_path: input.coverPath ?? null,
        page_count: input.pageCount ?? null,
        current_page: input.currentPage ?? 0,
        format: input.format ?? "physical",
        genre: input.genre ?? null,
        publisher: input.publisher ?? null,
        published_year: input.publishedYear ?? null,
        isbn: input.isbn ?? null,
        status: input.status ?? "want",
        rating: null,
        review: null,
        notes: null,
        tags: input.tags ?? [],
        is_favorite: false,
        color: null,
        started_at: input.startedAt ?? null,
        finished_at: null,
        reread_count: 0,
        active: true,
        created_at: ts,
        updated_at: ts,
      }
      const { data, error } = await supabase
        .from("books")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToBook(data as BookRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rqk.books }),
  })
}

export function useUpdateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Book> }) => {
      const { data, error } = await supabase
        .from("books")
        .update({ ...bookToRow(patch), updated_at: nowIso() })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToBook(data as BookRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rqk.books }),
  })
}

export function useArchiveBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("books")
        .update({ active: false, updated_at: nowIso() })
        .eq("id", id)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rqk.books }),
  })
}

// ════════════════════════════════════════════════════════════════
// READING SESSIONS
// ════════════════════════════════════════════════════════════════
export function useReadingSessions(bookId?: string) {
  return useQuery({
    queryKey: rqk.sessions(bookId),
    queryFn: async () => {
      let q = supabase.from("reading_sessions").select("*")
      if (bookId) q = q.eq("book_id", bookId)
      const { data, error } = await q.order("date", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToSession(r as SessionRow))
    },
    staleTime: 30_000,
  })
}

export interface NewSessionInput {
  bookId: string
  date: string
  durationSeconds: number
  startPage?: number | null
  endPage?: number | null
  pagesRead?: number
  startedAt?: string | null
  endedAt?: string | null
  notes?: string | null
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewSessionInput) => {
      const pagesRead =
        input.pagesRead ??
        (input.startPage != null && input.endPage != null
          ? Math.max(0, input.endPage - input.startPage)
          : 0)
      const row: SessionRow = {
        id: newId("rs"),
        book_id: input.bookId,
        date: input.date,
        started_at: input.startedAt ?? null,
        ended_at: input.endedAt ?? null,
        duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
        start_page: input.startPage ?? null,
        end_page: input.endPage ?? null,
        pages_read: pagesRead,
        notes: input.notes ?? null,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("reading_sessions")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToSession(data as SessionRow)
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: rqk.sessions(s.bookId) })
      qc.invalidateQueries({ queryKey: rqk.sessions() })
      qc.invalidateQueries({ queryKey: rqk.books })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reading_sessions")
        .delete()
        .eq("id", id)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reading-sessions"] })
      qc.invalidateQueries({ queryKey: rqk.books })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// READING GOAL (desafio anual)
// ════════════════════════════════════════════════════════════════
export function useReadingGoal(year: number) {
  return useQuery({
    queryKey: rqk.goal(year),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_goals")
        .select("*")
        .eq("year", year)
        .maybeSingle()
      if (error) throw error
      return data ? rowToGoal(data as GoalRow) : null
    },
    staleTime: 60_000,
  })
}

export function useUpsertReadingGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      year: number
      targetBooks?: number | null
      targetPages?: number | null
      targetMinutes?: number | null
    }) => {
      const ts = nowIso()
      const row: GoalRow = {
        id: newId("rg"),
        year: input.year,
        target_books: input.targetBooks ?? null,
        target_pages: input.targetPages ?? null,
        target_minutes: input.targetMinutes ?? null,
        created_at: ts,
        updated_at: ts,
      }
      const { data, error } = await supabase
        .from("reading_goals")
        .upsert(row, { onConflict: "year" })
        .select()
        .single()
      if (error) throw error
      return rowToGoal(data as GoalRow)
    },
    onSuccess: (g) => qc.invalidateQueries({ queryKey: rqk.goal(g.year) }),
  })
}

// ════════════════════════════════════════════════════════════════
// BOOK QUOTES (citações/destaques)
// ════════════════════════════════════════════════════════════════
export function useBookQuotes(bookId?: string) {
  return useQuery({
    queryKey: rqk.quotes(bookId ?? "none"),
    queryFn: async () => {
      if (!bookId) return []
      const { data, error } = await supabase
        .from("book_quotes")
        .select("*")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => rowToQuote(r as QuoteRow))
    },
    enabled: !!bookId,
    staleTime: 30_000,
  })
}

export function useAddQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      bookId: string
      text: string
      page?: number | null
    }) => {
      const row: QuoteRow = {
        id: newId("qt"),
        book_id: input.bookId,
        text: input.text,
        page: input.page ?? null,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("book_quotes")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToQuote(data as QuoteRow)
    },
    onSuccess: (q) => qc.invalidateQueries({ queryKey: rqk.quotes(q.bookId) }),
  })
}

export function useDeleteQuote(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("book_quotes").delete().eq("id", id)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rqk.quotes(bookId) }),
  })
}

// ════════════════════════════════════════════════════════════════
// COVER UPLOAD (bucket book-covers, público, escrita por dono)
// ════════════════════════════════════════════════════════════════
export function useUploadBookCover() {
  return useMutation({
    mutationFn: async ({ bookId, file }: { bookId: string; file: File }) => {
      const userId = await requireUserId()
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()
        : "jpg"
      const path = `${userId}/${bookId}/cover.${ext}`
      const { error } = await supabase.storage
        .from(COVERS_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        })
      if (error) throw error
      return path
    },
  })
}
