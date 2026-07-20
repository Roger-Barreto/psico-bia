import { toast } from "sonner"
import {
  countAppointmentsWithMethod,
  countFinanceUsage,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from "@/api/queries"
import { FinanceCrudList } from "@/components/finance/finance-crud"

export function FinancePaymentMethodsPage() {
  const methodsQ = usePaymentMethods()
  const create = useCreatePaymentMethod()
  const update = useUpdatePaymentMethod()
  const del = useDeletePaymentMethod()

  const methodsById = new Map((methodsQ.data ?? []).map((m) => [m.id, m]))

  return (
    <FinanceCrudList
      breadcrumbs={[
        { label: "Financeiro" },
        { label: "Cadastros" },
        { label: "Formas de pagamento" },
      ]}
      title="Formas de pagamento"
      description="Marque o tipo: “Empréstimo” pede uma pessoa e “Cartão de crédito” pede um cartão ao lançar. A cor é usada nos gráficos."
      placeholder="Nova forma…"
      showColor
      kinds={{
        options: [
          { value: "plain", label: "Comum" },
          { value: "loan", label: "Empréstimo" },
          { value: "credit", label: "Cartão de crédito" },
        ],
        valueOf: (item) => {
          const m = methodsById.get(item.id)
          return m?.isLoan ? "loan" : m?.isCreditCard ? "credit" : "plain"
        },
        onChange: async (id, value) => {
          await update.mutateAsync({
            id,
            patch: {
              isLoan: value === "loan",
              isCreditCard: value === "credit",
            },
          })
          toast.success("Tipo atualizado")
        },
      }}
      items={(methodsQ.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        active: m.active,
        color: m.color,
      }))}
      onAdd={async (name) => {
        await create.mutateAsync({ name })
      }}
      onRename={async (id, name) => {
        await update.mutateAsync({ id, patch: { name } })
      }}
      onColor={async (id, color) => {
        await update.mutateAsync({ id, patch: { color } })
      }}
      onArchive={async (id) => {
        await update.mutateAsync({ id, patch: { active: false } })
      }}
      onRestore={async (id) => {
        await update.mutateAsync({ id, patch: { active: true } })
      }}
      getDeleteInfo={async (item) => {
        const [count, appts] = await Promise.all([
          countFinanceUsage("payment_method_id", item.id),
          countAppointmentsWithMethod(item.id),
        ])
        const hint =
          appts > 0
            ? `${appts} ${appts === 1 ? "sessão manterá" : "sessões manterão"} o histórico, mas ${appts === 1 ? "perderá" : "perderão"} esta forma de pagamento.`
            : undefined
        return { count, hint }
      }}
      onDelete={async (id) => {
        await del.mutateAsync(id)
      }}
    />
  )
}
