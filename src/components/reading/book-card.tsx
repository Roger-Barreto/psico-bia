import { StarIcon } from "@phosphor-icons/react"
import type { Book } from "@/db/types"
import { coverSrc } from "@/api/reading"
import { progressPct, statusLabel } from "@/domain/reading"
import { Card } from "@/components/ui/card"
import { BookCover } from "./book-cover"
import { ReadingProgressBar } from "./progress-bar"

export function BookCard({
  book,
  onClick,
}: {
  book: Book
  onClick?: () => void
}) {
  const pct = progressPct(book)
  const showProgress = book.status === "reading" || book.status === "paused"

  return (
    <button type="button" onClick={onClick} className="group block text-left">
      <Card className="overflow-hidden transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-glow">
        <BookCover url={coverSrc(book)} title={book.title} />
        <div className="space-y-1.5 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-tight">
            {book.title}
          </p>
          {book.author && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {book.author}
            </p>
          )}

          {showProgress && book.pageCount ? (
            <div className="space-y-1 pt-1">
              <ReadingProgressBar pct={pct} />
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {book.currentPage}/{book.pageCount} · {pct}%
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                {statusLabel(book.status)}
              </span>
              {book.status === "finished" && book.rating != null && (
                <span className="flex items-center gap-0.5 text-[11px] text-amber-400">
                  <StarIcon weight="fill" className="size-3" />
                  {book.rating}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </button>
  )
}
