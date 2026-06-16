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

  return (
    <FinanceCrudList
      breadcrumbs={[
        { label: "Financeiro" },
        { label: "Cadastros" },
        { label: "Formas de pagamento" },
      ]}
      title="Formas de pagamento"
      description="“Empréstimo” vincula a uma pessoa. A cor é usada nos gráficos."
      placeholder="Nova forma…"
      showColor
      items={(methodsQ.data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        active: m.active,
        color: m.color,
        badge: m.isLoan ? "empréstimo" : undefined,
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
