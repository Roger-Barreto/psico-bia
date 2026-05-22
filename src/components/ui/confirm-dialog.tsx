import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

type Listener = (p: Pending | null) => void

const listeners = new Set<Listener>()
let current: Pending | null = null

function notify() {
  for (const l of listeners) l(current)
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (current) current.resolve(false)
  return new Promise<boolean>((resolve) => {
    current = { ...opts, resolve }
    notify()
  })
}

function resolveAndClose(ok: boolean) {
  if (!current) return
  const c = current
  current = null
  notify()
  c.resolve(ok)
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(current)

  useEffect(() => {
    const l: Listener = (p) => setPending(p)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) resolveAndClose(false)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pending?.title ?? ""}</DialogTitle>
          {pending?.description && (
            <DialogDescription>{pending.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => resolveAndClose(false)}>
            {pending?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            variant={pending?.destructive ? "destructive" : "default"}
            onClick={() => resolveAndClose(true)}
            autoFocus
          >
            {pending?.confirmLabel ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
