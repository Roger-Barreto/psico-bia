import { BookOpenIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

/** Capa 2:3 com fallback quando não há imagem. */
export function BookCover({
  url,
  title,
  className,
}: {
  url?: string | null
  title?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-lg border border-border/60 bg-muted/40",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={title ? `Capa de ${title}` : "Capa"}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground/40">
          <BookOpenIcon weight="duotone" className="size-10" />
        </div>
      )}
    </div>
  )
}
