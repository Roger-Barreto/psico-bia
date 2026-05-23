import {
  CalendarBlankIcon,
  ChecksIcon,
  CurrencyDollarIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import type { Occurrence, Patient } from "@/db/types"
import { PatientAvatar, genderLabel } from "@/components/patient/patient-avatar"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateBR } from "@/domain/dates"
import { formatBRL } from "@/domain/finance"
import { ageFromBirthdate } from "@/domain/age"
import { cn } from "@/lib/utils"

export interface PendencyBreakdown {
  patient: Patient
  insuranceName?: string | null
  checklistCount: number
  unpaidCount: number
  overdueCount: number
  unpaidValue: number
  nextDate?: string | null
  occurrence: Occurrence
}

export function PendencyList({
  items,
  today,
  onSelect,
}: {
  items: PendencyBreakdown[]
  today: string
  onSelect: (it: PendencyBreakdown) => void
}) {
  if (!items.length) return null
  return (
    <div className="flex flex-col space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Pacientes com pendências ({items.length})
      </h2>
      <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
        {items.map((it) => (
          <button
            key={it.patient.id}
            type="button"
            onClick={() => onSelect(it)}
            className="w-full text-left"
          >
          <Card
            className={cn(
              "border-destructive/40 bg-destructive/5 transition-colors hover:border-destructive/60 hover:bg-destructive/10",
            )}
          >
            <CardContent className="flex items-start gap-3 p-3">
              <PatientAvatar avatarId={it.patient.avatarId} name={it.patient.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {it.patient.name}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                    <WarningIcon weight="fill" className="size-3" />
                    {it.checklistCount + it.unpaidCount + it.overdueCount}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ageFromBirthdate(it.patient.birthdate)} anos · {genderLabel(it.patient.gender)}
                  {it.insuranceName && ` · ${it.insuranceName}`}
                  {!it.insuranceName && " · Particular"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {it.checklistCount > 0 && (
                    <Tag tone="amber" icon={<ChecksIcon weight="fill" className="size-3" />}>
                      {it.checklistCount}{" "}
                      {it.checklistCount === 1 ? "item" : "itens"} checklist
                    </Tag>
                  )}
                  {it.unpaidCount > 0 && (
                    <Tag
                      tone="emerald"
                      icon={
                        <CurrencyDollarIcon
                          weight="fill"
                          className="size-3"
                        />
                      }
                    >
                      {it.unpaidCount} não pago
                      {it.unpaidValue > 0 && ` · ${formatBRL(it.unpaidValue)}`}
                    </Tag>
                  )}
                  {it.overdueCount > 0 && (
                    <Tag
                      tone="red"
                      icon={
                        <CalendarBlankIcon
                          weight="fill"
                          className="size-3"
                        />
                      }
                    >
                      {it.overdueCount} sem confirmação
                    </Tag>
                  )}
                </div>
                {it.nextDate && it.nextDate >= today && (
                  <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    próxima sessão {formatDateBR(it.nextDate)}
                    {it.occurrence.time && ` às ${it.occurrence.time}`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </button>
        ))}
      </div>
    </div>
  )
}

function Tag({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "emerald" | "red"
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone === "amber" && "bg-amber-500/15 text-amber-300",
        tone === "emerald" && "bg-emerald-500/15 text-emerald-300",
        tone === "red" && "bg-destructive/20 text-destructive",
      )}
    >
      {icon}
      {children}
    </span>
  )
}
