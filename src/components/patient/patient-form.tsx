import { useEffect, useMemo, useRef, useState } from "react"
import { Reorder, useDragControls } from "framer-motion"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  DotsSixVerticalIcon,
  IdentificationCardIcon,
  ListChecksIcon,
  PaperclipIcon,
  PlusIcon,
  SealCheckIcon,
  TrashIcon,
  UserCircleIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import type { Gender, IndividualChecklistItem, Patient } from "@/db/types"
import {
  useAppointmentSeries,
  useAppointmentsInRange,
  useArchiveIndividualItem,
  useCreateIndividualItem,
  useCreatePatient,
  useDeleteIndividualItemPermanent,
  useDeletePatientPermanently,
  useDischargePatient,
  useDischargeReasons,
  useIndividualChecklist,
  useInsurances,
  usePatients,
  useReopenPatient,
  useReorderIndividualItems,
  useUpdatePatient,
} from "@/api/queries"
import { nextOrder } from "@/lib/checklist"
import { occurrencesForPatient } from "@/domain/recurrence"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group"
import { todayISO, formatDateBR } from "@/domain/dates"
import { randomMonsterAvatarId } from "@/lib/monster-avatars"
import { formatCpf, isValidCpf, onlyDigits } from "@/lib/cpf"
import { cn } from "@/lib/utils"
import { PatientDocuments } from "./patient-documents"
import { AvatarPicker } from "./avatar-picker"
import { confirmDialog } from "@/components/ui/confirm-dialog"

type TabKey = "dados" | "checklist" | "documentos"

interface Props {
  patient?: Patient
  onDone: () => void
}

function SectionBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: PhosphorIcon
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <Icon weight="fill" className="size-4 shrink-0 text-primary" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function SortableIndivRow({
  item,
  onDragEnd,
  onArchive,
  onDeletePermanent,
}: {
  item: IndividualChecklistItem
  onDragEnd: () => void
  onArchive: () => void
  onDeletePermanent: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      as="div"
      className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
    >
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        onPointerDown={(e) => controls.start(e)}
        className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted/40 active:cursor-grabbing"
      >
        <DotsSixVerticalIcon weight="bold" className="size-4" />
      </button>
      <span className="flex-1 text-sm">{item.label}</span>
      <button
        type="button"
        onClick={onArchive}
        aria-label="Arquivar"
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-amber-500/15 hover:text-amber-500"
      >
        <ArchiveIcon weight="fill" className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onDeletePermanent}
        aria-label="Excluir permanentemente"
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
      >
        <TrashIcon weight="fill" className="size-3.5" />
      </button>
    </Reorder.Item>
  )
}

