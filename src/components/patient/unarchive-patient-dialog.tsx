import { useMemo, useRef } from "react"
import { toast } from "sonner"
import {
  CalendarBlankIcon,
  CalendarXIcon,
  ClockCounterClockwiseIcon,
  WarningIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import type { AppointmentSeries, Patient } from "@/db/types"
import {
  useAppointmentSeries,
  usePatientAppointments,
  useUnarchivePatient,
} from "@/api/queries"
import { unarchivePreview } from "@/domain/unarchive"
import { formatDateBR, weekdayBR } from "@/domain/dates"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  /** Paciente a desarquivar; `null` fecha o diálogo. */
  patient: Patient | null
  onClose: () => void
}

export function UnarchivePatientDialog({ patient, onClose }: Props) {
  const open = !!patient
  // Segura o último paciente para o conteúdo não sumir na animação de saída.
  const lastRef = useRef(patient)
  if (patient) lastRef.current = patient
  const p = patient ?? lastRef.current

  const seriesQ = useAppointmentSeries(p?.id, { enabled: open && !!p })
  const apptsQ = usePatientAppointments(p?.id, { enabled: open })
  const unarchiveMut = useUnarchivePatient()

  const preview = useMemo(
    () =>
      p && seriesQ.data && apptsQ.data
        ? unarchivePreview(p, seriesQ.data, apptsQ.data)
        : null,
    [p, seriesQ.data, apptsQ.data],
  )
  const checking = open && !preview && (seriesQ.isLoading || apptsQ.isLoading)
  const checkFailed = open && !preview && (seriesQ.isError || apptsQ.isError)
  const stale = preview?.staleSessions ?? []
  const n = stale.length
  const busy = unarchiveMut.isPending

  async function run(cancelStale: boolean) {
    if (!p || busy) return
    try {
      await unarchiveMut.mutateAsync({
        id: p.id,
        cancelSessions: cancelStale
          ? stale.map((o) => ({ seriesId: o.seriesId, originDate: o.originDate }))
          : [],
      })
      toast.success(
        cancelStale && n > 0
          ? `Paciente desarquivado · ${n} ${n === 1 ? "sessão cancelada" : "sessões canceladas"}`
          : "Paciente desarquivado",
      )
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desarquivar")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Desarquivar paciente</DialogTitle>
          <DialogDescription>
            {p?.name} volta para a lista de pacientes, a agenda e o dashboard.
          </DialogDescription>
        </DialogHeader>

        {checking && (
          <p className="text-sm text-muted-foreground">Conferindo a agenda…</p>
        )}
        {checkFailed && (
          <p className="text-sm text-muted-foreground">
            Não deu para conferir a agenda deste paciente. Dá para desarquivar
            mesmo assim; sessões antigas sem registro aparecem como pendentes.
          </p>
        )}

        {preview && preview.resumingSeries.length > 0 && (
          <div className="space-y-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <CalendarBlankIcon weight="fill" className="size-3.5 text-primary" />
              Voltam para a agenda
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {preview.resumingSeries.map((s) => (
                <li key={s.id}>{seriesLabel(s)}</li>
              ))}
            </ul>
          </div>
        )}

        {n > 0 ? (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <WarningIcon
                weight="fill"
                className="mt-0.5 size-4 shrink-0 text-amber-500"
              />
              <p>
                {preview?.lastRecordedDate
                  ? `Desde a última sessão registrada (${formatDateBR(preview.lastRecordedDate)}), `
                  : "Nenhuma sessão deste paciente foi registrada: "}
                {n === 1
                  ? `1 sessão (${formatDateBR(stale[0].date)}) ficou sem registro e voltaria como pendente.`
                  : `${n} sessões, de ${formatDateBR(stale[0].date)} a ${formatDateBR(stale[n - 1].date)}, ficaram sem registro e voltariam como pendentes.`}
              </p>
            </div>
            <div className="space-y-2">
              <ChoiceButton
                icon={CalendarXIcon}
                label={n === 1 ? "Cancelar essa sessão" : `Cancelar as ${n} sessões`}
                hint="Saem da agenda e das pendências, como desmarcadas."
                disabled={busy}
                onClick={() => run(true)}
              />
              <ChoiceButton
                icon={ClockCounterClockwiseIcon}
                label="Manter como pendentes"
                hint="Ficam na agenda para você registrar uma a uma."
                disabled={busy}
                onClick={() => run(false)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={busy}
              >
                Voltar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => run(false)}
              loading={busy}
              disabled={checking}
            >
              Desarquivar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function seriesLabel(s: AppointmentSeries): string {
  const time = s.time.slice(0, 5)
  switch (s.frequency) {
    case "weekly":
      return `Semanal · ${weekdayBR(s.startDate)}, ${time}`
    case "biweekly":
      return `Quinzenal · ${weekdayBR(s.startDate)}, ${time}`
    case "monthly":
      return `Mensal · dia ${Number(s.startDate.slice(8))}, ${time}`
    default:
      return `Sessão avulsa · ${formatDateBR(s.startDate)}, ${time}`
  }
}

function ChoiceButton({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: PhosphorIcon
  label: string
  hint: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="h-auto w-full justify-start gap-3 py-3 text-left"
    >
      <Icon weight="fill" className="size-5 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 whitespace-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      </span>
    </Button>
  )
}
