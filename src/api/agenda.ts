import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { supabase } from "@/lib/supabase"
import { addDays, diffDays, fromISO, toISO } from "@/domain/dates"
import type {
  AgendaCategory,
  AgendaEvent,
  EventFrequency,
  EventScope,
} from "@/db/types"

// ════════════════════════════════════════════════════════════════
// Compromissos pessoais da agenda (036_compromissos.sql)
// ════════════════════════════════════════════════════════════════
function newId(prefix: string) {
  return `${prefix}_${nanoid(10)}`
}
function nowIso() {
  return new Date().toISOString()
}

/** Mensagem legível para os erros que o banco devolve nestas tabelas. */
export function agendaErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string } | null
  if (e?.code === "23505") return "Já existe uma categoria com esse nome"
  if (e?.code === "23514") return "Confira data e horários do compromisso"
  if (e?.code === "42501") return "Sem permissão para gravar este compromisso"
  return e?.message || "Erro ao salvar"
}

// ─── Mappers ─────────────────────────────────────────────────────────
interface AgendaCategoryRow {
  id: string
  name: string
  color: string
  icon: string
  created_at: string
}

function rowToCategory(r: AgendaCategoryRow): AgendaCategory {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
  }
}

interface AgendaEventRow {
  id: string
  title: string
  category_id: string | null
  start_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  frequency: EventFrequency | null
  weekdays: number[] | null
  end_date: string | null
  location: string | null
  notes: string | null
  busy: boolean
  created_at: string
  updated_at: string
  agenda_event_skips?: { origin_date: string }[] | null
}

function rowToEvent(r: AgendaEventRow): AgendaEvent {
  return {
    id: r.id,
    title: r.title,
    categoryId: r.category_id,
    startDate: r.start_date,
    allDay: r.all_day,
    startTime: r.start_time,
    endTime: r.end_time,
    frequency: r.frequency,
    weekdays: r.weekdays && r.weekdays.length > 0 ? r.weekdays : null,
    endDate: r.end_date,
    location: r.location,
    notes: r.notes,
    busy: r.busy,
    skips: (r.agenda_event_skips ?? []).map((s) => s.origin_date),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** O que o formulário de compromisso produz. */
export interface AgendaEventInput {
  title: string
  categoryId: string | null
  startDate: string
  allDay: boolean
  startTime: string | null
  endTime: string | null
  frequency: EventFrequency | null
  weekdays: number[] | null
  endDate: string | null
  location: string | null
  notes: string | null
  busy: boolean
}

/**
 * Colunas a gravar. Deixa a linha coerente com as CHECKs do banco: dia
 * inteiro sem horas, dias da semana só na repetição semanal, fim só em
 * repetição — o formulário pode trazer sobras de um modo anterior.
 */
function inputToRow(input: AgendaEventInput) {
  const weekly = input.frequency === "weekly"
  const weekdays =
    weekly && input.weekdays && input.weekdays.length > 0
      ? [...new Set(input.weekdays)].sort((a, b) => a - b)
      : null
  return {
    title: input.title.trim(),
    category_id: input.categoryId,
    start_date: input.startDate,
    all_day: input.allDay,
    start_time: input.allDay ? null : input.startTime,
    end_time: input.allDay ? null : input.endTime,
    frequency: input.frequency,
    weekdays,
    end_date: input.frequency ? input.endDate || null : null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    busy: input.busy,
  }
}

// ─── Query keys ──────────────────────────────────────────────────────
export const aqk = {
  categories: ["agenda-categories"] as const,
  events: ["agenda-events"] as const,
}

// ════════════════════════════════════════════════════════════════
// CATEGORIAS
// ════════════════════════════════════════════════════════════════
export function useAgendaCategories() {
  return useQuery({
    queryKey: aqk.categories,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_categories")
        .select("*")
        .order("name", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToCategory(r as AgendaCategoryRow))
    },
    staleTime: 60_000,
  })
}

/** Cria as categorias iniciais de quem ainda não tem nenhuma (idempotente). */
export function useSeedAgendaDefaults() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_agenda_defaults")
      if (error) throw error
      return Number(data ?? 0)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aqk.categories }),
  })
}

export function useCreateAgendaCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string; icon: string }) => {
      const row: AgendaCategoryRow = {
        id: newId("agc"),
        name: input.name.trim(),
        color: input.color,
        icon: input.icon,
        created_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("agenda_categories")
        .insert(row)
        .select()
        .single()
      if (error) throw error
      return rowToCategory(data as AgendaCategoryRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aqk.categories }),
  })
}

export function useUpdateAgendaCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<AgendaCategory, "name" | "color" | "icon">>
    }) => {
      const row: Partial<AgendaCategoryRow> = {}
      if (patch.name !== undefined) row.name = patch.name.trim()
      if (patch.color !== undefined) row.color = patch.color
      if (patch.icon !== undefined) row.icon = patch.icon
      const { data, error } = await supabase
        .from("agenda_categories")
        .update(row)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return rowToCategory(data as AgendaCategoryRow)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aqk.categories }),
  })
}

