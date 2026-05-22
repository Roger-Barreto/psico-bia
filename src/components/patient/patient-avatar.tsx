import type { Gender } from "@/db/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { monsterAvatarSrc } from "@/lib/monster-avatars"
import { cn } from "@/lib/utils"

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
