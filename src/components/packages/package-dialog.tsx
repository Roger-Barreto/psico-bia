import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Patient, SessionPackage } from "@/db/types"
import {
  packageErrorMessage,
  useCreateSessionPackage,
  usePatients,
  useUpdateSessionPackage,
} from "@/api/queries"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PatientCombobox } from "@/components/patient/patient-combobox"
import {
  PaymentMethodChips,
  usePaymentMethodChoice,
} from "@/components/patient/payment-method-chips"
import { packageUsed } from "@/domain/packages"
import { todayISO } from "@/domain/dates"
import { PackageFields, usePackageFields } from "./package-fields"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Pacote em edição; ausente = novo pacote. */
  pkg?: SessionPackage | null
  /** Paciente já definido (novo pacote a partir do cadastro dele). */
  patient?: Patient | null
}

/**
 * Novo pacote / editar pacote.
 *
 * Vender o pacote **numa sessão** é outro caminho — o "Marcar como paga" do
 * atendimento (`PaymentControl`), que já consome a 1ª vaga. Este diálogo serve
 * para o pacote combinado fora de uma sessão (pago antes, por exemplo) e para
 * corrigir um pacote que já existe.
 */
export function PackageDialog({ open, onOpenChange, pkg, patient }: Props) {
  const isEdit = !!pkg
  const patientsQ = usePatients()
  const create = useCreateSessionPackage()
  const update = useUpdateSessionPackage()

  const [patientId, setPatientId] = useState(patient?.id ?? "")
  const [startDate, setStartDate] = useState(todayISO())
  const [methodId, setMethodId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const choosable = useMemo(
    () => (patientsQ.data ?? []).filter((p) => p.active && !p.dischargedAt),
    [patientsQ.data],
  )
  const chosen =
    patient ??
    (patientsQ.data ?? []).find(
      (p) => p.id === (pkg?.patientId ?? patientId),
    ) ??
    null

  const used = pkg ? packageUsed(pkg) : 0
  const fields = usePackageFields(
    {
      initialSessions: pkg?.totalSessions ?? 4,
      initialValue: pkg?.totalValue,
      unitPrice: chosen?.consultationValue ?? 0,
      minSessions: Math.max(1, used),
    },
    // O paciente fica de fora: escolher (ou trocar) o paciente depois de
    // preencher não pode apagar o que já foi digitado.
    `${open}|${pkg?.id ?? "new"}`,
  )
  const { selected: method } = usePaymentMethodChoice(methodId)

  // Abre sempre com os dados certos: os do pacote, ou um formulário limpo.
  useEffect(() => {
    if (!open) return
    setPatientId(patient?.id ?? pkg?.patientId ?? "")
    setStartDate(pkg?.startDate ?? todayISO())
    setMethodId(pkg?.paymentMethodId ?? null)
    setNotes(pkg?.notes ?? "")
    setSubmitted(false)
  }, [open, pkg, patient])

  const pending = create.isPending || update.isPending

  async function onSubmit() {
    setSubmitted(true)
    if (pending) return
    if (!chosen) return toast.error("Escolha o paciente")
    if (fields.sessions === null)
      return toast.error(fields.sessionsError ?? "Quantidade inválida")
    if (fields.value === null)
      return toast.error(fields.valueError ?? "Valor inválido")
    if (!startDate) return toast.error("Informe a data da venda")
    if (!method) return toast.error("Escolha a forma de pagamento")
    try {
      if (pkg) {
        await update.mutateAsync({
          id: pkg.id,
          patch: {
            totalSessions: fields.sessions,
            totalValue: fields.value,
            paymentMethodId: method.id,
            startDate,
            notes: notes.trim() || null,
          },
        })
        toast.success("Pacote atualizado")
      } else {
        await create.mutateAsync({
          patientId: chosen.id,
          totalSessions: fields.sessions,
          totalValue: fields.value,
          paymentMethodId: method.id,
          startDate,
          notes: notes.trim() || null,
        })
        toast.success("Pacote registrado")
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(packageErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar pacote" : "Novo pacote"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Pacote de ${chosen?.name ?? "paciente"}.`
              : "Sessões pagas de uma vez. As próximas sessões do paciente são descontadas do pacote automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEdit && !patient && (
            <div className="space-y-2">
              <Label>Paciente</Label>
              <PatientCombobox
                patients={choosable}
                value={patientId}
                onChange={setPatientId}
              />
              {submitted && !chosen && (
                <p className="text-xs text-rose-300">Escolha o paciente.</p>
              )}
            </div>
          )}

          <PackageFields state={fields} submitted={submitted} />

          <div className="space-y-1.5">
            <Label htmlFor="package-start">Data da venda</Label>
            <DatePicker
              id="package-start"
              value={startDate}
              onChange={setStartDate}
            />
            <p className="text-xs text-muted-foreground">
              É o dia em que o valor entra no financeiro. Sessões a partir desta
              data são descontadas do pacote.
            </p>
          </div>

          <PaymentMethodChips
            value={methodId}
            onChange={setMethodId}
            submitted={submitted}
          />

          <div className="space-y-1.5">
            <Label htmlFor="package-notes">
              Observações{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </Label>
            <Textarea
              id="package-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ex.: validade combinada, condições do pacote…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="h-11"
          >
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={pending} className="h-11">
            {isEdit ? "Salvar" : "Registrar pacote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
