import { useState } from "react"
import {
  CaretRightIcon,
  HandCoinsIcon,
  PlusIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type { LedgerEntry, PaymentMethod } from "@/db/types"
import {
  useCreatePerson,
  usePaymentMethods,
  usePeople,
  usePersonLedger,
} from "@/api/queries"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatBRL, personBalance } from "@/domain/finance"
import { formatDateBR } from "@/domain/dates"
import { cn } from "@/lib/utils"

export function PeopleTab() {
  const peopleQ = usePeople()
  const methodsQ = usePaymentMethods()
  const createPerson = useCreatePerson()
  const [selected, setSelected] = useState<string | null>(null)
  const [newName, setNewName] = useState("")

  const people = (peopleQ.data ?? []).filter((p) => p.active)
  const methodsById = new Map(
    (methodsQ.data ?? []).map((m) => [m.id, m] as const),
  )

  async function add() {
    if (!newName.trim()) return
    try {
      const p = await createPerson.mutateAsync({ name: newName.trim() })
      setNewName("")
      setSelected(p.id)
      toast.success("Pessoa adicionada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <div className="space-y-3">
        <Card>
          <CardContent className="flex gap-2 p-3">
            <Input
              placeholder="Nova pessoa…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <Button onClick={add} disabled={!newName.trim()} size="icon">
              <PlusIcon weight="bold" />
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-1.5">
          {people.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              Nenhuma pessoa cadastrada.
            </p>
          )}
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                selected === p.id
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-card/40 hover:bg-muted/30",
              )}
            >
              <span className="grid size-8 place-items-center rounded-full bg-muted/40 text-muted-foreground">
                <UserIcon weight="fill" className="size-4" />
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {p.name}
              </span>
              <CaretRightIcon
                weight="bold"
                className="size-3.5 text-muted-foreground"
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        {selected ? (
          <PersonDetail personId={selected} methodsById={methodsById} />
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
  )
}

function PersonDetail({
  personId,
  methodsById,
}: {
  personId: string
  methodsById: Map<string, PaymentMethod>
}) {
  const ledgerQ = usePersonLedger(personId)
  const entries = ledgerQ.data ?? []
  const bal = personBalance(entries)

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
            <p className="text-xs text-muted-foreground">Saldo em aberto</p>
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
          <p className="mb-3 text-sm font-semibold">Movimentações</p>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum empréstimo registrado com esta pessoa.
            </p>
          ) : (
            <div className="space-y-1.5">
              {entries.map((e) => (
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
