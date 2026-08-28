import * as React from "react"
import { ClockIcon } from "@phosphor-icons/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface TimePickerProps {
  /** "HH:MM" string */
  value?: string
  onChange?: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Minute step in picker grid (default 5) */
  minuteStep?: number
}

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

function parse(value?: string): { h: number; m: number } | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (isNaN(h) || isNaN(min) || h > 23 || min > 59) return null
  return { h, m: min }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * Time selector built as **tap grids, never scrolling lists**.
 *
 * The previous version used two `overflow-y:auto` columns inside the popover.
 * On iPadOS (every browser there is WebKit — Safari, Chrome, Opera) a
 * touch-scrollable region living inside a portaled `position:fixed` popover,
 * inside a modal locked by `react-remove-scroll`, is unreliable: the lock's
 * non-passive `touchmove` handler and the dialog's transform/backdrop-filter
 * containing block fight each other and the list ends up frozen.
 *
 * Fitting every option on screen removes the whole class of bug — there is no
 * overflow left for the scroll lock to arbitrate — and gives much larger touch
 * targets, which is what the tablet users need anyway. The popover is portaled
 * to `document.body` (`portalToBody`) so it can also never be clipped by the
 * dialog it was opened from.
 */
export const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      id,
      disabled,
      placeholder = "--:--",
      className,
      minuteStep = 5,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    const parsed = parse(value)

    // Step list, plus the current minute when it falls off-step, so a value
    // typed/imported as e.g. 14:23 still shows up as selected.
    const minutes = React.useMemo(() => {
      const step = Math.max(1, Math.min(30, Math.round(minuteStep)))
      const list = new Set<number>()
      for (let m = 0; m < 60; m += step) list.add(m)
      if (parsed && !list.has(parsed.m)) list.add(parsed.m)
      return [...list].sort((a, b) => a - b)
    }, [minuteStep, parsed])

    const setHour = (h: number) => {
      onChange?.(`${pad(h)}:${pad(parsed?.m ?? 0)}`)
    }
    const setMinute = (m: number) => {
      onChange?.(`${pad(parsed?.h ?? 0)}:${pad(m)}`)
      setOpen(false)
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background/40 px-3.5 py-2 text-sm text-foreground transition-colors",
              "hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !parsed && "text-muted-foreground/80",
              className,
            )}
          >
            <span className="truncate tabular-nums">
              {parsed ? `${pad(parsed.h)}:${pad(parsed.m)}` : placeholder}
            </span>
            <ClockIcon weight="duotone" className="size-4 text-primary" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-2"
          align="start"
          portalToBody
        >
          <div className="w-[20rem] max-w-[calc(100vw-2.5rem)] space-y-2">
            <Section label="Hora">
              {HOURS.map((h) => (
                <Cell
                  key={h}
                  active={parsed?.h === h}
                  onSelect={() => setHour(h)}
                  aria-label={`${pad(h)} horas`}
                >
                  {pad(h)}
                </Cell>
              ))}
            </Section>
            <div className="h-px bg-border/60" />
            <Section label="Minuto">
              {minutes.map((m) => (
                <Cell
                  key={m}
                  active={parsed?.m === m}
                  onSelect={() => setMinute(m)}
                  aria-label={`${pad(m)} minutos`}
                >
                  {pad(m)}
                </Cell>
              ))}
            </Section>
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)
TimePicker.displayName = "TimePicker"

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="grid grid-cols-6 gap-1">{children}</div>
    </div>
  )
}

function Cell({
  active,
  onSelect,
  children,
  ...props
}: {
  active: boolean
  onSelect: () => void
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onSelect}
      // manipulation kills the double-tap-to-zoom delay on tablets.
      className={cn(
        "h-10 rounded-md text-center text-sm tabular-nums transition [touch-action:manipulation]",
        active
          ? "bg-primary font-medium text-primary-foreground"
          : "bg-background/30 text-foreground/85 hover:bg-muted/50 active:bg-muted/70",
      )}
      {...props}
    >
      {children}
    </button>
  )
}
