import { useEffect, useMemo, useState } from "react"
import {
  CheckIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { Patient } from "@/db/types"
import { Input } from "@/components/ui/input"
import { ClientAvatar } from "@/components/patient/patient-avatar"
import { isCouple, matchesPatient } from "@/domain/couples"
import { cn } from "@/lib/utils"

/** Selo "Casal" ao lado do nome. */
function CoupleTag() {
  return (
    <span className="shrink-0 rounded-full bg-secondary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary">
      Casal
    </span>
  )
}

interface Props {
  patients: Patient[]
  value: string
  onChange: (id: string) => void
}

/**
 * Busca de paciente com a lista **dentro da própria tela** (sem menu
 * flutuante). Acento-insensível, com navegação por teclado. Depois de
 * escolhido, vira uma linha com o nome e um botão para trocar.
 */
export function PatientCombobox({ patients, value, onChange }: Props) {
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)

  const sorted = useMemo(
    () => patients.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [patients],
  )
  // Acha o casal pelo nome de qualquer uma das pessoas.
  const filtered = useMemo(
    () => sorted.filter((p) => matchesPatient(p, query)),
    [sorted, query],
  )

  const selected = patients.find((p) => p.id === value) ?? null

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0)
  }, [filtered, activeIdx])

  function pick(id: string) {
    onChange(id)
    setQuery("")
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const p = filtered[activeIdx]
      if (p) pick(p.id)
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <ClientAvatar patient={selected} size="sm" />
          <span className="truncate text-sm">{selected.name}</span>
          {isCouple(selected) && <CoupleTag />}
        </span>
        <button
          type="button"
          onClick={() => onChange("")}
          className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label="Trocar paciente"
        >
          <XIcon weight="bold" className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="relative border-b border-border/60">
        <MagnifyingGlassIcon
          weight="fill"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar por nome..."
          className="border-0 bg-transparent pl-9 focus-visible:ring-0"
        />
      </div>
      <div className="max-h-56 touch-pan-y overflow-y-auto overscroll-contain py-1 [-webkit-overflow-scrolling:touch]">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            {patients.length === 0 ? "Nenhum paciente ativo" : "Nenhum resultado"}
          </div>
        )}
        {filtered.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onMouseEnter={() => setActiveIdx(i)}
            onClick={() => pick(p.id)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              i === activeIdx ? "bg-accent/30" : "hover:bg-accent/20",
            )}
          >
            <ClientAvatar patient={p} size="sm" />
            <span className="flex-1 truncate">{p.name}</span>
            {isCouple(p) && <CoupleTag />}
            {p.id === value && (
              <CheckIcon weight="bold" className="size-4 text-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
