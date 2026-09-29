import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  LockSimpleIcon,
  PencilSimpleIcon,
  ProhibitIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import type { Patient, SessionPackage } from "@/db/types"
import {
  packageErrorMessage,
  useDeleteSessionPackage,
  usePaymentMethods,
  useUpdateSessionPackage,
} from "@/api/queries"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { formatBRL } from "@/domain/finance"
import {
  formatDateBR,
  formatDateTimeBR,
  formatLongDateBR,
} from "@/domain/dates"
import {
  packageRemaining,
  packageState,
  packageUnitValue,
  packageUnused,
  packageUsed,
  sessionsLabel,
} from "@/domain/packages"
import { PackageDialog } from "./package-dialog"
import { PackageProgress, PackageStateBadge } from "./package-progress"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  pkg: SessionPackage | null
  patient: Patient | null
}

/** Tudo sobre um pacote: saldo, o que já foi usado e as ações sobre ele. */
export function PackageDetailDialog({
  open,
  onOpenChange,
  pkg,
  patient,
}: Props) {
  const methodsQ = usePaymentMethods()
  const update = useUpdateSessionPackage()
  const remove = useDeleteSessionPackage()
  const [editOpen, setEditOpen] = useState(false)

  if (!pkg) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pacote</DialogTitle>
            <DialogDescription>Este pacote não existe mais.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const p = pkg
  const state = packageState(p)
  const used = packageUsed(p)
  const remaining = packageRemaining(p)
  const unused = packageUnused(p)
  const methodName = p.paymentMethodId
    ? methodsQ.data?.find((m) => m.id === p.paymentMethodId)?.name
    : undefined
  const pending = update.isPending || remove.isPending

  async function closePackage() {
    if (pending) return
    if (
      !(await confirmDialog({
        title: "Encerrar pacote",
        description: `${unused === 1 ? "A sessão que sobrou não será mais descontada" : `As ${unused} sessões que sobraram não serão mais descontadas`} deste pacote — as próximas voltam a ser cobradas normalmente. O valor recebido continua no financeiro. Dá para reabrir depois.`,
        confirmLabel: "Encerrar",
      }))
    )
      return
    try {
      await update.mutateAsync({
        id: p.id,
        patch: { closedAt: new Date().toISOString() },
      })
      toast.success("Pacote encerrado")
    } catch (err) {
      toast.error(packageErrorMessage(err))
    }
  }

  async function reopenPackage() {
    if (pending) return
    try {
      await update.mutateAsync({ id: p.id, patch: { closedAt: null } })
      toast.success("Pacote reaberto")
    } catch (err) {
      toast.error(packageErrorMessage(err))
    }
  }

  async function deletePackage() {
    if (pending) return
    const sessionsNote =
      used === 0
        ? ""
        : used === 1
          ? " A sessão que ele pagou volta a ficar como não paga."
          : ` As ${used} sessões que ele pagou voltam a ficar como não pagas.`
    if (
      !(await confirmDialog({
        title: "Excluir pacote",
        description: `O pacote e a receita de ${formatBRL(p.totalValue)} saem do financeiro.${sessionsNote} Esta ação não pode ser desfeita.`,
        confirmLabel: "Excluir",
        destructive: true,
      }))
    )
      return
    try {
      await remove.mutateAsync(p.id)
      toast.success("Pacote excluído")
      onOpenChange(false)
    } catch (err) {
      toast.error(packageErrorMessage(err))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pacote de {sessionsLabel(p.totalSessions)}</DialogTitle>
            <DialogDescription>
              Vendido em {formatDateBR(p.startDate)}
              {methodName ? ` · ${methodName}` : ""}
            </DialogDescription>
          </DialogHeader>

          {patient && (
            <div className="flex items-center gap-3">
              <PatientAvatar
                avatarId={patient.avatarId}
                name={patient.name}
                size="sm"
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {patient.name}
              </p>
              <PackageStateBadge pkg={p} />
            </div>
          )}

          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <PackageProgress pkg={p} />
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Valor do pacote</dt>
              <dd className="font-semibold tabular-nums">
                {formatBRL(p.totalValue)}
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Por sessão</dt>
              <dd className="font-semibold tabular-nums">
                {formatBRL(packageUnitValue(p))}
              </dd>
            </div>
          </dl>

          {p.notes && (
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
              {p.notes}
            </p>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Sessões do pacote</p>
            {used === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma sessão realizada ainda.
              </p>
            )}
            <ol className="space-y-1.5">
              {p.sessions.map((s, i) => {
                const missed = s.status === "missed"
                return (
                  <li
                    key={s.appointmentId}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-semibold tabular-nums text-emerald-300">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {formatLongDateBR(s.date)}
                        {s.time ? ` às ${s.time}` : ""}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {missed ? (
                          <ProhibitIcon weight="fill" className="size-3" />
                        ) : (
                          <CheckCircleIcon weight="fill" className="size-3" />
                        )}
                        {missed ? "Falta cobrada" : "Atendida"}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
            {state === "active" && (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                {remaining === 1
                  ? "Falta 1 sessão para realizar."
                  : `Faltam ${remaining} sessões para realizar.`}{" "}
                Elas são descontadas sozinhas quando a sessão é marcada como
                atendida.
              </p>
            )}
            {state === "closed" && (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                {/* `closedAt` é um instante em UTC: cortar a string daria o
                    dia seguinte para quem encerra à noite no Brasil. */}
                Encerrado em {formatDateTimeBR(p.closedAt ?? "")} com{" "}
                {sessionsLabel(unused)} sem uso.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setEditOpen(true)}
              disabled={pending}
              className="h-11 flex-1"
            >
              <PencilSimpleIcon weight="fill" />
              Editar
            </Button>
            {state === "active" && (
              <Button
                variant="outline"
                onClick={closePackage}
                disabled={pending}
                className="h-11 flex-1"
              >
                <LockSimpleIcon weight="fill" />
                Encerrar
              </Button>
            )}
            {state === "closed" && (
              <Button
                variant="outline"
                onClick={reopenPackage}
                disabled={pending}
                className="h-11 flex-1"
              >
                <ArrowCounterClockwiseIcon weight="fill" />
                Reabrir
              </Button>
            )}
            <Button
              variant="outline"
              onClick={deletePackage}
              disabled={pending}
              className="h-11 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <TrashIcon weight="fill" />
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PackageDialog open={editOpen} onOpenChange={setEditOpen} pkg={p} />
    </>
  )
}
