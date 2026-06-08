import { useEffect, useRef, useState } from "react"
import { Reorder, useDragControls } from "framer-motion"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  DotsSixVerticalIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import {
  useArchiveSharedItem,
  useCreateSharedItem,
  useDeleteSharedItemPermanent,
  useReorderSharedItems,
  useSharedChecklist,
  useUpdateSharedItem,
} from "@/api/queries"
import type { SharedChecklistItem } from "@/db/types"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { nextOrder } from "@/lib/checklist"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/breadcrumbs"

export function SharedChecklistPage() {
  const { data, isLoading } = useSharedChecklist()
  const add = useCreateSharedItem()
  const update = useUpdateSharedItem()
  const archive = useArchiveSharedItem()
  const reorder = useReorderSharedItems()
  const deletePermanent = useDeleteSharedItemPermanent()
  const [newLabel, setNewLabel] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const all = data ?? []
  const activeSorted = all
    .filter((i) => !i.archived)
    .slice()
    .sort((a, b) => a.order - b.order)
  const archivedSorted = all
    .filter((i) => i.archived)
    .slice()
    .sort((a, b) => a.order - b.order)
  const totalActive = activeSorted.length
  const totalArchived = archivedSorted.length

  // Local order for drag; re-synced from server whenever data changes.
  const [ordered, setOrdered] = useState<SharedChecklistItem[]>([])
  const orderedRef = useRef<SharedChecklistItem[]>([])
  orderedRef.current = ordered
  useEffect(() => {
    setOrdered(
      (data ?? [])
        .filter((i) => !i.archived)
        .slice()
        .sort((a, b) => a.order - b.order),
    )
  }, [data])

  function persistOrder() {
    const ids = orderedRef.current.map((i) => i.id)
    reorder.mutate(ids)
  }

  async function onAdd() {
    if (!newLabel.trim()) return
    try {
      await add.mutateAsync({
        label: newLabel.trim(),
        order: nextOrder(all),
        archived: false,
      })
      setNewLabel("")
      toast.success("Item adicionado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) return
    try {
      await update.mutateAsync({ id, patch: { label: editLabel.trim() } })
      setEditingId(null)
      toast.success("Atualizado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function onDeletePermanent(item: SharedChecklistItem) {
    const ok = await confirmDialog({
      title: "Excluir permanentemente",
      description: `Excluir "${item.label}" para sempre? Todo registro deste item será removido do sistema, inclusive de atendimentos passados, como se nunca tivesse existido. Para manter o histórico, use Arquivar.`,
      destructive: true,
      confirmLabel: "Excluir definitivamente",
    })
    if (!ok) return
    deletePermanent.mutate(item.id, {
      onSuccess: () => toast.success("Item excluído permanentemente"),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Erro"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs
            items={[{ label: "Cadastros" }, { label: "Checklist" }]}
          />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Checklist compartilhado
            </h1>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {totalActive}
            </span>
            {totalArchived > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {totalArchived} arquivado{totalArchived === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Itens herdados por todos os pacientes em cada atendimento. Arraste
            para reordenar.
          </p>
        </div>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Ocultando arquivados" : "Mostrar arquivados"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Novo item do checklist..."
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onAdd()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={onAdd}
              disabled={!newLabel.trim() || add.isPending}
            >
              <PlusIcon weight="bold" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      )}

      <Reorder.Group
        axis="y"
        values={ordered}
        onReorder={setOrdered}
        as="div"
        className="space-y-2"
      >
        {ordered.map((it) => (
          <SortableRow
            key={it.id}
            item={it}
            disabled={editingId !== null}
            onDragEnd={persistOrder}
            isEditing={editingId === it.id}
            editLabel={editLabel}
            setEditLabel={setEditLabel}
            onStartEdit={() => {
              setEditingId(it.id)
              setEditLabel(it.label)
            }}
            onSaveEdit={() => saveEdit(it.id)}
            onCancelEdit={() => setEditingId(null)}
            onArchive={() =>
              archive.mutate(it.id, {
                onSuccess: () => toast.success("Arquivado"),
              })
            }
            onDeletePermanent={() => onDeletePermanent(it)}
          />
        ))}
      </Reorder.Group>

      {showArchived && archivedSorted.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Arquivados
          </p>
          {archivedSorted.map((it) => (
            <Card key={it.id} className="opacity-60">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  {it.order}
                </span>
                <span className="flex-1 text-sm">{it.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  arquivado
                </span>
                <button
                  onClick={() =>
                    update.mutate(
                      { id: it.id, patch: { archived: false } },
                      { onSuccess: () => toast.success("Restaurado") },
                    )
                  }
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-primary/15 hover:text-primary"
                  aria-label="Restaurar"
                >
                  <ArrowCounterClockwiseIcon weight="fill" className="size-3.5" />
                </button>
                <button
                  onClick={() => onDeletePermanent(it)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  aria-label="Excluir permanentemente"
                >
                  <TrashIcon weight="fill" className="size-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

interface SortableRowProps {
  item: SharedChecklistItem
  disabled: boolean
  onDragEnd: () => void
  isEditing: boolean
  editLabel: string
  setEditLabel: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onArchive: () => void
  onDeletePermanent: () => void
}

function SortableRow({
  item,
  disabled,
  onDragEnd,
  isEditing,
  editLabel,
  setEditLabel,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onArchive,
  onDeletePermanent,
}: SortableRowProps) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      as="div"
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-3">
          <button
            type="button"
            aria-label="Arrastar para reordenar"
            onPointerDown={(e) => {
              if (!disabled) controls.start(e)
            }}
            className={
              "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground " +
              (disabled
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab hover:bg-muted/40 active:cursor-grabbing")
            }
          >
            <DotsSixVerticalIcon weight="bold" className="size-4" />
          </button>
          {isEditing ? (
            <>
              <Input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onSaveEdit()
                  } else if (e.key === "Escape") {
                    onCancelEdit()
                  }
                }}
                className="flex-1"
              />
              <button
                type="button"
                onClick={onSaveEdit}
                className="grid size-8 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15"
                aria-label="Confirmar"
              >
                <CheckIcon weight="bold" className="size-4" />
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                aria-label="Cancelar"
              >
                <XIcon weight="bold" className="size-4" />
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm">{item.label}</span>
              <button
                onClick={onStartEdit}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                aria-label="Editar"
              >
                <PencilSimpleIcon weight="fill" className="size-3.5" />
              </button>
              <button
                onClick={onArchive}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-amber-500/15 hover:text-amber-500"
                aria-label="Arquivar"
              >
                <ArchiveIcon weight="fill" className="size-3.5" />
              </button>
              <button
                onClick={onDeletePermanent}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                aria-label="Excluir permanentemente"
              >
                <TrashIcon weight="fill" className="size-3.5" />
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </Reorder.Item>
  )
}
