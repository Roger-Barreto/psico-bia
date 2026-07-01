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
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { ProgressControl } from "./progress-control"
import { useSaveReadingSession } from "./use-save-session"

/** Minutos entre dois "HH:MM" (cruzando meia-noite se necessário). */
function minutesBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let d = eh * 60 + em - (sh * 60 + sm)
  if (d < 0) d += 24 * 60
  return d
}

/** Registro manual de sessão: data + horário inicial/final + páginas + notas. */
export function LogSessionDialog({
  open,
  onOpenChange,
  book,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  book: Book | null
}) {
  const { save, saving } = useSaveReadingSession()
  const [date, setDate] = useState(todayISO())
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [startPage, setStartPage] = useState("")
  const [endPage, setEndPage] = useState(0)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open || !book) return
    setDate(todayISO())
    setStartTime("")
    setEndTime("")
    setStartPage(String(book.currentPage))
    setEndPage(book.currentPage)
    setNotes("")
  }, [open, book?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!book) return null

  const minutes = minutesBetween(startTime, endTime)

  async function submit() {
    if (!book) return
    if (!date) {
      toast.error("Selecione a data")
      return
    }
    const sp = startPage ? Number(startPage) : null
    if (sp != null && endPage < sp) {
      toast.error("A página final não pode ser menor que a inicial")
      return
    }
    try {
      const { finished } = await save({
        book,
        date,
        durationSeconds: minutes * 60,
        startPage: sp,
        endPage,
        startedAt: startTime ? `${date}T${startTime}:00` : null,
        endedAt: endTime ? `${date}T${endTime}:00` : null,
        notes: notes.trim() || null,
      })
      toast.success(finished ? "Parabéns! Livro concluído 🎉" : "Sessão registrada")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar sessão</DialogTitle>
          <DialogDescription>{book.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Data</span>
            <DatePicker value={date} onChange={setDate} max={todayISO()} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Início
              </span>
              <TimePicker value={startTime} onChange={setStartTime} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Fim
              </span>
              <TimePicker value={endTime} onChange={setEndTime} />
            </label>
          </div>

          {minutes > 0 && (
            <p className="text-xs text-muted-foreground">
              Duração: {formatDuration(minutes * 60)}
            </p>
          )}

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
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar sessão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
