import type { SessionPackage } from "@/db/types"
import {
  packageRemaining,
  packageState,
  packageUnused,
  packageUsed,
  sessionsLabel,
  type PackageState,
} from "@/domain/packages"
import { cn } from "@/lib/utils"

const STATE_LABEL: Record<PackageState, string> = {
  active: "Em andamento",
  finished: "Concluído",
  closed: "Encerrado",
}

const STATE_CLASS: Record<PackageState, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  finished: "bg-primary/15 text-primary",
  closed: "bg-muted text-muted-foreground",
}

export function PackageStateBadge({ pkg }: { pkg: SessionPackage }) {
  const state = packageState(pkg)
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        STATE_CLASS[state],
      )}
    >
      {STATE_LABEL[state]}
    </span>
  )
}

/**
 * Barra de uso do pacote, uma "casa" por sessão enquanto couber (até 12) e
 * contínua acima disso. Sempre acompanhada do número por extenso — a barra
 * sozinha não diz quanto falta.
 */
export function PackageProgress({
  pkg,
  className,
}: {
  pkg: SessionPackage
  className?: string
}) {
  const used = packageUsed(pkg)
  const total = pkg.totalSessions
  const state = packageState(pkg)
  const remaining = packageRemaining(pkg)
  const unused = packageUnused(pkg)
  const segmented = total <= 12

  const summary =
    state === "closed"
      ? `${used} de ${total} realizadas · ${sessionsLabel(unused)} não ${unused === 1 ? "usada" : "usadas"}`
      : state === "finished"
        ? `${sessionsLabel(total)} ${total === 1 ? "realizada" : "realizadas"}`
        : `${used} de ${total} realizadas · ${remaining === 1 ? "resta 1" : `restam ${remaining}`}`

  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(used, total)}
        aria-label={`Sessões do pacote: ${summary}`}
        className={cn("flex h-2 w-full", segmented ? "gap-1" : "")}
      >
        {segmented ? (
          Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-full flex-1 rounded-full",
                i < used
                  ? state === "closed"
                    ? "bg-muted-foreground/60"
                    : "bg-emerald-400"
                  : "bg-muted",
              )}
            />
          ))
        ) : (
          <span className="h-full w-full overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                "block h-full rounded-full",
                state === "closed" ? "bg-muted-foreground/60" : "bg-emerald-400",
              )}
              style={{ width: `${Math.min(100, (used / total) * 100)}%` }}
            />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  )
}
