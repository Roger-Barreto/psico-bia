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
import { CardDialog } from "@/components/finance/card-dialog"
import { CofrinhoDialog } from "@/components/finance/cofrinho-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCards,
  useCofrinhos,
  useCreateFinanceCategory,
  useCreateInstallments,
  useCreateLoanGranted,
  useCreatePaymentMethod,
  useCreatePerson,
  useCreateRecurringRule,
  useCreateTransaction,
  useFinanceCategories,
  usePayWithCofrinho,
  usePaymentMethods,
  usePeople,
  useUpdateTransaction,
} from "@/api/queries"
import type { FinanceScope, LedgerEntry, TransactionKind } from "@/db/types"
import {
  addMonthsISO,
  cardInvoiceFor,
  installmentDates,
  periodOf,
  splitInstallments,
  todayPeriod,
} from "@/domain/finance"
import { formatLongDateBR, todayISO } from "@/domain/dates"
import { PiggyBankIcon, PlusIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type Mode = "single" | "installment" | "recurring"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  viewPeriod: string // currently viewed YYYY-MM (for recurring materialization)
  /** When set, the dialog edits this manual launch instead of creating one. */
  editing?: LedgerEntry | null
  /** Pre-select a credit card + its method when creating (from the Cartões page). */
  presetCardId?: string | null
  /** Pre-select a cofrinho + its method when creating (from the Cofrinhos page). */
  presetCofrinhoId?: string | null
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
  presetCardId,
  presetCofrinhoId,
}: Props) {
  const isEdit = !!editing

  const categoriesQ = useFinanceCategories()
  const methodsQ = usePaymentMethods()
  const peopleQ = usePeople()
  const cardsQ = useCards()
  const cofrinhosQ = useCofrinhos()

  const createCategory = useCreateFinanceCategory()
  const createMethod = useCreatePaymentMethod()
  const createPerson = useCreatePerson()

  const createTx = useCreateTransaction()
  const updateTx = useUpdateTransaction()
  const createInstallments = useCreateInstallments()
  const createLoanGranted = useCreateLoanGranted()
  const createRule = useCreateRecurringRule()
  const payWithCofrinho = usePayWithCofrinho()

  const categories = (categoriesQ.data ?? []).filter((c) => c.active)
  const methods = (methodsQ.data ?? []).filter((m) => m.active)
  const people = (peopleQ.data ?? []).filter((p) => p.active)
  const cards = (cardsQ.data ?? []).filter((c) => c.active)
  const cofrinhos = (cofrinhosQ.data ?? []).filter((c) => c.active)

  const [kind, setKind] = useState<TransactionKind>("expense")
  const [scope, setScope] = useState<FinanceScope>("personal")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [methodId, setMethodId] = useState<string | null>(null)
  const [personId, setPersonId] = useState<string | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [cofrinhoId, setCofrinhoId] = useState<string | null>(null)
  const [cofrinhoDialogOpen, setCofrinhoDialogOpen] = useState(false)
  // pay-with-cofrinho: whether to replenish the reserve, and in how many months
  const [replenish, setReplenish] = useState(true)
  const [repayInstallments, setRepayInstallments] = useState("1")
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
      setCardId(editing.cardId)
      setCofrinhoId(editing.cofrinhoId)
      setSettled(editing.settled)
      setMode("single")
    } else {
      setKind("expense")
      setScope("personal")
      setDescription("")
      setAmount("")
      setDate(todayISO())
      setCategoryId(null)
      setPersonId(null)
      setMode("single")
      setInstallments("2")
      setReplenish(true)
      setRepayInstallments("1")
      setWithOutflow(true)
      setOutflowMethodId(null)
      setOutflowCategoryId(null)
      // Pre-select the credit-card method + card when opened from a card page.
      const ccMethod = presetCardId
        ? (methodsQ.data ?? []).find((m) => m.active && m.isCreditCard)
        : undefined
      // Pre-select the cofrinho method + reserve when opened from a cofrinho page.
      const cofMethod = presetCofrinhoId
        ? (methodsQ.data ?? []).find((m) => m.active && m.isCofrinho)
        : undefined
      if (presetCardId && ccMethod) {
        setMethodId(ccMethod.id)
        setCardId(presetCardId)
        setCofrinhoId(null)
        setSettled(false)
      } else if (presetCofrinhoId && cofMethod) {
        setMethodId(cofMethod.id)
        setCofrinhoId(presetCofrinhoId)
        setCardId(null)
        setSettled(true)
      } else {
        setMethodId(null)
        setCardId(null)
        setCofrinhoId(null)
        setSettled(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const selectedMethod = methods.find((m) => m.id === methodId)
  const isLoan = selectedMethod?.isLoan ?? false
  const isCreditCard = selectedMethod?.isCreditCard ?? false
  const isCofrinho = selectedMethod?.isCofrinho ?? false
  const selectedCard = cards.find((c) => c.id === cardId)
  const selectedCofrinho = cofrinhos.find((c) => c.id === cofrinhoId)
  const amountNum = parseMoney(amount)
  const nInst = Math.max(2, Math.min(360, Number(installments) || 2))
  const nRepay = Math.max(1, Math.min(360, Number(repayInstallments) || 1))

  const isLoanGranted = !isEdit && kind === "income" && isLoan && withOutflow

  // Which invoice this purchase falls into (preview for the credit-card flow).
  const invoicePreview =
    isCreditCard && selectedCard && date
      ? cardInvoiceFor(selectedCard.closingDay, selectedCard.dueDay, date)
      : null

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
    createRule.isPending ||
    payWithCofrinho.isPending

  async function submit() {
    if (!description.trim()) return toast.error("Informe uma descrição")
    if (amountNum <= 0) return toast.error("Informe um valor válido")
    if (!date) return toast.error("Selecione a data")
    if (isLoan && !personId) return toast.error("Empréstimo exige uma pessoa")
    if (isCreditCard && !cardId)
      return toast.error("Selecione um cartão para o pagamento no crédito")
    if (isCofrinho && !cofrinhoId)
      return toast.error("Selecione o cofrinho de onde vai retirar")

    try {
      if (isEdit) {
        await updateTx.mutateAsync({
          id: editing!.id,
          installmentGroup: editing!.installmentGroup,
          patch: {
            kind,
            scope,
            description: description.trim(),
            amount: amountNum,
            date,
            categoryId,
            paymentMethodId: methodId,
            personId: isLoan ? personId : null,
            cardId: isCreditCard ? cardId : null,
            cofrinhoId: isCofrinho ? cofrinhoId : null,
            settled,
            settledAt: settled
              ? editing!.settled
                ? editing!.settledAt
                : new Date().toISOString()
              : null,
          },
        })
        toast.success("Lançamento atualizado")
      } else if (isCofrinho) {
        if (!cofrinhoId) return
        const repay =
          replenish && amountNum > 0
            ? {
                amounts: splitInstallments(amountNum, nRepay),
                dates: installmentDates(addMonthsISO(date, 1), nRepay),
              }
            : undefined
        await payWithCofrinho.mutateAsync({
          tx: {
            kind: "expense",
            scope,
            description: description.trim(),
            amount: amountNum,
            date,
            categoryId,
            paymentMethodId: methodId,
            cofrinhoId,
            settled: true,
          },
          repay,
        })
        toast.success(
          replenish
            ? `Pago com o cofrinho — reposição em ${nRepay}x`
            : "Pago com o cofrinho",
        )
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
            cardId: isCreditCard ? cardId : null,
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
          cardId: isCreditCard ? cardId : null,
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
          cardId: isCreditCard ? cardId : null,
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
                const m = methods.find((x) => x.id === id)
                // loans and card purchases start outstanding (a pagar)
                if (!isEdit && (m?.isLoan || m?.isCreditCard)) setSettled(false)
                // dropping the credit-card / cofrinho method clears its link
                if (!m?.isCreditCard) setCardId(null)
                if (!m?.isCofrinho) setCofrinhoId(null)
                // paying with a cofrinho is always an expense, paid now
                if (m?.isCofrinho) {
                  setKind("expense")
                  setSettled(true)
                }
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

          {isCreditCard && (
            <Field
              label="Cartão"
              hint={
                invoicePreview
                  ? mode === "installment" && !isEdit
                    ? `1ª parcela na fatura que vence em ${formatLongDateBR(invoicePreview.dueDate)}; as demais nas faturas seguintes.`
                    : `Entra na fatura que vence em ${formatLongDateBR(invoicePreview.dueDate)}.`
                  : "Selecione o cartão para lançar na fatura certa."
              }
            >
              <Select
                value={cardId ?? undefined}
                onValueChange={(v) => {
                  if (v === "__add_card__") {
                    setCardDialogOpen(true)
                    return
                  }
                  setCardId(v)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.last4 ? ` •••• ${c.last4}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="__add_card__" className="text-primary">
                    <span className="flex items-center gap-1.5">
                      <PlusIcon weight="bold" className="size-3.5" />
                      Novo cartão…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {isCofrinho && (
            <div className="space-y-3">
              <Field
                label="Cofrinho"
                hint={
                  selectedCofrinho
                    ? "O valor sai da reserva deste cofrinho."
                    : "Escolha de qual reserva o dinheiro vai sair."
                }
              >
                <Select
                  value={cofrinhoId ?? undefined}
                  onValueChange={(v) => {
                    if (v === "__add_cofrinho__") {
                      setCofrinhoDialogOpen(true)
                      return
                    }
                    setCofrinhoId(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar cofrinho" />
                  </SelectTrigger>
                  <SelectContent>
                    {cofrinhos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="__add_cofrinho__"
                      className="text-primary"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlusIcon weight="bold" className="size-3.5" />
                        Novo cofrinho…
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={replenish}
                    onChange={(e) => setReplenish(e.target.checked)}
                    className="size-4 rounded border-border accent-amber-500"
                  />
                  <span className="flex items-center gap-1.5">
                    <PiggyBankIcon
                      weight="fill"
                      className="size-4 text-amber-400"
                    />
                    Vou repor o cofrinho depois
                  </span>
                </label>
                {replenish && (
                  <div className="grid grid-cols-2 items-end gap-3">
                    <Field label="Em quantas vezes">
                      <Input
                        type="number"
                        min={1}
                        max={360}
                        value={repayInstallments}
                        onChange={(e) => setRepayInstallments(e.target.value)}
                      />
                    </Field>
                    <p className="pb-2.5 text-xs text-muted-foreground">
                      {amountNum > 0
                        ? `${nRepay}× de ${formatMoneyValue(splitInstallments(amountNum, nRepay)[0])} — metas a partir do mês que vem.`
                        : "Metas de guardar a partir do mês que vem."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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
          {!isEdit && !isLoanGranted && !isCofrinho && (
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

          {!isEdit && mode === "installment" && !isLoanGranted && !isCofrinho && (
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

          {(isEdit || (mode === "single" && !isLoanGranted)) &&
            !isCreditCard &&
            !isCofrinho && (
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

          {isCreditCard && (
            <p className="text-xs text-muted-foreground">
              O pagamento é controlado pela fatura do cartão, em{" "}
              <span className="font-medium text-foreground">Cartões</span>.
            </p>
          )}

          {isCofrinho && (
            <p className="text-xs text-muted-foreground">
              O valor sai da reserva do cofrinho.{" "}
              {replenish
                ? "As metas de reposição aparecerão nos próximos meses."
                : "Sem reposição, a reserva diminui de vez."}
            </p>
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

      <CardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        onCreated={(id) => setCardId(id)}
      />
      <CofrinhoDialog
        open={cofrinhoDialogOpen}
        onOpenChange={setCofrinhoDialogOpen}
        onCreated={(id) => setCofrinhoId(id)}
      />
    </Dialog>
  )
}
