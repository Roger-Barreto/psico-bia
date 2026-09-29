import { useMemo, useState } from "react"
import {
  ArrowClockwiseIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  PlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import type { Patient } from "@/db/types"
import { usePatients, useSessionPackages } from "@/api/queries"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { PackageCard } from "@/components/packages/package-card"
import { PackageDetailDialog } from "@/components/packages/package-detail-dialog"
import { PackageDialog } from "@/components/packages/package-dialog"
import { formatBRL } from "@/domain/finance"
import {
  packageState,
  packageTotals,
  type PackageState,
} from "@/domain/packages"
import { cn } from "@/lib/utils"

type Filter = PackageState | "all"

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Em andamento" },
  { id: "finished", label: "Concluídos" },
  { id: "closed", label: "Encerrados" },
  { id: "all", label: "Todos" },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/**
 * Acompanhamento dos pacotes de sessões: quem tem pacote, quantas sessões já
 * foram feitas e quantas ainda faltam.
 */
export function PackagesPage() {
  const packagesQ = useSessionPackages()
  const patientsQ = usePatients()
  const [filter, setFilter] = useState<Filter>("active")
  const [query, setQuery] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const patientsById = useMemo(() => {
    const m = new Map<string, Patient>()
    for (const p of patientsQ.data ?? []) m.set(p.id, p)
    return m
  }, [patientsQ.data])

  // Pacote de paciente arquivado sai da tela, como sai do resto do app.
  const packages = useMemo(
    () =>
      (packagesQ.data ?? []).filter(
        (p) => patientsById.get(p.patientId)?.active,
      ),
    [packagesQ.data, patientsById],
  )

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      active: 0,
      finished: 0,
      closed: 0,
      all: packages.length,
    }
    for (const p of packages) c[packageState(p)]++
    return c
  }, [packages])

  const totals = useMemo(() => packageTotals(packages), [packages])

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    return packages
      .filter((p) => filter === "all" || packageState(p) === filter)
      .filter((p) =>
        q
          ? normalize(patientsById.get(p.patientId)?.name ?? "").includes(q)
          : true,
      )
      .slice()
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  }, [packages, filter, query, patientsById])

  const detail = packages.find((p) => p.id === detailId) ?? null
  const isLoading = packagesQ.isLoading || patientsQ.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Pacotes" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">
            Pacotes de sessões
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sessões pagas de uma vez e descontadas a cada atendimento.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <PlusIcon weight="bold" />
          Novo pacote
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 [&>*]:min-w-0">
        <KpiCard
          label="Em andamento"
          value={totals.active}
          tone="success"
          hint={totals.active === 1 ? "pacote" : "pacotes"}
        />
        <KpiCard
          label="Sessões a realizar"
          value={totals.sessionsToDeliver}
          tone="secondary"
          hint="já pagas"
        />
        <div className="col-span-2 @3xl:col-span-1">
          <KpiCard
            label="Valor a realizar"
            value={formatBRL(totals.valueToDeliver)}
            hint="recebido por sessões que ainda vão acontecer"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Filtrar pacotes"
          // 2×2 no celular: numa linha só, as duas últimas abas ficavam
          // escondidas atrás de uma rolagem lateral.
          className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/40 p-1 sm:flex"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors sm:justify-start",
                filter === f.id
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {counts[f.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <MagnifyingGlassIcon
            weight="fill"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar por paciente..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : packagesQ.isError ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm text-rose-200">
            <span className="flex items-center gap-1.5">
              <WarningCircleIcon weight="fill" className="size-4 shrink-0" />
              Não foi possível carregar os pacotes.
            </span>
            <Button variant="outline" onClick={() => packagesQ.refetch()}>
              <ArrowClockwiseIcon weight="bold" />
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <PackageIcon weight="duotone" className="size-8 text-primary/70" />
            {packages.length === 0 ? (
              <>
                <p className="font-medium text-foreground">
                  Nenhum pacote registrado
                </p>
                <p className="max-w-sm">
                  Ao marcar uma sessão como paga, escolha “Novo pacote”, informe
                  o valor e a quantidade de sessões. As próximas sessões do
                  paciente são descontadas sozinhas.
                </p>
              </>
            ) : (
              <p>Nenhum pacote nesta seleção.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {shown.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              patient={patientsById.get(p.patientId) ?? null}
              onOpen={() => setDetailId(p.id)}
            />
          ))}
        </div>
      )}

      <PackageDetailDialog
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null)
        }}
        pkg={detail}
        patient={detail ? (patientsById.get(detail.patientId) ?? null) : null}
      />
      <PackageDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
