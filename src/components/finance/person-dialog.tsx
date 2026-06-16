import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ShuffleIcon } from "@phosphor-icons/react"
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
import { PatientAvatar } from "@/components/patient/patient-avatar"
import {
  monsterAvatarIds,
  monsterAvatarSrc,
  randomMonsterAvatarId,
} from "@/lib/monster-avatars"
import { useCreatePerson, useUpdatePerson } from "@/api/queries"
import type { Person } from "@/db/types"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** When set, edits this person; otherwise creates a new one. */
  editing?: Person | null
  onCreated?: (id: string) => void
}

/** Add/edit a person: name + inline monster-avatar picker (no popover, so it
 *  never clips inside the dialog). */
export function PersonDialog({ open, onOpenChange, editing, onCreated }: Props) {
  const create = useCreatePerson()
  const update = useUpdatePerson()
  const [name, setName] = useState("")
  const [avatarId, setAvatarId] = useState(1)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setAvatarId(editing.avatarId)
    } else {
      setName("")
      setAvatarId(randomMonsterAvatarId())
    }
  }, [open, editing])

  const busy = create.isPending || update.isPending

  async function save() {
    if (!name.trim()) return toast.error("Informe um nome")
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { name: name.trim(), avatarId },
        })
        toast.success("Pessoa atualizada")
      } else {
        const p = await create.mutateAsync({ name: name.trim(), avatarId })
        toast.success("Pessoa adicionada")
        onCreated?.(p.id)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
          <DialogDescription>
            Nome e avatar da contraparte de empréstimos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <PatientAvatar avatarId={avatarId} name={name} size="lg" />
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Nome
              </label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da pessoa"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    save()
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Avatar
              </label>
              <button
                type="button"
                onClick={() => setAvatarId(randomMonsterAvatarId())}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <ShuffleIcon weight="bold" className="size-3" />
                Aleatório
              </button>
            </div>
            <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto rounded-lg border border-border/50 p-2">
              {monsterAvatarIds().map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAvatarId(id)}
                  className={cn(
                    "overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.03]",
                    avatarId === id
                      ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                      : "border-transparent opacity-80 hover:opacity-100",
                  )}
                  aria-label={`Avatar ${id}`}
                  aria-pressed={avatarId === id}
                >
                  <img
                    src={monsterAvatarSrc(id)}
                    alt=""
                    className="aspect-square w-full bg-muted/30 object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
