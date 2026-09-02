import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowUUpLeftIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
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
  useAppointmentSeries,
  useAppointmentsInRange,
  useDeletePatientAnnotation,
  useIndividualChecklist,
  useInsurances,
  usePatchAppointment,
  usePatientAnnotations,
  useSharedChecklist,
  useUndoAppointment,
  useUpsertAppointment,
  useUpdatePatient,
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
import { genderLabel } from "./patient-avatar"
import { AvatarPicker } from "./avatar-picker"
import { PaymentControl } from "./payment-control"
import { PatientForm } from "./patient-form"
import { AddAnnotationDialog } from "./add-annotation-dialog"
import { AddChecklistItemDialog } from "./add-checklist-item-dialog"
import { buildSnapshotIds, checklistFor } from "@/domain/pendencies"
import { occurrencesForPatient } from "@/domain/recurrence"
import { todayISO, formatLongDateBR } from "@/domain/dates"
import { cn } from "@/lib/utils"
import { ageLabel } from "@/domain/age"
import { Spinner } from "@/components/ui/spinner"
import { UndoAppointmentDialog } from "@/components/appointments/undo-appointment-dialog"
import { MissedAppointmentDialog } from "@/components/appointments/missed-appointment-dialog"
import { RescheduleConflictDialog } from "@/components/appointments/reschedule-conflict-dialog"

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
  const undo = useUndoAppointment()
  const updatePatient = useUpdatePatient()
  const sharedQ = useSharedChecklist()
  const indivQ = useIndividualChecklist(patient?.id)
  const insurancesQ = useInsurances()
  const seriesQ = useAppointmentSeries()
  const annotationsQ = usePatientAnnotations(patient?.id)
  const deleteAnnotation = useDeletePatientAnnotation()
  const [reschedDate, setReschedDate] = useState("")
  const [reschedTime, setReschedTime] = useState("")
  const [reschedOpen, setReschedOpen] = useState(false)
  const [editPatientOpen, setEditPatientOpen] = useState(false)
  const [addChecklistOpen, setAddChecklistOpen] = useState(false)
  const [addAnnotationOpen, setAddAnnotationOpen] = useState(false)
  const [undoOpen, setUndoOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictTarget, setConflictTarget] = useState<Occurrence | null>(null)
  const [missedOpen, setMissedOpen] = useState(false)

  const shared = sharedQ.data ?? []
  const individual = indivQ.data ?? []
  const insurances = insurancesQ.data ?? []
  const allSeries = seriesQ.data ?? []
  const annotations = annotationsQ.data ?? []

  // Ocorrências do paciente na data-alvo do reagendamento (para detectar conflito).
  const targetDayAppts =
    useAppointmentsInRange(reschedDate || todayISO(), reschedDate || todayISO())
      .data ?? []
  const targetOccurrences = useMemo(() => {
    if (!patient || !reschedDate) return []
    return occurrencesForPatient(
      patient,
      allSeries,
      { fromISO: reschedDate, toISO: reschedDate },
      targetDayAppts,
    )
  }, [patient, allSeries, reschedDate, targetDayAppts])

  useEffect(() => {
    if (!open) {
      setReschedDate("")
      setReschedTime("")
      setReschedOpen(false)
      setEditPatientOpen(false)
      setAddChecklistOpen(false)
      setAddAnnotationOpen(false)
      setConflictOpen(false)
      setConflictTarget(null)
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
  const isChargedAbsence = isMissed && !!appt?.chargedAbsence
  // Sessão que gera receita: atendida, ou falta que o contrato manda cobrar.
  const isBillableSession = isAttended || isChargedAbsence
  const isFuture = o.date > todayISO()
  const isPast = o.date < todayISO()
  const hasFinalStatus = isAttended || isMissed
  const canAct = !isFuture && !hasFinalStatus
  const wasRescheduled = !!appt?.rescheduledTo

  async function markAttended() {
    const snapshot = buildSnapshotIds(p.id, shared, individual)
    try {
      await upsert.mutateAsync({
        seriesId: o.seriesId,
        patientId: p.id,
        originDate: o.originDate,
        date: o.date,
        status: "attended",
        chargedAbsence: false,
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

  /**
   * `paidValue` só vem preenchido quando o usuário escolheu cobrar um valor
   * diferente do cadastro; `null` deixa a falta seguir o `consultationValue`
   * do paciente, como acontece com as sessões atendidas.
   */
  async function markMissed(charged: boolean, paidValue: number | null) {
    try {
      await upsert.mutateAsync({
        seriesId: o.seriesId,
        patientId: p.id,
        originDate: o.originDate,
        date: o.date,
        status: "missed",
        chargedAbsence: charged,
        snapshotItemIds: [],
        checkedItemIds: [],
        // Falta não cobrada não gera receita: um pagamento que porventura
        // estivesse na linha tem de sair junto, senão sobra `paid` sem
        // `isBillable` — a divergência que o KPI "Faturado" não perdoa.
        ...(charged
          ? { paidValue }
          : { paid: false, paidValue: null, paidAt: null, paymentMethodId: null }),
      })
      setMissedOpen(false)
      // Falta cobrada ainda é uma falta: o confete triste continua valendo.
      celebrate("sad")
      toast.success(charged ? "Falta cobrada registrada" : "Falta registrada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  /**
   * Liga/desliga a cobrança de uma falta já registrada (serve também para
   * faltas anteriores a esta funcionalidade). Usa `patch`, não `upsert`: o
   * upsert monta a row inteira e apagaria o pagamento junto.
   *
   * Desligar uma falta já paga limpa o pagamento no mesmo patch — sem isso
   * sobraria uma linha paga que sumiu do ledger mas continuaria somando no
   * KPI "Faturado", e o controle de pagamento (única forma de desfazê-la)
   * teria acabado de sair da tela.
   */
  async function toggleChargedAbsence() {
    if (!appt || patch.isPending) return
    const next = !appt.chargedAbsence
    if (!next && appt.paid) {
      if (
        !(await confirmDialog({
          title: "Deixar de cobrar esta falta",
          description:
            "O pagamento já registrado nesta sessão será desmarcado e a receita sai do financeiro. Continuar?",
          destructive: true,
        }))
      )
        return
    }
    try {
      await patch.mutateAsync({
        id: appt.id,
        patch: next
          ? { chargedAbsence: true }
          : {
              chargedAbsence: false,
              paid: false,
              paidValue: null,
              paidAt: null,
              paymentMethodId: null,
            },
      })
      toast.success(next ? "Falta passou a ser cobrada" : "Falta não será cobrada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  function findConflict(): Occurrence | null {
    return (
      targetOccurrences.find(
        (t) =>
          t.time === reschedTime &&
          !(t.seriesId === o.seriesId && t.originDate === o.originDate),
      ) ?? null
    )
  }

  function closeResched() {
    setReschedOpen(false)
    setReschedDate("")
    setReschedTime("")
    setConflictOpen(false)
    setConflictTarget(null)
    onOpenChange(false)
  }

  // Move a mesma linha para a nova data: status volta a "scheduled" (acionável),
  // rescheduledTo guarda a proveniência ("Reagendado de ...").
  //
  // O pagamento é preservado (antes era apagado sem aviso). Como uma sessão
  // "scheduled" ainda não aconteceu, ela não conta como receita enquanto
  // estiver assim — volta a contar ao ser marcada como atendida na nova data.
  async function doReschedule() {
    if (appt?.paid) {
      if (
        !(await confirmDialog({
          title: "Reagendar sessão paga",
          description:
            "O pagamento registrado será mantido, mas sai do faturamento enquanto a sessão estiver apenas agendada. Ele volta a contar quando você marcar a nova data como atendida.",
          confirmLabel: "Reagendar",
        }))
      )
        return
    }
    try {
      await upsert.mutateAsync({
        seriesId: o.seriesId,
        patientId: p.id,
        originDate: o.originDate,
        date: reschedDate,
        rescheduledTo: reschedDate,
        status: "scheduled",
        chargedAbsence: false,
        time: reschedTime,
      })
      toast.success("Reagendado")
      closeResched()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function reschedule() {
    if (!reschedDate) return toast.error("Selecione uma data")
    if (!reschedTime) return toast.error("Selecione um horário")
    const conflict = findConflict()
    if (conflict) {
      setConflictTarget(conflict)
      setConflictOpen(true)
      return
    }
    await doReschedule()
  }

  // Conflito: manter o atendimento já existente e descartar o que seria movido.
  async function keepExisting() {
    try {
      await undo.mutateAsync({
        seriesId: o.seriesId,
        scope: "one",
        originDate: o.originDate,
      })
      toast.success("Atendimento desfeito")
      closeResched()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  // Conflito: remover o atendimento já existente e concluir o reagendamento.
  async function replaceExisting() {
    if (!conflictTarget) return
    try {
      await undo.mutateAsync({
        seriesId: conflictTarget.seriesId,
        scope: "one",
        originDate: conflictTarget.originDate,
      })
      await doReschedule()
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

  async function changeAvatar(nextAvatarId: number) {
    if (nextAvatarId === p.avatarId) return
    try {
      await updatePatient.mutateAsync({
        id: p.id,
        patch: { avatarId: nextAvatarId },
      })
      toast.success("Avatar atualizado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar avatar")
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
            <AvatarPicker
              value={patient.avatarId}
              onChange={changeAvatar}
              name={patient.name}
              size="lg"
              disabled={updatePatient.isPending}
            />
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
                {[ageLabel(patient.birthdate), genderLabel(patient.gender)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
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
                  {formatLongDateBR(occurrence.date)}
                  {occurrence.time && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      às {occurrence.time}
                    </span>
                  )}
                </p>
                {wasRescheduled && (
                  <p className="mt-1 text-xs text-secondary">
                    Reagendado de {formatLongDateBR(occurrence.originDate)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusPill
                  status={status}
                  isPast={isPast}
                  pendencyCount={occurrence.pendencyCount}
                  chargedAbsence={isChargedAbsence}
                  isUnpaid={isBillableSession && !!appt && !appt.paid}
                />
                <button
                  type="button"
                  onClick={() => setUndoOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  <ArrowUUpLeftIcon weight="fill" className="size-3" />
                  Desfazer
                </button>
              </div>
            </div>
          </div>

          {/* AÇÕES — Atendido/Falta só quando faz sentido; Reagendar sempre */}
          {canAct ? (
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
                onClick={() => setMissedOpen(true)}
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
          ) : (
            <Button
              onClick={() => setReschedOpen((v) => !v)}
              variant="outline"
              className="w-full border-secondary/40 text-secondary hover:bg-secondary/10"
            >
              <CalendarBlankIcon weight="fill" />
              Reagendar
            </Button>
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
                isMissed &&
                  !isChargedAbsence &&
                  "border-border/60 bg-muted/30 text-muted-foreground",
                isChargedAbsence &&
                  "border-amber-500/40 bg-amber-500/10 text-amber-200",
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
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  {isAttended &&
                    "Atendimento concluído. Preencha o checklist abaixo."}
                  {isMissed &&
                    (isChargedAbsence
                      ? "Paciente faltou — esta sessão está sendo cobrada."
                      : "Paciente faltou neste atendimento.")}
                </span>
                {isMissed && (
                  <button
                    type="button"
                    onClick={toggleChargedAbsence}
                    disabled={patch.isPending}
                    className={cn(
                      "inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 font-medium underline-offset-2 transition-colors hover:underline disabled:opacity-60",
                      isChargedAbsence
                        ? "text-amber-200/80 hover:text-amber-100"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {patch.isPending && <Spinner className="size-3" />}
                    {isChargedAbsence ? "Deixar de cobrar" : "Cobrar esta falta"}
                  </button>
                )}
              </span>
            </div>
          )}

          {/* REAGENDAR FORM */}
          {reschedOpen && (
            <div className="rounded-xl border border-secondary/40 bg-secondary/10 p-3">
              <p className="mb-2 text-sm font-medium">Nova data e horário</p>
              <div className="flex gap-2">
                <DatePicker
                  value={reschedDate}
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

          {/* PAGAMENTO — atendido, ou falta que está sendo cobrada */}
          {isBillableSession && appt && (
            <PaymentControl appointment={appt} patient={patient} />
          )}

          {/* CHECKLIST — só quando atendido (falta não preenche checklist) */}
          {isAttended && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">Checklist do dia</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {entries.filter((e) => e.checked).length} / {entries.length}
                </p>
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
          </div>
          )}

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
      <UndoAppointmentDialog
        open={undoOpen}
        onOpenChange={setUndoOpen}
        seriesId={o.seriesId}
        originDate={o.originDate}
        hasOverride={!!appt}
        onDone={() => onOpenChange(false)}
      />
      <RescheduleConflictDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        patientName={p.name}
        targetDate={reschedDate}
        targetTime={reschedTime}
        pending={upsert.isPending || undo.isPending}
        onKeepExisting={keepExisting}
        onReplaceExisting={replaceExisting}
      />
      <MissedAppointmentDialog
        open={missedOpen}
        onOpenChange={setMissedOpen}
        patientName={p.name}
        consultationValue={p.consultationValue ?? 0}
        pending={upsert.isPending}
        onConfirm={markMissed}
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
  isPast,
  pendencyCount,
  chargedAbsence,
  isUnpaid,
}: {
  status: Appointment["status"] | null
  isPast: boolean
  pendencyCount: number
  chargedAbsence: boolean
  isUnpaid: boolean
}) {
  // Só atendido exibe pendências de checklist.
  if (status === "attended" && pendencyCount > 0) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/20 px-2.5 py-1 text-xs font-medium text-destructive">
          <WarningIcon weight="fill" className="size-3" />
          {pendencyCount} pendência{pendencyCount === 1 ? "" : "s"}
        </span>
        {isUnpaid && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
            <CurrencyDollarIcon weight="fill" className="size-3" />
            Não pago
          </span>
        )}
      </div>
    )
  }
  if (status === "attended" && isUnpaid) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
        <CurrencyDollarIcon weight="fill" className="size-3" />
        Atendido · não pago
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
  // Falta cobrada vem antes da falta comum: continua sendo falta, mas o que
  // importa ler aqui é o estado do dinheiro.
  if (status === "missed" && chargedAbsence) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
          isUnpaid
            ? "bg-amber-500/20 text-amber-300"
            : "bg-emerald-500/20 text-emerald-400",
        )}
      >
        <ProhibitIcon weight="fill" className="size-3" />
        {isUnpaid ? "Falta cobrada · não paga" : "Falta cobrada · paga"}
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
  // scheduled / sem linha
  if (isPast) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-300">
        <WarningIcon weight="fill" className="size-3" />
        Pendente
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
      <ClockIcon weight="fill" className="size-3" />
      A atender
    </span>
  )
}
