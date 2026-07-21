import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  ArrowDownLeftIcon,
  DotsThreeVerticalIcon,
  PencilSimpleIcon,
  PiggyBankIcon,
  PlusIcon,
  StackIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"
import type { Cofrinho, CofrinhoEntry, LedgerEntry } from "@/db/types"
import {
  countCofrinhoUsage,
  useAllCofrinhoEntries,
  useAllCofrinhoTransactions,
  useCofrinhos,
  useCofrinhoWithdrawals,
  useDeleteCofrinho,
  useLedgerMonth,
} from "@/api/queries"
import {
  cofrinhoSlots,
  depositsBySource,
  incomeByDay,
  monthlyDeposited,
} from "@/domain/cofrinhos"
import {
  addPeriod,
  formatBRL,
  periodLabel,
  periodShort,
  todayPeriod,
} from "@/domain/finance"
import { formatLongDateBR } from "@/domain/dates"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CofrinhoDialog } from "@/components/finance/cofrinho-dialog"
import { CofrinhoDepositDialog } from "@/components/finance/cofrinho-deposit-dialog"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonthNav } from "@/components/finance/month-nav"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { colorForKey } from "@/lib/finance-colors"
import { brl, chartAxis, chartTooltip } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

const ALL = "__all__"

const SOURCE_LABEL: Record<string, string> = {
  fixed: "Meta fixa",
  percent: "% do faturamento",
  rollover: "Rollover",
  repay: "Reposição",
  manual: "Avulso",
}

function goalLabel(c: Cofrinho): string {
  if (c.goalType === "percent")
    return `${c.percent ?? 0}% ${c.incomeScope === "clinic" ? "da clínica" : "da receita"}`
  return `${formatBRL(c.fixedAmount ?? 0)} no dia ${c.fixedDay ?? 1}`
}

/** Net withdrawn (expenses funded by the cofrinho) among ledger rows. */
function withdrawnOf(tx: LedgerEntry[]): number {
  return tx.reduce((s, w) => s + (w.kind === "expense" ? w.amount : -w.amount), 0)
}

