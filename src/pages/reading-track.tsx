import { useMemo, useState, type ReactNode } from "react"
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react"
import type { Book, BookStatus } from "@/db/types"
import { useBooks } from "@/api/reading"
import { STATUS_ORDER, statusLabel } from "@/domain/reading"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { BookCard } from "@/components/reading/book-card"
import { BookDialog } from "@/components/reading/book-dialog"
import { BookDetailDialog } from "@/components/reading/book-detail-dialog"
import { cn } from "@/lib/utils"

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")

export function ReadingTrackPage() {
  const booksQ = useBooks()
  const books = booksQ.data ?? []

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<BookStatus | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Book | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = books.find((b) => b.id === selectedId) ?? null

  const sections = useMemo(() => {
    const q = norm(query.trim())
    const filtered = q
      ? books.filter(
          (b) => norm(b.title).includes(q) || norm(b.author ?? "").includes(q),
        )
      : books
    const order = statusFilter ? [statusFilter] : STATUS_ORDER
    return order
      .map((status) => ({
        status,
        items: filtered.filter((b) => b.status === status),
      }))
      .filter((s) => s.items.length > 0)
  }, [books, query, statusFilter])

  const counts = useMemo(() => {
    const m = new Map<BookStatus, number>()
    for (const b of books) m.set(b.status, (m.get(b.status) ?? 0) + 1)
    return m
  }, [books])

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openBook(book: Book) {
    setSelectedId(book.id)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Leituras" }, { label: "Track" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Track</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua estante: acompanhe o progresso de cada livro.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon weight="bold" />
          Adicionar livro
        </Button>
      </div>

      {/* Filtros por status */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={statusFilter === null}
          onClick={() => setStatusFilter(null)}
        >
          Todos ({books.length})
        </FilterChip>
        {STATUS_ORDER.map((s) => {
          const n = counts.get(s) ?? 0
          if (n === 0) return null
          return (
            <FilterChip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {statusLabel(s)} ({n})
            </FilterChip>
          )
        })}
        <div className="relative ml-auto w-full sm:w-64">
          <MagnifyingGlassIcon
            weight="fill"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar por título ou autor…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {booksQ.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            Nenhum livro na estante ainda.
            <button
              type="button"
              onClick={openNew}
              className="text-xs font-medium text-primary hover:underline"
            >
              Adicionar o primeiro livro
            </button>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum livro encontrado.
        </p>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.status} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {statusLabel(section.status)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground/60">
                  {section.items.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {section.items.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onClick={() => openBook(book)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <BookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
      <BookDetailDialog
        book={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(book) => {
          setDetailOpen(false)
          setEditing(book)
          setDialogOpen(true)
        }}
      />
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
