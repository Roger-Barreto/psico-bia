import {
  GenderFemaleIcon,
  GenderMaleIcon,
  UserIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import type { Gender } from "@/db/types"
import { cn } from "@/lib/utils"

const styles: Record<Gender, string> = {
  female: "bg-primary/20 text-primary",
  male: "bg-secondary/30 text-secondary",
  other: "bg-accent/30 text-accent",
}

const Icon: Record<Gender, PhosphorIcon> = {
  female: GenderFemaleIcon,
  male: GenderMaleIcon,
  other: UserIcon,
}

export function GenderAvatar({
  gender,
  size = "md",
  className,
}: {
  gender: Gender
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const I = Icon[gender]
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full",
        size === "sm" && "size-8 [&>svg]:size-4",
        size === "md" && "size-11 [&>svg]:size-5",
        size === "lg" && "size-14 [&>svg]:size-7",
        styles[gender],
        className,
      )}
    >
      <I weight="fill" />
    </div>
  )
}

export function genderLabel(g: Gender) {
  return g === "female" ? "Feminino" : g === "male" ? "Masculino" : "Outro"
}
