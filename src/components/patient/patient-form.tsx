import { useEffect, useMemo, useRef, useState } from "react"
import { Reorder, useDragControls } from "framer-motion"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  DotsSixVerticalIcon,
  IdentificationCardIcon,
  ListChecksIcon,
  PackageIcon,
  PaperclipIcon,
  PlusIcon,
  SealCheckIcon,
  TrashIcon,
  UserCircleIcon,
  UserIcon,
  UsersIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import type {
  Gender,
  IndividualChecklistItem,
  Patient,
  PatientKind,
} from "@/db/types"
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
  useSessionPackages,
  useUpdatePatient,
} from "@/api/queries"
import { packageRemaining, packagesOfPatient } from "@/domain/packages"
import { PatientPackages } from "@/components/packages/patient-packages"
import { nextOrder } from "@/lib/checklist"
import { occurrencesForPatient } from "@/domain/recurrence"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/ui/copy-button"
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
import { DischargeReasonField } from "./discharge-reason-field"
import { ClientAvatar } from "./patient-avatar"
import { UnarchivePatientDialog } from "./unarchive-patient-dialog"
import {
  CoupleMembersField,
  draftName,
  draftsFromMembers,
  draftsToMembers,
  membersError,
  newMemberDraft,
  type MemberDraft,
} from "./couple-members-field"
import {
  coupleAutoName,
  couplesOfPatient,
  firstName,
  splitCoupleName,
} from "@/domain/couples"
import { birthdateError } from "@/domain/age"
import { confirmDialog } from "@/components/ui/confirm-dialog"

