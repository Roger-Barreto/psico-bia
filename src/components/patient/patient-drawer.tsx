import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilSimpleIcon,
  PlusIcon,
  ProhibitIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import type {
  Appointment,
  Occurrence,
  Patient,
} from "@/db/types"
import {
  qk,
  useDeletePatientAnnotation,
  useIndividualChecklist,
  useInsurances,
  usePatchAppointment,
  usePatientAnnotations,
  useSharedChecklist,
  useUpsertAppointment,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { celebrate } from "@/lib/celebrate"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PatientAvatar, genderLabel } from "./patient-avatar"
import { PaymentControl } from "./payment-control"
import { PatientForm } from "./patient-form"
import { AddAnnotationDialog } from "./add-annotation-dialog"
import { AddChecklistItemDialog } from "./add-checklist-item-dialog"
import { buildSnapshotIds, checklistFor } from "@/domain/pendencies"
import { todayISO } from "@/domain/dates"
import { cn } from "@/lib/utils"

const recurrenceLabel = {
  once: "Único",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
} as const

const weekdayLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface Props {
  occurrence: Occurrence | null
  patient: Patient | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function PatientDrawer({
  occurrence,
  patient,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient()
  const upsert = useUpsertAppointment()
  const patch = usePatchAppointment()
  const sharedQ = useSharedChecklist()
  const indivQ = useIndividualChecklist(patient?.id)
  const insurancesQ = useInsurances()
  const annotationsQ = usePatientAnnotations(patient?.id)
  const deleteAnnotation = useDeletePatientAnnotation()
  const [reschedDate, setReschedDate] = useState("")
  const [reschedTime, setReschedTime] = useState("")
  const [reschedOpen, setReschedOpen] = useState(false)
  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [addChecklistOpen, setAddChecklistOpen] = useState(false)
  const [addAnnotationOpen, setAddAnnotationOpen] = useState(false)

  const shared = sharedQ.data ?? []
  const individual = indivQ.data ?? []
  const insurances = insurancesQ.data ?? []
  const annotations = annotationsQ.data ?? []

  useEffect(() => {
    if (!open) {
      setReschedDate("")
      setReschedTime("")
      setReschedOpen(false)
      setEditPatientOpen(false)
      setAddChecklistOpen(false)
      setAddAnnotationOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (reschedOpen && !reschedTime && occurrence) {
      setReschedTime(occurrence.time || "08:00")
    }
  }, [reschedOpen, reschedTime, occurrence])

  const entries = useMemo(() => {
    if (!occurrence) return []
    return checklistFor(occurrence, shared, individual)
  }, [occurrence, shared, individual])

  if (!patient || !occurrence) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    )
  }

  const p = patient
  const o = occurrence
  const appt = o.appointment
  const status = appt?.status ?? null
  const isAttended = status === "attended"
  const isMissed = status === "missed"
  const isResched = status === "rescheduled"
  const isFuture = o.date > todayISO()
  const hasFinalStatus = isAttended || isMissed || isResched
  const canAct = !isFuture && !hasFinalStatus

  async function markAttended() {
    const snapshot = buildSnapshotIds(p.id, shared, individual)
    try {
      await upsert.mutateAsync({
        patientId: p.id,
        originDate: o.originDate,
        date: o.date,
        status: "attended",
        snapshotItemIds: appt?.snapshotItemIds.length
          ? appt.snapshotItemIds
          : snapshot,
        checkedItemIds: appt?.checkedItemIds ?? [],
      })
      celebrate("happy")
      toast.success("Marcado como atendido")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function markMissed() {
    if (
      !(await confirmDialog({
        title: "Marcar falta",
        description: `Marcar falta para ${p.name}?`,
        destructive: true,
      }))
    )
      return
    const snapshot = buildSnapshotIds(p.id, shared, individual)
    try {
      await upsert.mutateAsync({
        patientId: p.id,
        originDate: o.originDate,
        date: o.date,
        status: "missed",
        snapshotItemIds: appt?.snapshotItemIds.length
          ? appt.snapshotItemIds
          : snapshot,
        checkedItemIds: appt?.checkedItemIds ?? [],
      })
      celebrate("sad")
      toast.success("Falta registrada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function reschedule() {
    if (!reschedDate) return toast.error("Selecione uma data")
    if (!reschedTime) return toast.error("Selecione um horário")
    try {
      await upsert.mutateAsync({
        patientId: p.id,
        originDate: o.originDate,
        date: reschedDate,
        rescheduledTo: reschedDate,
        status: "rescheduled",
        time: reschedTime,
      })
      celebrate("sad")
      toast.success("Reagendado")
      setReschedOpen(false)
      setReschedDate("")
      setReschedTime("")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function toggleItem(itemId: string, checked: boolean) {
    if (!appt) return
    const next = checked
      ? Array.from(new Set([...appt.checkedItemIds, itemId]))
      : appt.checkedItemIds.filter((id) => id !== itemId)

    // Optimistic update across all cached appointment ranges
    const matched: { key: readonly unknown[]; prev: Appointment[] }[] = []
    qc.getQueriesData<Appointment[]>({ queryKey: ["appointments"] }).forEach(
      ([key, data]) => {
        if (!data) return
        const has = data.some((a) => a.id === appt.id)
        if (!has) return
        matched.push({ key, prev: data })
        qc.setQueryData<Appointment[]>(
          key,
          data.map((a) =>
            a.id === appt.id ? { ...a, checkedItemIds: next } : a,
          ),
        )
      },
    )

    try {
      await patch.mutateAsync({
        id: appt.id,
        patch: { checkedItemIds: next },
      })
    } catch (err) {
      // rollback
      matched.forEach(({ key, prev }) => qc.setQueryData(key, prev))
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      qc.invalidateQueries({ queryKey: qk.patients }).catch(() => {})
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Atendimento</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 p-6">
          <div className="flex items-start gap-4">
            <PatientAvatar avatarId={patient.avatarId} name={patient.name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-semibold">{patient.name}</p>
                <button
                  type="button"
                  onClick={() => setEditPatientOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary hover:bg-secondary/15"
                  title="Editar cadastro"
                >
                  <PencilSimpleIcon weight="fill" className="size-3" />
                  Cadastro
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {patient.age} anos · {genderLabel(patient.gender)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                  <ArrowsClockwiseIcon weight="fill" className="size-3" />
                  {recurrenceLabel[patient.recurrence]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/25 px-2 py-0.5 text-xs text-secondary">
                  <CalendarBlankIcon weight="fill" className="size-3" />
                  {weekdayLabel[patient.defaultWeekday]}
                </span>
                {patient.consultationValue > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                    R$ {patient.consultationValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
                {patient.insuranceId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/25 px-2 py-0.5 text-xs text-accent-foreground">
                    {insurances.find((i) => i.id === patient.insuranceId)?.name ?? "Convênio"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Data do atendimento
                </p>
                <p className="mt-0.5 text-base font-medium">
                  {formatLongDate(occurrence.date)}
                  {occurrence.time && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      às {occurrence.time}
                    </span>
                  )}
                </p>
                {isResched && (
                  <p className="mt-1 text-xs text-secondary">
                    Reagendado de {occurrence.originDate}
                  </p>
                )}
              </div>
              <StatusPill
                status={status}
                isFuture={isFuture}
                pendencyCount={occurrence.pendencyCount}
              />
            </div>
          </div>

          {/* AÇÕES — só aparecem se faz sentido agir */}
          {canAct && (
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={markAttended}
                disabled={upsert.isPending}
                className="bg-emerald-500 text-white hover:bg-emerald-500/90 hover:brightness-110 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_8px_28px_-10px_rgba(16,185,129,0.55)]"
              >
                <CheckCircleIcon weight="fill" />
                Atendido
              </Button>
              <Button
                onClick={markMissed}
                disabled={upsert.isPending}
                variant="outline"
                className="border-muted bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <ProhibitIcon weight="fill" />
                Falta
              </Button>
              <Button
                onClick={() => setReschedOpen((v) => !v)}
                className="bg-secondary text-secondary-foreground hover:brightness-105 shadow-[0_0_0_1px_hsl(var(--secondary)/0.3),0_8px_28px_-10px_hsl(var(--secondary)/0.55)]"
              >
                <CalendarBlankIcon weight="fill" />
                Reagendar
              </Button>
            </div>
          )}

          {/* MENSAGEM CONTEXTUAL quando não pode agir */}
          {isFuture && !hasFinalStatus && (
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <ClockIcon
                weight="fill"
                className="mt-0.5 size-4 shrink-0 text-secondary"
              />
              <span>
                Atendimento futuro. As ações ficarão disponíveis no dia.
              </span>
            </div>
          )}

          {hasFinalStatus && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs",
                isAttended &&
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                isMissed && "border-border/60 bg-muted/30 text-muted-foreground",
                isResched &&
                  "border-secondary/40 bg-secondary/10 text-secondary",
              )}
            >
              {isAttended && (
                <CheckCircleIcon
                  weight="fill"
                  className="mt-0.5 size-4 shrink-0"
                />
              )}
              {isMissed && (
                <ProhibitIcon
                  weight="fill"
                  className="mt-0.5 size-4 shrink-0"
                />
              )}
              {isResched && (
                <CalendarBlankIcon
                  weight="fill"
                  className="mt-0.5 size-4 shrink-0"
                />
              )}
              <span>
                {isAttended &&
                  "Atendimento concluído. Preencha o checklist abaixo."}
                {isMissed &&
                  "Paciente faltou neste atendimento. Itens não cumpridos do checklist contam como pendência."}
                {isResched &&
                  `Reagendado para ${formatLongDate(occurrence.date)}.`}
              </span>
            </div>
          )}

          {/* REAGENDAR FORM */}
          {reschedOpen && canAct && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-3">
              <p className="mb-2 text-sm font-medium">Nova data e horário</p>
              <div className="flex gap-2">
                <DatePicker
                  value={reschedDate}
                  min={todayISO()}
                  onChange={setReschedDate}
                  className="flex-1"
                />
                <TimePicker
                  value={reschedTime}
                  onChange={setReschedTime}
                  className="w-32"
                />
                <Button
                  onClick={reschedule}
                  disabled={upsert.isPending || !reschedDate || !reschedTime}
                  className="bg-secondary text-secondary-foreground hover:brightness-105"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          )}

          {/* PAGAMENTO — aparece quando atendido */}
          {isAttended && appt && (
            <PaymentControl appointment={appt} patient={patient} />
          )}

          {/* CHECKLIST — header sempre visível; lista só quando atendido/faltou */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">Checklist do dia</p>
              <div className="flex items-center gap-2">
                {(isAttended || isMissed) && (
                  <p className="text-xs text-muted-foreground">
                    {entries.filter((e) => e.checked).length} / {entries.length}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setAddChecklistOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/15"
                  title="Adicionar item ao checklist"
                >
                  <PlusIcon weight="bold" className="size-3" />
                  Checklist
                </button>
              </div>
            </div>
            {(isAttended || isMissed) && (
              <>
                <p className="text-xs text-muted-foreground">
                  Itens não marcados contam como pendência no painel.
                </p>
                <div className="space-y-1.5 pt-1">
                  {entries.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sem itens neste checklist.
                    </p>
                  )}
                  {entries.map((e) => (
                    <label
                      key={e.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 transition-colors",
                        e.checked && "border-emerald-500/40 bg-emerald-500/10",
                      )}
                    >
                      <Checkbox
                        checked={e.checked}
                        onCheckedChange={(v) => toggleItem(e.id, v === true)}
                        className={cn(
                          "mt-0.5",
                          e.checked &&
                            "border-emerald-500 bg-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm",
                            e.checked &&
                              "text-muted-foreground line-through decoration-emerald-500/60",
                          )}
                        >
                          {e.label}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {e.source === "shared" ? "Compartilhado" : "Individual"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ANOTAÇÕES — sempre visível */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">Anotações</p>
              <button
                type="button"
                onClick={() => setAddAnnotationOpen(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-secondary hover:bg-secondary/15"
                title="Adicionar anotação"
              >
                <PlusIcon weight="bold" className="size-3" />
                Anotação
              </button>
            </div>
            <div className="space-y-1.5 pt-1">
              {annotations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sem anotações para este paciente.
                </p>
              )}
              {annotations.map((a) => (
                <div
                  key={a.id}
                  className="relative rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2.5 pr-9"
                >
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {a.text}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {formatAnnotationDate(a.createdAt)}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !(await confirmDialog({
                          title: "Excluir anotação",
                          description: "Excluir esta anotação?",
                          destructive: true,
                        }))
                      )
                        return
                      deleteAnnotation.mutate(a.id, {
                        onSuccess: () => toast.success("Anotação excluída"),
                        onError: (err) =>
                          toast.error(
                            err instanceof Error ? err.message : "Erro",
                          ),
                      })
                    }}
                    className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-secondary/80 transition-colors hover:bg-secondary/20 hover:text-secondary"
                    aria-label="Excluir anotação"
                    title="Excluir anotação"
                  >
                    <XIcon weight="bold" className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>

      <Sheet open={editPatientOpen} onOpenChange={setEditPatientOpen}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Editar paciente</SheetTitle>
          </SheetHeader>
          <PatientForm
            key={patient.id}
            patient={patient}
            onDone={() => setEditPatientOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <AddChecklistItemDialog
        patientId={patient.id}
        open={addChecklistOpen}
        onOpenChange={setAddChecklistOpen}
      />
      <AddAnnotationDialog
        patientId={patient.id}
        open={addAnnotationOpen}
        onOpenChange={setAddAnnotationOpen}
      />
    </Sheet>
  )
}

function formatAnnotationDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function StatusPill({
  status,
  isFuture,
  pendencyCount,
}: {
  status: Appointment["status"] | null
  isFuture: boolean
  pendencyCount: number
}) {
  if (status === "attended" && pendencyCount > 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/20 px-2.5 py-1 text-xs font-medium text-destructive">
        <WarningIcon weight="fill" className="size-3" />
        {pendencyCount} pendência{pendencyCount === 1 ? "" : "s"}
      </span>
    )
  }
  if (status === "attended") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
        <CheckCircleIcon weight="fill" className="size-3" />
        Atendido
      </span>
    )
  }
  if (status === "missed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <ProhibitIcon weight="fill" className="size-3" />
        Falta
      </span>
    )
  }
  if (status === "rescheduled") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/25 px-2.5 py-1 text-xs font-medium text-secondary">
        <CalendarBlankIcon weight="fill" className="size-3" />
        Reagendado
      </span>
    )
  }
  if (isFuture) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
        <ClockIcon weight="fill" className="size-3" />
        A atender
      </span>
    )
  }
  if (pendencyCount > 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/20 px-2.5 py-1 text-xs font-medium text-destructive">
        <WarningIcon weight="fill" className="size-3" />
        {pendencyCount} pendência{pendencyCount === 1 ? "" : "s"}
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Pendente
    </span>
  )
}

const monthsLong = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]
const weekdaysLong = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
]

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return `${weekdaysLong[dt.getDay()]}, ${d} de ${monthsLong[m - 1]}`
}
