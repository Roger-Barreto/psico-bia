import { Link } from "react-router-dom"
import { CaretRightIcon } from "@phosphor-icons/react"

export interface Crumb {
  label: string
  to?: string
}

interface Props {
  items: Crumb[]
}

export function Breadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((it, idx) => {
          const last = idx === items.length - 1
          return (
            <li key={idx} className="flex items-center gap-1">
              {it.to && !last ? (
                <Link
                  to={it.to}
                  className="rounded hover:bg-muted/40 hover:text-foreground px-1 py-0.5"
                >
                  {it.label}
                </Link>
              ) : (
                <span
                  className={
                    last
                      ? "font-medium text-foreground/80 px-1 py-0.5"
                      : "px-1 py-0.5"
                  }
                  aria-current={last ? "page" : undefined}
                >
                  {it.label}
                </span>
              )}
              {!last && (
                <CaretRightIcon
                  weight="bold"
                  className="size-3 shrink-0 text-muted-foreground/60"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
