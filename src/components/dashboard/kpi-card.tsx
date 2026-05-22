import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Props {
  label: string
  value: ReactNode
  tone?: "primary" | "secondary" | "success" | "warning" | "muted"
  hint?: string
}

const toneStyles: Record<NonNullable<Props["tone"]>, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  success: "text-emerald-400",
  warning: "text-amber-400",
  muted: "text-foreground",
}

export function KpiCard({ label, value, tone = "muted", hint }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 text-2xl font-bold tracking-tight", toneStyles[tone])}>
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  )
}
