import { useState } from "react"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CheckIcon,
  PaletteIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ColorPicker } from "@/components/finance/color-picker"
import { AvatarPicker } from "@/components/patient/avatar-picker"
import { ConfirmDeleteDialog } from "@/components/finance/confirm-delete-dialog"
import { colorForKey } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

export interface CrudItem {
  id: string
  name: string
  active: boolean
  color?: string | null
  avatarId?: number
  badge?: string
}

export interface KindOption {
  value: string
  label: string
}

/** Optional per-item "type" selector (e.g. payment method: comum/empréstimo/cartão). */
export interface KindControl {
  options: KindOption[]
  valueOf: (item: CrudItem) => string
  onChange: (id: string, value: string) => Promise<void>
}

interface Props {
  breadcrumbs: { label: string }[]
  title: string
  description: string
  items: CrudItem[]
  placeholder: string
  showColor?: boolean
  showAvatar?: boolean
  /** Optional per-item type selector shown before the actions. */
  kinds?: KindControl
  onAdd: (name: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onColor?: (id: string, color: string) => Promise<void>
  onAvatar?: (id: string, avatarId: number) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onRestore: (id: string) => Promise<void>
  /** Fetch how many records reference this item (+ optional warning hint). */
  getDeleteInfo: (item: CrudItem) => Promise<{ count: number; hint?: string }>
  /** Perform the cascade delete. */
  onDelete: (id: string) => Promise<void>
}

/**
 * Reusable cadastro page: header with counter + "mostrar arquivados" toggle,
 * add row, list (one card per item) with inline rename, optional color picker,
 * archive/restore, and destructive delete (typed-"excluir" confirmation when
 * related records exist).
 */
export function FinanceCrudList({
  breadcrumbs,
  title,
  description,
  items,
  placeholder,
  showColor,
  showAvatar,
  kinds,
  onAdd,
  onRename,
  onColor,
  onAvatar,
  onArchive,
  onRestore,
  getDeleteInfo,
  onDelete,
}: Props) {
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [colorId, setColorId] = useState<string | null>(null)

  const [deleting, setDeleting] = useState<CrudItem | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<{ count: number; hint?: string }>(
    { count: 0 },
  )
  const [deleteBusy, setDeleteBusy] = useState(false)

  const totalActive = items.filter((i) => i.active).length
  const totalArchived = items.length - totalActive
  const visible = items
    .filter((i) => (showArchived ? true : i.active))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

  async function add() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await onAdd(newName.trim())
      setNewName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setAdding(false)
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

  async function askDelete(item: CrudItem) {
    setDeleting(item)
    setDeleteInfo({ count: 0 })
    try {
      setDeleteInfo(await getDeleteInfo(item))
    } catch {
      /* keep zero — simple confirm */
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await onDelete(deleting.id)
      toast.success("Excluído")
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={breadcrumbs} />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {totalActive}
            </span>
            {totalArchived > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {totalArchived} arquivado{totalArchived === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
              placeholder={placeholder}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  add()
                }
              }}
              className="flex-1"
            />
            <Button onClick={add} disabled={!newName.trim()} loading={adding}>
              {!adding && <PlusIcon weight="bold" />}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum item.</p>
        )}
        {visible.map((it) => (
          <Card key={it.id} className={!it.active ? "opacity-60" : ""}>
            <CardContent className="p-0">
              <div className="flex items-center gap-3 p-3">
                {showAvatar && it.avatarId != null && onAvatar && (
                  <AvatarPicker
                    value={it.avatarId}
                    name={it.name}
                    size="sm"
                    onChange={(a) => onAvatar(it.id, a)}
                  />
                )}
                {showColor && (
                  <button
                    type="button"
                    onClick={() => setColorId(colorId === it.id ? null : it.id)}
                    className="grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-border"
                    style={{ backgroundColor: it.color ?? colorForKey(it.name) }}
                    aria-label="Trocar cor"
                  >
                    <PaletteIcon
                      weight="bold"
                      className="size-3 text-white/80 drop-shadow"
                    />
                  </button>
                )}

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

                {kinds ? (
                  <KindSelect
                    options={kinds.options}
                    value={kinds.valueOf(it)}
                    onChange={(v) => kinds.onChange(it.id, v)}
                  />
                ) : (
                  it.badge && (
                    <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {it.badge}
                    </span>
                  )
                )}

                {!it.active && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    arquivado
                  </span>
                )}

                {it.active ? (
                  <button
                    type="button"
                    onClick={() =>
                      onArchive(it.id).then(() => toast.success("Arquivado"))
                    }
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    aria-label="Arquivar"
                    title="Arquivar"
                  >
                    <ArchiveIcon weight="fill" className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onRestore(it.id).then(() => toast.success("Restaurado"))
                    }
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-primary/15 hover:text-primary"
                    aria-label="Restaurar"
                    title="Restaurar"
                  >
                    <ArrowCounterClockwiseIcon weight="fill" className="size-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => askDelete(it)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  aria-label="Excluir"
                  title="Excluir"
                >
                  <TrashIcon weight="fill" className="size-3.5" />
                </button>
              </div>

              {showColor && colorId === it.id && onColor && (
                <div className="border-t border-border/50 p-3">
                  <ColorPicker
                    value={it.color ?? null}
                    onChange={(c) =>
                      onColor(it.id, c).then(() => setColorId(null))
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        itemName={deleting?.name ?? ""}
        relatedCount={deleteInfo.count}
        relatedHint={deleteInfo.hint}
        busy={deleteBusy}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

/** Compact dropdown to change an item's "type" (payment-method kind). */
function KindSelect({
  options,
  value,
  onChange,
}: {
  options: KindOption[]
  value: string
  onChange: (value: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const current = options.find((o) => o.value === value) ?? options[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
          title="Alterar tipo da forma de pagamento"
        >
          {busy ? <Spinner className="size-3" /> : null}
          {current.label}
          <CaretDownIcon weight="bold" className="size-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={async () => {
              if (o.value === value) return
              setBusy(true)
              try {
                await onChange(o.value)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erro")
              } finally {
                setBusy(false)
              }
            }}
          >
            <CheckIcon
              weight="bold"
              className={cn(
                "size-3.5",
                o.value === value ? "opacity-100" : "opacity-0",
              )}
            />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
