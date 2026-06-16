import * as React from "react"
import { cn } from "@/lib/utils"

export interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** BR-formatted string, e.g. "1.234,56" (empty string allowed). */
  value: string
  onChange: (value: string) => void
}

/** Digits-only string → "1.234,56" (cents-based mask, always 2 decimals). */
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Parse a BR money string ("1.234,56") to a number. */
export function parseMoney(s: string): number {
  if (!s) return 0
  return Number(s.replace(/\./g, "").replace(",", ".")) || 0
}

/**
 * Currency input: right-aligned, always two decimals, with a pink "R$"
 * start adornment. Types as cents (e.g. "1234" → 12,34).
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    function handle(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, "")
      if (digits === "") return onChange("")
      onChange(formatCents(parseInt(digits, 10)))
    }
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-primary">
          R$
        </span>
        <input
          ref={ref}
          inputMode="decimal"
          value={value}
          onChange={handle}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-background/40 py-2 pl-10 pr-3.5 text-right text-sm tabular-nums text-foreground transition-colors",
            "placeholder:text-muted-foreground/70",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          placeholder="0,00"
          {...props}
        />
      </div>
    )
  },
)
MoneyInput.displayName = "MoneyInput"
