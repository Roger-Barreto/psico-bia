import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CheckIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react"
import type { Frequency, Patient } from "@/db/types"
import {
  useCreateAppointmentSeries,
  usePatients,
} from "@/api/queries"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { todayISO } from "@/domain/dates"
import { cn } from "@/lib/utils"

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

  async function onSubmit() {
    if (!patientId) return toast.error("Selecione um paciente")
    if (!date) return toast.error("Informe a data")
    if (!time) return toast.error("Informe o horário")
    if (tipo === "recurring" && endDate && endDate < date) {
      return toast.error("Data final deve ser posterior à inicial")
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
          <Button onClick={onSubmit} disabled={createSeries.isPending}>
            {createSeries.isPending ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

interface ComboProps {
  patients: Patient[]
  value: string
  onChange: (id: string) => void
}

function PatientCombobox({ patients, value, onChange }: ComboProps) {
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(
    () => patients.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [patients],
  )
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return sorted
    return sorted.filter((p) => normalize(p.name).includes(q))
  }, [sorted, query])

  const selected = patients.find((p) => p.id === value) ?? null

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0)
  }, [filtered, activeIdx])

  function pick(id: string) {
    onChange(id)
    setQuery("")
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const p = filtered[activeIdx]
      if (p) pick(p.id)
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <PatientAvatar
            avatarId={selected.avatarId}
            name={selected.name}
            size="sm"
          />
          <span className="truncate text-sm">{selected.name}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange("")}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label="Trocar paciente"
        >
          <XIcon weight="bold" className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="relative border-b border-border/60">
        <MagnifyingGlassIcon
          weight="fill"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar por nome..."
          className="border-0 bg-transparent pl-9 focus-visible:ring-0"
        />
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {patients.length === 0
              ? "Nenhum paciente ativo"
              : "Nenhum resultado"}
          </div>
        )}
        {filtered.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onMouseEnter={() => setActiveIdx(i)}
            onClick={() => pick(p.id)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              i === activeIdx ? "bg-accent/30" : "hover:bg-accent/20",
            )}
          >
            <PatientAvatar avatarId={p.avatarId} name={p.name} size="sm" />
            <span className="truncate flex-1">{p.name}</span>
            {p.id === value && (
              <CheckIcon weight="bold" className="size-4 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
