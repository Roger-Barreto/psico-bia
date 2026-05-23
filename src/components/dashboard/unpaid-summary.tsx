import { CurrencyDollarIcon } from "@phosphor-icons/react"
import { formatBRL } from "@/domain/finance"
import { cn } from "@/lib/utils"

interface Props {
  count: number
  totalValue: number
  onClick?: () => void
}

export function UnpaidSummary({ count, totalValue, onClick }: Props) {
  const empty = count === 0
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border p-6 sm:p-8 text-left transition-colors",
        empty
          ? "border-border/60 bg-muted/30 cursor-default"
          : "border-amber-500/40 bg-amber-500/10 shadow-[0_8px_40px_-15px_rgba(245,158,11,0.4)] hover:border-amber-500/60 hover:bg-amber-500/15",
      )}
    >
      <div>
        <p
          className={cn(
            "text-sm font-medium uppercase tracking-wider",
            empty ? "text-muted-foreground" : "text-amber-300/80",
          )}
        >
          Atendimentos não pagos
        </p>
        <p
          className={cn(
            "mt-1 text-6xl font-bold",
            empty ? "text-muted-foreground" : "text-amber-300",
          )}
        >
          {count}
        </p>
        {empty ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todas as sessões atendidas estão pagas.
          </p>
        ) : (
          <>
            <p className="mt-3 text-lg font-semibold text-amber-200">
              {formatBRL(totalValue)} a receber
            </p>
            <p className="text-sm text-amber-300/80">
              Clique para ver os pacientes
            </p>
          </>
        )}
      </div>
      <div
        className={cn(
          "grid size-20 shrink-0 place-items-center rounded-2xl",
          empty
            ? "bg-muted/40 text-muted-foreground"
            : "bg-amber-500/20 text-amber-300",
        )}
      >
        <CurrencyDollarIcon weight="fill" className="size-12" />
      </div>
    </button>
  )
}