type TabKey = "dados" | "checklist" | "pacotes" | "documentos"

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
  // Sempre carregado: o casal vincula pessoas a cadastros individuais.
  const patientsQ = usePatients()
  const navigate = useNavigate()
  const patient = patientProp
    ? patientsQ.data?.find((p) => p.id === patientProp.id) ?? patientProp
    : undefined
  const isEdit = !!patient
  const allPatients = useMemo(() => patientsQ.data ?? [], [patientsQ.data])
  const patientsById = useMemo(
    () => new Map(allPatients.map((p) => [p.id, p] as const)),
    [allPatients],
  )
  const [tab, setTab] = useState<TabKey>("dados")
  const [name, setName] = useState(patient?.name ?? "")
  // Nome do casal num estado próprio: tocar em Casal e voltar para
  // Individual não pode reescrever o nome da pessoa.
  const [coupleName, setCoupleName] = useState(
    patient?.kind === "couple" ? patient.name : "",
  )
  const [kind, setKind] = useState<PatientKind>(patient?.kind ?? "individual")
  const [drafts, setDrafts] = useState<MemberDraft[]>(() =>
    patient?.kind === "couple" ? draftsFromMembers(patient.members) : [],
  )
  // O nome do casal acompanha as pessoas até a psicóloga escrever o dela.
  const [nameAuto, setNameAuto] = useState<boolean>(
    () =>
      !patient ||
      (patient.kind === "couple" &&
        patient.name === coupleAutoName(patient.members)),
  )
  const [submitted, setSubmitted] = useState(false)
  const isCoupleForm = kind === "couple"
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
  const [dischargeSubmitted, setDischargeSubmitted] = useState(false)
  const [unarchiveOpen, setUnarchiveOpen] = useState(false)

  // Fecha/reabre limpo: nenhum resto da tentativa anterior.
  useEffect(() => {
    if (dischargeOpen) return
    setDischargeReasonId("")
    setDischargeSubmitted(false)
  }, [dischargeOpen])

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
  const packagesQ = useSessionPackages()

  // Pacotes do paciente que ainda têm sessão para realizar.
  const openPackages = useMemo(
    () =>
      patient
        ? packagesOfPatient(packagesQ.data ?? [], patient.id).filter(
            (k) => packageRemaining(k) > 0,
          )
        : [],
    [packagesQ.data, patient],
  )
  const openPackageCount = openPackages.length
  const openPackageSessions = openPackages.reduce(
    (n, k) => n + packageRemaining(k),
    0,
  )

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
    setCoupleName("")
    setKind("individual")
    setDrafts([])
    setNameAuto(true)
    setSubmitted(false)
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

  const autoName = useMemo(
    () =>
      coupleAutoName(drafts.map((d) => ({ name: draftName(d, patientsById) }))),
    [drafts, patientsById],
  )
  useEffect(() => {
    if (isCoupleForm && nameAuto) setCoupleName(autoName)
  }, [isCoupleForm, nameAuto, autoName])

  // Pacientes individuais que podem ser uma das pessoas do casal.
  const linkable = useMemo(
    () =>
      allPatients
        .filter((p) => p.active && p.kind === "individual" && p.id !== patient?.id)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [allPatients, patient?.id],
  )

  // Casais de que este paciente individual faz parte.
  const couplesOfThis = useMemo(
    () =>
      patient && patient.kind === "individual"
        ? couplesOfPatient(patient.id, allPatients)
        : [],
    [patient, allPatients],
  )

  /**
   * Individual ↔ Casal. Vale também na edição: é assim que um cadastro feito
   * como contorno ("Ana e Bruno", gênero "Outro") vira casal sem perder agenda,
   * pagamentos e histórico — o id é o mesmo.
   */
  function changeKind(next: PatientKind) {
    if (next === kind) return
    // (2) Quem já é pessoa vinculada em outro casal continua individual: se o
    // cadastro dele virasse casal, aquele casal passaria a ler os dados deste.
    if (next === "couple" && couplesOfThis.length > 0) {
      toast.error(
        `${firstName(name) || "Este paciente"} faz parte do casal ${couplesOfThis[0].name}. Para atendê-lo(a) em casal com outra pessoa, cadastre um novo casal e vincule este cadastro.`,
      )
      return
    }
    // Ainda não há ninguém preenchido (ex.: tocou em Casal, voltou, digitou
    // o nome da pessoa e tocou de novo)? Monta as pessoas a partir de agora.
    const blank = drafts.every((d) => !d.name.trim() && !d.patientId)
    if (next === "couple" && blank) {
      const parts = splitCoupleName(name)
      const firstData = {
        cpf,
        birthdate,
        // "Outro" era como o contorno marcava o casal — não é da pessoa.
        gender: gender === "other" ? null : gender,
        avatarId,
      }
      if (parts.length >= 2) {
        setDrafts(
          parts.map((n, i) =>
            newMemberDraft(i === 0 ? { name: n, ...firstData } : { name: n }),
          ),
        )
        // Mantém o nome que ela já usava ("Ana e Bruno").
        setCoupleName(name.trim())
        setNameAuto(false)
      } else {
        const typed = name.trim()
        setDrafts([
          newMemberDraft(typed ? { name: typed, ...firstData } : {}),
          newMemberDraft(),
        ])
        setNameAuto(true)
      }
      // Quem pagava era o próprio paciente: o CPF dele segue como pagador.
      if (payerSameAsPatient && onlyDigits(cpf)) setPayerCpf(cpf)
    }
    if (next === "individual" && patient?.kind === "couple" && drafts[0]) {
      // Os campos individuais de um casal gravado são só marcadores; parte
      // dos dados da primeira pessoa.
      const d = drafts[0]
      setGender(d.gender ?? "female")
      setBirthdate(d.birthdate)
      setCpf(d.cpf)
      setAvatarId(d.avatarId)
      setPayerSameAsPatient(!payerCpf)
    }
    setSubmitted(false)
    setKind(next)
  }

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

  // Vale só um motivo que ainda existe e está ativo: se o escolhido foi
  // arquivado em outra aba, confirmar gravaria um id que ninguém mais vê.
  const selectedReason =
    (reasonsQ.data ?? []).find(
      (r) => r.active && r.id === dischargeReasonId,
    ) ?? null

  async function confirmDischarge() {
    if (!patient || dischargeMut.isPending) return
    setDischargeSubmitted(true)
    if (!selectedReason) return toast.error("Escolha o motivo do encerramento")
    if (!dischargeDate) return toast.error("Informe a data")
    const n = futureOccurrenceCount
    const futureMsg =
      n === 0
        ? "Nenhum atendimento futuro a remover."
        : n === 1
        ? "1 atendimento futuro será deletado permanentemente."
        : `${n} atendimentos futuros serão deletados permanentemente.`
    const packageMsg =
      openPackageSessions === 0
        ? ""
        : openPackageSessions === 1
          ? " Atenção: resta 1 sessão de pacote já paga e ainda não realizada."
          : ` Atenção: restam ${openPackageSessions} sessões de pacote já pagas e ainda não realizadas.`
    if (
      !(await confirmDialog({
        title: "Encerrar tratamento?",
        description: `Encerrando em ${formatDateBR(dischargeDate)}. ${futureMsg} Atendimentos passados permanecem para histórico. Você poderá reabrir o tratamento depois.${packageMsg}`,
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
        dischargeReasonId: selectedReason.id,
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (isCoupleForm) return submitCouple()
    if (!name.trim()) return toast.error("Nome é obrigatório")
    // Nascimento é opcional: só validamos o que foi preenchido.
    const bdErr = birthdateError(birthdate, todayISO())
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
    // nascimento é opcional — vazio grava null
    const birthdateFinal = birthdate || null
    const insuranceFinal = insuranceId === "__none__" ? null : insuranceId
    if (
      patient?.kind === "couple" &&
      !(await confirmDialog({
        title: "Transformar em cadastro individual?",
        description:
          "As pessoas do casal saem deste cadastro. Agenda, pagamentos, pacotes e anotações continuam como estão.",
        confirmLabel: "Transformar",
      }))
    )
      return
    try {
      if (isEdit && patient) {
        await updateMut.mutateAsync({
          id: patient.id,
          patch: {
            name: name.trim(),
            gender,
            avatarId,
            birthdate: birthdateFinal,
            cpf: cpfFinal,
            payerCpf: payerCpfFinal,
            consultationValue: valueNum,
            insuranceId: insuranceFinal,
            // Só quando está deixando de ser casal: um formulário velho aberto
            // em outro aparelho não pode desfazer uma conversão feita aqui.
            ...(patient.kind === "couple"
              ? { kind: "individual" as const, members: [] }
              : {}),
          },
        })
        toast.success("Paciente atualizado")
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          gender,
          avatarId,
          birthdate: birthdateFinal,
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

  async function submitCouple() {
    const err = membersError(drafts, patientsById)
    if (err) return toast.error(err)
    const finalName = (coupleName.trim() || autoName).trim()
    if (!finalName) return toast.error("Informe o nome do casal")
    const valueNum = Number(consultationValue)
    if (!Number.isFinite(valueNum) || valueNum < 0)
      return toast.error("Valor de consulta inválido")
    const payerDigits = onlyDigits(payerCpf)
    if (payerDigits && !isValidCpf(payerDigits))
      return toast.error("CPF do pagador inválido")
    const members = draftsToMembers(drafts, patientsById)
    const fields = {
      name: finalName,
      kind: "couple" as const,
      members,
      // Campos de pessoa não se aplicam ao casal: ficam neutros, e quem
      // abrir o cadastro num app antigo vê o mesmo que via no contorno.
      gender: "other" as const,
      birthdate: null,
      cpf: null,
      avatarId: members[0].avatarId,
      payerCpf: payerDigits || null,
      consultationValue: valueNum,
      insuranceId: insuranceId === "__none__" ? null : insuranceId,
    }
    try {
      if (isEdit && patient) {
        await updateMut.mutateAsync({ id: patient.id, patch: fields })
        toast.success(
          patient.kind === "couple"
            ? "Casal atualizado"
            : "Cadastro transformado em casal",
        )
      } else {
        await createMut.mutateAsync({
          ...fields,
          individualChecklistItemIds: [],
          active: true,
          dischargedAt: null,
          dischargeReasonId: null,
        })
        toast.success("Casal cadastrado")
      }
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar")
    }
  }

  // CPFs das pessoas, para preencher o pagador com um toque.
  const memberCpfs = drafts
    .map((d) => {
      const linked = d.patientId ? patientsById.get(d.patientId) : undefined
      const digits = linked ? (linked.cpf ?? "") : onlyDigits(d.cpf)
      return { name: firstName(draftName(d, patientsById)), digits }
    })
    .filter((m) => m.digits && isValidCpf(m.digits))

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
      {/* Acima das abas: vale para o cadastro inteiro, não só para "Dados". */}
      {isEdit && patient && !patient.active && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="font-medium">Paciente arquivado</p>
            <p className="text-xs text-muted-foreground">
              Fora da agenda, do dashboard e das listas.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setUnarchiveOpen(true)}
          >
            <ArrowCounterClockwiseIcon weight="fill" />
            Desarquivar
          </Button>
        </div>
      )}

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
            active={tab === "pacotes"}
            onClick={() => setTab("pacotes")}
            icon={PackageIcon}
            label={`Pacotes${openPackageCount > 0 ? ` (${openPackageCount})` : ""}`}
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
            <div
              role="radiogroup"
              aria-label="Tipo de atendimento"
              className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/40 p-1"
            >
              {(
                [
                  { id: "individual", label: "Individual", icon: UserIcon },
                  { id: "couple", label: "Casal", icon: UsersIcon },
                ] as const
              ).map((k) => {
                const on = kind === k.id
                const KIcon = k.icon
                return (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => changeKind(k.id)}
                    className={cn(
                      "flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                      on
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <KIcon
                      weight="fill"
                      className={cn("size-4", on && "text-primary")}
                    />
                    {k.label}
                  </button>
                )
              })}
            </div>

            {isCoupleForm ? (
              <>
                <div className="flex flex-col items-center gap-1 pb-1">
                  <ClientAvatar
                    patient={{
                      kind: "couple",
                      name: coupleName,
                      avatarId: drafts[0]?.avatarId ?? avatarId,
                      members: draftsToMembers(drafts, patientsById),
                    }}
                    size="lg"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Os avatares são escolhidos em cada pessoa
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome do casal</Label>
                  <Input
                    id="name"
                    value={coupleName}
                    onChange={(e) => {
                      setCoupleName(e.target.value)
                      setNameAuto(false)
                    }}
                    // Saiu do campo vazio? Volta a acompanhar os nomes. No
                    // onChange não: apagar para reescrever voltaria a encher.
                    onBlur={() => {
                      if (!coupleName.trim()) setNameAuto(true)
                    }}
                    placeholder={autoName || "Ex.: Ana & Bruno"}
                  />
                  {nameAuto ? (
                    <p className="text-xs text-muted-foreground">
                      Montado com os nomes abaixo. Pode trocar — ex.: “Casal
                      Souza”.
                    </p>
                  ) : (
                    autoName &&
                    coupleName !== autoName && (
                      <button
                        type="button"
                        onClick={() => setNameAuto(true)}
                        className="inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
                      >
                        Usar “{autoName}”
                      </button>
                    )
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Pessoas do casal</p>
                  <CoupleMembersField
                    drafts={drafts}
                    onChange={setDrafts}
                    linkable={linkable}
                    patientsById={patientsById}
                    submitted={submitted}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payer-cpf">
                    CPF de quem paga{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="payer-cpf"
                      inputMode="numeric"
                      value={payerCpf}
                      onChange={(e) => setPayerCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                    <CopyButton
                      variant="boxed"
                      value={payerCpf}
                      label="CPF do pagador"
                      disabled={!payerCpf}
                    />
                  </div>
                  {memberCpfs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {memberCpfs.map((m) => {
                        const on = onlyDigits(payerCpf) === m.digits
                        return (
                          <button
                            key={m.digits}
                            type="button"
                            onClick={() => setPayerCpf(formatCpf(m.digits))}
                            className={cn(
                              "inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
                              on
                                ? "border-primary/60 bg-primary/15 text-foreground"
                                : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                            )}
                          >
                            {on ? "Paga: " : "Usar CPF de "}
                            {m.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
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

                {/* Uma coluna no celular: lado a lado, o rótulo do nascimento
                    quebrava em duas linhas e passava por cima do gênero. */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <Label htmlFor="birthdate">
                      Data de nascimento{" "}
                      <span className="font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </Label>
                    <DatePicker
                      id="birthdate"
                      value={birthdate}
                      onChange={setBirthdate}
                      max={todayISO()}
                      clearable
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
                  <div className="flex items-center gap-2">
                    <Input
                      id="cpf"
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                    <CopyButton
                      variant="boxed"
                      value={cpf}
                      label="CPF"
                      disabled={!cpf}
                    />
                  </div>
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
                    <div className="flex items-center gap-2">
                      <Input
                        id="payer-cpf"
                        inputMode="numeric"
                        value={payerCpf}
                        onChange={(e) => setPayerCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                      />
                      <CopyButton
                        variant="boxed"
                        value={payerCpf}
                        label="CPF do pagador"
                        disabled={!payerCpf}
                      />
                    </div>
                  </div>
                )}

                {couplesOfThis.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                      <UsersIcon weight="fill" className="size-3.5" />
                      Também em terapia de casal
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {couplesOfThis.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => navigate(`/patients?edit=${c.id}`)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 text-xs font-medium hover:bg-muted/40"
                        >
                          <ClientAvatar patient={c} size="sm" />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Data
                    </label>
                    <DatePicker
                      value={dischargeDate}
                      onChange={setDischargeDate}
                    />
                  </div>

                  <DischargeReasonField
                    value={dischargeReasonId}
                    onChange={setDischargeReasonId}
                    showError={dischargeSubmitted && !selectedReason}
                  />

                  {/* linha, não coluna: `flex-1` num container de coluna
                      zeraria a base de altura e os botões encolhiam abaixo do
                      alvo de toque. */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDischargeOpen(false)}
                      disabled={dischargeMut.isPending}
                      className="h-11 flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={confirmDischarge}
                      loading={dischargeMut.isPending}
                      className="h-11 flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Encerrar
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

      {isEdit && tab === "pacotes" && patient && (
        <SectionBlock title="Pacotes de sessões" icon={PackageIcon}>
          <PatientPackages patient={patient} />
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

      <UnarchivePatientDialog
        patient={unarchiveOpen && patient ? patient : null}
        onClose={() => setUnarchiveOpen(false)}
      />
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
        // No celular, ícone em cima do rótulo: quatro abas lado a lado não
        // cabem em 375px com o texto na mesma linha do ícone.
        "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-sm",
        active
          ? "bg-primary/15 text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <Icon
        weight="fill"
        className={cn("size-4 shrink-0", active ? "text-primary" : "")}
      />
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}