export function FinanceCofrinhosPage() {
  const cofrinhosQ = useCofrinhos()
  const allEntriesQ = useAllCofrinhoEntries()
  const withdrawalsMapQ = useCofrinhoWithdrawals()
  const allTxQ = useAllCofrinhoTransactions()
  const deleteCofrinho = useDeleteCofrinho()

  const [searchParams] = useSearchParams()
  const urlCofrinho = searchParams.get("cofrinho")

  const [selected, setSelected] = useState<string>(urlCofrinho ?? ALL)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Cofrinho | null>(null)
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositCofrinhoId, setDepositCofrinhoId] = useState<string | undefined>(
    undefined,
  )

  const cofrinhos = (cofrinhosQ.data ?? []).filter((c) => c.active)
  const allEntries = allEntriesQ.data ?? []
  const allTx = allTxQ.data ?? []
  const withdrawalsMap = withdrawalsMapQ.data ?? new Map<string, number>()

  const depositsByCofrinho = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of allEntries)
      if (e.kind === "deposit")
        m.set(e.cofrinhoId, (m.get(e.cofrinhoId) ?? 0) + e.amount)
    return m
  }, [allEntries])

  function balanceOf(c: Cofrinho): number {
    return (
      (c.initialAmount ?? 0) +
      (depositsByCofrinho.get(c.id) ?? 0) -
      (withdrawalsMap.get(c.id) ?? 0)
    )
  }

  useEffect(() => {
    if (urlCofrinho && cofrinhos.some((c) => c.id === urlCofrinho))
      setSelected(urlCofrinho)
  }, [urlCofrinho, cofrinhos])

  const selectedCofrinho =
    selected === ALL ? null : (cofrinhos.find((c) => c.id === selected) ?? null)

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(c: Cofrinho) {
    setEditing(c)
    setDialogOpen(true)
  }
  function openDeposit(id: string) {
    setDepositCofrinhoId(id)
    setDepositOpen(true)
  }
  async function askDelete(c: Cofrinho) {
    let count = 0
    try {
      count = await countCofrinhoUsage(c.id)
    } catch {
      /* best-effort */
    }
    const ok = await confirmDialog({
      title: `Excluir “${c.name}”?`,
      description:
        count > 0
          ? `${count} ${count === 1 ? "compra paga" : "compras pagas"} com este cofrinho ${count === 1 ? "continuará" : "continuarão"} como despesa no financeiro (sem vínculo). O histórico de guardados será apagado.`
          : "O histórico de guardados deste cofrinho será apagado.",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteCofrinho.mutateAsync(c.id)
      toast.success("Cofrinho excluído")
      if (selected === c.id) setSelected(ALL)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  const totalReserved = cofrinhos.reduce((s, c) => s + balanceOf(c), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Financeiro" }, { label: "Cofrinhos" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Cofrinhos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reservas de dinheiro com metas de guardar, mês a mês.
          </p>
        </div>
        <Button onClick={openNew}>
          <PlusIcon weight="bold" />
          Novo cofrinho
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-1.5">
          {cofrinhos.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(ALL)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-2 py-2 text-left transition-colors",
                selected === ALL
                  ? "border-amber-400/40 bg-amber-500/10"
                  : "border-border/50 bg-card/40 hover:bg-muted/30",
              )}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-300">
                <StackIcon weight="fill" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  Todos os cofrinhos
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {cofrinhos.length}{" "}
                  {cofrinhos.length === 1 ? "cofrinho" : "cofrinhos"}
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-300">
                {formatBRL(totalReserved)}
              </span>
            </button>
          )}

          {cofrinhos.length === 0 && (
            <Card>
              <CardContent className="grid place-items-center gap-1 py-10 text-center text-sm text-muted-foreground">
                Nenhum cofrinho cadastrado.
                <button
                  type="button"
                  onClick={openNew}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Criar o primeiro
                </button>
              </CardContent>
            </Card>
          )}

          {cofrinhos.map((c) => {
            const swatch = c.color ?? colorForKey(c.name)
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                  selected === c.id
                    ? "border-amber-400/40 bg-amber-500/10"
                    : "border-border/50 bg-card/40 hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-white shadow-inner"
                    style={{ backgroundColor: swatch }}
                  >
                    <PiggyBankIcon weight="fill" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {c.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {goalLabel(c)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-300">
                    {formatBRL(balanceOf(c))}
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
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <PencilSimpleIcon weight="fill" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => askDelete(c)}
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
          {cofrinhos.length === 0 ? (
            <Card>
              <CardContent className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
                <PiggyBankIcon weight="duotone" className="size-8 opacity-60" />
                Crie um cofrinho para acompanhar suas reservas.
              </CardContent>
            </Card>
          ) : selectedCofrinho ? (
            <CofrinhoPanel
              key={selectedCofrinho.id}
              cofrinho={selectedCofrinho}
              entries={allEntries.filter(
                (e) => e.cofrinhoId === selectedCofrinho.id,
              )}
              tx={allTx.filter((t) => t.cofrinhoId === selectedCofrinho.id)}
              balance={balanceOf(selectedCofrinho)}
              onAddValue={() => openDeposit(selectedCofrinho.id)}
            />
          ) : (
            <CombinedPanel
              cofrinhos={cofrinhos}
              entries={allEntries}
              tx={allTx}
              balanceOf={balanceOf}
              totalReserved={totalReserved}
            />
          )}
        </div>
      </div>

      <CofrinhoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onCreated={(id) => setSelected(id)}
      />
      <CofrinhoDepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        cofrinhoId={depositCofrinhoId}
      />
    </div>
  )
}

// ─── Combined ("Todos") panel ────────────────────────────────
function CombinedPanel({
  cofrinhos,
  entries,
  tx,
  balanceOf,
  totalReserved,
}: {
  cofrinhos: Cofrinho[]
  entries: CofrinhoEntry[]
  tx: LedgerEntry[]
  balanceOf: (c: Cofrinho) => number
  totalReserved: number
}) {
  const [period, setPeriod] = useState(todayPeriod())
  const ledgerQ = useLedgerMonth(period)
  const ledger = ledgerQ.data ?? []

  const savedMonth = entries
    .filter((e) => e.kind === "deposit" && e.period === period)
    .reduce((s, e) => s + e.amount, 0)
  const withdrawnMonth = withdrawnOf(
    tx.filter((t) => t.period === period),
  )
  const toSave = useMemo(() => {
    let sum = 0
    for (const c of cofrinhos) {
      const income = incomeByDay(ledger, c.incomeScope)
      for (const s of cofrinhoSlots(c, period, income, entries)) sum += s.pending
    }
    return sum
  }, [cofrinhos, ledger, entries, period])

  const perCofrinho = cofrinhos
    .map((c) => ({
      name: c.name,
      value: balanceOf(c),
      color: c.color ?? colorForKey(c.name),
    }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">
                Todos os cofrinhos
              </p>
              <p className="text-xs text-muted-foreground">
                Visão somada de {cofrinhos.length}{" "}
                {cofrinhos.length === 1 ? "reserva" : "reservas"}
              </p>
            </div>
            <MonthNav period={period} onChange={setPeriod} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total reservado" value={totalReserved} tone="amber" />
            <Stat label="Guardado no mês" value={savedMonth} tone="income" />
            <Stat label="A guardar no mês" value={toSave} tone="muted" />
            <Stat label="Retirado no mês" value={withdrawnMonth} tone="expense" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard title="Reserva por cofrinho">
          {perCofrinho.length === 0 ? (
            <Empty />
          ) : (
            <BarChart data={perCofrinho} layout="vertical">
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" {...chartAxis} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" width={90} {...chartAxis} />
              <Tooltip {...chartTooltip} formatter={brl} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {perCofrinho.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ChartCard>

        <MonthlySavedChart entries={entries} toPeriod={period} />
        <SourcePieChart entries={entries} />
        <ReserveByMonthChart entries={entries} tx={tx} toPeriod={period} />
      </div>

      <div>
        <p className="mb-2 px-1 text-sm font-semibold">
          Movimentações de {periodLabel(period)}
        </p>
        <HistoryList
          entries={entries.filter((e) => e.period === period)}
          withdrawals={tx.filter((t) => t.period === period)}
        />
      </div>
    </div>
  )
}

// ─── Single-cofrinho panel ───────────────────────────────────
function CofrinhoPanel({
  cofrinho,
  entries,
  tx,
  balance,
  onAddValue,
}: {
  cofrinho: Cofrinho
  entries: CofrinhoEntry[]
  tx: LedgerEntry[]
  balance: number
  onAddValue: () => void
}) {
  const [period, setPeriod] = useState(todayPeriod())
  const ledgerQ = useLedgerMonth(period)
  const ledger = ledgerQ.data ?? []

  const savedMonth = entries
    .filter((e) => e.kind === "deposit" && e.period === period)
    .reduce((s, e) => s + e.amount, 0)
  const withdrawnMonth = withdrawnOf(tx.filter((t) => t.period === period))
  const toSave = useMemo(() => {
    const income = incomeByDay(ledger, cofrinho.incomeScope)
    return cofrinhoSlots(cofrinho, period, income, entries).reduce(
      (s, x) => s + x.pending,
      0,
    )
  }, [cofrinho, ledger, entries, period])

  const fixedTarget =
    cofrinho.goalType === "fixed" ? (cofrinho.fixedAmount ?? 0) : 0

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {cofrinho.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Meta:{" "}
                {cofrinho.goalType === "percent"
                  ? `${cofrinho.percent}% ${cofrinho.incomeScope === "clinic" ? "da clínica recebida" : "de toda receita recebida"}`
                  : `${formatBRL(cofrinho.fixedAmount ?? 0)} todo dia ${cofrinho.fixedDay}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={onAddValue}>
                <PlusIcon weight="bold" />
                Adicionar valor
              </Button>
              <MonthNav period={period} onChange={setPeriod} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Saldo reservado" value={balance} tone="amber" />
            <Stat label="Guardado no mês" value={savedMonth} tone="income" />
            <Stat label="A guardar no mês" value={toSave} tone="muted" />
            <Stat label="Retirado no mês" value={withdrawnMonth} tone="expense" />
          </div>

          {fixedTarget > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta do mês</span>
                <span className="tabular-nums">
                  {formatBRL(savedMonth)} / {formatBRL(fixedTarget)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, (savedMonth / fixedTarget) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <MonthlySavedChart entries={entries} toPeriod={period} />
        <SourcePieChart entries={entries} />
        <ReserveByMonthChart
          entries={entries}
          tx={tx}
          toPeriod={period}
          initial={cofrinho.initialAmount}
        />
      </div>

      <div>
        <p className="mb-2 px-1 text-sm font-semibold">
          Movimentações de {periodLabel(period)}
        </p>
        <HistoryList
          entries={entries.filter((e) => e.period === period)}
          withdrawals={tx.filter((t) => t.period === period)}
        />
      </div>
    </div>
  )
}

// ─── Charts ──────────────────────────────────────────────────
function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold">{title}</p>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as never}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function Empty() {
  return (
    <div className="grid h-full place-items-center text-xs text-muted-foreground">
      Sem dados.
    </div>
  )
}

function MonthlySavedChart({
  entries,
  toPeriod,
}: {
  entries: CofrinhoEntry[]
  toPeriod: string
}) {
  const data = monthlyDeposited(entries, addPeriod(toPeriod, -5), toPeriod).map(
    (p) => ({ label: periodShort(p.period), total: p.total }),
  )
  return (
    <ChartCard title="Guardado por mês">
      <BarChart data={data}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...chartAxis} />
        <YAxis {...chartAxis} tickFormatter={(v) => `R$${v}`} />
        <Tooltip {...chartTooltip} formatter={brl} />
        <Bar dataKey="total" fill="rgb(16, 185, 129)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartCard>
  )
}

function SourcePieChart({ entries }: { entries: CofrinhoEntry[] }) {
  const data = useMemo(() => {
    const m = depositsBySource(entries)
    return [...m.entries()]
      .map(([source, value]) => ({
        name: SOURCE_LABEL[source] ?? source,
        value,
        color: colorForKey(source),
      }))
      .filter((d) => d.value > 0.005)
      .sort((a, b) => b.value - a.value)
  }, [entries])
  return (
    <ChartCard title="Guardado por origem">
      {data.length === 0 ? (
        <Empty />
      ) : (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip {...chartTooltip} formatter={brl} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      )}
    </ChartCard>
  )
}

function ReserveByMonthChart({
  entries,
  tx,
  toPeriod,
  initial = 0,
}: {
  entries: CofrinhoEntry[]
  tx: LedgerEntry[]
  toPeriod: string
  initial?: number
}) {
  const data = useMemo(() => {
    const from = addPeriod(toPeriod, -5)
    const delta = new Map<string, number>()
    const add = (p: string, v: number) => delta.set(p, (delta.get(p) ?? 0) + v)
    for (const e of entries) if (e.kind === "deposit") add(e.period, e.amount)
    for (const w of tx) add(w.period, -(w.kind === "expense" ? w.amount : -w.amount))
    let running = initial
    for (const [p, v] of delta) if (p < from) running += v
    const out: { label: string; saldo: number }[] = []
    let p = from
    while (p <= toPeriod) {
      running += delta.get(p) ?? 0
      out.push({ label: periodShort(p), saldo: Math.round(running * 100) / 100 })
      p = addPeriod(p, 1)
    }
    return out
  }, [entries, tx, toPeriod, initial])
  return (
    <ChartCard title="Reserva ao longo do tempo">
      <BarChart data={data}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...chartAxis} />
        <YAxis {...chartAxis} tickFormatter={(v) => `R$${v}`} />
        <Tooltip {...chartTooltip} formatter={brl} />
        <Bar dataKey="saldo" fill="rgb(245, 158, 11)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartCard>
  )
}

// ─── History list ────────────────────────────────────────────
function HistoryList({
  entries,
  withdrawals,
}: {
  entries: CofrinhoEntry[]
  withdrawals: LedgerEntry[]
}) {
  const rows: {
    id: string
    date: string
    label: string
    amount: number
    tone: "saved" | "skipped" | "withdraw"
    tag: string
  }[] = []
  for (const e of entries) {
    if (e.kind === "deposit")
      rows.push({
        id: e.id,
        date: e.date,
        label: e.description?.trim() || "Guardado",
        amount: e.amount,
        tone: "saved",
        tag: SOURCE_LABEL[e.source] ?? e.source,
      })
    else if (e.kind === "skip")
      rows.push({
        id: e.id,
        date: e.date,
        label: "Pulado",
        amount: 0,
        tone: "skipped",
        tag: SOURCE_LABEL[e.source] ?? e.source,
      })
  }
  for (const w of withdrawals) {
    rows.push({
      id: w.id,
      date: w.date,
      label: w.description,
      amount: w.kind === "expense" ? w.amount : -w.amount,
      tone: "withdraw",
      tag: "retirada",
    })
  }
  rows.sort((a, b) => b.date.localeCompare(a.date))

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground">
        Nenhuma movimentação neste mês.
      </div>
    )
  }

  return (
    <Card className="divide-y divide-border/40 overflow-hidden">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-4 py-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full border",
              r.tone === "saved" &&
                "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
              r.tone === "skipped" &&
                "border-rose-500/40 bg-rose-500/15 text-rose-300",
              r.tone === "withdraw" &&
                "border-amber-500/40 bg-amber-500/15 text-amber-300",
            )}
          >
            {r.tone === "withdraw" ? (
              <ArrowDownLeftIcon weight="bold" className="size-4" />
            ) : (
              <PiggyBankIcon weight="fill" className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.label}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatLongDateBR(r.date)} · {r.tag}
            </p>
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              r.tone === "saved" && "text-emerald-300",
              r.tone === "skipped" && "text-muted-foreground",
              r.tone === "withdraw" && "text-amber-300",
            )}
          >
            {r.tone === "skipped"
              ? "—"
              : `${r.tone === "withdraw" ? "−" : "+"}${formatBRL(Math.abs(r.amount))}`}
          </p>
        </div>
      ))}
    </Card>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "income" | "expense" | "amber" | "muted"
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "income" && "text-emerald-300",
          tone === "expense" && "text-rose-300",
          tone === "amber" && "text-amber-300",
          tone === "muted" && "text-amber-400/90",
        )}
      >
        {formatBRL(value)}
      </p>
    </div>
  )
}
