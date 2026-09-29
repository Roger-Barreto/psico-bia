import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Patient, PatientKind } from "@/db/types"
import { useArchivePatient, usePatients } from "@/api/queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ClientAvatar,
  patientSummary,
} from "@/components/patient/patient-avatar"
import {
  couplesOfPatient,
  firstName,
  isCouple,
  matchesPatient,
} from "@/domain/couples"
import { PatientForm } from "@/components/patient/patient-form"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { CopyButton } from "@/components/ui/copy-button"
import { formatCpf } from "@/lib/cpf"
import { cn } from "@/lib/utils"

export function PatientsPage() {
  const { data, isLoading } = usePatients()
  const archive = useArchivePatient()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Patient | null>(null)
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [kindFilter, setKindFilter] = useState<PatientKind | "all">("all")
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const editId = searchParams.get("edit")
    if (!editId || !data) return
    const found = data.find((p) => p.id === editId)
    if (found) {
      setEditing(found)
      setOpen(true)
    }
    searchParams.delete("edit")
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, data, setSearchParams])

  const filtered = useMemo(() => {
    const list = data ?? []
    return list
      .filter((p) => (showArchived ? true : p.active))
      .filter((p) => kindFilter === "all" || p.kind === kindFilter)
      // Acha o casal pelo nome de qualquer uma das pessoas.
      .filter((p) => matchesPatient(p, query))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, query, showArchived, kindFilter])

  const all = data ?? []
  const visible = all.filter((p) => (showArchived ? true : p.active))
  const coupleCount = visible.filter(isCouple).length
  const totalActive = all.filter((p) => p.active).length
  const totalArchived = all.length - totalActive

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs
            items={[{ label: "Cadastros" }, { label: "Pacientes" }]}
          />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {totalActive}
            </span>
            {totalArchived > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {totalArchived} arquivado{totalArchived === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <PlusIcon weight="bold" />
          Novo paciente
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            weight="fill"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar por nome..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Ocultando arquivados" : "Mostrar arquivados"}
        </Button>
      </div>

      {/* Só aparece quando existe casal: sem casais, seria ruído. */}
      {(coupleCount > 0 || kindFilter !== "all") && (
        <div
          role="tablist"
          aria-label="Tipo de atendimento"
          className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/40 p-1 sm:inline-grid"
        >
          {(
            [
              { id: "all", label: "Todos", n: visible.length },
              {
                id: "individual",
                label: "Individuais",
                n: visible.length - coupleCount,
              },
              { id: "couple", label: "Casais", n: coupleCount },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={kindFilter === f.id}
              onClick={() => setKindFilter(f.id)}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                kindFilter === f.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {f.n}
              </span>
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhum paciente cadastrado ainda.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
        {filtered.map((p) => {
          const openEdit = () => {
            setEditing(p)
            setOpen(true)
          }
          return (
            <Card
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={openEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openEdit()
                }
              }}
              className={`cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!p.active ? "opacity-60" : ""}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <ClientAvatar patient={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {isCouple(p) && (
                      <span className="shrink-0 rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                        casal
                      </span>
                    )}
                    {!p.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        arquivado
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {(isCouple(p)
                      ? patientSummary(p).slice(1)
                      : patientSummary(p)
                    ).join(" · ")}
                  </p>
                  {isCouple(p) &&
                    p.members
                      .filter((m) => m.cpf)
                      .map((m) => (
                        <CpfLine
                          key={m.id}
                          label={firstName(m.name)}
                          copyLabel={`CPF de ${firstName(m.name)}`}
                          digits={m.cpf!}
                        />
                      ))}
                  {!isCouple(p) &&
                    couplesOfPatient(p.id, all).map((c) => (
                      <p
                        key={c.id}
                        className="mt-0.5 flex items-center gap-1 truncate text-xs text-secondary"
                      >
                        <UsersIcon weight="fill" className="size-3 shrink-0" />
                        Casal: {c.name}
                      </p>
                    ))}
                  {p.cpf && (
                    <CpfLine
                      label="CPF"
                      copyLabel="CPF"
                      digits={p.cpf}
                    />
                  )}
                  {p.payerCpf && (
                    <CpfLine
                      label="Pagador"
                      copyLabel="CPF do pagador"
                      digits={p.payerCpf}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit()
                    }}
                    aria-label="Editar"
                  >
                    <PencilSimpleIcon weight="fill" className="size-3.5" />
                  </button>
                  {p.active && (
                    <button
                      className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (
                          await confirmDialog({
                            title: "Arquivar paciente",
                            description: `Arquivar ${p.name}?`,
                            destructive: true,
                          })
                        ) {
                          archive.mutate(p.id, {
                            onSuccess: () => toast.success("Arquivado"),
                          })
                        }
                      }}
                      aria-label="Arquivar"
                    >
                      <TrashIcon weight="fill" className="size-3.5" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setEditing(null)
        }}
      >
        <SheetContent className="w-full max-w-2xl overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Editar paciente" : "Novo paciente"}
            </SheetTitle>
          </SheetHeader>
          <PatientForm
            key={editing?.id ?? "new"}
            patient={editing ?? undefined}
            onDone={() => {
              setOpen(false)
              setEditing(null)
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

/** Linha "CPF 000.000.000-00 [copiar]" nos cards da lista. */
function CpfLine({
  label,
  copyLabel,
  digits,
}: {
  label: string
  copyLabel: string
  digits: string
}) {
  const formatted = formatCpf(digits)
  return (
    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
      <span className="shrink-0 text-muted-foreground/70">{label}</span>
      <span className="truncate tabular-nums">{formatted}</span>
      <CopyButton value={formatted} label={copyLabel} />
    </div>
  )
}