export function PatientForm({ patient: patientProp, onDone }: Props) {
  const patientsQ = usePatients({ enabled: !!patientProp })
  const patient = patientProp
    ? patientsQ.data?.find((p) => p.id === patientProp.id) ?? patientProp
    : undefined
  const isEdit = !!patient
  const [tab, setTab] = useState<TabKey>("dados")
  const [name, setName] = useState(patient?.name ?? "")
  const [gender, setGender] = useState<Gender>(patient?.gender ?? "female")
  const [avatarId, setAvatarId] = useState<number>(
    patient?.avatarId ?? randomMonsterAvatarId(),
  )
  const [birthdate, setBirthdate] = useState<string>(patient?.birthdate ?? "")
  const [cpf, setCpf] = useState<string>(formatCpf(patient?.cpf ?? ""))
  const [payerSameAsPatient, setPayerSameAsPatient] = useState<boolean>(
    patient ? !patient.payerCpf : true,
  )
  const [payerCpf, setPayerCpf] = useState<string>(
    formatCpf(patient?.payerCpf ?? ""),
  )
  const [consultationValue, setConsultationValue] = useState<string>(
    patient ? String(patient.consultationValue ?? 0) : "0",
  )
  const [insuranceId, setInsuranceId] = useState<string>(
    patient?.insuranceId ?? "__none__",
  )
  const [newItem, setNewItem] = useState("")
  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [dischargeDate, setDischargeDate] = useState<string>(todayISO())
  const [dischargeReasonId, setDischargeReasonId] = useState<string>("")

  const createMut = useCreatePatient()
  const updateMut = useUpdatePatient()
  const dischargeMut = useDischargePatient()
  const reopenMut = useReopenPatient()
  const deletePermanentMut = useDeletePatientPermanently()
  const indivQ = useIndividualChecklist(patient?.id)
  const addItemMut = useCreateIndividualItem()
  const archiveItemMut = useArchiveIndividualItem()
  const reorderItemMut = useReorderIndividualItems()
  const deleteItemPermanentMut = useDeleteIndividualItemPermanent()
  const insurancesQ = useInsurances()
  const reasonsQ = useDischargeReasons()

  // Forecast future occurrences for discharge dialog
  const dischargeForecastRange = useMemo(() => {
    const start = dischargeDate || todayISO()
    const end = new Date(start + "T00:00:00Z")
    end.setUTCFullYear(end.getUTCFullYear() + 2)
    return { from: start, to: end.toISOString().slice(0, 10) }
  }, [dischargeDate])
  const dischargeSeriesQ = useAppointmentSeries(patient?.id)
  const dischargeApptsQ = useAppointmentsInRange(
    dischargeForecastRange.from,
    dischargeForecastRange.to,
  )
  const futureOccurrenceCount = useMemo(() => {
    if (!patient) return 0
    if (!dischargeDate) return 0
    const series = dischargeSeriesQ.data ?? []
    const appts = (dischargeApptsQ.data ?? []).filter(
      (a) => a.patientId === patient.id,
    )
    const occs = occurrencesForPatient(
      { ...patient, dischargedAt: null },
      series,
      { fromISO: dischargeForecastRange.from, toISO: dischargeForecastRange.to },
      appts,
    )
    let n = 0
    for (const o of occs) {
      if (o.date <= dischargeDate) continue
      const a = o.appointment
      if (!a || a.status === "scheduled" || a.status === "rescheduled") n++
    }
    return n
  }, [
    patient,
    dischargeDate,
    dischargeForecastRange,
    dischargeSeriesQ.data,
    dischargeApptsQ.data,
  ])

  useEffect(() => {
    if (patient) {
      setAvatarId(patient.avatarId)
      return
    }
    setName("")
    setGender("female")
    setAvatarId(randomMonsterAvatarId())
    setBirthdate("")
    setCpf("")
    setPayerSameAsPatient(true)
    setPayerCpf("")
    setConsultationValue("0")
    setInsuranceId("__none__")
    setTab("dados")
  }, [patient])

  function bumpValue(delta: number) {
    const current = Number(consultationValue) || 0
    setConsultationValue(String(current + delta))
  }

  function onInsuranceChange(next: string) {
    setInsuranceId(next)
    if (next === "__none__") return
    const ins = (insurancesQ.data ?? []).find((i) => i.id === next)
    if (ins && ins.defaultValue > 0) {
      setConsultationValue(String(ins.defaultValue))
    }
  }

  async function confirmDischarge() {
    if (!patient) return
    if (!dischargeReasonId) return toast.error("Selecione um motivo")
    if (!dischargeDate) return toast.error("Informe a data")
    const n = futureOccurrenceCount
    const futureMsg =
      n === 0
        ? "Nenhum atendimento futuro a remover."
        : n === 1
        ? "1 atendimento futuro será deletado permanentemente."
        : `${n} atendimentos futuros serão deletados permanentemente.`
    if (
      !(await confirmDialog({
        title: "Encerrar tratamento?",
        description: `Encerrando em ${formatDateBR(dischargeDate)}. ${futureMsg} Atendimentos passados permanecem para histórico. Você poderá reabrir o tratamento depois.`,
        confirmLabel: "Encerrar",
        cancelLabel: "Cancelar",
        destructive: n > 0,
      }))
    )
      return
    try {
      const result = await dischargeMut.mutateAsync({
        id: patient.id,
        dischargedAt: dischargeDate,
        dischargeReasonId,
      })
      setDischargeOpen(false)
      const removed = result.deletedAppointments
      toast.success(
        removed > 0
          ? `Tratamento encerrado · ${removed} atendimento${removed === 1 ? "" : "s"} removido${removed === 1 ? "" : "s"}`
          : "Tratamento encerrado",
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function undoDischarge() {
    if (!patient) return
    if (
      !(await confirmDialog({
        title: "Reabrir tratamento",
        description: "Reabrir tratamento deste paciente?",
      }))
    )
      return
    try {
      await reopenMut.mutateAsync(patient.id)
      toast.success("Tratamento reaberto")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function confirmPermanentDelete() {
    if (!patient) return
    if (
      !(await confirmDialog({
        title: "Excluir paciente permanentemente?",
        description:
          "Esta ação é irreversível. Todos os dados deste paciente serão apagados: atendimentos passados e futuros, anotações, checklist individual e documentos anexados. O cadastro também será removido.",
        confirmLabel: "Excluir definitivamente",
        cancelLabel: "Cancelar",
        destructive: true,
      }))
    )
      return
    try {
      await deletePermanentMut.mutateAsync(patient.id)
      toast.success("Paciente excluído")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir")
    }
  }

  function validateBirthdate(iso: string): string | null {
    if (!iso) return "Informe a data de nascimento"
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return "Data inválida"
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (y < 1900 || y > new Date().getFullYear())
      return "Ano fora do intervalo"
    const date = new Date(y, mo - 1, d)
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== mo - 1 ||
      date.getDate() !== d
    )
      return "Data inválida"
    if (iso > todayISO()) return "Data não pode estar no futuro"
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error("Nome é obrigatório")
    const bdErr = validateBirthdate(birthdate)
    if (bdErr) return toast.error(bdErr)
    const valueNum = Number(consultationValue)
    if (!Number.isFinite(valueNum) || valueNum < 0)
      return toast.error("Valor de consulta inválido")
    const cpfDigits = onlyDigits(cpf)
    if (cpfDigits && !isValidCpf(cpfDigits))
      return toast.error("CPF do paciente inválido")
    const payerDigits = payerSameAsPatient ? "" : onlyDigits(payerCpf)
    if (payerDigits && !isValidCpf(payerDigits))
      return toast.error("CPF do pagador inválido")
    const cpfFinal = cpfDigits || null
    // null = pagador é o mesmo que o paciente
    const payerCpfFinal = payerSameAsPatient ? null : payerDigits || null
    const insuranceFinal = insuranceId === "__none__" ? null : insuranceId
    try {
      if (isEdit && patient) {
        await updateMut.mutateAsync({
          id: patient.id,
          patch: {
            name: name.trim(),
            gender,
            avatarId,
            birthdate,
            cpf: cpfFinal,
            payerCpf: payerCpfFinal,
            consultationValue: valueNum,
            insuranceId: insuranceFinal,
          },
        })
        toast.success("Paciente atualizado")
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          gender,
          avatarId,
          birthdate,
          cpf: cpfFinal,
          payerCpf: payerCpfFinal,
          individualChecklistItemIds: [],
          active: true,
          consultationValue: valueNum,
          insuranceId: insuranceFinal,
          dischargedAt: null,
          dischargeReasonId: null,
        })
        toast.success("Paciente cadastrado")
      }
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  async function addIndividualItem() {
    if (!patient || !newItem.trim()) return
    try {
      await addItemMut.mutateAsync({
        patientId: patient.id,
        label: newItem.trim(),
        order: nextOrder(indivQ.data ?? []),
        archived: false,
      })
      setNewItem("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function onDeleteItemPermanent(item: IndividualChecklistItem) {
    const ok = await confirmDialog({
      title: "Excluir permanentemente",
      description: `Excluir "${item.label}" para sempre? Todo registro deste item será removido do sistema, inclusive de atendimentos passados, como se nunca tivesse existido. Para manter o histórico, use Arquivar.`,
      destructive: true,
      confirmLabel: "Excluir definitivamente",
    })
    if (!ok) return
    deleteItemPermanentMut.mutate(item.id, {
      onSuccess: () => toast.success("Item excluído permanentemente"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Erro"),
    })
  }

  const saving = createMut.isPending || updateMut.isPending
  const activeItems = (indivQ.data ?? [])
    .filter((i) => !i.archived)
    .slice()
    .sort((a, b) => a.order - b.order)

  // Local order for drag; re-synced from server whenever data changes.
  const [orderedItems, setOrderedItems] = useState<IndividualChecklistItem[]>(
    [],
  )
  const orderedItemsRef = useRef<IndividualChecklistItem[]>([])
  orderedItemsRef.current = orderedItems
  useEffect(() => {
    setOrderedItems(
      (indivQ.data ?? [])
        .filter((i) => !i.archived)
        .slice()
        .sort((a, b) => a.order - b.order),
    )
  }, [indivQ.data])

  function persistItemOrder() {
    if (!patient) return
    reorderItemMut.mutate({
      patientId: patient.id,
      ids: orderedItemsRef.current.map((i) => i.id),
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
      {isEdit && (
        <div className="flex gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
          <TabButton
            active={tab === "dados"}
            onClick={() => setTab("dados")}
            icon={UserCircleIcon}
            label="Dados"
          />
          <TabButton
            active={tab === "checklist"}
            onClick={() => setTab("checklist")}
            icon={ListChecksIcon}
            label={`Checklist${activeItems.length > 0 ? ` (${activeItems.length})` : ""}`}
          />
          <TabButton
            active={tab === "documentos"}
            onClick={() => setTab("documentos")}
            icon={PaperclipIcon}
            label="Documentos"
          />
        </div>
      )}

      {tab === "dados" && (
        <>
          <SectionBlock title="Identificação" icon={UserCircleIcon}>
            <div className="flex flex-col items-center gap-1 pb-1">
              <AvatarPicker
                value={avatarId}
                onChange={setAvatarId}
                name={name}
                size="lg"
              />
              <p className="text-[11px] text-muted-foreground">
                Toque para escolher o avatar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gênero</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={(v) => setGender(v as Gender)}
                  className="flex gap-3 pt-2"
                >
                  {(["female", "male", "other"] as Gender[]).map((g) => (
                    <label
                      key={g}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <RadioGroupItem value={g} id={`g-${g}`} />
                      {g === "female" ? "F" : g === "male" ? "M" : "Outro"}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">Data de nascimento</Label>
                <DatePicker
                  id="birthdate"
                  value={birthdate}
                  onChange={setBirthdate}
                  max={todayISO()}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">
                CPF{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input
                id="cpf"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={payerSameAsPatient}
                onCheckedChange={(v) => setPayerSameAsPatient(v === true)}
              />
              <span>CPF do pagador é o mesmo do paciente</span>
            </label>

            {!payerSameAsPatient && (
              <div className="space-y-2">
                <Label htmlFor="payer-cpf">
                  CPF do pagador{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>
                <Input
                  id="payer-cpf"
                  inputMode="numeric"
                  value={payerCpf}
                  onChange={(e) => setPayerCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
            )}
          </SectionBlock>

          <SectionBlock title="Financeiro" icon={IdentificationCardIcon}>
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select value={insuranceId} onValueChange={onInsuranceChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Particular</SelectItem>
                  {(insurancesQ.data ?? [])
                    .filter(
                      (i) =>
                        i.active || i.id === (patient?.insuranceId ?? ""),
                    )
                    .map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                        {i.defaultValue > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (R$ {i.defaultValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </span>
                        )}
                        {!i.active && " (arquivado)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O valor padrão do convênio preenche o campo abaixo
                automaticamente, mas pode ser ajustado.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Valor da consulta (R$)</Label>
              <div className="flex gap-2">
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  min={0}
                  value={consultationValue}
                  onChange={(e) => setConsultationValue(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bumpValue(110)}
                  className="shrink-0"
                >
                  +110
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bumpValue(80)}
                  className="shrink-0"
                >
                  +80
                </Button>
              </div>
            </div>
          </SectionBlock>

          {isEdit && patient && (
            <SectionBlock title="Tratamento" icon={SealCheckIcon}>
              {patient.dischargedAt ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2.5">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-secondary">
                      Encerrado em {formatDateBR(patient.dischargedAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Motivo:{" "}
                      {(reasonsQ.data ?? []).find(
                        (r) => r.id === patient.dischargeReasonId,
                      )?.name ?? "—"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={undoDischarge}
                  >
                    <ArrowCounterClockwiseIcon weight="fill" />
                    Reabrir
                  </Button>
                </div>
              ) : dischargeOpen ? (
                <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm font-medium">Encerrar tratamento</p>
                  <p className="text-xs text-muted-foreground">
                    Todos os atendimentos futuros deste paciente serão
                    cancelados. O cadastro permanece para reagendamento.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Data
                      </label>
                      <DatePicker
                        value={dischargeDate}
                        onChange={setDischargeDate}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Motivo
                      </label>
                      <Select
                        value={dischargeReasonId}
                        onValueChange={setDischargeReasonId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(reasonsQ.data ?? [])
                            .filter((r) => r.active)
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDischargeOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={confirmDischarge}
                      disabled={dischargeMut.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDischargeOpen(true)}
                  className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <SealCheckIcon weight="fill" />
                  Encerrar tratamento
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={confirmPermanentDelete}
                disabled={deletePermanentMut.isPending}
                className="mt-3 w-full justify-center border-destructive/60 bg-destructive/5 text-destructive hover:bg-destructive/15"
              >
                <TrashIcon weight="fill" />
                Excluir permanentemente
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Excluir remove o paciente e todos os dados associados
                (atendimentos, anotações, documentos). Ação irreversível.
              </p>
            </SectionBlock>
          )}
        </>
      )}

      {isEdit && tab === "checklist" && (
        <SectionBlock title="Checklist individual" icon={ListChecksIcon}>
          <div className="space-y-1.5">
            {orderedItems.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sem itens individuais (default vazio).
              </p>
            )}
            <Reorder.Group
              axis="y"
              values={orderedItems}
              onReorder={setOrderedItems}
              as="div"
              className="space-y-1.5"
            >
              {orderedItems.map((it) => (
                <SortableIndivRow
                  key={it.id}
                  item={it}
                  onDragEnd={persistItemOrder}
                  onArchive={() => archiveItemMut.mutate(it.id)}
                  onDeletePermanent={() => onDeleteItemPermanent(it)}
                />
              ))}
            </Reorder.Group>
          </div>
          <div className="flex gap-2 pt-1">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Novo item individual..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addIndividualItem()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addIndividualItem}
              disabled={!newItem.trim() || addItemMut.isPending}
            >
              <PlusIcon weight="bold" />
            </Button>
          </div>
        </SectionBlock>
      )}

      {isEdit && tab === "documentos" && patient && (
        <SectionBlock title="Documentos" icon={PaperclipIcon}>
          <PatientDocuments patientId={patient.id} />
        </SectionBlock>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: PhosphorIcon
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <Icon
        weight="fill"
        className={cn("size-4", active ? "text-primary" : "")}
      />
      <span>{label}</span>
    </button>
  )
}
