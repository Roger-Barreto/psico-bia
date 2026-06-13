import { useState } from "react"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  HandCoinsIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import {
  useCreateFinanceCategory,
  useCreatePaymentMethod,
  useCreatePerson,
  useFinanceCategories,
  usePaymentMethods,
  usePeople,
  useUpdateFinanceCategory,
  useUpdatePaymentMethod,
  useUpdatePerson,
} from "@/api/queries"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CrudItem {
  id: string
  name: string
  active: boolean
  badge?: string
}

function CrudSection({
  title,
  description,
  items,
  onAdd,
  onRename,
  onArchive,
  onRestore,
  placeholder,
}: {
  title: string
  description: string
  items: CrudItem[]
  onAdd: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onRestore: (id: string) => Promise<void>
  placeholder: string
}) {
  const [newName, setNewName] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const visible = items
    .filter((i) => (showArchived ? true : i.active))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

  async function add() {
    if (!newName.trim()) return
    try {
      await onAdd(newName.trim())
      setNewName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function save(id: string) {
    if (!editName.trim()) return
    try {
      await onRename(id, editName.trim())
      setEditingId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showArchived ? "Ocultar arquivados" : "Ver arquivados"}
          </button>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button onClick={add} disabled={!newName.trim()} size="icon">
            <PlusIcon weight="bold" />
          </Button>
        </div>

        <div className="space-y-1.5">
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item.</p>
          )}
          {visible.map((it) => (
            <div
              key={it.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2",
                !it.active && "opacity-60",
              )}
            >
              {editingId === it.id ? (
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      save(it.id)
                    } else if (e.key === "Escape") setEditingId(null)
                  }}
                  onBlur={() => save(it.id)}
                  className="h-8 flex-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(it.id)
                    setEditName(it.name)
                  }}
                  className="flex-1 text-left text-sm"
                >
                  {it.name}
                </button>
              )}
              {it.badge && (
                <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <HandCoinsIcon className="size-3" />
                  {it.badge}
                </span>
              )}
              {it.active ? (
                <button
                  type="button"
                  onClick={() =>
                    onArchive(it.id).then(() => toast.success("Arquivado"))
                  }
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  aria-label="Arquivar"
                >
                  <ArchiveIcon weight="fill" className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onRestore(it.id).then(() => toast.success("Restaurado"))
                  }
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-primary/15 hover:text-primary"
                  aria-label="Restaurar"
                >
                  <ArrowCounterClockwiseIcon weight="fill" className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function ConfigTab() {
  const categoriesQ = useFinanceCategories()
  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()

  const createCategory = useCreateFinanceCategory()
  const updateCategory = useUpdateFinanceCategory()
  const createMethod = useCreatePaymentMethod()
  const updateMethod = useUpdatePaymentMethod()
  const createPerson = useCreatePerson()
  const updatePerson = useUpdatePerson()

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <CrudSection
        title="Categorias"
        description="Usadas para analisar receitas e despesas."
        placeholder="Nova categoria…"
        items={(categoriesQ.data ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active,
        }))}
        onAdd={async (name) => {
          await createCategory.mutateAsync({ name })
        }}
        onRename={async (id, name) => {
          await updateCategory.mutateAsync({ id, patch: { name } })
        }}
        onArchive={async (id) => {
          await updateCategory.mutateAsync({ id, patch: { active: false } })
        }}
        onRestore={async (id) => {
          await updateCategory.mutateAsync({ id, patch: { active: true } })
        }}
      />

      <CrudSection
        title="Formas de pagamento"
        description="“Empréstimo” vincula a uma pessoa."
        placeholder="Nova forma…"
        items={(methodsQ.data ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          active: m.active,
          badge: m.isLoan ? "empréstimo" : undefined,
        }))}
        onAdd={async (name) => {
          await createMethod.mutateAsync({ name })
        }}
        onRename={async (id, name) => {
          await updateMethod.mutateAsync({ id, patch: { name } })
        }}
        onArchive={async (id) => {
          await updateMethod.mutateAsync({ id, patch: { active: false } })
        }}
        onRestore={async (id) => {
          await updateMethod.mutateAsync({ id, patch: { active: true } })
        }}
      />

      <CrudSection
        title="Pessoas"
        description="Contrapartes de empréstimos."
        placeholder="Nova pessoa…"
        items={(peopleQ.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          active: p.active,
        }))}
        onAdd={async (name) => {
          await createPerson.mutateAsync({ name })
        }}
        onRename={async (id, name) => {
          await updatePerson.mutateAsync({ id, patch: { name } })
        }}
        onArchive={async (id) => {
          await updatePerson.mutateAsync({ id, patch: { active: false } })
        }}
        onRestore={async (id) => {
          await updatePerson.mutateAsync({ id, patch: { active: true } })
        }}
      />
    </div>
  )
}
