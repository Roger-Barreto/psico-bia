import { ClockIcon, TrashIcon } from "@phosphor-icons/react"
import { useDeleteSession, useReadingSessions } from "@/api/reading"
import { formatDuration } from "@/domain/reading"
import { formatDateBR } from "@/domain/dates"

/** Histórico de sessões de um livro, com exclusão. */
export function SessionList({ bookId }: { bookId: string }) {
  const sessionsQ = useReadingSessions(bookId)
  const del = useDeleteSession()
  const sessions = sessionsQ.data ?? []

  if (sessionsQ.isLoading) {
    return (
      <p className="text-xs text-muted-foreground">Carregando sessões…</p>
    )
  }
  if (sessions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma sessão registrada ainda.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border/50">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-2 py-2 text-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <ClockIcon weight="duotone" className="size-4 text-primary" />
            <span className="tabular-nums">{formatDateBR(s.date)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDuration(s.durationSeconds)}
              {s.pagesRead > 0 ? ` · ${s.pagesRead} pág.` : ""}
            </span>
            <button
              type="button"
              onClick={() => del.mutate(s.id)}
              className="text-muted-foreground/70 transition-colors hover:text-destructive"
              aria-label="Excluir sessão"
            >
              <TrashIcon weight="bold" className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
