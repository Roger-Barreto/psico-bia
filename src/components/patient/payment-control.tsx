import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  CheckCircleIcon,
  CurrencyDollarIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import type { Appointment, Patient } from "@/db/types"
import { usePatchAppointment } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { celebrate } from "@/lib/celebrate"

interface Props {
  appointment: Appointment
  patient: Patient
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("pt-BR")
}

export function PaymentControl({ appointment, patient }: Props) {
  const patch = usePatchAppointment()
  const [editing, setEditing] = useState(false)
  const [customValue, setCustomValue] = useState<string>(
    String(patient.consultationValue ?? 0),
  )
  const [useCustom, setUseCustom] = useState(false)

  useEffect(() => {
    if (!editing) {
      setCustomValue(String(patient.consultationValue ?? 0))
      setUseCustom(false)
    }
  }, [editing, patient.consultationValue])

  async function confirmPaid() {
    const value = useCustom
      ? Number(customValue)
      : patient.consultationValue ?? 0
    if (!Number.isFinite(value) || value < 0) {
      return toast.error("Valor inválido")
    }
    try {
      await patch.mutateAsync({
        id: appointment.id,
        patch: {
          paid: true,
          paidValue: value,
          paidAt: new Date().toISOString(),
        },
      })
      celebrate("happy")
      toast.success("Sessão marcada como paga")
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function unmark() {
    if (
      !(await confirmDialog({
        title: "Desmarcar pagamento",
        description: "Desmarcar pagamento desta sessão?",
        destructive: true,
      }))
    )
      return
    try {
      await patch.mutateAsync({
        id: appointment.id,
        patch: { paid: false, paidValue: null, paidAt: null },
      })
      toast.success("Pagamento desmarcado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  if (appointment.paid) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
        <span className="flex items-center gap-2">
          <CheckCircleIcon weight="fill" className="size-4" />
          Pago {formatBRL(appointment.paidValue ?? 0)}
          {appointment.paidAt && (
            <span className="text-xs opacity-80">
              em {formatShortDate(appointment.paidAt)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={unmark}
          className="inline-flex items-center gap-1 text-xs text-emerald-300/70 hover:text-emerald-300 hover:underline"
        >
          <XCircleIcon weight="fill" className="size-3.5" />
          Desmarcar
        </button>
      </div>
    )
  }

  if (!editing) {
    return (
      <Button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full bg-emerald-600 text-white hover:bg-emerald-600/90"
      >
        <CurrencyDollarIcon weight="fill" />
        Marcar como paga
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Confirmar pagamento</p>
        <p className="text-xs text-muted-foreground">
          Valor padrão do cadastro:{" "}
          <strong className="text-foreground">
            {formatBRL(patient.consultationValue ?? 0)}
          </strong>
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useCustom}
          onChange={(e) => setUseCustom(e.target.checked)}
          className="size-4 rounded border-border accent-emerald-500"
        />
        Usar valor diferente nesta sessão
      </label>

      {useCustom && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Valor (R$)
          </label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            autoFocus
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(false)}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={confirmPaid}
          disabled={patch.isPending}
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          Confirmar
        </Button>
      </div>
    </div>
  )
}
