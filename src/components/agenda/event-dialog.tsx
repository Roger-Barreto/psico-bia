import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { TrashIcon, WarningIcon } from "@phosphor-icons/react"
import {
  agendaErrorMessage,
  useCreateAgendaEvent,
  useDeleteAgendaOccurrence,
  useEditAgendaOccurrence,
  type AgendaEventInput,
} from "@/api/agenda"
import type {
  AgendaEvent,
  EventFrequency,
  EventOccurrence,
  EventScope,
} from "@/db/types"
import {
  addDays,
  formatLongDateBR,
  fromISO,
  todayISO,
  toISO,
} from "@/domain/dates"
import {
  addMinutesToTime,
  eventWeekdays,
  occurrencesForEvent,
  sessionsClashingWithEvent,
  toMinutes,
} from "@/domain/events"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { EventCategoryPicker } from "./event-category-picker"
import { EventScopeDialog } from "./event-scope-dialog"
import { useSessionsInRange } from "./use-agenda"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Dia sugerido ao criar (o selecionado na agenda). */
  defaultDate?: string
  /** Ocorrência em edição: o compromisso e o dia em que o usuário clicou. */
  editing?: EventOccurrence | null
}

type Repeat = "none" | EventFrequency

const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Não se repete" },
  { value: "daily", label: "Todo dia" },
  { value: "weekly", label: "Toda semana" },
  { value: "biweekly", label: "A cada 2 semanas" },
  { value: "monthly", label: "Todo mês" },
  { value: "yearly", label: "Todo ano" },
]

// Segunda primeiro, como no resto do app a semana é lida.
const WEEKDAY_CHIPS = [
  { day: 1, short: "S", name: "Segunda" },
  { day: 2, short: "T", name: "Terça" },
  { day: 3, short: "Q", name: "Quarta" },
  { day: 4, short: "Q", name: "Quinta" },
  { day: 5, short: "S", name: "Sexta" },
  { day: 6, short: "S", name: "Sábado" },
  { day: 0, short: "D", name: "Domingo" },
]

/** Até onde olhar por conflitos numa repetição sem fim (~6 meses). */
const CLASH_HORIZON_DAYS = 182

function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

function sameDays(a: number[], b: number[]) {
  return [...a].sort().join() === [...b].sort().join()
}

/**
 * Criar ou editar um compromisso pessoal (tudo o que não é atendimento).
 * Em repetição, salvar e excluir perguntam o alcance: só este dia, este e os
 * próximos, ou todos.
 */
