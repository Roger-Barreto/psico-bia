import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ptBR } from "date-fns/locale"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays
      className={cn("p-1 text-sm", className)}
      classNames={{
        months: "flex flex-col gap-3",
        month: "space-y-3",
        month_caption: "flex h-9 items-center justify-center relative",
        caption_label: "text-sm font-medium capitalize",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between px-1 pointer-events-none",
        button_previous:
          "pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-foreground/70 hover:bg-muted/40 hover:text-foreground transition",
        button_next:
          "pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-foreground/70 hover:bg-muted/40 hover:text-foreground transition",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
        weeks: "",
        week: "flex w-full mt-1",
        day: "h-9 w-9 p-0 text-center align-middle relative [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal text-foreground/90 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:brightness-110 aria-selected:font-medium",
        selected: "",
        today:
          "[&>button]:border [&>button]:border-primary/60 [&>button]:text-primary",
        outside: "text-muted-foreground/40 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground/30 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <CaretLeftIcon weight="bold" className="size-4" {...rest} />
          ) : (
            <CaretRightIcon weight="bold" className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
