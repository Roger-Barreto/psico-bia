import type { Book } from "@/db/types"
import { useCreateSession, useUpdateBook } from "@/api/reading"
import { celebrateBook } from "@/lib/celebrate"

export interface SaveSessionInput {
  book: Book
  date: string // YYYY-MM-DD
  durationSeconds: number
  startPage?: number | null
  endPage?: number | null
  startedAt?: string | null
  endedAt?: string | null
  notes?: string | null
}

/**
 * Cria a sessão e atualiza o livro (página atual, transições de status,
 * detecção de conclusão + comemoração). Compartilhado pelo cronômetro e pelo
 * registro manual.
 */
export function useSaveReadingSession() {
  const createSession = useCreateSession()
  const updateBook = useUpdateBook()

  async function save(input: SaveSessionInput): Promise<{ finished: boolean }> {
    const { book } = input
    const startPage = input.startPage ?? null
    const endPage = input.endPage ?? null

    await createSession.mutateAsync({
      bookId: book.id,
      date: input.date,
      durationSeconds: input.durationSeconds,
      startPage,
      endPage,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      notes: input.notes ?? null,
    })

    const newCurrent =
      endPage != null ? Math.max(book.currentPage, endPage) : book.currentPage
    const reachedEnd = !!book.pageCount && newCurrent >= book.pageCount

    const patch: Partial<Book> = {
      currentPage: reachedEnd ? book.pageCount! : newCurrent,
    }
    if (!book.startedAt) patch.startedAt = input.date
    if (reachedEnd) {
      patch.status = "finished"
      patch.finishedAt = input.date
    } else if (book.status === "want" || book.status === "paused") {
      patch.status = "reading"
    }

    await updateBook.mutateAsync({ id: book.id, patch })
    if (reachedEnd) celebrateBook()
    return { finished: reachedEnd }
  }

  return { save, saving: createSession.isPending || updateBook.isPending }
}
