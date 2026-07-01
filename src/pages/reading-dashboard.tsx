import { useMemo, useState } from "react"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import { useBooks, useReadingSessions } from "@/api/reading"
import { formatDuration, heatmapData, libraryStats } from "@/domain/reading"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ChartCard } from "@/components/dashboard/charts"
import {
  BooksByMonthChart,
  DistributionDonut,
  PagesByMonthChart,
  RatingBarChart,
} from "@/components/reading/reading-charts"
import { ReadingHeatmap } from "@/components/reading/reading-heatmap"
import { ReadingGoalCard } from "@/components/reading/reading-goal-card"

const CURRENT_YEAR = new Date().getFullYear()

export function ReadingDashboardPage() {
  const booksQ = useBooks()
  const sessionsQ = useReadingSessions()
  const books = booksQ.data ?? []
  const sessions = sessionsQ.data ?? []
  const [year, setYear] = useState(CURRENT_YEAR)

  const stats = useMemo(
    () => libraryStats(books, sessions, year),
    [books, sessions, year],
  )
  const heat = useMemo(() => heatmapData(sessions, year), [sessions, year])
  const loading = booksQ.isLoading || sessionsQ.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Leituras" }, { label: "Dashboard" }]} />
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas métricas de leitura por ano.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Ano anterior"
          >
            <CaretLeftIcon weight="bold" />
          </Button>
          <span className="min-w-[3.5rem] text-center text-lg font-semibold tabular-nums">
            {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= CURRENT_YEAR}
            aria-label="Próximo ano"
          >
            <CaretRightIcon weight="bold" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Carregando…
        </p>
      ) : books.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            Adicione livros na aba Track para ver suas métricas aqui.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KpiCard
              label={`Livros lidos em ${year}`}
              value={stats.booksFinished}
              tone="success"
            />
            <KpiCard
              label="Páginas lidas"
              value={stats.pagesRead.toLocaleString("pt-BR")}
            />
            <KpiCard
              label="Tempo de leitura"
              value={formatDuration(stats.secondsRead)}
            />
            <KpiCard
              label="Velocidade média"
              value={stats.speedPph ? `${stats.speedPph} pág/h` : "—"}
              hint="páginas por hora"
            />
            <KpiCard
              label="Sequência atual"
              value={`${stats.currentStreak} dia(s)`}
              tone="warning"
              hint={`recorde: ${stats.longestStreak}`}
            />
            <KpiCard label="Lendo agora" value={stats.readingNow} tone="primary" />
            <KpiCard
              label="Avaliação média"
              value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
              tone="secondary"
            />
            <KpiCard label="Total na estante" value={books.length} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReadingGoalCard year={year} booksFinished={stats.booksFinished} />
            <ReadingHeatmap data={heat} year={year} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Livros lidos por mês" subtitle={String(year)}>
              <BooksByMonthChart data={stats.booksByMonth} />
            </ChartCard>
            <ChartCard title="Páginas lidas por mês" subtitle={String(year)}>
              <PagesByMonthChart data={stats.pagesByMonth} />
            </ChartCard>
            <ChartCard title="Por gênero">
              <DistributionDonut data={stats.byGenre} />
            </ChartCard>
            <ChartCard title="Por formato">
              <DistributionDonut data={stats.byFormat} />
            </ChartCard>
          </div>

          {stats.byRating.length > 0 && (
            <ChartCard title="Distribuição de avaliações">
              <RatingBarChart data={stats.byRating} />
            </ChartCard>
          )}
        </>
      )}
    </div>
  )
}
