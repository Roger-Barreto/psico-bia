import { useState } from "react"
import { CheckIcon, PlusIcon, XIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

export interface Option {
  id: string
  name: string
}

const ADD_SENTINEL = "__add__"

interface Props {
  value: string | null
  onChange: (id: string) => void
  options: Option[]
  placeholder?: string
  addLabel?: string
  onCreate: (name: string) => Promise<Option>
  disabled?: boolean
}

/**
 * Select with an inline "create new" affordance. Picking "+ Adicionar…"
 * swaps the trigger for a text input; on confirm it calls onCreate and
 * selects the freshly created option. Used for categories, payment
 * methods and people so the user can add one mid-flow.
 */
export function AddableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  addLabel = "Adicionar nova…",
  onCreate,
  disabled,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  async function confirmAdd() {
    const name = text.trim()
    if (!name) return
    setBusy(true)
    try {
      const created = await onCreate(name)
      onChange(created.id)
      setAdding(false)
      setText("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar")
    } finally {
      setBusy(false)
    }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nome…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              confirmAdd()
            } else if (e.key === "Escape") {
              setAdding(false)
              setText("")
            }
          }}
        />
        <button
          type="button"
          onClick={confirmAdd}
          disabled={busy || !text.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
          aria-label="Confirmar"
        >
          <CheckIcon weight="bold" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false)
            setText("")
          }}
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
          aria-label="Cancelar"
        >
          <XIcon weight="bold" className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => {
        if (v === ADD_SENTINEL) {
          setAdding(true)
          return
        }
        onChange(v)
      }}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
        <SelectItem value={ADD_SENTINEL} className="text-primary">
          <span className="flex items-center gap-1.5">
            <PlusIcon weight="bold" className="size-3.5" />
            {addLabel}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
