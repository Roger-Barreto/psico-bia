import { CurrencyDollarIcon } from "@phosphor-icons/react"
import type { Occurrence, Patient } from "@/db/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PatientAvatar, genderLabel } from "@/components/patient/patient-avatar"
import { formatBRL } from "@/domain/finance"
import { formatDateBR } from "@/domain/dates"
import { ageFromBirthdate } from "@/domain/age"

export interface UnpaidPatientEntry {
  patient: Patient
  insuranceName: string | null
  count: number
  totalValue: number
  oldestDate: string
  occurrence: Occurrence
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: UnpaidPatientEntry[]
  totalValue: number
  onSelect: (entry: UnpaidPatientEntry) => void
}

export function UnpaidPatientsDialog({
  open,
  onOpenChange,
  items,
  totalValue,
  onSelect,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Atendimentos não pagos</DialogTitle>
          <DialogDescription>
            {items.length}{" "}
            {items.length === 1 ? "paciente" : "pacientes"} ·{" "}
            {formatBRL(totalValue)} a receber
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum atendimento pendente de pagamento.
            </p>
          ) : (
            items.map((it) => (
              <button
                key={it.patient.id}
                type="button"
                onClick={() => onSelect(it)}
                className="flex w-full items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left transition-colors hover:border-amber-500/60 hover:bg-amber-500/10"
              >
                <PatientAvatar
                  avatarId={it.patient.avatarId}
                  name={it.patient.name}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {it.patient.name}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                      <CurrencyDollarIcon weight="fill" className="size-3" />
                      {formatBRL(it.totalValue)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ageFromBirthdate(it.patient.birthdate)} anos ·{" "}
                    {genderLabel(it.patient.gender)}
                    {it.insuranceName ? ` · ${it.insuranceName}` : " · Particular"}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-amber-200/80">
                    {it.count}{" "}
                    {it.count === 1 ? "sessão" : "sessões"} · mais antiga em{" "}
                    {formatDateBR(it.oldestDate)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
