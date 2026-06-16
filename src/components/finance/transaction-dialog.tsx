import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput, parseMoney } from "@/components/ui/money-input"
import { DatePicker } from "@/components/ui/date-picker"
import { AddableSelect } from "@/components/finance/addable-select"
import {
  useCreateFinanceCategory,
  useCreateInstallments,
  useCreateLoanGranted,
  useCreatePaymentMethod,
  useCreatePerson,
  useCreateRecurringRule,
  useCreateTransaction,
  useFinanceCategories,
  usePaymentMethods,
  usePeople,
  useUpdateTransaction,
} from "@/api/queries"
import type { FinanceScope, LedgerEntry, TransactionKind } from "@/db/types"
import {
  installmentDates,
  periodOf,
  splitInstallments,
  todayPeriod,
} from "@/domain/finance"
import { todayISO } from "@/domain/dates"
import { cn } from "@/lib/utils"

type Mode = "single" | "installment" | "recurring"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  viewPeriod: string // currently viewed YYYY-MM (for recurring materialization)
  /** When set, the dialog edits this manual launch instead of creating one. */
  editing?: LedgerEntry | null
}

/** number → "1.234,56" */
function formatMoneyValue(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; tone?: "income" | "expense" }[]
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-lg border border-border/60 bg-background/40 p-1">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              !active && "text-muted-foreground hover:text-foreground",
              active &&
                o.tone === "income" &&
                "bg-emerald-500/15 text-emerald-300",
              active && o.tone === "expense" && "bg-rose-500/15 text-rose-300",
              active && !o.tone && "bg-primary/15 text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

