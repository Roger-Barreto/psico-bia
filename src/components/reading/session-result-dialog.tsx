import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Book } from "@/db/types"
import { formatDuration } from "@/domain/reading"
import { todayISO } from "@/domain/dates"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProgressControl } from "./progress-control"
import { useSaveReadingSession } from "./use-save-session"

/** Formulário exibido ao parar o cronômetro: páginas lidas + notas. */
export function SessionResultDialog({
  open,
  onOpenChange,
  book,
  durationSeconds,
  startedAtIso,
  onSaved,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  book: Book | null
  durationSeconds: number
  startedAtIso: string | null
  onSaved: () => void
  onDiscard: () => void
}) {
  const { save, saving } = useSaveReadingSession()
  const [minutes, setMinutes] = useState("")
  const [startPage, setStartPage] = useState("")
  const [endPage, setEndPage] = useState(0)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open || !book) return
    setMinutes(String(Math.max(1, Math.round(durationSeconds / 60))))
    setStartPage(String(book.currentPage))
    setEndPage(book.currentPage)
    setNotes("")
  }, [open, book?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!book) return null

  async function submit() {
    if (!book) return
    const sp = startPage ? Number(startPage) : null
    if (sp != null && endPage < sp) {
      toast.error("A página final não pode ser menor que a inicial")
      return
    }
    try {
      const { finished } = await save({
        book,
        date: todayISO(),
        durationSeconds: Math.max(0, Math.round((Number(minutes) || 0) * 60)),
        startPage: sp,
        endPage,
        startedAt: startedAtIso,
        endedAt: new Date().toISOString(),
        notes: notes.trim() || null,
      })
      toast.success(finished ? "Parabéns! Livro concluído 🎉" : "Sessão registrada")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sessão de leitura</DialogTitle>
          <DialogDescription>
            {book.title} · {formatDuration(Math.max(0, durationSeconds))} lidos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Duração (min)
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Página inicial
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={startPage}
                onChange={(e) => setStartPage(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Página final
            </span>
            <ProgressControl
              pageCount={book.pageCount ?? 0}
              value={endPage}
              onChange={setEndPage}
            />
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Notas (opcional)
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que achou desta sessão?"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onDiscard}>
            Descartar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar sessão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
