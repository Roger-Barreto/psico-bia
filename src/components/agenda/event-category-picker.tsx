import { useState } from "react"
import { toast } from "sonner"
import {
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import {
  agendaErrorMessage,
  useAgendaCategories,
  useCreateAgendaCategory,
  useDeleteAgendaCategory,
  useUpdateAgendaCategory,
} from "@/api/agenda"
import type { AgendaCategory } from "@/db/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import {
  EVENT_COLORS,
  EVENT_ICONS,
  eventIcon,
  lighten,
  tint,
} from "./event-style"

interface Props {
  value: string | null
  onChange: (id: string | null) => void
}

type Editor =
  | { mode: "new"; name: string; color: string; icon: string }
  | { mode: "edit"; id: string; name: string; color: string; icon: string }

/**
 * Categoria do compromisso em chips — a cor e o ícone que ele vai ter na
 * agenda ficam à vista na hora de escolher. As categorias são do usuário:
 * dá para criar, renomear, recolorir e excluir aqui mesmo.
 */
export function EventCategoryPicker({ value, onChange }: Props) {
  const categoriesQ = useAgendaCategories()
  const create = useCreateAgendaCategory()
  const update = useUpdateAgendaCategory()
  const remove = useDeleteAgendaCategory()
  const [editor, setEditor] = useState<Editor | null>(null)

  const categories = categoriesQ.data ?? []
  const selected = categories.find((c) => c.id === value) ?? null
  const busy = create.isPending || update.isPending || remove.isPending

  function openNew() {
    // Primeira cor que ainda não está em uso, para a nova já nascer distinta.
    const used = new Set(categories.map((c) => c.color.toLowerCase()))
    const color = EVENT_COLORS.find((c) => !used.has(c)) ?? EVENT_COLORS[0]
    setEditor({ mode: "new", name: "", color, icon: "calendar" })
  }

  function openEdit(c: AgendaCategory) {
    setEditor({
      mode: "edit",
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
    })
  }

  async function save() {
    if (!editor) return
    const name = editor.name.trim()
    if (!name) return toast.error("Dê um nome à categoria")
    try {
      if (editor.mode === "new") {
        const c = await create.mutateAsync({
          name,
          color: editor.color,
          icon: editor.icon,
        })
        onChange(c.id)
      } else {
        await update.mutateAsync({
          id: editor.id,
          patch: { name, color: editor.color, icon: editor.icon },
        })
      }
      setEditor(null)
    } catch (err) {
      toast.error(agendaErrorMessage(err))
    }
  }

  async function removeCategory() {
    if (editor?.mode !== "edit") return
    const ok = await confirmDialog({
      title: `Excluir a categoria “${editor.name}”?`,
      description:
        "Os compromissos dela continuam na agenda, só ficam sem categoria.",
      confirmLabel: "Excluir",
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(editor.id)
      if (value === editor.id) onChange(null)
      setEditor(null)
    } catch (err) {
      toast.error(agendaErrorMessage(err))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const active = c.id === value
          const Icon = eventIcon(c.icon)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? null : c.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors [touch-action:manipulation]",
                !active &&
                  "border-border/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              )}
              style={
                active
                  ? {
                      borderColor: tint(c.color, 0.7),
                      backgroundColor: tint(c.color, 0.18),
                      color: lighten(c.color, 0.55),
                    }
                  : undefined
              }
            >
              <Icon
                weight="fill"
                className="size-3.5"
                style={{ color: active ? undefined : c.color }}
              />
              {c.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <PlusIcon weight="bold" className="size-3" />
          Nova
        </button>
        {selected && !editor && (
          <button
            type="button"
            onClick={() => openEdit(selected)}
            className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            aria-label={`Editar a categoria ${selected.name}`}
          >
            <PencilSimpleIcon weight="fill" className="size-3" />
            Editar
          </button>
        )}
      </div>

      {editor && (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg"
              style={{
                backgroundColor: tint(editor.color, 0.2),
                color: lighten(editor.color),
              }}
            >
              {(() => {
                const Icon = eventIcon(editor.icon)
                return <Icon weight="fill" className="size-4" />
              })()}
            </span>
            <Input
              autoFocus
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  save()
                }
              }}
              placeholder="Nome da categoria"
              maxLength={40}
              className="h-9"
            />
          </div>

          <div>
            <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Cor
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_COLORS.map((c) => {
                const active = editor.color.toLowerCase() === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditor({ ...editor, color: c })}
                    className={cn(
                      "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110",
                      active && "ring-2 ring-foreground",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                    aria-pressed={active}
                  >
                    {active && (
                      <CheckIcon
                        weight="bold"
                        className="size-3.5 text-white drop-shadow"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Ícone
            </p>
            <div className="flex flex-wrap gap-1">
              {EVENT_ICONS.map(({ key, label, icon: Icon }) => {
                const active = editor.icon === key
                return (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={active}
                    onClick={() => setEditor({ ...editor, icon: key })}
                    className={cn(
                      "grid size-9 place-items-center rounded-md transition-colors [touch-action:manipulation]",
                      !active &&
                        "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                    style={
                      active
                        ? {
                            backgroundColor: tint(editor.color, 0.22),
                            color: lighten(editor.color),
                          }
                        : undefined
                    }
                  >
                    <Icon weight="fill" className="size-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editor.mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={removeCategory}
                className="text-destructive hover:bg-destructive/10"
              >
                <TrashIcon weight="fill" />
                Excluir
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              Cancelar
            </Button>
            <Button type="button" size="sm" loading={busy} onClick={save}>
              {editor.mode === "new" ? "Criar categoria" : "Salvar categoria"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
