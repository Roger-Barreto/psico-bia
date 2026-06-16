import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarBlankIcon, XIcon } from "@phosphor-icons/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

export interface DatePickerProps {
  /** ISO date string YYYY-MM-DD (or empty) */
  value?: string
  onChange?: (value: string) => void
  id?: string
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  clearable?: boolean
}

function parseISO(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, "yyyy-MM-dd", new Date())
  return isValid(d) ? d : undefined
}

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      id,
      min,
      max,
      disabled,
      placeholder = "Selecionar data",
      className,
      clearable = false,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false)
    const selected = parseISO(value)
    const minDate = parseISO(min)
    const maxDate = parseISO(max)
    const today = new Date()
    const startMonth = minDate ?? new Date(today.getFullYear() - 100, 0, 1)
    const endMonth =
      maxDate ?? new Date(today.getFullYear() + 5, 11, 31)

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
              !selected && "text-muted-foreground/80",
              className,
            )}
          >
            <span className="truncate">
              {selected
                ? format(selected, "dd 'de' MMM 'de' yyyy", { locale: ptBR })
                : placeholder}
            </span>
            <span className="flex items-center gap-1.5 text-foreground/70">
              {clearable && selected && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange?.("")
                  }}
                  className="inline-flex size-5 items-center justify-center rounded hover:bg-muted/50 hover:text-foreground"
                  aria-label="Limpar data"
                >
                  <XIcon weight="bold" className="size-3.5" />
                </span>
              )}
              <CalendarBlankIcon weight="duotone" className="size-4 text-primary" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" portalToBody>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={
              minDate || maxDate
                ? { before: minDate as Date, after: maxDate as Date }
                : undefined
            }
            onSelect={(d) => {
              if (d) {
                onChange?.(toISO(d))
                setOpen(false)
              }
            }}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    )
  },
)
DatePicker.displayName = "DatePicker"
