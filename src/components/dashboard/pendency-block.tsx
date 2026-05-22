import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface Props {
  totalCount: number
  overdueCount: number // pendencies from days before today
  todayCount: number // pendencies from today only
}

export function PendencyBlock({
  totalCount,
  overdueCount,
  todayCount,
}: Props) {
  const redMascot = useMemo(
    () => (Math.random() < 0.5 ? "/triste.png" : "/brava.png"),
    [totalCount, overdueCount],
  )

  if (totalCount === 0) {
    return (
      <PendencyShell tone="green">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-300/80">
            Pendências
          </p>
          <p className="mt-1 text-6xl font-bold text-emerald-300">0</p>
          <p className="mt-3 text-lg font-semibold text-emerald-200">
            Tudo em dia! 🎉
          </p>
          <p className="text-sm text-emerald-300/80">
            Sem pendências pra resolver. Bom trabalho!
          </p>
        </div>
        <MascotImage src="/feliz.png" />
      </PendencyShell>
    )
  }

  if (overdueCount === 0) {
    return (
      <PendencyShell tone="yellow">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-amber-300/80">
            Pendências de hoje
          </p>
          <p className="mt-1 text-6xl font-bold text-amber-300">
            {todayCount}
          </p>
          <p className="mt-3 text-lg font-semibold text-amber-200">
            Atenção pra hoje 🟡
          </p>
          <p className="text-sm text-amber-300/80">
            {todayCount === 1
              ? "1 pendência do dia para resolver."
              : `${todayCount} pendências do dia para resolver.`}
          </p>
        </div>
        <MascotImage src="/neutra.png" />
      </PendencyShell>
    )
  }

  return (
    <PendencyShell tone="red">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-destructive/80">
          Pendências em atraso
        </p>
        <p className="mt-1 text-6xl font-bold text-destructive">
          {totalCount}
        </p>
        <p className="mt-3 text-lg font-semibold text-destructive">
          Pendências antigas! 🔴
        </p>
        <p className="text-sm text-destructive/80">
          {overdueCount === 1
            ? `${totalCount} pendências (1 atrasada).`
            : `${totalCount} pendências, sendo ${overdueCount} atrasadas.`}
        </p>
      </div>
      <MascotImage src={redMascot} />
    </PendencyShell>
  )
}

function MascotImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className="size-32 shrink-0 object-contain"
    />
  )
}

function PendencyShell({
  tone,
  children,
}: {
  tone: "green" | "yellow" | "red"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border p-6 sm:p-8",
        tone === "green" &&
          "border-emerald-500/30 bg-emerald-500/10 shadow-[0_8px_40px_-15px_rgba(16,185,129,0.4)]",
        tone === "yellow" &&
          "border-amber-500/30 bg-amber-500/10 shadow-[0_8px_40px_-15px_rgba(245,158,11,0.4)]",
        tone === "red" &&
          "border-destructive/40 bg-destructive/10 shadow-[0_8px_40px_-15px_hsl(var(--destructive)/0.5)]",
      )}
    >
      {children}
    </div>
  )
}
