import type { Gender, Patient } from "@/db/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { monsterAvatarSrc } from "@/lib/monster-avatars"
import { cn } from "@/lib/utils"
import { ageLabel } from "@/domain/age"
import { memberShortLabel } from "@/domain/couples"

const sizeClasses = {
  sm: "size-8",
  md: "size-11",
  lg: "size-14",
} as const

export function PatientAvatar({
  avatarId,
  name,
  size = "md",
  className,
}: {
  avatarId: number
  name?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?"

  return (
    <Avatar
      className={cn(
        sizeClasses[size],
        "ring-1 ring-border/60 ring-offset-0",
        className,
      )}
    >
      <AvatarImage src={monsterAvatarSrc(avatarId)} alt={name ?? "Avatar do paciente"} />
      <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
    </Avatar>
  )
}

export function genderLabel(g: Gender) {
  return g === "female" ? "Feminino" : g === "male" ? "Masculino" : "Outro"
}

/** Lado do quadrado de cada tamanho, em px (casa com `sizeClasses`). */
const sizePx = { sm: 32, md: 44, lg: 56 } as const

/**
 * Avatar de um cadastro: o monstrinho do paciente, ou — num casal — os das
 * duas primeiras pessoas, sobrepostos na diagonal. Ocupa exatamente o mesmo
 * quadrado do avatar individual, então nenhuma lista muda de layout.
 */
export function ClientAvatar({
  patient,
  size = "md",
  className,
}: {
  patient: Pick<Patient, "kind" | "members" | "avatarId" | "name">
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const [a, b] = patient.members
  if (patient.kind !== "couple" || !a || !b) {
    return (
      <PatientAvatar
        avatarId={patient.avatarId}
        name={patient.name}
        size={size}
        className={className}
      />
    )
  }
  const box = sizePx[size]
  const inner = Math.round(box * 0.7)
  const face = (avatarId: number, name: string, pos: string) => (
    <Avatar
      className={cn(
        "absolute ring-2 ring-card ring-offset-0",
        pos,
      )}
      style={{ width: inner, height: inner }}
    >
      <AvatarImage src={monsterAvatarSrc(avatarId)} alt="" />
      <AvatarFallback className="text-[10px] font-semibold">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  )
  return (
    <span
      role="img"
      aria-label={`Casal: ${patient.name}`}
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: box, height: box }}
    >
      {face(a.avatarId, a.name, "left-0 top-0")}
      {face(b.avatarId, b.name, "bottom-0 right-0")}
    </span>
  )
}

/**
 * Linha de resumo de um cadastro, em partes para `join(" · ")`:
 * individual → ["34 anos", "Feminino"]; casal → ["Casal", "Ana, 34", "Bruno"].
 */
export function patientSummary(
  p: Pick<Patient, "kind" | "members" | "birthdate" | "gender">,
): string[] {
  if (p.kind === "couple") return ["Casal", ...p.members.map(memberShortLabel)]
  return [ageLabel(p.birthdate), genderLabel(p.gender)].filter(
    (s): s is string => !!s,
  )
}
