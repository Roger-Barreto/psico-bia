import { useState } from "react"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
} from "@phosphor-icons/react"
import {
  useArchiveInsurance,
  useCreateInsurance,
  useInsurances,
  useUpdateInsurance,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { formatBRL } from "@/domain/finance"

export function InsurancesPage() {
  const { data, isLoading } = useInsurances()
  const add = useCreateInsurance()
  const update = useUpdateInsurance()
  const archive = useArchiveInsurance()
  const [newName, setNewName] = useState("")
  const [newValue, setNewValue] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editValue, setEditValue] = useState("")
  const [showArchived, setShowArchived] = useState(false)

  const all = data ?? []
  const items = all
    .filter((i) => (showArchived ? true : i.active))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const totalActive = all.filter((i) => i.active).length
  const totalArchived = all.length - totalActive

  async function onAdd() {
    if (!newName.trim()) return
    const valNum = Number(newValue) || 0
    if (valNum < 0) return toast.error("Valor inválido")
    try {
      await add.mutateAsync({
        name: newName.trim(),
        active: true,
        defaultValue: valNum,
      })
      setNewName("")
      setNewValue("")
      toast.success("Convênio adicionado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    const valNum = Number(editValue) || 0
    if (valNum < 0) return toast.error("Valor inválido")
    try {
      await update.mutateAsync({
        id,
        patch: { name: editName.trim(), defaultValue: valNum },
      })
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
            items={[{ label: "Cadastros" }, { label: "Convênios" }]}
          />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Convênios</h1>
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
            Opções disponíveis ao cadastrar pacientes. O valor padrão é
            sugerido no formulário.
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
              placeholder="Novo convênio (ex: Bradesco Saúde)..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onAdd()
                }
              }}
              className="flex-1"
            />
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="Valor padrão (R$)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onAdd()
                }
              }}
              className="sm:w-40"
            />
            <Button
              onClick={onAdd}
              disabled={!newName.trim() || add.isPending}
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
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum convênio cadastrado.
          </p>
        )}
        {items.map((it) => (
          <Card key={it.id} className={!it.active ? "opacity-60" : ""}>
            <CardContent className="flex items-center gap-3 p-3">
              {editingId === it.id ? (
                <>
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Valor"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        saveEdit(it.id)
                      } else if (e.key === "Escape") {
                        setEditingId(null)
                      }
                    }}
                    className="w-32"
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
                  <span className="flex-1 text-sm">{it.name}</span>
                  <span className="rounded-md bg-muted/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {it.defaultValue > 0 ? formatBRL(it.defaultValue) : "—"}
                  </span>
                  {!it.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      arquivado
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(it.id)
                      setEditName(it.name)
                      setEditValue(String(it.defaultValue ?? 0))
                    }}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    aria-label="Editar"
                  >
                    <PencilSimpleIcon weight="fill" className="size-3.5" />
                  </button>
                  {it.active ? (
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
                  ) : (
                    <button
                      onClick={() =>
                        update.mutate(
                          { id: it.id, patch: { active: true } },
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
