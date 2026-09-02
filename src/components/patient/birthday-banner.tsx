import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { CakeIcon, CaretRightIcon } from "@phosphor-icons/react"
import type { Patient } from "@/db/types"
import { PatientAvatar } from "./patient-avatar"
import { turningAgeLabel } from "@/domain/birthdays"
import { todayISO } from "@/domain/dates"
import { celebrateBirthday } from "@/lib/celebrate"
import { cn } from "@/lib/utils"

interface Props {
  patients: Patient[]
  /** Dia selecionado na agenda (ISO). Define "hoje" vs. outra data. */
  dateISO: string
  /** patientId → horário da sessão daquele paciente no dia, se houver. */
  sessionTimeByPatient?: Map<string, string>
}

/**
 * Aniversariantes do dia, acima da lista de agendamentos.
 *
 * O confete dispara sozinho quando o dia visto é hoje, uma única vez por dia
 * (`sessionStorage`): sem a trava ele voltaria a cada ida e volta entre as
 * páginas, já que a agenda remonta.
 */
export function BirthdayBanner({
  patients,
  dateISO,
  sessionTimeByPatient,
}: Props) {
  const navigate = useNavigate()
  const isToday = dateISO === todayISO()
  const fired = useRef(false)

  useEffect(() => {
    if (!isToday || patients.length === 0 || fired.current) return
    fired.current = true
    const key = `birthday-confetti:${dateISO}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // navegador sem sessionStorage (modo privado antigo): comemora mesmo assim
    }
    celebrateBirthday()
  }, [isToday, patients.length, dateISO])

  if (patients.length === 0) return null

  const many = patients.length > 1

  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent p-4 shadow-glow animate-fade-in"
    >
      {/* Brilho que atravessa o card. Puramente decorativo. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative flex items-center gap-2">
        <CakeIcon
          weight="fill"
          className="size-5 shrink-0 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.6)]"
        />
        <p className="text-sm font-semibold">
          {many ? "Aniversariantes do dia" : "Aniversário"}
          {isToday ? " 🎉" : ""}
        </p>
        {many && (
          <span className="ml-auto rounded-full bg-secondary/20 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-secondary">
            {patients.length}
          </span>
        )}
      </div>

      <div className={cn("relative mt-3", many ? "space-y-2" : "")}>
        {patients.map((p) => {
          const age = turningAgeLabel(p.birthdate, dateISO)
          const time = sessionTimeByPatient?.get(p.id)
          const details = [
            age ? `${age}${isToday ? " hoje" : ""}` : null,
            time ? `sessão às ${time}` : null,
          ].filter(Boolean)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/patients?edit=${p.id}`)}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-primary/10"
            >
              <PatientAvatar avatarId={p.avatarId} name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  {p.dischargedAt && (
                    <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      encerrado
                    </span>
                  )}
                </div>
                {details.length > 0 && (
                  <p className="truncate text-xs text-secondary/90">
                    {details.join(" · ")}
                  </p>
                )}
              </div>
              <CaretRightIcon
                weight="bold"
                className="size-4 shrink-0 text-muted-foreground"
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
