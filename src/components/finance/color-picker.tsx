import { CheckIcon } from "@phosphor-icons/react"
import { FINANCE_COLORS } from "@/lib/finance-colors"
import { cn } from "@/lib/utils"

interface Props {
  value: string | null
  onChange: (color: string) => void
  className?: string
}

/** Swatch grid for picking a category / payment-method color. */
export function ColorPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {FINANCE_COLORS.map((c) => {
        const active = value?.toLowerCase() === c.toLowerCase()
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
              active && "ring-2 ring-foreground",
            )}
            style={{ backgroundColor: c }}
            aria-label={`Cor ${c}`}
            aria-pressed={active}
          >
            {active && (
              <CheckIcon weight="bold" className="size-3.5 text-white drop-shadow" />
            )}
          </button>
        )
      })}
    </div>
  )
}
