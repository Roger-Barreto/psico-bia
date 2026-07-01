import { progressColor } from "@/domain/reading"
import { cn } from "@/lib/utils"

/** Barra de progresso cuja cor muda do início ao fim conforme o percentual. */
export function ReadingProgressBar({
  pct,
  className,
}: {
  pct: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: progressColor(pct) }}
      />
    </div>
  )
}
