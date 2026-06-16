import {
  countFinanceUsage,
  useCreateFinanceCategory,
  useDeleteFinanceCategory,
  useFinanceCategories,
  useUpdateFinanceCategory,
} from "@/api/queries"
import { FinanceCrudList } from "@/components/finance/finance-crud"

export function FinanceCategoriesPage() {
  const categoriesQ = useFinanceCategories()
  const create = useCreateFinanceCategory()
  const update = useUpdateFinanceCategory()
  const del = useDeleteFinanceCategory()

  return (
    <FinanceCrudList
      breadcrumbs={[
        { label: "Financeiro" },
        { label: "Cadastros" },
        { label: "Categorias" },
      ]}
      title="Categorias"
      description="Usadas para analisar receitas e despesas. A cor é usada nos gráficos."
      placeholder="Nova categoria…"
      showColor
      items={(categoriesQ.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        active: c.active,
        color: c.color,
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
        const count = await countFinanceUsage("category_id", item.id)
        return { count }
      }}
      onDelete={async (id) => {
        await del.mutateAsync(id)
      }}
    />
  )
}
