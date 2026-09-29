import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { WarningIcon } from "@phosphor-icons/react"
import type { Frequency, Patient } from "@/db/types"
import {
  useAppointmentsInRange,
  useAppointmentSeries,
  useCreateAppointmentSeries,
  usePatients,
} from "@/api/queries"
import {
  occurrencesForPatient,
  occurrencesForSeries,
} from "@/domain/recurrence"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { PatientCombobox } from "@/components/patient/patient-combobox"
import { addDays, formatLongDateBR, fromISO, todayISO, toISO } from "@/domain/dates"

type Tipo = "single" | "recurring"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultDate?: string
}

export function ScheduleAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
}: Props) {
  const patientsQ = usePatients()
  const createSeries = useCreateAppointmentSeries()

  const [patientId, setPatientId] = useState("")
  const [date, setDate] = useState(defaultDate ?? todayISO())
  const [time, setTime] = useState("08:00")
  const [tipo, setTipo] = useState<Tipo>("single")
  const [frequency, setFrequency] = useState<Frequency>("weekly")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    if (!open) return
    setPatientId("")
    setDate(defaultDate ?? todayISO())
    setTime("08:00")
    setTipo("single")
    setFrequency("weekly")
    setEndDate("")
  }, [open, defaultDate])

  const activePatients = useMemo(
    () => (patientsQ.data ?? []).filter((p) => p.active && !p.dischargedAt),
    [patientsQ.data],
  )

  // ── Slot-conflict detection ───────────────────────────────────────────
  // A slot (date + time) may hold only one patient. Compute the slots this
  // new appointment would occupy, then check them against everyone else's
  // occurrences so we can block a double-booking before it's created.
  const seriesQ = useAppointmentSeries()
  const allSeries = seriesQ.data ?? []
  const patientById = useMemo(() => {
    const m = new Map<string, Patient>()
    for (const p of patientsQ.data ?? []) m.set(p.id, p)
    return m
  }, [patientsQ.data])

  const newSlots = useMemo(() => {
    if (!date || !time) return [] as { date: string; time: string }[]
    if (tipo === "single") return [{ date, time }]
    // Recurring: expand occurrences up to the end date, or ~6 months out
    // when open-ended, so repeated clashes are caught too.
    const horizon =
      endDate && endDate >= date ? endDate : toISO(addDays(fromISO(date), 182))
    const occs = occurrencesForSeries(
      {
        id: "__new__",
        patientId: "__new__",
        startDate: date,
        time,
        frequency,
        endDate: endDate || null,
        createdAt: "",
      },
      { fromISO: date, toISO: horizon },
      [],
    )
    return occs.map((o) => ({ date: o.date, time: o.time }))
  }, [date, time, tipo, frequency, endDate])

  const rangeFrom = newSlots.reduce(
    (min, s) => (s.date < min ? s.date : min),
    date || todayISO(),
  )
  const rangeTo = newSlots.reduce(
    (max, s) => (s.date > max ? s.date : max),
    date || todayISO(),
  )
  const existingAppts = useAppointmentsInRange(rangeFrom, rangeTo).data ?? []

  const conflicts = useMemo(() => {
    if (newSlots.length === 0) return [] as { date: string; time: string; name: string }[]
    const taken = new Map<string, string>() // "date|time" → patient name
    for (const p of patientsQ.data ?? []) {
      if (!p.active) continue
      const occs = occurrencesForPatient(
        p,
        allSeries,
        { fromISO: rangeFrom, toISO: rangeTo },
        existingAppts,
      )
      for (const o of occs) {
        if (!o.time) continue
        taken.set(`${o.date}|${o.time}`, patientById.get(o.patientId)?.name ?? "outro paciente")
      }
    }
    const out: { date: string; time: string; name: string }[] = []
    for (const s of newSlots) {
      const name = taken.get(`${s.date}|${s.time}`)
      if (name) out.push({ date: s.date, time: s.time, name })
    }
    return out
  }, [newSlots, patientsQ.data, allSeries, rangeFrom, rangeTo, existingAppts, patientById])

  async function onSubmit() {
    if (!patientId) return toast.error("Selecione um paciente")
    if (!date) return toast.error("Informe a data")
    if (!time) return toast.error("Informe o horário")
    if (tipo === "recurring" && endDate && endDate < date) {
      return toast.error("Data final deve ser posterior à inicial")
    }
    if (conflicts.length > 0) {
      return toast.error("Já existe um atendimento nesse horário")
    }
    try {
      await createSeries.mutateAsync({
        patientId,
        startDate: date,
        time,
        frequency: tipo === "single" ? null : frequency,
        endDate: tipo === "recurring" && endDate ? endDate : null,
      })
      toast.success("Atendimento agendado")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo atendimento</DialogTitle>
          <DialogDescription>
            Agende um atendimento único ou recorrente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Paciente</Label>
            <PatientCombobox
              patients={activePatients}
              value={patientId}
              onChange={setPatientId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <TimePicker value={time} onChange={setTime} />
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
              <WarningIcon
                weight="fill"
                className="mt-0.5 size-4 shrink-0 text-rose-400"
              />
              <div>
                {conflicts.length === 1 ? (
                  <>
                    Horário ocupado: <b>{conflicts[0].name}</b> já tem atendimento
                    em {formatLongDateBR(conflicts[0].date)} às {conflicts[0].time}.
                  </>
                ) : (
                  <>
                    {conflicts.length} horários já estão ocupados por outros
                    atendimentos. Ajuste a data ou o horário.
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as Tipo)}
              className="flex gap-4 pt-1"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="single" id="tipo-single" />
                Único
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="recurring" id="tipo-rec" />
                Recorrente
              </label>
            </RadioGroup>
          </div>

          {tipo === "recurring" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as Frequency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Encerrar em (opcional)</Label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  min={date}
                  clearable
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createSeries.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={createSeries.isPending || conflicts.length > 0}
          >
            {createSeries.isPending ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
