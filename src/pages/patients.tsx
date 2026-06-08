import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Patient } from "@/db/types"
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
import { PatientAvatar, genderLabel } from "@/components/patient/patient-avatar"
import { PatientForm } from "@/components/patient/patient-form"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { ageFromBirthdate } from "@/domain/age"

export function PatientsPage() {
  const { data, isLoading } = usePatients()
  const archive = useArchivePatient()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Patient | null>(null)
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
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
    const q = query.trim().toLowerCase()
    return list
      .filter((p) => (showArchived ? true : p.active))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, query, showArchived])

  const all = data ?? []
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

      <div className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
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
                <PatientAvatar avatarId={p.avatarId} name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {!p.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        arquivado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ageFromBirthdate(p.birthdate)} anos · {genderLabel(p.gender)}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
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
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
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
