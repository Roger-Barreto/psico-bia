import { useMemo, useState } from "react"
import {
  DotsThreeVerticalIcon,
  HandCoinsIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { LedgerEntry, PaymentMethod, Person } from "@/db/types"
import {
  countFinanceUsage,
  useDeletePerson,
  usePaymentMethods,
  usePeople,
  usePersonLedger,
} from "@/api/queries"
import {
  formatBRL,
  periodLabel,
  periodOf,
  personBalance,
  todayPeriod,
} from "@/domain/finance"
import { formatDateBR } from "@/domain/dates"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { MonthNav } from "@/components/finance/month-nav"
import { PersonDialog } from "@/components/finance/person-dialog"
import { ConfirmDeleteDialog } from "@/components/finance/confirm-delete-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  const deletePerson = useDeletePerson()
  const [selected, setSelected] = useState<string | null>(null)
  const [period, setPeriod] = useState(todayPeriod())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)

  const [deleting, setDeleting] = useState<Person | null>(null)
  const [deleteCount, setDeleteCount] = useState(0)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const people = (peopleQ.data ?? []).filter((p) => p.active)
  const methodsById = new Map(
    (methodsQ.data ?? []).map((m) => [m.id, m] as const),
  )

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(p: Person) {
    setEditing(p)
    setDialogOpen(true)
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
          {people.map((p) => (
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
                <span className="flex-1 truncate text-sm font-medium">
                  {p.name}
                </span>
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
          ))}
        </div>

        <div>
          {selected ? (
            <PersonDetail
              personId={selected}
              methodsById={methodsById}
              period={period}
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
  period,
}: {
  personId: string
  methodsById: Map<string, PaymentMethod>
  period: string
}) {
  const ledgerQ = usePersonLedger(personId)
  const all = ledgerQ.data ?? []
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

      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-sm font-semibold">
            Movimentações de {periodLabel(period)}
          </p>
          {monthEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação neste mês.
            </p>
          ) : (
            <div className="space-y-1.5">
              {monthEntries.map((e) => (
                <PersonRow
                  key={e.id}
                  entry={e}
                  method={
                    e.paymentMethodId
                      ? methodsById.get(e.paymentMethodId)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PersonRow({
  entry: e,
  method,
}: {
  entry: LedgerEntry
  method?: PaymentMethod
}) {
  const income = e.kind === "income"
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {e.description}
          {e.installmentTotal ? (
            <span className="ml-1.5 rounded bg-muted/50 px-1 text-[10px] text-muted-foreground">
              {e.installmentNo}/{e.installmentTotal}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDateBR(e.date)}
          {method ? ` · ${method.name}` : ""} ·{" "}
          {e.settled ? "quitado" : income ? "a receber" : "a pagar"}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          income ? "text-emerald-300" : "text-rose-300",
        )}
      >
        {income ? "+" : "−"}
        {formatBRL(e.amount)}
      </p>
    </div>
  )
}
