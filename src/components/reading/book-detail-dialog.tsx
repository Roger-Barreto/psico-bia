import { useEffect, useState, type ReactNode } from "react"
import {
  ArchiveIcon,
  BookOpenIcon,
  CheckCircleIcon,
  NotePencilIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  StarIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Book, BookStatus } from "@/db/types"
import { useArchiveBook, useUpdateBook, coverSrc } from "@/api/reading"
import {
  formatLabel,
  progressPct,
  statusLabel,
} from "@/domain/reading"
import { todayISO } from "@/domain/dates"
import { celebrateBook } from "@/lib/celebrate"
import { useReadingTimer } from "@/context/reading-timer"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BookCover } from "./book-cover"
import { ReadingProgressBar } from "./progress-bar"
import { ProgressControl } from "./progress-control"
import { SessionList } from "./session-list"
import { LogSessionDialog } from "./log-session-dialog"
import { cn } from "@/lib/utils"

export function BookDetailDialog({
  book,
  open,
  onOpenChange,
  onEdit,
}: {
  book: Book | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onEdit: (book: Book) => void
}) {
  const updateBook = useUpdateBook()
  const archiveBook = useArchiveBook()
  const timer = useReadingTimer()
  const [page, setPage] = useState(0)
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    if (book) setPage(book.currentPage)
  }, [book?.id, book?.currentPage, open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!book) return null
  const pct = progressPct({ ...book, currentPage: page })

  async function persist(patch: Partial<Book>) {
    if (!book) return
    await updateBook.mutateAsync({ id: book.id, patch })
  }

  async function saveProgress() {
    if (!book) return
    const reachedEnd = !!book.pageCount && page >= book.pageCount
    const patch: Partial<Book> = {
      currentPage: reachedEnd ? book.pageCount! : page,
    }
    if (reachedEnd) {
      patch.status = "finished"
      patch.finishedAt = todayISO()
      if (!book.startedAt) patch.startedAt = todayISO()
    } else if (page > 0 && (book.status === "want" || book.status === "paused")) {
      patch.status = "reading"
      if (!book.startedAt) patch.startedAt = todayISO()
    }
    try {
      await persist(patch)
      if (reachedEnd) {
        celebrateBook()
        toast.success("Parabéns! Livro concluído 🎉")
      } else {
        toast.success("Progresso salvo")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  async function changeStatus(next: BookStatus) {
    if (!book) return
    const patch: Partial<Book> = { status: next }
    if (next === "finished") {
      patch.finishedAt = todayISO()
      if (book.pageCount) patch.currentPage = book.pageCount
      if (!book.startedAt) patch.startedAt = todayISO()
    }
    if (next === "reading" && !book.startedAt) patch.startedAt = todayISO()
    try {
      await persist(patch)
      if (next === "finished") {
        celebrateBook()
        toast.success("Parabéns! Livro concluído 🎉")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  async function setRating(r: number) {
    try {
      await persist({ rating: book?.rating === r ? null : r })
    } catch {
      toast.error("Erro ao avaliar")
    }
  }

  async function archive() {
    if (!book) return
    try {
      await archiveBook.mutateAsync(book.id)
      toast.success("Livro arquivado")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao arquivar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{book.title}</DialogTitle>
          <DialogDescription>
            {[book.author, book.pageCount ? `${book.pageCount} págs.` : null, formatLabel(book.format)]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="w-24 shrink-0">
            <BookCover url={coverSrc(book)} title={book.title} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <ReadingProgressBar pct={pct} />
              <p className="text-xs tabular-nums text-muted-foreground">
                {page}
                {book.pageCount ? `/${book.pageCount}` : ""} · {pct}%
              </p>
            </div>

            {/* Avaliação (estrelas) */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  aria-label={`${r} estrelas`}
                  className="text-amber-400 transition-transform hover:scale-110"
                >
                  <StarIcon
                    weight={book.rating != null && r <= book.rating ? "fill" : "regular"}
                    className="size-5"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Controle de páginas */}
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Página atual
          </p>
          <ProgressControl
            pageCount={book.pageCount ?? 0}
            value={page}
            onChange={setPage}
          />
          <Button
            size="sm"
            className="w-full"
            onClick={saveProgress}
            loading={updateBook.isPending}
          >
            Salvar progresso
          </Button>
        </div>

        {/* Ações de status */}
        <div className="flex flex-wrap gap-2">
          <StatusButton
            active={book.status === "reading"}
            onClick={() => changeStatus("reading")}
            icon={<BookOpenIcon weight="fill" />}
          >
            Lendo
          </StatusButton>
          <StatusButton
            active={book.status === "paused"}
            onClick={() => changeStatus("paused")}
            icon={<PauseIcon weight="fill" />}
          >
            Pausar
          </StatusButton>
          <StatusButton
            active={book.status === "finished"}
            onClick={() => changeStatus("finished")}
            icon={<CheckCircleIcon weight="fill" />}
          >
            Concluir
          </StatusButton>
          <StatusButton
            active={book.status === "dnf"}
            onClick={() => changeStatus("dnf")}
            icon={<XCircleIcon weight="fill" />}
          >
            Abandonar
          </StatusButton>
        </div>

        {/* Sessões de leitura */}
        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Sessões</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  timer.start(book.id)
                  onOpenChange(false)
                }}
                disabled={!!timer.active}
                title={
                  timer.active ? "Já há uma sessão em andamento" : undefined
                }
              >
                <PlayIcon weight="fill" /> Iniciar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLogOpen(true)}
              >
                <NotePencilIcon weight="fill" /> Registrar
              </Button>
            </div>
          </div>
          <SessionList bookId={book.id} />
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            {statusLabel(book.status)}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={archive}>
              <ArchiveIcon weight="bold" /> Arquivar
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(book)}>
              <PencilSimpleIcon weight="bold" /> Editar
            </Button>
          </div>
        </div>

        <LogSessionDialog open={logOpen} onOpenChange={setLogOpen} book={book} />
      </DialogContent>
    </Dialog>
  )
}

function StatusButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  )
}
