import { useEffect, useRef, useState, type ReactNode } from "react"
import { UploadSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"
import type { Book, BookFormat, BookStatus } from "@/db/types"
import {
  useCreateBook,
  useUpdateBook,
  useUploadBookCover,
  coverSrc,
} from "@/api/reading"
import { statusLabel, formatLabel } from "@/domain/reading"
import { enrichBook, type BookSearchResult } from "@/lib/book-metadata"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookCover } from "./book-cover"
import { BookSearch } from "./book-search"
import { cn } from "@/lib/utils"

const FORMATS: BookFormat[] = ["physical", "ebook", "audiobook"]
const STATUSES: BookStatus[] = ["want", "reading", "finished", "paused", "dnf"]

type Mode = "search" | "manual"

export function BookDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing?: Book | null
}) {
  const isEdit = !!editing
  const createBook = useCreateBook()
  const updateBook = useUpdateBook()
  const uploadCover = useUploadBookCover()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>("manual")
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [pageCount, setPageCount] = useState("")
  const [genre, setGenre] = useState("")
  const [publishedYear, setPublishedYear] = useState("")
  const [isbn, setIsbn] = useState("")
  const [publisher, setPublisher] = useState("")
  const [coverUrl, setCoverUrl] = useState("")
  const [format, setFormat] = useState<BookFormat>("physical")
  const [status, setStatus] = useState<BookStatus>("want")
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [enriching, setEnriching] = useState(false)

  useEffect(() => {
    if (!open) return
    setCoverFile(null)
    if (editing) {
      setMode("manual")
      setTitle(editing.title)
      setAuthor(editing.author ?? "")
      setPageCount(editing.pageCount != null ? String(editing.pageCount) : "")
      setGenre(editing.genre ?? "")
      setPublishedYear(
        editing.publishedYear != null ? String(editing.publishedYear) : "",
      )
      setIsbn(editing.isbn ?? "")
      setPublisher(editing.publisher ?? "")
      setCoverUrl(editing.coverUrl ?? "")
      setFormat(editing.format)
      setStatus(editing.status)
    } else {
      setMode("search")
      setTitle("")
      setAuthor("")
      setPageCount("")
      setGenre("")
      setPublishedYear("")
      setIsbn("")
      setPublisher("")
      setCoverUrl("")
      setFormat("physical")
      setStatus("want")
    }
  }, [open, editing])

  async function applyResult(r: BookSearchResult) {
    setEnriching(true)
    try {
      const full = await enrichBook(r)
      setTitle(full.title)
      setAuthor(full.author ?? "")
      setPageCount(full.pageCount != null ? String(full.pageCount) : "")
      setGenre(full.genre ?? "")
      setPublishedYear(
        full.publishedYear != null ? String(full.publishedYear) : "",
      )
      setIsbn(full.isbn ?? "")
      setPublisher(full.publisher ?? "")
      setCoverUrl(full.coverUrl ?? "")
      setCoverFile(null)
    } finally {
      setEnriching(false)
      setMode("manual")
    }
  }

  const previewUrl = coverFile
    ? URL.createObjectURL(coverFile)
    : coverUrl || (editing ? coverSrc(editing) : null)

  async function submit() {
    if (!title.trim()) {
      toast.error("Informe o título do livro")
      return
    }
    const pages = pageCount ? Number(pageCount) : null
    if (pages != null && (!Number.isFinite(pages) || pages < 0)) {
      toast.error("Número de páginas inválido")
      return
    }
    setBusy(true)
    try {
      const base = {
        title: title.trim(),
        author: author.trim() || null,
        pageCount: pages,
        genre: genre.trim() || null,
        publishedYear: publishedYear ? Number(publishedYear) : null,
        isbn: isbn.trim() || null,
        publisher: publisher.trim() || null,
        coverUrl: coverUrl.trim() || null,
        format,
        status,
      }
      let bookId: string
      if (editing) {
        await updateBook.mutateAsync({ id: editing.id, patch: base })
        bookId = editing.id
      } else {
        const created = await createBook.mutateAsync(base)
        bookId = created.id
      }
      if (coverFile) {
        const path = await uploadCover.mutateAsync({ bookId, file: coverFile })
        await updateBook.mutateAsync({ id: bookId, patch: { coverPath: path } })
      }
      toast.success(isEdit ? "Livro atualizado" : "Livro adicionado")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar livro" : "Adicionar livro"}</DialogTitle>
          <DialogDescription>
            Busque para preencher automaticamente, ou informe os dados à mão.
          </DialogDescription>
        </DialogHeader>

        {!isEdit && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "search", label: "Buscar" },
              { value: "manual", label: "Manual" },
            ]}
          />
        )}

        {mode === "search" ? (
          <BookSearch onPick={applyResult} />
        ) : (
          <>
            {enriching && (
              <p className="text-xs text-muted-foreground">
                Completando dados do livro…
              </p>
            )}
            <div className="grid grid-cols-[6rem_1fr] gap-4">
              <div className="space-y-2">
                <BookCover url={previewUrl} title={title} />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadSimpleIcon weight="bold" /> Capa
                </Button>
              </div>

              <div className="space-y-3">
                <Field label="Título">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: O Homem em Busca de Sentido"
                  />
                </Field>
                <Field label="Autor(a)">
                  <Input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Ex.: Viktor Frankl"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Páginas">
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={pageCount}
                      onChange={(e) => setPageCount(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Gênero">
                    <Input
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      placeholder="Ex.: Psicologia"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ano">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={publishedYear}
                  onChange={(e) => setPublishedYear(e.target.value)}
                  placeholder="Ex.: 2006"
                />
              </Field>
              <Field label="ISBN">
                <Input
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="Opcional"
                />
              </Field>
            </div>

            <Field label="Capa por URL (opcional)">
              <Input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://…"
                disabled={!!coverFile}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Formato">
                <Segmented
                  value={format}
                  onChange={setFormat}
                  options={FORMATS.map((f) => ({
                    value: f,
                    label: formatLabel(f),
                  }))}
                />
              </Field>
              <Field label="Status">
                <Segmented
                  value={status}
                  onChange={setStatus}
                  options={STATUSES.map((s) => ({
                    value: s,
                    label: statusLabel(s),
                  }))}
                />
              </Field>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={submit} loading={busy}>
                Salvar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
