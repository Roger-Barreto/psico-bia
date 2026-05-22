import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-20" />
        <Skeleton className="mt-1 h-3 w-32" />
      </CardContent>
    </Card>
  )
}

export function PendencyBlockSkeleton() {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/10 p-6 sm:p-8",
      )}
    >
      <div className="w-full">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-16 w-24" />
        <Skeleton className="mt-3 h-5 w-48" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>
      <Skeleton className="size-32 shrink-0 rounded-full" />
    </div>
  )
}

export function PendencyListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col space-y-2">
      <Skeleton className="h-4 w-48" />
      <div className="grid max-h-[420px] gap-2 overflow-hidden pr-1">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="border-border/60 bg-muted/10">
            <CardContent className="flex items-start gap-3 p-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
                <Skeleton className="mt-1 h-3 w-48" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

interface ChartCardSkeletonProps {
  height?: number
  variant?: "bars" | "vbars" | "line" | "pie"
}

export function ChartCardSkeleton({
  height = 240,
  variant = "bars",
}: ChartCardSkeletonProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1 h-3 w-40" />
        </div>
        <div style={{ width: "100%", height }} className="flex">
          <ChartBody variant={variant} />
        </div>
      </CardContent>
    </Card>
  )
}

function ChartBody({ variant }: { variant: ChartCardSkeletonProps["variant"] }) {
  if (variant === "pie") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4">
        <Skeleton className="size-32 rounded-full" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    )
  }
  if (variant === "vbars") {
    // horizontal bars (e.g. TopPatientsChart)
    return (
      <div className="flex w-full flex-col justify-around gap-3 py-4">
        {[80, 65, 50, 40, 28, 18].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 shrink-0" />
            <Skeleton className="h-4" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    )
  }
  if (variant === "line") {
    return (
      <div className="relative flex w-full items-end gap-2 px-2 pb-6">
        {[40, 55, 35, 70, 50, 80].map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton
              className="w-full"
              style={{ height: `${h}%`, opacity: 0.4 }}
            />
            <Skeleton className="h-2 w-8" />
          </div>
        ))}
      </div>
    )
  }
  // bars (vertical)
  return (
    <div className="flex w-full items-end gap-1.5 px-2 pb-6">
      {Array.from({ length: 16 }).map((_, i) => {
        const h = 20 + ((i * 37) % 70)
        return (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        )
      })}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PendencyBlockSkeleton />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCardSkeleton variant="bars" />
        <ChartCardSkeleton variant="pie" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCardSkeleton variant="vbars" height={280} />
        <ChartCardSkeleton variant="line" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCardSkeleton variant="pie" />
        <ChartCardSkeleton variant="pie" />
        <ChartCardSkeleton variant="pie" />
      </div>
    </div>
  )
}
