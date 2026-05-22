import { cn } from "@/lib/utils"

interface Props extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: Props) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/40",
        className,
      )}
      {...props}
    />
  )
}
