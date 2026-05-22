import { useState } from "react"
import { PencilSimpleIcon, ShuffleIcon } from "@phosphor-icons/react"
import {
  MONSTER_AVATAR_COUNT,
  monsterAvatarIds,
  monsterAvatarSrc,
  randomMonsterAvatarId,
} from "@/lib/monster-avatars"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PatientAvatar } from "./patient-avatar"

export function AvatarPicker({
  value,
  onChange,
  name,
  size = "lg",
  disabled,
}: {
  value: number
  onChange: (avatarId: number) => void
  name?: string
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  function pick(id: number) {
    onChange(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Escolher avatar"
        >
          <PatientAvatar avatarId={value} name={name} size={size} />
          <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <PencilSimpleIcon weight="fill" className="size-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[17.5rem] p-3" align="start">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Escolher avatar
          </p>
          <button
            type="button"
            onClick={() => pick(randomMonsterAvatarId())}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <ShuffleIcon weight="bold" className="size-3" />
            Aleatório
          </button>
        </div>
        <div className="grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto pr-0.5">
          {monsterAvatarIds().map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={cn(
                "overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.03]",
                value === id
                  ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                  : "border-transparent opacity-80 hover:border-border/80 hover:opacity-100",
              )}
              aria-label={`Avatar ${id}`}
              aria-pressed={value === id}
            >
              <img
                src={monsterAvatarSrc(id)}
                alt=""
                className="aspect-square w-full bg-muted/30 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {MONSTER_AVATAR_COUNT} opções disponíveis
        </p>
      </PopoverContent>
    </Popover>
  )
}
