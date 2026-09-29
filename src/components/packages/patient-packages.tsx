import { useMemo, useState } from "react"
import { ArrowClockwiseIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react"
import type { Patient } from "@/db/types"
import { useSessionPackages } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { packagesOfPatient, packageState } from "@/domain/packages"
import { PackageCard } from "./package-card"
import { PackageDetailDialog } from "./package-detail-dialog"
import { PackageDialog } from "./package-dialog"

/** Pacotes de um paciente: os em andamento primeiro, depois o histórico. */
export function PatientPackages({ patient }: { patient: Patient }) {
  const packagesQ = useSessionPackages()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const list = useMemo(() => {
    const mine = packagesOfPatient(packagesQ.data ?? [], patient.id)
    const rank = { active: 0, closed: 1, finished: 2 } as const
    return mine
      .slice()
      .sort(
        (a, b) =>
          rank[packageState(a)] - rank[packageState(b)] ||
          b.startDate.localeCompare(a.startDate),
      )
  }, [packagesQ.data, patient.id])

  const detail = list.find((p) => p.id === detailId) ?? null

  return (
    <div className="space-y-3">
      {packagesQ.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : packagesQ.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <span className="flex items-center gap-1.5">
            <WarningCircleIcon weight="fill" className="size-4 shrink-0" />
            Não foi possível carregar os pacotes.
          </span>
          <button
            type="button"
            onClick={() => packagesQ.refetch()}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2.5 font-medium text-rose-100 hover:bg-rose-500/20"
          >
            <ArrowClockwiseIcon weight="bold" className="size-3.5" />
            Tentar de novo
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Este paciente ainda não tem pacotes. Um pacote pode ser fechado ao
          marcar uma sessão como paga, ou registrado aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <PackageCard key={p.id} pkg={p} onOpen={() => setDetailId(p.id)} />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setNewOpen(true)}
        className="h-11 w-full"
      >
        <PlusIcon weight="bold" />
        Novo pacote
      </Button>

      <PackageDetailDialog
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null)
        }}
        pkg={detail}
        patient={patient}
      />
      <PackageDialog open={newOpen} onOpenChange={setNewOpen} patient={patient} />
    </div>
  )
}