export function TransactionDialog({
  open,
  onOpenChange,
  viewPeriod,
  editing,
}: Props) {
  const isEdit = !!editing

  const categoriesQ = useFinanceCategories()
  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()

  const createCategory = useCreateFinanceCategory()
  const createMethod = useCreatePaymentMethod()
  const createPerson = useCreatePerson()

  const createTx = useCreateTransaction()
  const updateTx = useUpdateTransaction()
  const createInstallments = useCreateInstallments()
  const createLoanGranted = useCreateLoanGranted()
  const createRule = useCreateRecurringRule()

  const categories = (categoriesQ.data ?? []).filter((c) => c.active)
  const methods = (methodsQ.data ?? []).filter((m) => m.active)
  const people = (peopleQ.data ?? []).filter((p) => p.active)

  const [kind, setKind] = useState<TransactionKind>("expense")
  const [scope, setScope] = useState<FinanceScope>("personal")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [settled, setSettled] = useState(true)
  const [mode, setMode] = useState<Mode>("single")
  const [installments, setInstallments] = useState("2")
  // loan granted (income + loan): also record the cash outflow
  const [withOutflow, setWithOutflow] = useState(true)
  const [outflowMethodId, setOutflowMethodId] = useState<string | null>(null)
  const [outflowCategoryId, setOutflowCategoryId] = useState<string | null>(null)

  // Prefill (edit) or reset (create) whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    if (editing) {
      setKind(editing.kind)
      setScope(editing.scope)
      setDescription(editing.description)
      setAmount(formatMoneyValue(editing.amount))
      setDate(editing.date)
      setCategoryId(editing.categoryId)
      setMethodId(editing.paymentMethodId)
      setPersonId(editing.personId)
      setSettled(editing.settled)
      setMode("single")
    } else {
      setKind("expense")
      setScope("personal")
      setDescription("")
      setAmount("")
      setDate(todayISO())
      setCategoryId(null)
      setMethodId(null)
      setPersonId(null)
      setSettled(true)
      setMode("single")
      setInstallments("2")
      setWithOutflow(true)
      setOutflowMethodId(null)
      setOutflowCategoryId(null)
    }
  }, [open, editing])

  const selectedMethod = methods.find((m) => m.id === methodId)
  const isLoan = selectedMethod?.isLoan ?? false
  const amountNum = parseMoney(amount)
  const nInst = Math.max(2, Math.min(360, Number(installments) || 2))

  const isLoanGranted = !isEdit && kind === "income" && isLoan && withOutflow

  const installmentPreview = useMemo(() => {
    if (mode !== "installment" || amountNum <= 0) return null
    return splitInstallments(amountNum, nInst)[0]
  }, [mode, amountNum, nInst])

  function close() {
    onOpenChange(false)
  }

  const busy =
    createTx.isPending ||
    updateTx.isPending ||
    createInstallments.isPending ||
    createLoanGranted.isPending ||
    createRule.isPending

  async function submit() {
    if (!description.trim()) return toast.error("Informe uma descrição")
    if (amountNum <= 0) return toast.error("Informe um valor válido")
    if (!date) return toast.error("Selecione a data")
    if (isLoan && !personId) return toast.error("Empréstimo exige uma pessoa")

    try {
      if (isEdit) {
        await updateTx.mutateAsync({
          id: editing!.id,
          patch: {
            kind,
            scope,
            description: description.trim(),
            amount: amountNum,
            date,
            categoryId,
            paymentMethodId: methodId,
            personId: isLoan ? personId : null,
            settled,
            settledAt: settled
              ? editing!.settled
                ? editing!.settledAt
                : new Date().toISOString()
              : null,
          },
        })
        toast.success("Lançamento atualizado")
      } else if (isLoanGranted) {
        // case 3b: cash outflow (expense) + receivable (income/loan)
        if (!methodId) return
        await createLoanGranted.mutateAsync({
          personId: personId!,
          amount: amountNum,
          date,
          description: description.trim(),
          scope,
          outflowCategoryId,
          outflowPaymentMethodId: outflowMethodId,
          receivablePaymentMethodId: methodId,
          outflowSettled: true,
        })
        toast.success("Empréstimo registrado (saída + a receber)")
      } else if (mode === "installment") {
        const amounts = splitInstallments(amountNum, nInst)
        const dates = installmentDates(date, nInst)
        await createInstallments.mutateAsync({
          base: {
            kind,
            scope,
            description: description.trim(),
            categoryId,
            paymentMethodId: methodId,
            personId: isLoan ? personId : null,
          },
          amounts,
          dates,
        })
        toast.success(`${nInst}x criadas`)
      } else if (mode === "recurring") {
        const dayOfMonth = Number(date.split("-")[2])
        await createRule.mutateAsync({
          kind,
          scope,
          description: description.trim(),
          amount: amountNum,
          categoryId,
          paymentMethodId: methodId,
          personId: isLoan ? personId : null,
          dayOfMonth,
          startPeriod: periodOf(date),
          untilPeriod: viewPeriod > todayPeriod() ? viewPeriod : todayPeriod(),
        })
        toast.success("Recorrência criada")
      } else {
        await createTx.mutateAsync({
          kind,
          scope,
          description: description.trim(),
          amount: amountNum,
          date,
          categoryId,
          paymentMethodId: methodId,
          personId: isLoan ? personId : null,
          settled,
        })
        toast.success(kind === "income" ? "Receita criada" : "Despesa criada")
      }
      close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
          <DialogDescription>
            A data define o mês de competência do valor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v)
              if (v === "expense") setWithOutflow(false)
            }}
            options={[
              { value: "income", label: "Receita", tone: "income" },
              { value: "expense", label: "Despesa", tone: "expense" },
            ]}
          />

          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: "personal", label: "Pessoal (PF)" },
              { value: "clinic", label: "Clínica (PJ)" },
            ]}
          />

          <Field label="Descrição">
            <Input
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Aluguel, Honorários…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Data (competência)">
              <DatePicker value={date} onChange={setDate} />
            </Field>
          </div>

          <Field label="Categoria">
            <AddableSelect
              value={categoryId}
              onChange={setCategoryId}
              options={categories}
              placeholder="Selecionar categoria"
              addLabel="Nova categoria…"
              onCreate={async (name) => {
                const c = await createCategory.mutateAsync({ name })
                return { id: c.id, name: c.name }
              }}
            />
          </Field>

          <Field
            label="Forma de pagamento"
            hint={
              isLoan
                ? kind === "expense"
                  ? "Empréstimo: você deve a esta pessoa."
                  : "Empréstimo: esta pessoa deve a você."
                : undefined
            }
          >
            <AddableSelect
              value={methodId}
              onChange={(id) => {
                setMethodId(id)
                // a loan starts outstanding (not yet paid back/received)
                if (!isEdit && methods.find((m) => m.id === id)?.isLoan)
                  setSettled(false)
              }}
              options={methods}
              placeholder="Selecionar forma"
              addLabel="Nova forma…"
              onCreate={async (name) => {
                const m = await createMethod.mutateAsync({ name })
                return { id: m.id, name: m.name }
              }}
            />
          </Field>

          {isLoan && (
            <Field label="Pessoa">
              <AddableSelect
                value={personId}
                onChange={setPersonId}
                options={people}
                placeholder="Selecionar pessoa"
                addLabel="Nova pessoa…"
                onCreate={async (name) => {
                  const p = await createPerson.mutateAsync({ name })
                  return { id: p.id, name: p.name }
                }}
              />
            </Field>
          )}

          {/* Loan granted — record the real cash outflow too (case 3b) */}
          {!isEdit && kind === "income" && isLoan && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={withOutflow}
                  onChange={(e) => setWithOutflow(e.target.checked)}
                  className="size-4 rounded border-border accent-primary"
                />
                Também saiu do meu caixa agora (eu paguei por essa pessoa)
              </label>
              {withOutflow && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Forma da saída">
                    <AddableSelect
                      value={outflowMethodId}
                      onChange={setOutflowMethodId}
                      options={methods.filter((m) => !m.isLoan)}
                      placeholder="PIX, Dinheiro…"
                      addLabel="Nova forma…"
                      onCreate={async (name) => {
                        const m = await createMethod.mutateAsync({ name })
                        return { id: m.id, name: m.name }
                      }}
                    />
                  </Field>
                  <Field label="Categoria da saída">
                    <AddableSelect
                      value={outflowCategoryId}
                      onChange={setOutflowCategoryId}
                      options={categories}
                      placeholder="Empréstimos concedidos"
                      addLabel="Nova categoria…"
                      onCreate={async (name) => {
                        const c = await createCategory.mutateAsync({ name })
                        return { id: c.id, name: c.name }
                      }}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* Recurrence / installments — only when creating */}
          {!isEdit && !isLoanGranted && (
            <Field label="Repetição">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "single", label: "Único" },
                  { value: "installment", label: "Parcelado" },
                  { value: "recurring", label: "Recorrente" },
                ]}
              />
            </Field>
          )}

          {!isEdit && mode === "installment" && !isLoanGranted && (
            <div className="grid grid-cols-2 items-end gap-3">
              <Field label="Nº de parcelas">
                <Input
                  type="number"
                  min={2}
                  max={360}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              </Field>
              <p className="pb-2.5 text-sm text-muted-foreground">
                {installmentPreview != null
                  ? `${nInst}× de ${formatMoneyValue(installmentPreview)}`
                  : "—"}
              </p>
            </div>
          )}

          {!isEdit && mode === "recurring" && !isLoanGranted && (
            <p className="text-xs text-muted-foreground">
              Repete todo mês no dia {Number(date.split("-")[2])} até ser
              cancelada.
            </p>
          )}

          {(isEdit || (mode === "single" && !isLoanGranted)) && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settled}
                onChange={(e) => setSettled(e.target.checked)}
                className="size-4 rounded border-border accent-emerald-500"
              />
              {kind === "income" ? "Já recebido" : "Já pago"}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
