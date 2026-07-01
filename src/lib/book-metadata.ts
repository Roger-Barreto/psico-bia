/**
 * Busca de metadados de livros direto do browser (sem backend), respeitando os
 * limites do Supabase-direct. Fonte primária: Open Library (sem chave, CORS-ok);
 * enriquecimento/fallback: Google Books (chave opcional via VITE_GOOGLE_BOOKS_KEY).
 *
 * ⚠️ Privacidade (LGPD): só trafega título/ISBN do livro — nunca dado de paciente.
 */

export interface BookSearchResult {
  title: string
  author: string | null
  coverUrl: string | null
  pageCount: number | null
  publishedYear: number | null
  genre: string | null
  publisher: string | null
  isbn: string | null
  source: "openlibrary" | "google"
}

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_BOOKS_KEY as string | undefined

// ─── Open Library ─────────────────────────────────────────
async function searchOpenLibrary(
  q: string,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> {
  const url =
    "https://openlibrary.org/search.json?limit=12&fields=" +
    "title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,publisher" +
    `&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error("Open Library indisponível")
  const json = await res.json()
  return (json.docs ?? [])
    .map(
      (d: any): BookSearchResult => ({
        title: d.title,
        author: Array.isArray(d.author_name)
          ? d.author_name.slice(0, 2).join(", ")
          : null,
        coverUrl: d.cover_i
          ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
          : null,
        pageCount:
          typeof d.number_of_pages_median === "number"
            ? d.number_of_pages_median
            : null,
        publishedYear:
          typeof d.first_publish_year === "number"
            ? d.first_publish_year
            : null,
        genre: null,
        publisher: Array.isArray(d.publisher) ? d.publisher[0] : null,
        isbn: Array.isArray(d.isbn)
          ? (d.isbn.find((x: string) => x.length === 13) ?? d.isbn[0])
          : null,
        source: "openlibrary",
      }),
    )
    .filter((b: BookSearchResult) => !!b.title)
}

// ─── Google Books ─────────────────────────────────────────
function mapGoogleItem(item: any): BookSearchResult {
  const v = item.volumeInfo ?? {}
  const ids: any[] = v.industryIdentifiers ?? []
  const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier
  const isbn10 = ids.find((i) => i.type === "ISBN_10")?.identifier
  return {
    title: v.title,
    author: Array.isArray(v.authors) ? v.authors.slice(0, 2).join(", ") : null,
    coverUrl: v.imageLinks?.thumbnail
      ? String(v.imageLinks.thumbnail).replace(/^http:/, "https:")
      : null,
    pageCount:
      typeof v.pageCount === "number" && v.pageCount > 0 ? v.pageCount : null,
    publishedYear: v.publishedDate
      ? Number(String(v.publishedDate).slice(0, 4)) || null
      : null,
    genre: Array.isArray(v.categories) ? v.categories[0] : null,
    publisher: v.publisher ?? null,
    isbn: isbn13 ?? isbn10 ?? null,
    source: "google",
  }
}

async function searchGoogle(
  q: string,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> {
  const key = GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : ""
  const url = `https://www.googleapis.com/books/v1/volumes?maxResults=12&q=${encodeURIComponent(
    q,
  )}${key}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error("Google Books indisponível")
  const json = await res.json()
  return (json.items ?? [])
    .map(mapGoogleItem)
    .filter((b: BookSearchResult) => !!b.title)
}

// ─── API pública ──────────────────────────────────────────
/** Busca por título/autor (Open Library; cai para Google se vier vazio). */
export async function searchBooks(
  query: string,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const ol = await searchOpenLibrary(q, signal).catch(() => [])
  if (ol.length > 0) return ol
  return searchGoogle(q, signal).catch(() => [])
}

/** Preenche lacunas (páginas/gênero/editora) via Google Books ao escolher um livro. */
export async function enrichBook(
  b: BookSearchResult,
): Promise<BookSearchResult> {
  if (b.pageCount && b.genre) return b
  const q = b.isbn ? `isbn:${b.isbn}` : `${b.title} ${b.author ?? ""}`.trim()
  try {
    const g = await searchGoogle(q)
    const best = g[0]
    if (!best) return b
    return {
      ...b,
      pageCount: b.pageCount ?? best.pageCount,
      genre: b.genre ?? best.genre,
      publisher: b.publisher ?? best.publisher,
      publishedYear: b.publishedYear ?? best.publishedYear,
      coverUrl: b.coverUrl ?? best.coverUrl,
    }
  } catch {
    return b
  }
}
