import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useCreatePatientAnnotation } from "@/api/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Props {
  patientId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function AddAnnotationDialog({ patientId, open, onOpenChange }: Props) {
  const [text, setText] = useState("")
  const create = useCreatePatientAnnotation()

  useEffect(() => {
    if (!open) setText("")
  }, [open])

  const trimmed = text.trim()

  async function submit() {
    if (!trimmed) return
    try {
      await create.mutateAsync({ patientId, text: trimmed })
      toast.success("Anotação adicionada")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar anotação</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Texto
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Anotações sobre o paciente..."
            rows={5}
            maxLength={2000}
            className={cn(
              "flex w-full rounded-md border border-input bg-background/40 px-3.5 py-2 text-sm text-foreground transition-colors",
              "placeholder:text-muted-foreground/70",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
            )}
          />
          <p className="text-[10px] text-muted-foreground">
            Ctrl/Cmd + Enter para salvar
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!trimmed || create.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