/**
 * Apaga a categoria. Os compromissos dela continuam na agenda, só ficam sem
 * categoria (FK `on delete set null`).
 */
export function useDeleteAgendaCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agenda_categories")
        .delete()
        .eq("id", id)
      if (error) throw error
      return { ok: true as const }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aqk.categories })
      qc.invalidateQueries({ queryKey: aqk.events })
    },
  })
}

// ════════════════════════════════════════════════════════════════
// COMPROMISSOS
// ════════════════════════════════════════════════════════════════
/**
 * Todos os compromissos do usuário, com as datas puladas embutidas. São
 * regras, não ocorrências — poucas linhas —, então vêm de uma vez (como
 * `useAppointmentSeries`) e cada tela calcula o intervalo que precisa.
 */
export function useAgendaEvents(opts?: { enabled?: boolean }) {
  return useQuery({
    enabled: opts?.enabled ?? true,
    queryKey: aqk.events,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_events")
        .select("*, agenda_event_skips(origin_date)")
        .order("start_date", { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => rowToEvent(r as AgendaEventRow))
    },
    staleTime: 30_000,
  })
}

async function insertEvent(input: AgendaEventInput) {
  const now = nowIso()
  const { error } = await supabase.from("agenda_events").insert({
    id: newId("age"),
    ...inputToRow(input),
    created_at: now,
    updated_at: now,
  })
  if (error) throw error
}

async function updateEvent(id: string, row: Record<string, unknown>) {
  const { error } = await supabase
    .from("agenda_events")
    .update({ ...row, updated_at: nowIso() })
    .eq("id", id)
  if (error) throw error
}

async function deleteEvent(id: string) {
  const { error } = await supabase.from("agenda_events").delete().eq("id", id)
  if (error) throw error
}

async function skipOccurrence(eventId: string, originDate: string) {
  const { error } = await supabase
    .from("agenda_event_skips")
    .upsert(
      { event_id: eventId, origin_date: originDate },
      { onConflict: "event_id,origin_date", ignoreDuplicates: true },
    )
  if (error) throw error
}

function dayBefore(iso: string): string {
  return toISO(addDays(fromISO(iso), -1))
}

export function useCreateAgendaEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AgendaEventInput) => {
      await insertEvent(input)
      return { ok: true as const }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aqk.events }),
  })
}

/**
 * Salva a edição feita a partir de UMA ocorrência (`originDate`).
 *
 * Compromisso avulso: atualiza a linha. Repetição, conforme o alcance:
 * - `one`: pula a data na regra e cria um avulso com o que foi editado.
 * - `future`: encerra a regra na véspera e cria outra a partir daqui.
 * - `all`: atualiza a regra. O começo da série é preservado — só anda se o
 *   usuário mexeu no dia (e anda o mesmo tanto), senão editar a 5ª terça
 *   apagaria as quatro anteriores.
 *
 * Sempre grava o novo antes de mexer no antigo: se a segunda escrita falhar,
 * sobra uma duplicata visível, nunca um compromisso perdido.
 */
export function useEditAgendaOccurrence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      event,
      originDate,
      scope,
      input,
    }: {
      event: AgendaEvent
      originDate: string
      scope: EventScope
      input: AgendaEventInput
    }) => {
      if (!event.frequency) {
        await updateEvent(event.id, inputToRow(input))
        return
      }
      if (scope === "one") {
        await insertEvent({
          ...input,
          frequency: null,
          weekdays: null,
          endDate: null,
        })
        await skipOccurrence(event.id, originDate)
        return
      }
      // Nada antes desta ocorrência: "este e os próximos" é a série inteira.
      if (scope === "future" && originDate > event.startDate) {
        await insertEvent(input)
        await updateEvent(event.id, { end_date: dayBefore(originDate) })
        return
      }
      const row = inputToRow(input)
      if (scope === "all" && input.frequency) {
        const moved = diffDays(fromISO(input.startDate), fromISO(originDate))
        row.start_date = toISO(addDays(fromISO(event.startDate), moved))
        // O fim nunca pode ficar antes do começo preservado.
        if (row.end_date && row.end_date < row.start_date) row.end_date = null
      }
      await updateEvent(event.id, row)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aqk.events }),
    // Numa sequência de duas escritas a primeira pode ter entrado.
    onError: () => qc.invalidateQueries({ queryKey: aqk.events }),
  })
}

/**
 * Exclui a partir de UMA ocorrência. `one` pula só a data; `future` encerra
 * a repetição na véspera (o que já passou fica); `all` apaga tudo.
 */
export function useDeleteAgendaOccurrence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      event,
      originDate,
      scope,
    }: {
      event: AgendaEvent
      originDate: string
      scope: EventScope
    }) => {
      if (!event.frequency || scope === "all") {
        await deleteEvent(event.id)
      } else if (scope === "one") {
        await skipOccurrence(event.id, originDate)
      } else if (originDate <= event.startDate) {
        await deleteEvent(event.id)
      } else {
        await updateEvent(event.id, { end_date: dayBefore(originDate) })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aqk.events }),
  })
}
