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

// Cap each scroll column to the room the popover actually has (Radix exposes it
// as a CSS var). Subtracts the column label + content padding so the whole
// popover stays inside the dialog and never gets clipped. Falls back to 60dvh.
const LIST_MAX_HEIGHT =
  "min(13rem, calc(var(--radix-popover-content-available-height, 60dvh) - 2.25rem))"

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

    const hours = React.useMemo(
      () => Array.from({ length: 24 }, (_, i) => i),
      [],
    )
    const minutes = React.useMemo(
      () =>
        Array.from(
          { length: Math.ceil(60 / minuteStep) },
          (_, i) => i * minuteStep,
        ).filter((m) => m < 60),
      [minuteStep],
    )

    const setHour = (h: number) => {
      const m = parsed?.m ?? 0
      onChange?.(`${pad(h)}:${pad(m)}`)
    }
    const setMinute = (m: number) => {
      const h = parsed?.h ?? 0
      onChange?.(`${pad(h)}:${pad(m)}`)
      setOpen(false)
    }

    const hourListRef = React.useRef<HTMLDivElement>(null)
    const minListRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      if (!open) return
      requestAnimationFrame(() => {
        hourListRef.current
          ?.querySelector<HTMLButtonElement>("[data-active='true']")
          ?.scrollIntoView({ block: "center" })
        minListRef.current
          ?.querySelector<HTMLButtonElement>("[data-active='true']")
          ?.scrollIntoView({ block: "center" })
      })
    }, [open])

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
          className="w-auto max-h-[var(--radix-popover-content-available-height)] overflow-hidden p-2"
          align="start"
        >
          <div className="flex gap-2">
            <div className="flex flex-col items-center">
              <span className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Hora
              </span>
              <div
                ref={hourListRef}
                style={{ maxHeight: LIST_MAX_HEIGHT }}
                className="h-52 w-14 touch-pan-y overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-background/30 p-1 [-webkit-overflow-scrolling:touch]"
              >
                {hours.map((h) => {
                  const active = parsed?.h === h
                  return (
                    <button
                      key={h}
                      type="button"
                      data-active={active}
                      onClick={() => setHour(h)}
                      className={cn(
                        "block w-full rounded px-2 py-1 text-center text-sm tabular-nums transition",
                        active
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground/85 hover:bg-muted/40",
                      )}
                    >
                      {pad(h)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Min
              </span>
              <div
                ref={minListRef}
                style={{ maxHeight: LIST_MAX_HEIGHT }}
                className="h-52 w-14 touch-pan-y overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-background/30 p-1 [-webkit-overflow-scrolling:touch]"
              >
                {minutes.map((m) => {
                  const active = parsed?.m === m
                  return (
                    <button
                      key={m}
                      type="button"
                      data-active={active}
                      onClick={() => setMinute(m)}
                      className={cn(
                        "block w-full rounded px-2 py-1 text-center text-sm tabular-nums transition",
                        active
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground/85 hover:bg-muted/40",
                      )}
                    >
                      {pad(m)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)
TimePicker.displayName = "TimePicker"
