import { useEffect, useState } from "react"
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts"
import { PencilSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useReadingGoal, useUpsertReadingGoal } from "@/api/reading"
import { progressColor } from "@/domain/reading"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Anel da meta anual (desafio) + editor inline. */
export function ReadingGoalCard({
  year,
  booksFinished,
}: {
  year: number
  booksFinished: number
}) {
  const goalQ = useReadingGoal(year)
  const upsert = useUpsertReadingGoal()
  const target = goalQ.data?.targetBooks ?? null

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  useEffect(() => {
    setValue(target != null ? String(target) : "")
  }, [target])

  const pct =
    target && target > 0
      ? Math.min(100, Math.round((booksFinished / target) * 100))
      : 0
  const color = progressColor(pct)

  async function save() {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe uma meta válida")
      return
    }
    try {
      await upsert.mutateAsync({ year, targetBooks: Math.round(n) })
      toast.success("Meta salva")
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Meta de {year}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Desafio de leitura
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            <PencilSimpleIcon weight="bold" /> {target ? "Editar" : "Definir"}
          </Button>
        </div>

        {editing ? (
          <div className="mt-4 flex items-end gap-2">
            <label className="flex-1 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Livros no ano
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ex.: 24"
              />
            </label>
            <Button onClick={save} loading={upsert.isPending}>
              Salvar
            </Button>
          </div>
        ) : target ? (
          <div className="mt-2 grid grid-cols-[130px_1fr] items-center gap-3">
            <div className="relative h-[130px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="72%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  data={[{ name: "meta", value: pct }]}
                >
                  <PolarAngleAxis
                    type="number"
                    domain={[0, 100]}
                    tick={false}
                  />
                  <RadialBar
                    background
                    dataKey="value"
                    cornerRadius={12}
                    fill={color}
                    isAnimationActive={false}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-2xl font-bold leading-none tabular-nums">
                    {booksFinished}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    de {target}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-semibold" style={{ color }}>
                  {pct}%
                </span>{" "}
                concluído
              </p>
              <p className="text-xs text-muted-foreground">
                {booksFinished >= target
                  ? "Meta batida! 🎉"
                  : `Faltam ${target - booksFinished} livro(s)`}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma meta definida para {year}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
