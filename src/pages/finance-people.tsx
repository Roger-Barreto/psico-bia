import { useEffect, useMemo, useState } from "react"
import {
  DotsThreeVerticalIcon,
  HandCoinsIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type {
  FinanceCategory,
  LedgerEntry,
  PaymentMethod,
  Person,
} from "@/db/types"
import {
  countFinanceUsage,
  useDeletePerson,
  useFinanceCategories,
  usePaymentMethods,
  usePeople,
  usePeopleBalances,
  usePersonLedger,
} from "@/api/queries"
import {
  formatBRL,
  periodLabel,
  periodOf,
  personBalance,
  todayPeriod,
} from "@/domain/finance"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { MonthNav } from "@/components/finance/month-nav"
import { PersonDialog } from "@/components/finance/person-dialog"
import { TransactionDialog } from "@/components/finance/transaction-dialog"
import { TransactionList } from "@/components/finance/transaction-list"
import { ConfirmDeleteDialog } from "@/components/finance/confirm-delete-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function FinancePeoplePage() {
  const peopleQ = usePeople()
  const methodsQ = usePaymentMethods()
  const categoriesQ = useFinanceCategories()
  const balancesQ = usePeopleBalances()
  const deletePerson = useDeletePerson()
  const [selected, setSelected] = useState<string | null>(null)
  const [period, setPeriod] = useState(todayPeriod())
  const [hideZeroed, setHideZeroed] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)

  // Edit a launch from the person's ledger (same dialog as Lançamentos).
  const [txOpen, setTxOpen] = useState(false)
  const [txEditing, setTxEditing] = useState<LedgerEntry | null>(null)

  const [deleting, setDeleting] = useState<Person | null>(null)
  const [deleteCount, setDeleteCount] = useState(0)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const people = (peopleQ.data ?? []).filter((p) => p.active)
  const balancesById = balancesQ.data ?? new Map()

  /** Net open balance (they owe − you owe). 0 when nothing is outstanding. */
  function netOf(id: string): number {
    const b = balancesById.get(id)
    if (!b) return 0
    return b.receivable - b.payable
  }
  function isZeroed(id: string): boolean {
    const b = balancesById.get(id)
    return !b || (Math.abs(b.receivable) < 0.005 && Math.abs(b.payable) < 0.005)
  }

  // Hide people with no open balance (kept: the currently-selected one).
  const visiblePeople = useMemo(
    () =>
      hideZeroed
        ? people.filter((p) => !isZeroed(p.id) || p.id === selected)
        : people,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, hideZeroed, balancesById, selected],
  )
  const hiddenCount = people.length - visiblePeople.length

  const methodsById = useMemo(
    () => new Map((methodsQ.data ?? []).map((m) => [m.id, m] as const)),
    [methodsQ.data],
  )
  const peopleById = useMemo(
    () => new Map((peopleQ.data ?? []).map((p) => [p.id, p] as const)),
    [peopleQ.data],
  )
  const categoriesById = useMemo(
    () => new Map((categoriesQ.data ?? []).map((c) => [c.id, c] as const)),
    [categoriesQ.data],
  )

  // Auto-select the first visible person on entry (and after a deletion clears it).
  useEffect(() => {
    if (!selected && visiblePeople.length > 0) setSelected(visiblePeople[0].id)
  }, [visiblePeople, selected])

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(p: Person) {
    setEditing(p)
    setDialogOpen(true)
  }
  function openEditTx(entry: LedgerEntry) {
    setTxEditing(entry)
    setTxOpen(true)
  }
  async function askDelete(p: Person) {
    setDeleting(p)
    setDeleteCount(0)
    try {
      setDeleteCount(await countFinanceUsage("person_id", p.id))
    } catch {
      /* keep zero → simple confirm */
    }
  }
  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deletePerson.mutateAsync(deleting.id)
      toast.success("Excluído")
      if (selected === deleting.id) setSelected(null)
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Financeiro" }, { label: "Pessoas" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Pessoas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Extrato de empréstimos e saldo em aberto por pessoa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav period={period} onChange={setPeriod} />
          <Button onClick={openNew}>
            <PlusIcon weight="bold" />
            Nova pessoa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-1.5">
          {people.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 px-1 pb-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={hideZeroed}
                onChange={(e) => setHideZeroed(e.target.checked)}
                className="size-3.5 rounded border-border accent-primary"
              />
              Ocultar pessoas zeradas
              {hideZeroed && hiddenCount > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  {hiddenCount}
                </span>
              )}
            </label>
          )}
          {people.length === 0 && (
            <Card>
              <CardContent className="grid place-items-center gap-1 py-10 text-center text-sm text-muted-foreground">
                Nenhuma pessoa cadastrada.
                <button
                  type="button"
                  onClick={openNew}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Adicionar a primeira
                </button>
              </CardContent>
            </Card>
          )}
          {people.length > 0 && visiblePeople.length === 0 && (
            <Card>
              <CardContent className="grid place-items-center gap-1 py-10 text-center text-sm text-muted-foreground">
                Todas as pessoas estão zeradas.
                <button
                  type="button"
                  onClick={() => setHideZeroed(false)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Mostrar todas
                </button>
              </CardContent>
            </Card>
          )}
          {visiblePeople.map((p) => {
            const net = netOf(p.id)
            return (
            <div
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                selected === p.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-card/40 hover:bg-muted/30",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(p.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <PatientAvatar avatarId={p.avatarId} name={p.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.name}
                </span>
                {Math.abs(net) > 0.005 && (
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                      net > 0
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300",
                    )}
                    title={net > 0 ? "Te devem" : "Você deve"}
                  >
                    {net > 0 ? "+" : "−"}
                    {formatBRL(Math.abs(net))}
                  </span>
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                    aria-label="Ações"
                  >
                    <DotsThreeVerticalIcon weight="bold" className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(p)}>
                    <PencilSimpleIcon weight="fill" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => askDelete(p)}
                    className="text-destructive focus:bg-destructive/15"
                  >
                    <TrashIcon weight="fill" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            )
          })}
        </div>

        <div>
          {selected ? (
            <PersonDetail
              key={selected}
              personId={selected}
              methodsById={methodsById}
              peopleById={peopleById}
              categoriesById={categoriesById}
              period={period}
              onEditTx={openEditTx}
            />
          ) : (
            <Card>
              <CardContent className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <HandCoinsIcon weight="duotone" className="size-8 opacity-60" />
                Selecione uma pessoa para ver o extrato de empréstimos.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <PersonDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onCreated={(id) => setSelected(id)}
      />
      <TransactionDialog
        open={txOpen}
        onOpenChange={setTxOpen}
        viewPeriod={period}
        editing={txEditing}
      />
      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        itemName={deleting?.name ?? ""}
        relatedCount={deleteCount}
        busy={deleteBusy}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function PersonDetail({
  personId,
  methodsById,
  peopleById,
  categoriesById,
  period,
  onEditTx,
}: {
  personId: string
  methodsById: Map<string, PaymentMethod>
  peopleById: Map<string, Person>
  categoriesById: Map<string, FinanceCategory>
  period: string
  onEditTx: (entry: LedgerEntry) => void
}) {
  const ledgerQ = usePersonLedger(personId)
  const all = ledgerQ.data ?? []
  const [query, setQuery] = useState("")
  // Both the totals and the list are scoped to the selected month.
  const monthEntries = useMemo(
    () => all.filter((e) => periodOf(e.date) === period),
    [all, period],
  )
  const bal = personBalance(monthEntries)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-3 gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Te devem</p>
            <p className="mt-1 text-lg font-semibold text-emerald-300 tabular-nums">
              {formatBRL(bal.receivable)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Você deve</p>
            <p className="mt-1 text-lg font-semibold text-rose-300 tabular-nums">
              {formatBRL(bal.payable)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {bal.net >= 0 ? "Você vai receber" : "Você precisa pagar"}
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-semibold tabular-nums",
                bal.net >= 0 ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {bal.net >= 0 ? "+" : "−"}
              {formatBRL(Math.abs(bal.net))}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold">Lançamentos de {periodLabel(period)}</p>
      </div>

      <div className="relative">
        <MagnifyingGlassIcon
          weight="fill"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Buscar por descrição, valor, categoria, data…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <TransactionList
        entries={monthEntries}
        methodsById={methodsById}
        peopleById={peopleById}
        categoriesById={categoriesById}
        query={query}
        onEdit={onEditTx}
      />
    </div>
  )
}
