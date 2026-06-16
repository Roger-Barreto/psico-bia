import { useEffect, useState } from "react"
import { WarningIcon } from "@phosphor-icons/react"
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

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Name of the item being deleted (shown in the message). */
  itemName: string
  /** How many related records will also be deleted. 0 → simple confirm. */
  relatedCount: number
  /** Optional extra line shown when relatedCount > 0. */
  relatedHint?: string
  busy?: boolean
  onConfirm: () => void
}

/**
 * Destructive delete confirmation. When there are related records, it warns
 * they will all be deleted and requires typing "excluir" to enable the action.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  relatedCount,
  relatedHint,
  busy,
  onConfirm,
}: Props) {
  const [text, setText] = useState("")
  const needsType = relatedCount > 0
  const canDelete = !needsType || text.trim().toLowerCase() === "excluir"

  useEffect(() => {
    if (!open) setText("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir “{itemName}”?</DialogTitle>
          <DialogDescription>
            {needsType
              ? "Esta ação não pode ser desfeita."
              : "Tem certeza que deseja excluir este item?"}
          </DialogDescription>
        </DialogHeader>

        {needsType && (
          <div className="space-y-3">
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <WarningIcon weight="fill" className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p>
                  Existem <strong>{relatedCount}</strong>{" "}
                  {relatedCount === 1 ? "registro relacionado" : "registros relacionados"}.
                  Todos serão <strong>excluídos</strong> junto.
                </p>
                {relatedHint && (
                  <p className="text-xs opacity-90">{relatedHint}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Digite <strong className="text-foreground">excluir</strong> para confirmar
              </label>
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="excluir"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canDelete && !busy) onConfirm()
                }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canDelete}
            loading={busy}
          >
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