export function EventDialog({ open, onOpenChange, defaultDate, editing }: Props) {
  const event = editing?.event ?? null
  const isEdit = !!event
  const wasRecurring = !!event?.frequency

  const create = useCreateAgendaEvent()
  const edit = useEditAgendaOccurrence()
  const remove = useDeleteAgendaOccurrence()

  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO())
  const [allDay, setAllDay] = useState(false)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [repeat, setRepeat] = useState<Repeat>("none")
  // Dias extras da repetição semanal; o dia da própria data entra sempre.
  const [extraDays, setExtraDays] = useState<number[]>([])
  const [endDate, setEndDate] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(true)

  const [scopeMode, setScopeMode] = useState<"edit" | "delete" | null>(null)
  const [pendingScope, setPendingScope] = useState<EventScope | null>(null)

  // Preenche (edição) ou zera (criação) sempre que o diálogo abre.
  useEffect(() => {
    if (!open) return
    setScopeMode(null)
    setPendingScope(null)
    if (editing) {
      const e = editing.event
      setTitle(e.title)
      setCategoryId(e.categoryId)
      setDate(editing.date)
      setAllDay(e.allDay)
      setStartTime(e.startTime ?? "09:00")
      setEndTime(e.endTime ?? "10:00")
      setRepeat(e.frequency ?? "none")
      setExtraDays(e.frequency === "weekly" ? eventWeekdays(e) : [])
      setEndDate(e.endDate ?? "")
      setLocation(e.location ?? "")
      setNotes(e.notes ?? "")
      setBusy(e.busy)
    } else {
      setTitle("")
      setCategoryId(null)
      setDate(defaultDate ?? todayISO())
      setAllDay(false)
      setStartTime("09:00")
      setEndTime("10:00")
      setRepeat("none")
      setExtraDays([])
      setEndDate("")
      setLocation("")
      setNotes("")
      setBusy(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const dateWeekday = date ? fromISO(date).getDay() : 0
  const weekdays = useMemo(
    () => [...new Set([...extraDays, dateWeekday])].sort((a, b) => a - b),
    [extraDays, dateWeekday],
  )

  const frequency: EventFrequency | null = repeat === "none" ? null : repeat
  const timesValid = allDay || (!!startTime && !!endTime && endTime > startTime)
  const endValid = !frequency || !endDate || endDate >= date

  const input: AgendaEventInput = useMemo(
    () => ({
      title,
      categoryId,
      startDate: date,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      frequency,
      weekdays: frequency === "weekly" ? weekdays : null,
      endDate: frequency && endDate ? endDate : null,
      location: location || null,
      notes: notes || null,
      busy,
    }),
    [
      title,
      categoryId,
      date,
      allDay,
      startTime,
      endTime,
      frequency,
      weekdays,
      endDate,
      location,
      notes,
      busy,
    ],
  )

  // A repetição em si mudou? Então "só este dia" deixa de fazer sentido.
  const recurrenceChanged =
    !!event &&
    wasRecurring &&
    (frequency !== event.frequency ||
      (endDate || null) !== event.endDate ||
      (frequency === "weekly" && !sameDays(weekdays, eventWeekdays(event))))

  // ── Atendimentos em cima deste compromisso ────────────────────────────
  // Só para o que ocupa horário. Numa repetição olha ~6 meses à frente (ou
  // até o fim dela), como o "Novo atendimento" faz no sentido inverso.
  const clashRange = useMemo(() => {
    if (!date) return { from: "", to: "" }
    if (!frequency) return { from: date, to: date }
    const horizon = toISO(addDays(fromISO(date), CLASH_HORIZON_DAYS))
    return {
      from: date,
      to: endDate && endDate >= date && endDate < horizon ? endDate : horizon,
    }
  }, [date, frequency, endDate])

  const { sessions, patientById } = useSessionsInRange(
    clashRange.from,
    clashRange.to,
    { enabled: open && busy && timesValid },
  )

  const clashes = useMemo(() => {
    if (!open || !busy || !timesValid || !clashRange.from) return []
    const draft: AgendaEvent = {
      id: "__draft__",
      title: "",
      categoryId: null,
      startDate: date,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      frequency,
      weekdays: frequency === "weekly" ? weekdays : null,
      endDate: frequency && endDate ? endDate : null,
      location: null,
      notes: null,
      busy: true,
      skips: [],
      createdAt: "",
      updatedAt: "",
    }
    const out: { date: string; time: string; name: string }[] = []
    for (const o of occurrencesForEvent(draft, {
      fromISO: clashRange.from,
      toISO: clashRange.to,
    })) {
      for (const s of sessionsClashingWithEvent(sessions, draft, o.date)) {
        out.push({
          date: s.date,
          time: s.time,
          name: patientById.get(s.patientId)?.name ?? "um paciente",
        })
      }
    }
    return out.sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    )
  }, [
    open,
    busy,
    timesValid,
    clashRange,
    date,
    allDay,
    startTime,
    endTime,
    frequency,
    weekdays,
    endDate,
    sessions,
    patientById,
  ])

  const working = create.isPending || edit.isPending || remove.isPending

  function changeStart(next: string) {
    // Mantém a duração: mexer no início empurra o fim junto.
    const duration =
      startTime && endTime && endTime > startTime
        ? toMinutes(endTime) - toMinutes(startTime)
        : 60
    setStartTime(next)
    const pushed = addMinutesToTime(next, duration)
    setEndTime(pushed > next ? pushed : "23:59")
  }

  function toggleDay(day: number) {
    if (day === dateWeekday) return
    setExtraDays((cur) =>
      cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day],
    )
  }

  /** Primeiro problema do formulário, ou `null` se dá para salvar. */
  function problem(): string | null {
    if (!title.trim()) return "Dê um nome ao compromisso"
    if (!date) return "Informe a data"
    if (!allDay && (!startTime || !endTime)) return "Informe início e término"
    if (!timesValid) return "O término precisa ser depois do início"
    if (!endValid) return "A repetição não pode terminar antes de começar"
    return null
  }

  async function runEdit(scope: EventScope) {
    if (!editing) return
    setPendingScope(scope)
    try {
      await edit.mutateAsync({
        event: editing.event,
        originDate: editing.date,
        scope,
        input,
      })
      toast.success("Compromisso atualizado")
      setScopeMode(null)
      onOpenChange(false)
    } catch (err) {
      toast.error(agendaErrorMessage(err))
    } finally {
      setPendingScope(null)
    }
  }

  async function runDelete(scope: EventScope) {
    if (!editing) return
    setPendingScope(scope)
    try {
      await remove.mutateAsync({
        event: editing.event,
        originDate: editing.date,
        scope,
      })
      toast.success("Compromisso excluído")
      setScopeMode(null)
      onOpenChange(false)
    } catch (err) {
      toast.error(agendaErrorMessage(err))
    } finally {
      setPendingScope(null)
    }
  }

  async function submit() {
    const issue = problem()
    if (issue) {
      toast.error(issue)
      return
    }
    if (isEdit) {
      if (wasRecurring) return setScopeMode("edit")
      return runEdit("all")
    }
    try {
      await create.mutateAsync(input)
      toast.success(frequency ? "Compromisso repetido criado" : "Compromisso criado")
      onOpenChange(false)
    } catch (err) {
      toast.error(agendaErrorMessage(err))
    }
  }

  async function askDelete() {
    if (!editing) return
    if (wasRecurring) return setScopeMode("delete")
    const ok = await confirmDialog({
      title: "Excluir compromisso?",
      description: `“${editing.event.title}” sai da agenda. Não pode ser desfeito.`,
      confirmLabel: "Excluir",
      destructive: true,
    })
    if (ok) await runDelete("all")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !working && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar compromisso" : "Novo compromisso"}
          </DialogTitle>
          <DialogDescription>
            {isEdit && editing
              ? formatLongDateBR(editing.date)
              : "Consulta, aula, reunião, folga — tudo o que não é atendimento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="O que é">
            <Input
              autoFocus={!isEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Consulta médica, Pilates, Supervisão…"
              maxLength={120}
            />
          </Field>

          <Field label="Categoria">
            <EventCategoryPicker value={categoryId} onChange={setCategoryId} />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Data" className="col-span-2 sm:col-span-1">
              <DatePicker value={date} onChange={setDate} />
            </Field>
            {allDay ? (
              <div className="col-span-2 flex items-end pb-3 text-sm text-muted-foreground">
                O dia todo
              </div>
            ) : (
              <>
                <Field label="Início">
                  <TimePicker value={startTime} onChange={changeStart} />
                </Field>
                <Field label="Término">
                  <TimePicker
                    value={endTime}
                    onChange={setEndTime}
                    className={cn(!timesValid && "border-destructive/70")}
                  />
                </Field>
              </>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Dia inteiro
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Repetição">
              <Select value={repeat} onValueChange={(v) => setRepeat(v as Repeat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {frequency && (
              <Field label="Repete até (opcional)">
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  min={date}
                  clearable
                  placeholder="Sem data final"
                />
              </Field>
            )}
          </div>

          {frequency === "weekly" && (
            <Field
              label="Dias da semana"
              hint="O dia da data escolhida sempre faz parte."
            >
              <div className="flex gap-1.5">
                {WEEKDAY_CHIPS.map(({ day, short, name }) => {
                  const active = weekdays.includes(day)
                  const locked = day === dateWeekday
                  return (
                    <button
                      key={day}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={active}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "grid h-10 flex-1 place-items-center rounded-md text-sm font-medium transition-colors [touch-action:manipulation]",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-background/40 text-muted-foreground hover:bg-muted/50",
                        locked && "cursor-default ring-2 ring-primary/40",
                      )}
                    >
                      {short}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          <Field label="Local (opcional)">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Endereço, clínica, link da chamada…"
              maxLength={160}
            />
          </Field>

          <Field label="Observações (opcional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="min-h-[60px]"
              placeholder="Levar exames, falar com a recepção…"
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={busy}
              onChange={(e) => setBusy(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border accent-primary"
            />
            <span>
              Ocupa meu horário
              <span className="block text-xs text-muted-foreground">
                {busy
                  ? "O app avisa se você for agendar um paciente em cima."
                  : "Só um lembrete: não gera aviso ao agendar pacientes."}
              </span>
            </span>
          </label>

          {clashes.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100"
            >
              <WarningIcon
                weight="fill"
                className="mt-0.5 size-4 shrink-0 text-amber-400"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">
                  {clashes.length === 1
                    ? "Há um atendimento neste horário"
                    : `${clashes.length} atendimentos caem neste horário`}
                </p>
                <ul className="space-y-0.5 text-xs text-amber-100/90">
                  {clashes.slice(0, 4).map((c, i) => (
                    <li key={i}>
                      <b className="font-semibold">{c.name}</b> ·{" "}
                      {formatLongDateBR(c.date)} às {c.time}
                    </li>
                  ))}
                  {clashes.length > 4 && (
                    <li className="text-amber-100/70">
                      e mais {clashes.length - 4}…
                    </li>
                  )}
                </ul>
                <p className="text-xs text-amber-100/70">
                  Dá para salvar assim mesmo — a agenda vai marcar o conflito.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:items-center">
          {isEdit && (
            <Button
              type="button"
              variant="ghost"
              disabled={working}
              onClick={askDelete}
              className="text-destructive hover:bg-destructive/10 sm:mr-auto"
            >
              <TrashIcon weight="fill" />
              Excluir
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={working}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={submit}
            loading={working && !scopeMode}
            disabled={working}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>

      {editing && (
        <EventScopeDialog
          open={!!scopeMode}
          onOpenChange={(v) => !v && setScopeMode(null)}
          mode={scopeMode ?? "edit"}
          title={editing.event.title}
          dateLabel={formatLongDateBR(editing.date).toLowerCase()}
          allowOne={scopeMode === "delete" || !recurrenceChanged}
          pending={pendingScope}
          onChoose={(scope) =>
            scopeMode === "delete" ? runDelete(scope) : runEdit(scope)
          }
        />
      )}
    </Dialog>
  )
}
