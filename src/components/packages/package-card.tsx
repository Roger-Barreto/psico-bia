import type { Patient, SessionPackage } from "@/db/types"
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { formatBRL } from "@/domain/finance"
import { formatDateBR } from "@/domain/dates"
import {
  packageState,
  packageUnitValue,
  sessionsLabel,
} from "@/domain/packages"
import { cn } from "@/lib/utils"
import { PackageProgress, PackageStateBadge } from "./package-progress"

interface Props {
  pkg: SessionPackage
  /** Mostra o paciente no topo (lista geral); sem ele, só o pacote. */
  patient?: Patient | null
  onOpen: () => void
}

/** Cartão de um pacote na lista: quem, quanto falta e quanto custou. */
export function PackageCard({ pkg, patient, onOpen }: Props) {
  const state = packageState(pkg)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-card/70 p-4 text-left transition-colors hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        state !== "active" && "opacity-80",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {patient && (
          <PatientAvatar
            avatarId={patient.avatarId}
            name={patient.name}
            size="sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {patient ? patient.name : `Pacote de ${sessionsLabel(pkg.totalSessions)}`}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {patient ? `${sessionsLabel(pkg.totalSessions)} · ` : ""}
            vendido em {formatDateBR(pkg.startDate)}
          </p>
        </div>
        <PackageStateBadge pkg={pkg} />
      </div>

      <PackageProgress pkg={pkg} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatBRL(pkg.totalValue)}
        </span>
        <span className="tabular-nums">
          {formatBRL(packageUnitValue(pkg))} por sessão
        </span>
      </div>
    </button>
  )
}
