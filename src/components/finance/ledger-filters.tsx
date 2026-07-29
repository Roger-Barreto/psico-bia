import { useMemo } from "react"
import {
  ArrowsDownUpIcon,
  CheckIcon,
  FunnelSimpleIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { FinanceCategory, LedgerEntry } from "@/db/types"
import { colorForKey } from "@/lib/finance-colors"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// ─── Tipo de lançamento ──────────────────────────────────

/** Visão de tipo da tela de Lançamentos (grupo de botões no topo da lista). */
export type LedgerFilter = "all" | "payable" | "receivable" | "card" | "cofrinho"

// ─── Ordenação ───────────────────────────────────────────

/** Row order of the ledger / invoice transaction lists. */
export type LedgerSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"

export const DEFAULT_LEDGER_SORT: LedgerSort = "date-desc"

/** `short` goes on the trigger button, `label` inside the menu. */
export const LEDGER_SORTS: {
  id: LedgerSort
  short: string
  label: string
}[] = [
  { id: "date-desc", short: "Mais recentes", label: "Data — mais recentes primeiro" },
  { id: "date-asc", short: "Mais antigos", label: "Data — mais antigos primeiro" },
  { id: "amount-desc", short: "Maior valor", label: "Valor — do maior para o menor" },
  { id: "amount-asc", short: "Menor valor", label: "Valor — do menor para o maior" },
]

/** Value sorts drop the per-day grouping (a day subtotal makes no sense once
 *  the rows are ordered by amount) — the list goes flat with a date chip. */
export function isValueSort(sort: LedgerSort): boolean {
  return sort === "amount-desc" || sort === "amount-asc"
}

// ─── Categorias ──────────────────────────────────────────

/** Bucket key for entries with no category. */
export const NO_CATEGORY = "__sem-categoria__"

/** Bucket key for clinic income that arrives from the view with no category. */
export const CLINIC_INCOME = "__atendimentos__"

/** Fields needed to bucket an entry by category. */
type Categorizable = Pick<LedgerEntry, "categoryName" | "kind" | "scope">

/** Which bucket an entry falls under. Grouped by *name*, like the charts —
 *  clinic income comes from a view with a name but no category id; when it has
 *  no name either it gets its own bucket instead of falling in "Sem categoria". */
export function categoryKeyOf(e: Categorizable): string {
  if (e.categoryName) return e.categoryName
  return e.kind === "income" && e.scope === "clinic" ? CLINIC_INCOME : NO_CATEGORY
}

/** Label of an entry's bucket — same rule as `categoryKeyOf`. */
export function categoryNameOf(e: Categorizable): string {
  if (e.categoryName) return e.categoryName
  return e.kind === "income" && e.scope === "clinic"
    ? "Atendimentos"
    : "Sem categoria"
}

export interface CategoryOption {
  key: string
  name: string
  color: string
  count: number
  total: number
}

/**
 * Category buckets present in `entries`, biggest total first — the filter only
 * ever offers categories that actually have rows in the current view.
 */
export function categoryOptionsOf(
  entries: LedgerEntry[],
  categoriesById?: Map<string, FinanceCategory>,
): CategoryOption[] {
  const m = new Map<string, CategoryOption>()
  for (const e of entries) {
    const key = categoryKeyOf(e)
    const cur = m.get(key)
    if (cur) {
      cur.count += 1
      cur.total += e.amount
      continue
    }
    const name = categoryNameOf(e)
    m.set(key, {
      key,
      name,
      color:
        (e.categoryId ? categoriesById?.get(e.categoryId)?.color : null) ??
        colorForKey(name),
      count: 1,
      total: e.amount,
    })
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

/** Multi-select category filter. Empty selection = no filter (everything). */
export function CategoryFilter({
  options,
  selected,
  onChange,
  className,
}: {
  options: CategoryOption[]
  selected: string[]
  onChange: (next: string[]) => void
  className?: string
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const active = selected.length > 0

  function toggle(key: string) {
    onChange(
      selectedSet.has(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key],
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-w-0 gap-2",
            active && "border-primary/50 bg-primary/10",
            className,
          )}
          title="Filtrar por categoria"
        >
          <FunnelSimpleIcon weight="fill" />
          <span className="truncate">
            {active && options.length
              ? (options.find((o) => o.key === selected[0])?.name ?? "Categorias")
              : "Categorias"}
          </span>
          {selected.length > 1 && (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/25 text-[11px] font-bold text-primary">
              +{selected.length - 1}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[17rem] p-2">
        <div className="mb-1 flex items-center justify-between gap-2 px-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categorias
          </p>
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              <XIcon weight="bold" className="size-3" />
              Limpar
            </button>
          )}
        </div>
        {options.length === 0 ? (
          <p className="px-1.5 py-5 text-center text-xs text-muted-foreground">
            Nenhuma categoria nesta lista.
          </p>
        ) : (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
            {options.map((o) => {
              const on = selectedSet.has(o.key)
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    onClick={() => toggle(o.key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors",
                      on ? "bg-primary/15" : "hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {on && <CheckIcon weight="bold" className="size-3" />}
                    </span>
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: o.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {o.count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Order switch for the transaction lists (date ⇄ value, both directions). */
export function SortMenu({
  value,
  onChange,
  className,
}: {
  value: LedgerSort
  onChange: (next: LedgerSort) => void
  className?: string
}) {
  const current =
    LEDGER_SORTS.find((s) => s.id === value) ?? LEDGER_SORTS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "min-w-0 gap-2",
            value !== DEFAULT_LEDGER_SORT && "border-primary/50 bg-primary/10",
            className,
          )}
          title="Mudar a ordenação"
        >
          <ArrowsDownUpIcon weight="bold" />
          <span className="truncate">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
        {LEDGER_SORTS.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => onChange(s.id)}
            className={cn(value === s.id && "bg-primary/10")}
          >
            {value === s.id ? (
              <CheckIcon weight="bold" />
            ) : (
              <span className="size-4 shrink-0" aria-hidden />
            )}
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
