import { useEffect, useState } from "react"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Input } from "@/components/ui/input"
import { searchBooks, type BookSearchResult } from "@/lib/book-metadata"
import { BookCover } from "./book-cover"

/** Campo de busca (debounced) que devolve o resultado escolhido via onPick. */
export function BookSearch({
  onPick,
}: {
  onPick: (r: BookSearchResult) => void
}) {
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    setLoading(true)
    searchBooks(debounced, ctrl.signal)
      .then((r) => {
        if (!cancelled) setResults(r)
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [debounced])

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlassIcon
          weight="fill"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          autoFocus
          placeholder="Buscar por título, autor ou ISBN…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="min-h-[8rem] max-h-72 space-y-1 overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Buscando…
          </p>
        ) : debounced.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Digite para buscar capa, páginas e autor automaticamente.
          </p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nada encontrado. Tente outro termo ou preencha manualmente.
          </p>
        ) : (
          results.map((r, i) => (
            <button
              key={`${r.title}-${i}`}
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/40"
            >
              <BookCover url={r.coverUrl} title={r.title} className="w-9" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{r.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {[r.author, r.publishedYear, r.pageCount ? `${r.pageCount} p.` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
