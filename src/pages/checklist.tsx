import { useState } from "react"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react"
import {
  useArchiveSharedItem,
  useCreateSharedItem,
  useSharedChecklist,
  useUpdateSharedItem,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/breadcrumbs"

export function SharedChecklistPage() {
  const { data, isLoading } = useSharedChecklist()
  const add = useCreateSharedItem()
  const update = useUpdateSharedItem()
  const archive = useArchiveSharedItem()
  const [newLabel, setNewLabel] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const all = data ?? []
  const items = all
    .filter((i) => (showArchived ? true : !i.archived))
    .slice()
    .sort((a, b) => a.order - b.order)
  const totalActive = all.filter((i) => !i.archived).length
  const totalArchived = all.length - totalActive

  async function onAdd() {
    if (!newLabel.trim()) return
    const order = (data?.length ?? 0) + 1
    try {
      await add.mutateAsync({
        label: newLabel.trim(),
        order,
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
            Itens herdados por todos os pacientes em cada atendimento.
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
          <div className="flex gap-2">
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

      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.id} className={it.archived ? "opacity-60" : ""}>
            <CardContent className="flex items-center gap-3 p-3">
              <span className="grid size-8 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                {it.order}
              </span>
              {editingId === it.id ? (
                <>
                  <Input
                    autoFocus
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        saveEdit(it.id)
                      } else if (e.key === "Escape") {
                        setEditingId(null)
                      }
                    }}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(it.id)}
                    className="grid size-8 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15"
                    aria-label="Confirmar"
                  >
                    <CheckIcon weight="bold" className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                    aria-label="Cancelar"
                  >
                    <XIcon weight="bold" className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{it.label}</span>
                  {it.archived && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      arquivado
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(it.id)
                      setEditLabel(it.label)
                    }}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    aria-label="Editar"
                  >
                    <PencilSimpleIcon weight="fill" className="size-3.5" />
                  </button>
                  {it.archived ? (
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
                      <ArrowCounterClockwiseIcon
                        weight="fill"
                        className="size-3.5"
                      />
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        archive.mutate(it.id, {
                          onSuccess: () => toast.success("Arquivado"),
                        })
                      }
                      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      aria-label="Arquivar"
                    >
                      <ArchiveIcon weight="fill" className="size-3.5" />
                    </button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
