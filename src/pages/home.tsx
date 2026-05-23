import { useMemo, useState } from "react"
import {
  CalendarBlankIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import {
  useAppointmentSeries,
  useAppointmentsInRange,
  useIndividualChecklist,
  useInsurances,
  usePatients,
  useSharedChecklist,
} from "@/api/queries"
import {
  MiniCalendar,
  monthRange,
} from "@/components/calendar/mini-calendar"
import {
  occurrencesForPatient,
} from "@/domain/recurrence"
import {
  pendencyCount,
  pendencyIndex,
} from "@/domain/pendencies"
import type { Occurrence, Patient } from "@/db/types"
import { ageFromBirthdate } from "@/domain/age"
import { ScheduleAppointmentDialog } from "@/components/appointments/schedule-appointment-dialog"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PatientAvatar, genderLabel } from "@/components/patient/patient-avatar"
import { effectiveValue, formatBRL } from "@/domain/finance"
import { PatientDrawer } from "@/components/patient/patient-drawer"
import { todayISO, formatLongDateBR } from "@/domain/dates"
import { cn } from "@/lib/utils"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PatientForm } from "@/components/patient/patient-form"

export function HomePage() {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedISO, setSelectedISO] = useState<string>(todayISO())
  const [query, setQuery] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [activeKey, setActiveKey] = useState<{
    patientId: string
    originDate: string
  } | null>(null)

  const range = useMemo(() => monthRange(visibleMonth), [visibleMonth])
  const patientsQ = usePatients()
  const apptQ = useAppointmentsInRange(range.fromISO, range.toISO)
  const seriesQ = useAppointmentSeries()
  const sharedQ = useSharedChecklist()
  const indivQ = useIndividualChecklist()
  const insurancesQ = useInsurances()

  const patients = patientsQ.data ?? []
  const appointments = apptQ.data ?? []
  const series = seriesQ.data ?? []
  const shared = sharedQ.data ?? []
  const individual = indivQ.data ?? []
  const insurances = insurancesQ.data ?? []

  const insuranceById = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of insurances) m.set(i.id, i.name)
    return m
  }, [insurances])

  // all occurrences in visible month (memo-cached)
  const monthOccurrences: Occurrence[] = useMemo(() => {
    const out: Occurrence[] = []
    for (const p of patients) {
      if (!p.active) continue
      const occs = occurrencesForPatient(p, series, range, appointments)
      for (const o of occs) {
        o.pendencyCount = pendencyCount(o, shared, individual)
        out.push(o)
      }
    }
    return out
  }, [patients, series, appointments, range, shared, individual])

  const byDate = useMemo(
    () => pendencyIndex(monthOccurrences, shared, individual),
    [monthOccurrences, shared, individual],
  )

  const dayOccurrences = useMemo(
    () => monthOccurrences.filter((o) => o.date === selectedISO),
    [monthOccurrences, selectedISO],
  )

  const patientById = useMemo(() => {
    const m = new Map<string, Patient>()
    for (const p of patients) m.set(p.id, p)
    return m
  }, [patients])

  const filteredDay = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dayOccurrences
      .map((o) => ({ o, p: patientById.get(o.patientId) }))
      .filter((x) => !!x.p)
      .filter((x) =>
        q ? x.p!.name.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => {
        const t = (a.o.time || "").localeCompare(b.o.time || "")
        if (t !== 0) return t
        return a.p!.name.localeCompare(b.p!.name)
      })
  }, [dayOccurrences, patientById, query])

  const activeOcc = useMemo(() => {
    if (!activeKey) return null
    return (
      monthOccurrences.find(
        (o) =>
          o.patientId === activeKey.patientId &&
          o.originDate === activeKey.originDate,
      ) ?? null
    )
  }, [activeKey, monthOccurrences])

  const activePatient =
    activeKey ? patientById.get(activeKey.patientId) ?? null : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Agenda" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gestão de pacientes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setScheduleOpen(true)}>
            <PlusIcon weight="bold" />
            Novo atendimento
          </Button>
          <Button variant="outline" onClick={() => setNewPatientOpen(true)}>
            <PlusIcon weight="bold" />
            Novo paciente
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <MiniCalendar
            visibleMonth={visibleMonth}
            selectedISO={selectedISO}
            byDate={byDate}
            onChangeMonth={setVisibleMonth}
            onSelect={(iso) => {
              setSelectedISO(iso)
              const d = new Date(iso)
              if (
                d.getMonth() !== visibleMonth.getMonth() ||
                d.getFullYear() !== visibleMonth.getFullYear()
              ) {
                setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1))
              }
            }}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <CalendarBlankIcon
                  weight="fill"
                  className="size-5 text-primary"
                />
                <p className="text-sm font-semibold">
                  {formatLongDateBR(selectedISO)}
                </p>
                <span className="ml-auto text-xs text-muted-foreground">
                  {filteredDay.length}{" "}
                  {filteredDay.length === 1 ? "paciente" : "pacientes"}
                </span>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon
                  weight="fill"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Buscar paciente..."
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {filteredDay.length === 0 && (
            <Card>
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Nenhum paciente neste dia.
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {filteredDay.map(({ o, p }) => {
              const insuranceName = p!.insuranceId
                ? insuranceById.get(p!.insuranceId) ?? "Convênio"
                : "Particular"
              const value = o.appointment
                ? effectiveValue(o.appointment, p!)
                : p!.consultationValue ?? 0
              return (
                <button
                  key={`${o.patientId}-${o.originDate}`}
                  onClick={() => {
                    setActiveKey({
                      patientId: o.patientId,
                      originDate: o.originDate,
                    })
                    setDrawerOpen(true)
                  }}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    cardClassFor(o, selectedISO),
                  )}
                >
                  {o.time && (
                    <span className="shrink-0 rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                      {o.time}
                    </span>
                  )}
                  <PatientAvatar avatarId={p!.avatarId} name={p!.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{p!.name}</p>
                      {value > 0 && (
                        <span className="shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {formatBRL(value)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {ageFromBirthdate(p!.birthdate)} anos · {genderLabel(p!.gender)} · {insuranceName}
                    </p>
                    <p className={cn("mt-0.5 text-xs", statusTextClass(o))}>
                      {statusLabel(o)}
                    </p>
                  </div>
                  <StatusBadge occurrence={o} selectedISO={selectedISO} />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <PatientDrawer
        occurrence={activeOcc}
        patient={activePatient}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v)
          if (!v) setActiveKey(null)
        }}
      />

      <Sheet open={newPatientOpen} onOpenChange={setNewPatientOpen}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Novo paciente</SheetTitle>
          </SheetHeader>
          <PatientForm
            key={newPatientOpen ? "new" : "idle"}
            patient={undefined}
            onDone={() => setNewPatientOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <ScheduleAppointmentDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultDate={selectedISO}
      />
    </div>
  )
}

function isFuture(iso: string): boolean {
  return iso > todayISO()
}

function cardClassFor(o: Occurrence, _selectedISO: string): string {
  const status = o.appointment?.status
  if (status === "attended" && o.pendencyCount > 0) {
    return "border-destructive/40 bg-destructive/10 hover:border-destructive/60"
  }
  if (status === "attended") {
    return "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500/60"
  }
  if (status === "missed") {
    return "border-border/60 bg-muted/30 hover:border-border opacity-80"
  }
  if (status === "rescheduled") {
    return "border-secondary/40 bg-secondary/10 hover:border-secondary/60"
  }
  if (o.pendencyCount > 0) {
    return "border-destructive/40 bg-destructive/10 hover:border-destructive/60"
  }
  return "border-border/60 bg-card/70 hover:border-primary/40 hover:bg-card"
}

function statusTextClass(o: Occurrence): string {
  const status = o.appointment?.status
  if (status === "attended") return "text-emerald-400"
  if (status === "missed") return "text-muted-foreground"
  if (status === "rescheduled") return "text-secondary"
  return "text-muted-foreground"
}

function StatusBadge({
  occurrence,
  selectedISO,
}: {
  occurrence: Occurrence
  selectedISO: string
}) {
  const o = occurrence
  const future = isFuture(selectedISO)
  if (o.pendencyCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 px-2.5 py-1 text-xs font-medium text-destructive">
        <WarningIcon weight="fill" className="size-3" />
        {o.pendencyCount}{" "}
        {o.pendencyCount === 1 ? "pendência" : "pendências"}
      </span>
    )
  }
  if (o.appointment?.status === "attended") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
        Concluído
      </span>
    )
  }
  if (o.appointment?.status === "missed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Falta
      </span>
    )
  }
  if (o.appointment?.status === "rescheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/25 px-2.5 py-1 text-xs font-medium text-secondary">
        Reagendado
      </span>
    )
  }
  if (future) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
        A atender
      </span>
    )
  }
  return null
}

function statusLabel(o: Occurrence): string {
  if (!o.appointment) {
    return o.date > todayISO() ? "Aguardando atendimento" : "Pendente"
  }
  switch (o.appointment.status) {
    case "attended":
      return o.pendencyCount > 0
        ? "Atendido · checklist incompleto"
        : "Atendido"
    case "missed":
      return "Faltou"
    case "rescheduled":
      return `Reagendado de ${formatLongDateBR(o.originDate)}`
    case "cancelled":
      return "Cancelado"
    default:
      return "Agendado"
  }
}
