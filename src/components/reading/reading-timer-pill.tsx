import { useState } from "react"
import { BookOpenIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react"
import { useBooks } from "@/api/reading"
import { useReadingTimer } from "@/context/reading-timer"
import { Button } from "@/components/ui/button"
import { SessionResultDialog } from "./session-result-dialog"

function clock(total: number): string {
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Pílula flutuante do cronômetro ativo, visível em qualquer página de Leituras. */
export function ReadingTimerPill() {
  const timer = useReadingTimer()
  const booksQ = useBooks()
  const [resultOpen, setResultOpen] = useState(false)

  if (!timer.active) return null
  const book = (booksQ.data ?? []).find((b) => b.id === timer.active!.bookId) ?? null

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-max max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-border/70 bg-popover/95 px-4 py-2 shadow-glow backdrop-blur md:bottom-6">
        <BookOpenIcon weight="fill" className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 truncate text-sm font-medium">
          {book?.title ?? "Leitura"}
        </span>
        <span className="tabular-nums text-sm font-semibold text-primary">
          {clock(timer.elapsedSeconds)}
        </span>
        {timer.active.running ? (
          <button
            type="button"
            onClick={timer.pause}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Pausar"
          >
            <PauseIcon weight="fill" className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={timer.resume}
            className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Retomar"
          >
            <PlayIcon weight="fill" className="size-4" />
          </button>
        )}
        <Button
          size="sm"
          onClick={() => {
            timer.pause()
            setResultOpen(true)
          }}
        >
          Parar
        </Button>
      </div>

      <SessionResultDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        book={book}
        durationSeconds={timer.elapsedSeconds}
        startedAtIso={timer.active.startedAtIso}
        onSaved={() => {
          setResultOpen(false)
          timer.cancel()
        }}
        onDiscard={() => {
          setResultOpen(false)
          timer.cancel()
        }}
      />
    </>
  )
}
