# Leituras — Plano de Implementação

> **Status:** Proposta / plano técnico (nada implementado ainda).
> **Data:** 2026-07-01 · **Módulo:** `Leituras` (acompanhamento de leitura de livros).
> **Escopo:** feature isolada das demais, com pasta própria no menu (`Leituras`) e duas
> páginas: **Track** e **Dashboard**.

Este documento é um plano **acionável**: traz modelo de dados (SQL de migração), integração
de APIs de metadados, camada de dados no frontend, componentes de UI, regras de sessão de
leitura, catálogo de métricas do dashboard e um roadmap por fases — tudo respeitando as
convenções do PsicoBia e os limites do Supabase (ver [`../evolucao/README.md`](../evolucao/README.md)).

---

## Sumário

1. [Sumário executivo](#1-sumário-executivo)
2. [Objetivo e escopo](#2-objetivo-e-escopo)
3. [Pesquisa de mercado — o que copiar (e o que ignorar)](#3-pesquisa-de-mercado--o-que-copiar-e-o-que-ignorar)
4. [Encaixe na arquitetura atual](#4-encaixe-na-arquitetura-atual)
5. [Limites do Supabase e decisões de projeto](#5-limites-do-supabase-e-decisões-de-projeto)
6. [Modelo de dados (migração `018_leituras`)](#6-modelo-de-dados-migração-018_leituras)
7. [Metadados de livros — Open Library + Google Books](#7-metadados-de-livros--open-library--google-books)
8. [Camada de dados no frontend](#8-camada-de-dados-no-frontend)
9. [Componentes de UI](#9-componentes-de-ui)
10. [Página **Track**](#10-página-track)
11. [Sessões de leitura (cronômetro + manual)](#11-sessões-de-leitura-cronômetro--manual)
12. [Cor por progresso + animação de conclusão](#12-cor-por-progresso--animação-de-conclusão)
13. [Página **Dashboard** — catálogo de métricas](#13-página-dashboard--catálogo-de-métricas)
14. [Metas, sequências (streaks) e gamificação](#14-metas-sequências-streaks-e-gamificação)
15. [Menu e rotas](#15-menu-e-rotas)
16. [Roadmap por fases](#16-roadmap-por-fases)
17. [Riscos e mitigações](#17-riscos-e-mitigações)
18. [Decisões tomadas e pontos em aberto](#18-decisões-tomadas-e-pontos-em-aberto)
19. [Apêndice — mapeamento requisito → solução e fontes](#19-apêndice--mapeamento-requisito--solução-e-fontes)

---

## 1. Sumário executivo

Um módulo de leitura **single-user** (como o resto do app), 100% no padrão **Supabase-direct**:
o frontend fala direto com o Postgres (RLS por usuário autenticado) e com o Storage; nada de
backend novo. Quatro tabelas (`books`, `reading_sessions`, `reading_goals`, `book_quotes`),
um bucket de capas, e a lógica pesada (velocidade, ritmo, sequências, previsão de término,
agregações do dashboard) fica em `src/domain/reading.ts` **puro** — igual a `domain/finance.ts`.

A página **Track** é uma **estante visual** (gallery de capas) com destaque para o que está
sendo lido, barra/anel de progresso que **muda de cor conforme avança**, e um controle de
página com **slider + botões + campo numérico**. Cada livro registra **sessões de leitura**,
por **cronômetro** (start/pause/stop) ou por **horário inicial/final manual**. Ao terminar um
livro, dispara uma **animação de partículas** (confete, reaproveitando `canvas-confetti`).

A página **Dashboard** reúne **todas as métricas viáveis** — livros/páginas/tempo por período,
velocidade média, sequência atual e recorde, ritmo e previsão de término, mapa de calor de
dias lidos, distribuições por gênero/formato/nota, meta anual — inspiradas no Hardcover
(melhor painel do mercado) e no Bookmory (calendário/sessões).

Adotamos ainda features de alto valor que os melhores apps têm e que **cabem** aqui:
estantes por status (Quero ler / Lendo / Lido / Abandonei / Pausado), notas e avaliação
com meia-estrela, citações por livro, meta anual (desafio) e retrospectiva "Wrapped".
Ficam **de fora** recursos sociais (clubes, feed, amigos) e "personalidade de leitura por IA"
(ver §3, com o caso Fable).

---

## 2. Objetivo e escopo

### 2.1 Requisitos do pedido (obrigatórios)

| # | Requisito | Onde é tratado |
|---|---|---|
| R1 | Feature isolada, pasta `Leituras` no menu com **Track** e **Dashboard** | §15 |
| R2 | Adicionar livro com **imagem, nº de páginas etc.** | §6, §7, §9, §10 |
| R3 | Sessão de leitura: **cronômetro** OU **horário inicial/final** ao finalizar | §11 |
| R4 | **Slider + botões + campo** para definir páginas lidas | §9 (`ui/slider`), §10.3 |
| R5 | Exibir os livros com progresso de forma **bonita** na Track | §10 |
| R6 | Reunir **todas as métricas possíveis** no Dashboard | §13 |
| R7 | **Animação de partículas** ao concluir | §12 |
| R8 | Progresso **muda de cor** do início ao fim conforme % | §12 |

### 2.2 Funcionalidades adicionais recomendadas (além do pedido)

O pedido pede para "julgar o que vale copiar e adicionar aos requisitos". Recomendações,
priorizadas (justificativa e fonte em §3 e §19):

**Devem entrar (alto valor, baixo custo):**
- **Estantes por status:** `Quero ler (TBR)`, `Lendo`, `Lido`, `Abandonei (DNF)`, `Pausado`.
  Padrão universal (Goodreads/StoryGraph/Hardcover/Fable). Barato: uma coluna `status`.
- **Meta anual / desafio de leitura** (X livros no ano) com anel de progresso — Goodreads.
- **Sequência de leitura (streak)** atual e recorde + **mapa de calor** de dias lidos —
  a feature "herói" do Bookmory e do Hardcover; forte gatilho de hábito.
- **Ritmo e previsão de término** do livro atual (páginas/dia → data estimada) — Hardcover.
- **Avaliação com meia-estrela + resenha/nota** por livro.

**Delight (recomendado, fase posterior):**
- **Citações/destaques** por livro (assinatura do Literal/Bookmory).
- **Retrospectiva anual ("Wrapped")** — cartão-resumo do ano (Fable/Hardcover/Bookmory).
- **Cartão "Estante" compartilhável** (Shelfie do Fable) — imagem bonita da estante.
- **Tags/prateleiras livres** (`tags text[]`) para organização leve.

**Nice-to-have (opcional):**
- **Leitura de código de barras (ISBN)** via câmera (`BarcodeDetector` nativo do browser; PWA).
- **Múltiplas edições / re-leituras** (`reread_count`).

**Fora de escopo (não copiar):**
- Recursos **sociais** (clubes, feed, amigos, buddy reads) — app é single-user.
- **Personalidade de leitura por IA / recaps gerados por LLM** — a Fable removeu isso em
  jan/2025 após gerar textos racistas/enviesados (ver §3.4). Se um dia quisermos "Wrapped",
  fazemos com dados/regras determinísticas, sem IA generativa.
- **Leitor de e-book embutido**, marketplace, DRM.

---

## 3. Pesquisa de mercado — o que copiar (e o que ignorar)

Resumo da varredura de apps/sites de acompanhamento de leitura (fontes em §19).

### 3.1 Panorama por app

| App | Plataforma / preço | Conhecido por | Vale copiar |
|---|---|---|---|
| **Bookmory** | iOS/Android · freemium | **Cronômetro de sessão** + velocidade automática, **calendário de leitura** (feature herói), streaks, stats mensais/anuais, "Annual Rewind" | Modelo de **sessão + calendário + velocidade** |
| **Bookly** | iOS/Android · freemium | Timer **gamificado**, relatórios semanais/mensais/anuais | Relatórios por período; gamificação leve |
| **Hardcover** | Web/iOS/Android · free + Supporter | **Melhor página de estatísticas** do mercado; API GraphQL pública; recomendação **sem IA generativa** | **Catálogo de métricas do Dashboard** (§13) |
| **The StoryGraph** | Web/iOS/Android · freemium | Gráficos ricos, **tags de mood/pace**, questionário de avaliação | Data-viz; tags de humor/ritmo (opcional) |
| **Goodreads** | Web/app · free | Prateleiras, **Reading Challenge** anual | **Desafio anual**; estantes |
| **Fable** | iOS/Android/(web fraca) · freemium | Design polido, **Shelfie** (estante compartilhável), Wrap mensal/anual | **Shelfie** e **Wrapped** (sem IA) |
| **Literal** | Web/iOS · free | **Minimalismo** tipográfico; **destaques por foto** (OCR) | Estética calma; **citações/destaques** |
| **BookSloth** | iOS/Android · free | Descoberta social estilo Instagram; review por "elementos" | Pouco (é social/descoberta) |
| **ReadEra** | Android/iOS · free + premium | E-reader com **stats por sessão** (tempo + páginas), coleções | Ideia de stats por sessão |
| **Notion (templates)** | — | **Gallery = estante**, board por status, rollups de stats | **Views: gallery + board + tabela + calendário** |

### 3.2 Features "core" esperadas (união dos apps)
- **Adicionar livro:** busca por título/ISBN, **capa** (auto ou upload), metadados
  (páginas, autor, gênero, editora, ano, formato físico/ebook/áudio), entrada manual.
- **Status/estantes:** Quero ler / Lendo / Lido / DNF; prateleiras/tags; re-leituras.
- **Progresso:** por **página** ou **%**; atualização da página atual; "lendo agora".
- **Sessões:** **cronômetro** vs **início/fim manual**; páginas por sessão; intervalos de página.
- **Avaliação/notas:** estrelas (meia-estrela), resenha, **citações/destaques**.
- **Estatísticas/Dashboard:** ver catálogo exaustivo em §13 (é o coração do pedido R6).
- **Metas/gamificação:** desafio anual, metas de página/tempo, **streaks**, marcos.
- **Delight:** **comemoração ao concluir**, **cor de progresso**, gráficos, **Wrapped**, estante visual.

### 3.3 Padrão de views que vale copiar (Notion + apps)
A **gallery de capas é o gancho emocional** — deve ser a visão primária da Track.
Complementos: **board por status** (arrastar entre colunas), **tabela** (ordenar/filtrar) e
**calendário/heatmap** de dias lidos. Adotamos gallery (Track) + heatmap/calendário (Dashboard);
board e tabela ficam como incremento opcional.

### 3.4 Alerta (não copiar): IA de "personalidade de leitura" da Fable
Em jan/2025 os recaps gerados por IA da Fable produziram textos **racistas e enviesados**
(ex.: sugerir a um leitor negro "ler ocasionalmente um autor branco"); após a repercussão a
Fable **removeu todos os recursos de IA generativa**. Lição para o nosso "Wrapped":
usar **dados e regras determinísticas**, nunca gerar julgamentos sobre o gosto do usuário por IA.

---

## 4. Encaixe na arquitetura atual

O módulo espelha o **módulo Financeiro** (referência mais recente e completa). Convenções
observadas no código atual (ver [`../03-arquitetura/modelo-de-dados.md`](../03-arquitetura/modelo-de-dados.md),
[`../05-frontend/`](../05-frontend/)):

- **Stack:** React 18 + Vite + TS + Tailwind + Radix + **TanStack Query** + Supabase-js +
  **framer-motion** + **recharts** + **canvas-confetti** + **sonner** + **zod** + **date-fns** + **nanoid**.
- **IDs:** `text` PK via `nanoid(10)` com prefixo por coleção (ex.: `bk_`, `rs_`, `rg_`, `qt_`).
- **Datas:** string ISO `YYYY-MM-DD` para datas puras; ISO completo para timestamps
  (`created_at`/`updated_at`); horários `HH:MM`. (idêntico ao resto do app.)
- **Soft-delete:** coluna `active boolean default true` (arquivar em vez de apagar).
- **RLS:** app é **single-user**; política padrão `for all to authenticated using (true)`
  (não há `owner_id`). Basta habilitar RLS e criar a policy por tabela.
- **Storage:** bucket com caminho `${userId}/…`; `requireUserId()` em
  [`../../src/lib/supabase.ts`](../../src/lib/supabase.ts).
- **Camada de dados:** hooks em [`../../src/api/queries.ts`](../../src/api/queries.ts) com
  **mappers** `rowTo*`/`*ToRow` (snake_case ↔ camelCase), chaves em objeto `qk`/`fqk`,
  `useQuery`/`useMutation` + `invalidateQueries` (sem optimistic update).
- **Domínio puro:** funções sem React/fetch em `src/domain/*` (ex.: `finance.ts`, `dates.ts`).
- **Tipos canônicos:** interfaces camelCase escritas à mão em
  [`../../src/db/types.ts`](../../src/db/types.ts).
- **Layout de módulo:** um `*Layout` que renderiza `<Outlet/>`
  ([`../../src/components/finance/finance-layout.tsx`](../../src/components/finance/finance-layout.tsx)),
  rotas aninhadas em [`../../src/App.tsx`](../../src/App.tsx), grupo no menu em
  [`../../src/components/app-shell.tsx`](../../src/components/app-shell.tsx).
- **Migrações:** aplicadas **manualmente** no SQL Editor do Supabase, numeradas
  sequencialmente (última referência: `017`). Esta será a **`018_leituras`**.

---

## 5. Limites do Supabase e decisões de projeto

Plano free (ver [`../evolucao/README.md`](../evolucao/README.md)): **500 MB** de Postgres,
**1 GB** de Storage, **5 GB/mês** de banda, **pausa após 7 dias** sem requisição.

| Limite / restrição | Impacto no módulo | Decisão / mitigação |
|---|---|---|
| **Sem backend** (só browser → Supabase) | Metadados e capas precisam vir de API pública chamável do browser | **Open Library + Google Books** (CORS-ok, sem chave) — §7 |
| **Storage 1 GB** | Capas podem crescer | **Hotlink** da capa externa por padrão (`cover_url`), custo ~0; upload próprio (`cover_path`) só quando o usuário quiser. Capas são pequenas (≈50–200 KB) |
| **DB 500 MB** | Irrelevante: metadados são texto leve; sessões crescem devagar (~centenas de bytes) | Milhares de livros/sessões cabem por anos |
| **Sem server para agregação** | Dashboard calcula stats no cliente | Agregação em `domain/reading.ts` (puro) sobre dados já em cache do React Query. Se algum dia escalar, migrar para **view Postgres** como `finance_ledger` |
| **Pausa após 7 dias** | Nenhum (uso diário) | — |
| **Rate limit de API externa** | Busca pode ser chamada muito | **Debounce** na busca, **cache** no React Query, chave opcional do Google Books via env |
| **LGPD / privacidade** | App lida com dados de saúde | À API de livros vai **somente título/ISBN** — **nunca** dado de paciente. Fronteira documentada em §7.4 |
| **Timer sobrevive a reload?** | Cronômetro rodando não pode se perder ao navegar/recarregar | Persistir estado do timer em `localStorage` (§11.3) |

---

## 6. Modelo de dados (migração `018_leituras`)

### 6.1 SQL (aplicar no SQL Editor do Supabase, após a `017`)

```sql
-- ============================================================
-- 018_leituras.sql — módulo de acompanhamento de leitura
-- ============================================================

-- Estante de livros
create table public.books (
  id             text primary key,               -- bk_<nanoid(10)>
  title          text not null,
  subtitle       text,
  author         text,                           -- string de exibição (1+ autores)
  cover_url      text,                            -- URL externa (Open Library/Google) OU pública do bucket
  cover_path     text,                            -- caminho no bucket quando o usuário sobe a própria capa
  page_count     int,
  current_page   int  not null default 0,         -- fonte de verdade do progresso
  format         text not null default 'physical'
                 check (format in ('physical','ebook','audiobook')),
  genre          text,
  publisher      text,
  published_year int,
  isbn           text,
  status         text not null default 'want'
                 check (status in ('want','reading','finished','dnf','paused')),
  rating         numeric check (rating >= 0 and rating <= 5),  -- meia-estrela: 0.5 .. 5.0
  review         text,
  notes          text,
  tags           text[] not null default '{}',
  is_favorite    boolean not null default false,
  color          text,                            -- acento opcional do card
  started_at     text,                            -- YYYY-MM-DD
  finished_at    text,                            -- YYYY-MM-DD
  reread_count   int not null default 0,
  active         boolean not null default true,   -- soft-delete / arquivar
  created_at     text not null,
  updated_at     text not null
);
create index books_status_idx   on public.books (status) where active;
create index books_finished_idx on public.books (finished_at);

-- Sessões de leitura
create table public.reading_sessions (
  id               text primary key,              -- rs_<nanoid(10)>
  book_id          text not null references public.books(id) on delete cascade,
  date             text not null,                 -- YYYY-MM-DD (base p/ streak e heatmap)
  started_at       text,                          -- ISO datetime (cronômetro) ou HH:MM (manual)
  ended_at         text,
  duration_seconds int  not null default 0,       -- do cronômetro ou (ended-started)
  start_page       int,
  end_page         int,
  pages_read       int  not null default 0,       -- end-start ou informado manualmente
  notes            text,
  created_at       text not null
);
create index reading_sessions_book_idx on public.reading_sessions (book_id);
create index reading_sessions_date_idx on public.reading_sessions (date);

-- Meta anual (desafio de leitura)
create table public.reading_goals (
  id             text primary key,                -- rg_<nanoid(10)>
  year           int  not null unique,
  target_books   int,
  target_pages   int,
  target_minutes int,
  created_at     text not null,
  updated_at     text not null
);

-- Citações / destaques (opcional — fase 6)
create table public.book_quotes (
  id         text primary key,                    -- qt_<nanoid(10)>
  book_id    text not null references public.books(id) on delete cascade,
  text       text not null,
  page       int,
  created_at text not null
);
create index book_quotes_book_idx on public.book_quotes (book_id);

-- ---------- RLS (padrão single-user autenticado) ----------
alter table public.books            enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.reading_goals    enable row level security;
alter table public.book_quotes      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['books','reading_sessions','reading_goals','book_quotes']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_authenticated', t
    );
  end loop;
end $$;
```

### 6.2 Storage — bucket de capas

Capas de livro **não são dados sensíveis** (diferente de `patient-documents`, que é privado).
Para uma **gallery** com muitas imagens, URL pública é mais simples (sem signed URLs que
expiram). Escrita restrita ao dono pelo 1º segmento do caminho.

```sql
insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

create policy "book_covers_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book_covers_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book_covers_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
```

Caminho: `${userId}/${bookId}/${filename}`. Se `cover_path` estiver preenchido, a UI usa
`supabase.storage.from('book-covers').getPublicUrl(cover_path)`; senão usa `cover_url` (externa);
senão, placeholder.

> **Alternativa mais conservadora:** manter o bucket **privado** e usar `createSignedUrl`
> (como em `patient-documents`), gerando URLs em lote e cacheando no React Query. Escolhemos
> público por simplicidade da gallery; trocar é só mudar o flag e o helper de URL.

### 6.3 Tipos canônicos (`src/db/types.ts`)

```ts
export type BookStatus = "want" | "reading" | "finished" | "dnf" | "paused"
export type BookFormat = "physical" | "ebook" | "audiobook"

export interface Book {
  id: string
  title: string
  subtitle: string | null
  author: string | null
  coverUrl: string | null       // URL externa OU pública do bucket
  coverPath: string | null      // caminho no bucket (upload próprio)
  pageCount: number | null
  currentPage: number           // fonte de verdade do progresso
  format: BookFormat
  genre: string | null
  publisher: string | null
  publishedYear: number | null
  isbn: string | null
  status: BookStatus
  rating: number | null         // 0.5 .. 5 (meia-estrela)
  review: string | null
  notes: string | null
  tags: string[]
  isFavorite: boolean
  color: string | null
  startedAt: string | null      // YYYY-MM-DD
  finishedAt: string | null     // YYYY-MM-DD
  rereadCount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ReadingSession {
  id: string
  bookId: string
  date: string                  // YYYY-MM-DD
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number
  startPage: number | null
  endPage: number | null
  pagesRead: number
  notes: string | null
  createdAt: string
}

export interface ReadingGoal {
  id: string
  year: number
  targetBooks: number | null
  targetPages: number | null
  targetMinutes: number | null
  createdAt: string
  updatedAt: string
}

export interface BookQuote {
  id: string
  bookId: string
  text: string
  page: number | null
  createdAt: string
}
```

### 6.4 Regras de negócio (progresso e status)

- **`current_page`** é a fonte de verdade do progresso (permite atualização manual sem sessão).
  Uma sessão com `end_page` faz `current_page = max(current_page, end_page)`.
- **Transições automáticas de status:**
  - primeira sessão / primeira atualização de página > 0 e `status='want'` → `reading`
    (grava `started_at` se vazio);
  - `current_page >= page_count` (ou botão "Concluir") → propõe `finished`
    (grava `finished_at`, dispara **animação de conclusão** §12);
  - "Abandonar" → `dnf`; "Pausar" → `paused`.
- **`pages_read` da sessão** = `end_page - start_page` quando ambos existem; senão valor informado.
- **Progresso %** = `page_count ? round(current_page / page_count * 100) : 0`.

---

## 7. Metadados de livros — Open Library + Google Books

Objetivo (R2): ao adicionar um livro, o usuário **busca por título/ISBN** e o app
**pré-preenche** capa, páginas, autor, gênero, ano e ISBN. Entrada **manual** + **upload de
capa** continuam disponíveis (decisão do usuário: *auto-fetch + manual*).

### 7.1 APIs escolhidas (grátis, chamáveis do browser)

| API | Chave? | CORS | Retorna | Papel |
|---|---|---|---|---|
| **Open Library Search** `https://openlibrary.org/search.json?q=…` | Não | Sim | título, `author_name[]`, `first_publish_year`, `number_of_pages_median`, `cover_i`, `isbn[]` | **Busca primária** (sem chave, generosa) |
| **Open Library Covers** `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg` (ou `/b/isbn/{isbn}-L.jpg`) | Não | Sim | imagem da capa | **Capas** (hotlink) |
| **Google Books** `https://www.googleapis.com/books/v1/volumes?q=…` | Opcional | Sim | `pageCount`, `categories[]`, `publisher`, `publishedDate`, `imageLinks.thumbnail`, `industryIdentifiers` | **Enriquecimento** (páginas/gênero/descrição) |

Estratégia: **buscar no Open Library** (rápido, sem chave) e **enriquecer** páginas/gênero via
Google Books quando faltarem. Se o usuário informar ISBN, buscar direto por ISBN nas duas.

### 7.2 Módulo `src/lib/book-metadata.ts` (esboço)

```ts
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

// Busca por texto (título/autor). Debounced na UI.
export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const url = `https://openlibrary.org/search.json?limit=12&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  const json = await res.json()
  return (json.docs ?? []).map((d: any) => ({
    title: d.title,
    author: d.author_name?.[0] ?? null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    pageCount: d.number_of_pages_median ?? null,
    publishedYear: d.first_publish_year ?? null,
    genre: null,
    publisher: null,
    isbn: d.isbn?.[0] ?? null,
    source: "openlibrary" as const,
  }))
}

// Enriquecimento opcional via Google Books (páginas/gênero/editora/descrição).
export async function enrichFromGoogle(isbnOrTitle: string): Promise<Partial<BookSearchResult>> { /* … */ return {} }
```

Chave opcional: `VITE_GOOGLE_BOOKS_KEY` (adicionar em `.env.local`; sem ela funciona em
volume baixo). Cachear resultados no React Query por `query`.

### 7.3 Capa: hotlink por padrão, upload opcional
- Resultado da busca traz `coverUrl` (Open Library) → grava em `books.cover_url` (hotlink,
  0 bytes de storage).
- Usuário pode **enviar a própria capa** → upload no bucket `book-covers` → grava `cover_path`.
- Ordem de exibição na UI: `cover_path` (público do bucket) → `cover_url` → placeholder.

### 7.4 Fronteira de privacidade (LGPD)
Somente **título/ISBN do livro** é enviado ao Open Library/Google Books. **Nenhum** dado de
paciente, prontuário ou identidade do usuário trafega para essas APIs. Documentar isso em
[`../07-operacao/seguranca.md`](../07-operacao/seguranca.md) quando implementado.

---

## 8. Camada de dados no frontend

### 8.1 Chaves de query (em `src/api/queries.ts`)

```ts
export const rqk = {
  books:        ["reading-books"] as const,
  book:         (id: string) => ["reading-books", id] as const,
  sessions:     (bookId?: string) => ["reading-sessions", bookId ?? "all"] as const,
  goal:         (year: number) => ["reading-goal", year] as const,
  quotes:       (bookId: string) => ["reading-quotes", bookId] as const,
}
```

### 8.2 Hooks (mesmo padrão de `usePatients`/`useCreatePatient`)

- `useBooks(opts?)` — lista `active`, ordenada; `staleTime: 30_000`.
- `useCreateBook()` — `newId("bk")`, `created_at/updated_at = nowIso()`; invalida `rqk.books`.
- `useUpdateBook()` — `{ id, patch: Partial<Book> }` via `bookToRow(patch)`.
- `useArchiveBook()` — `active=false` (soft-delete).
- `useReadingSessions(bookId?)`, `useCreateSession()`, `useUpdateSession()`, `useDeleteSession()`
  — ao criar/editar sessão, também atualiza `books.current_page`/`status`/`started_at` e
  invalida `rqk.books` + `rqk.sessions`.
- `useReadingGoal(year)` / `useUpsertReadingGoal()`.
- `useBookQuotes(bookId)` / `useAddQuote()` / `useDeleteQuote()`.
- **Capa:** `useUploadBookCover(bookId)` — caminho `${userId}/${bookId}/${file.name}`,
  `upsert:true`, grava `cover_path`; `bookCoverPublicUrl(path)` helper (getPublicUrl).

> Reaproveitar os helpers existentes `newId()`, `nowIso()` e o padrão de mappers
> `rowToBook`/`bookToRow` (snake_case ↔ camelCase), idênticos aos de finance.

### 8.3 Domínio puro — `src/domain/reading.ts`

Sem React/fetch. Funções (com `date-fns`/helpers de `domain/dates.ts`):

```ts
progressPct(book: Book): number
progressColor(pct: number): string                 // cor início→fim (§12)
statusLabel(s: BookStatus): string
statusTone(s: BookStatus): "muted"|"primary"|"success"|"warning"|"destructive"
formatDuration(seconds: number): string            // "3h 24min"

// Agregações de sessões
bookTotals(sessions: ReadingSession[]): { seconds: number; pages: number; count: number }
readingSpeedPph(sessions: ReadingSession[]): number // páginas por hora
avgSessionMinutes(sessions: ReadingSession[]): number

// Ritmo e previsão
pagesPerDay(sessions: ReadingSession[], days: number): number
projectedFinish(book: Book, sessions: ReadingSession[]): { daysLeft: number; date: string | null }

// Sequências e calendário
readingDays(sessions: ReadingSession[]): Set<string>       // datas YYYY-MM-DD
currentStreak(days: Set<string>, today: string): number
longestStreak(days: Set<string>): number
heatmapData(sessions: ReadingSession[], year: number): { date: string; minutes: number }[]

// Dashboard (agregação grande sobre a biblioteca)
libraryStats(books: Book[], sessions: ReadingSession[], period: StatsPeriod): ReadingStats
```

---

## 9. Componentes de UI

### 9.1 Primitivos que **faltam** (criar em `src/components/ui/`)

- **`slider.tsx`** — necessário para R4. Adicionar dep **`@radix-ui/react-slider`** e
  envolver no padrão CVA/Tailwind do projeto (trilho `bg-muted`, range `bg-primary`, thumb
  com `ring`/`shadow-glow`). Suportar `value`, `min`, `max`, `step`, `onValueChange`.
- **`textarea.tsx`** — para notas/resenha/citações. Wrapper simples de `<textarea>` no mesmo
  estilo do `Input` (sem dep nova).

> Já disponíveis e reutilizáveis: `button` (tem prop `loading`), `input`, `card`, `dialog`,
> `sheet`, `select`, `date-picker`, `time-picker` (para horário início/fim manual!),
> `popover`, `checkbox`, `radio-group`, `avatar`, `spinner`, `skeleton`, `dropdown-menu`,
> `confirm-dialog`, e `@radix-ui/react-tooltip` (já é dep, usado no `app-shell`).

### 9.2 Componentes do módulo (`src/components/reading/`)

| Arquivo | Papel |
|---|---|
| `reading-layout.tsx` | `<Outlet/>`; garante linha de `reading_goal` do ano; pill de timer ativo |
| `book-card.tsx` | Card da estante: capa 2:3, título/autor, **anel/barra de progresso colorido**, status |
| `book-cover.tsx` | Capa com fallback (placeholder + inicial), aspect-ratio 2:3, cantos arredondados |
| `book-dialog.tsx` | Adicionar/editar: **busca (auto-fetch)** + campos manuais + upload de capa |
| `book-search.tsx` | Combobox de busca (debounce) → resultados com capa; preenche o form |
| `book-detail-drawer.tsx` | Detalhe: progresso, sessões, citações, avaliação, resenha, ações (concluir/pausar/abandonar) |
| `progress-control.tsx` | **Slider + botões (+/−, "terminei") + campo numérico** de página (R4) |
| `session-timer.tsx` | Cronômetro: start/pause/resume/stop; persiste em `localStorage` |
| `log-session-dialog.tsx` | Sessão manual: data, **início/fim (time-picker)**, páginas, notas |
| `rating-stars.tsx` | Avaliação com **meia-estrela** (input e display) |
| `finish-celebration.tsx` | Overlay de conclusão (framer-motion) + partículas (§12) |
| `reading-calendar-heatmap.tsx` | Mapa de calor de dias lidos (estilo GitHub) |
| `book-shelf.tsx` | Gallery responsiva de `book-card` com filtros por status/tag/busca |

Estatísticas do Dashboard reaproveitam `dashboard/kpi-card.tsx`, `dashboard/financial-gauge.tsx`
(padrão de gauge com `RadialBarChart`) e `dashboard/charts.tsx`.

---

## 10. Página **Track**

Rota `/leituras` (index). Estrutura no padrão de página do app (header com `Breadcrumbs` +
título + ações; `@container`; skeletons no loading; empty-state amigável).

### 10.1 Layout
1. **Header:** título "Leituras · Track", botão **"Adicionar livro"**, filtro por status
   (chips: Lendo / Quero ler / Lido / Pausado / Abandonado) e busca.
2. **"Lendo agora" (destaque):** carrossel/linha dos livros `reading` com capa grande,
   **anel de progresso colorido** (§12), % e página atual, e ações rápidas:
   **▶ Iniciar sessão (cronômetro)**, **✎ Registrar sessão (manual)**, **+páginas**.
3. **Estante (gallery):** grid responsivo de `book-card` (capas), agrupável por status.
   Cl?ique abre o `book-detail-drawer`.

### 10.2 Adicionar livro (`book-dialog`)
- Aba **Buscar:** campo de busca → resultados (Open Library) → escolher preenche
  título/autor/capa/páginas/ano/ISBN.
- Aba **Manual:** todos os campos editáveis; **upload de capa**; formato (físico/ebook/áudio);
  status inicial; tags.
- Validação simples + `toast` (padrão `transaction-dialog`): título obrigatório; páginas > 0
  se informado.

### 10.3 Controle de páginas (R4) — `progress-control.tsx`
Três formas de definir a página atual, sincronizadas:
- **Slider** (`ui/slider`, `min=0 max=page_count`) — arrastar;
- **Botões** `−1` / `+1` / `+10` e **"Terminei o livro"** (vai a `page_count`);
- **Campo numérico** para digitar a página exata.
Ao confirmar, grava `current_page` (e, se veio de uma sessão, `pages_read`); recalcula % e cor;
se atingiu o fim, chama o fluxo de conclusão (§12).

---

## 11. Sessões de leitura (cronômetro + manual)

Cada leitura vira uma `reading_session`. Dois modos (R3):

### 11.1 Cronômetro (`session-timer.tsx`)
- Botão **Iniciar** → mostra tempo correndo (mm:ss), **Pausar/Retomar**, **Parar**.
- Ao **Parar**, abre um mini-form: **página inicial → final** (pré-preenche inicial =
  `current_page`), notas; salva `duration_seconds` (do cronômetro), `pages_read`, atualiza livro.

### 11.2 Manual (`log-session-dialog.tsx`)
- **Data** (`date-picker`), **horário início/fim** (`time-picker` — já existe!), de onde se
  deriva `duration_seconds`; **páginas** (start/end via `progress-control`), notas.

### 11.3 Persistência do cronômetro (importante)
O timer não pode se perder ao navegar/recarregar. Guardar em `localStorage`
(`leituras:timer = { bookId, startEpoch, accumulatedMs, paused }`); um **pill flutuante**
no `reading-layout` indica "⏱ Lendo <título>" e permite voltar/parar de qualquer página.
(Refazemos o cálculo de tempo a partir de `startEpoch`, então o relógio continua certo mesmo
após reload.)

### 11.4 Efeitos ao salvar sessão
`current_page = max(current_page, end_page)`; se `status='want'` → `reading` + `started_at`;
invalida `rqk.books`/`rqk.sessions`; `toast.success`; se atingiu o fim → §12.

---

## 12. Cor por progresso + animação de conclusão

### 12.1 Cor do progresso início→fim (R8) — em `domain/reading.ts`
Interpola o **matiz** passando pelas cores da marca: **rosa (353°, `--primary`) → âmbar (46°,
`--secondary`) → verde (145°)** conforme 0→100%.

```ts
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 0% rosa → 50% âmbar → 100% verde. */
export function progressColor(pct: number): string {
  const t = Math.max(0, Math.min(100, pct)) / 100
  const hue =
    t < 0.5
      ? lerp(353, 360 + 46, t / 0.5) % 360   // 353→46 (sobe cruzando 360)
      : lerp(46, 145, (t - 0.5) / 0.5)        // 46→145 (âmbar→verde)
  return `hsl(${Math.round(hue)} 80% 60%)`
}
```

Uso: cor do **anel** (`RadialBarChart` ou SVG `stroke`) e da **barra** (`background` do range).
Transição suave com `transition-colors`/CSS. (Alternativa: `linear-gradient` rosa→âmbar→verde
com um "clip" no % — porém a cor sólida por % comunica melhor "onde estou".)

### 12.2 Animação de partículas ao concluir (R7) — estende `src/lib/celebrate.ts`
Reaproveita `canvas-confetti` (já é dep; já usado em atender/pagar). Nova função:

```ts
export function celebrateBook() {
  const emojis = ["📚", "📖", "✨", "🎉", "🌟"]
  const shapes = emojis.map((text) => confetti.shapeFromText({ text, scalar: 2 }))
  // rajada central
  confetti({ particleCount: 140, spread: 100, startVelocity: 48, gravity: 0.9,
             origin: { y: 0.6 }, shapes, scalar: 2, ticks: 200,
             colors: ["#f43f5e", "#fbbf24", "#22c55e", "#a78bfa", "#38bdf8"] })
  // canhões laterais por ~1.2s
  const end = Date.now() + 1200
  ;(function frame() {
    confetti({ particleCount: 6, angle: 60,  spread: 60, origin: { x: 0 }, shapes, scalar: 2 })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, shapes, scalar: 2 })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
```

Combinar com `finish-celebration.tsx` (framer-motion): overlay que faz **scale-in** de um
cartão "Parabéns! Você terminou **{título}** 🎉" com a capa e o total de páginas/tempo, e
botões "Avaliar" e "Fechar". (framer-motion já é usado no projeto — `AnimatePresence`.)

---

## 13. Página **Dashboard** — catálogo de métricas

Rota `/leituras/dashboard`. Reúne **todas as métricas viáveis** (R6), calculadas no cliente
por `libraryStats()`. Filtro de período reutiliza o padrão `MonthNav`/seletor (mês / ano /
tudo). Layout: KPIs no topo, depois gráficos (recharts) e o **mapa de calor**. Skeletons no
loading (padrão `dashboard/skeletons.tsx`).

### 13.1 KPIs (cards)
| KPI | Cálculo | Prioridade |
|---|---|---|
| Livros lidos (período / total) | count `finished` | MVP |
| Páginas lidas | Σ `pages_read` (ou Σ `page_count` dos lidos) | MVP |
| Tempo total de leitura | Σ `duration_seconds` | MVP |
| Velocidade média (pág/h) | páginas ÷ horas | MVP |
| Sequência atual / recorde | `currentStreak` / `longestStreak` | Alta |
| Lendo agora | count `reading` | MVP |
| Avaliação média | média de `rating` (lidos) | Alta |
| Sessões (nº) / duração média | count / média | Média |

### 13.2 Gráficos (recharts)
| Gráfico | Tipo | Fonte |
|---|---|---|
| Livros lidos por mês | barras | `finished_at` |
| Páginas lidas por mês/semana | barras/linha | sessões |
| **Mapa de calor de dias lidos** (estilo GitHub) | heatmap (SVG/grid) | `heatmapData` |
| Velocidade ao longo do tempo | linha | sessões |
| Distribuição por gênero | rosca/pizza | `genre` |
| Distribuição por formato (físico/ebook/áudio) | rosca | `format` |
| Distribuição de avaliações | barras | `rating` |
| Distribuição por nº de páginas | histograma | `page_count` |
| Livros por ano de publicação | barras | `published_year` |
| **Ritmo & previsão de término** (livro atual) | gauge (`RadialBarChart`) | `projectedFinish` |
| Progresso da **meta anual** | gauge | `reading_goals` |
| Recordes: maior/menor livro, leitura mais rápida | cards | derivado |
| Padrão por dia da semana / hora | barras (opcional) | `started_at` |

### 13.3 Inspiração (Hardcover)
O painel do Hardcover é a referência de exaustividade: livros/páginas/horas por ano-mês-dia,
gênero, humor, ficção×não-ficção, formato, distribuição de nota, autores mais lidos,
progresso de séries, percentil de leitura, tempo médio na "fila" (TBR→lido), previsão de
ritmo, re-leituras. Implementamos o subconjunto que nossos dados suportam agora e deixamos o
resto como incremento (§16, Fase 6/Wrapped).

---

## 14. Metas, sequências (streaks) e gamificação

- **Meta anual (desafio):** `reading_goals` do ano corrente; anel "X / N livros"; opcional
  metas de páginas/minutos. Editável no Dashboard.
- **Streak:** dias consecutivos com ≥1 sessão; card com chama/ícone + recorde; alimentado pelo
  `heatmapData`.
- **Marcos (opcional):** "10 livros no ano", "primeira sequência de 7 dias", "1.000 páginas no
  mês" → `toast` + confete leve (reusar `celebrate("happy")`).
- Sem ranking social, sem comparação com outros usuários.

---

## 15. Menu e rotas

### 15.1 Menu — `src/components/app-shell.tsx`
Adicionar um `NavGroup` (padrão idêntico ao "Financeiro"):

```ts
{
  id: "leituras",
  label: "Leituras",
  icon: BookOpenIcon,            // @phosphor-icons/react
  children: [
    { to: "/leituras", label: "Track", icon: BooksIcon, end: true },
    { to: "/leituras/dashboard", label: "Dashboard", icon: ChartLineIcon },
  ],
}
```

> Rótulos "Track" e "Dashboard" conforme pedido. Alternativas em PT, se preferir depois:
> "Estante"/"Acompanhar" e "Painel". Grupos aparecem no sidebar (expandido/flyout) e no
> drawer mobile; a bottom-tab-bar mostra só itens de topo (igual ao Financeiro).

### 15.2 Rotas — `src/App.tsx`
```tsx
<Route path="/leituras" element={<ReadingLayout />}>
  <Route index element={<ReadingTrackPage />} />
  <Route path="dashboard" element={<ReadingDashboardPage />} />
</Route>
```
Páginas em `src/pages/reading-track.tsx` e `src/pages/reading-dashboard.tsx`.

---

## 16. Roadmap por fases

Cada fase é entregável e testável isoladamente.

- **Fase 0 — Fundações.** Migração `018_leituras` (tabelas + RLS) e bucket `book-covers`;
  `db/types.ts`; `rqk` + hooks CRUD em `api/queries.ts`; `domain/reading.ts` (esqueleto +
  `progressColor`); `ui/slider` + `ui/textarea`; grupo no menu + rotas + `reading-layout`.
- **Fase 1 — MVP Track.** Adicionar livro (manual + upload de capa); estante (gallery) com
  filtros por status; `book-card` com **barra/anel colorido**; `progress-control`
  (slider+botões+campo); `book-detail-drawer` básico; atualização manual da página atual.
- **Fase 2 — Sessões.** Cronômetro (com persistência em `localStorage`) + sessão manual
  (time-picker); histórico de sessões; transições de status; **fluxo de conclusão + partículas**.
- **Fase 3 — Metadados.** Busca Open Library (auto-fetch) + enriquecimento Google Books;
  preenchimento automático de capa/páginas/autor/ano/ISBN.
- **Fase 4 — Dashboard.** KPIs + gráficos recharts + **mapa de calor** + streaks +
  ritmo/previsão.
- **Fase 5 — Metas & gamificação.** Meta anual (desafio), streaks em destaque, marcos.
- **Fase 6 — Delight/extras.** Citações/destaques; avaliação/resenha polidas; **Retrospectiva
  ("Wrapped")** determinística; **Shelfie** compartilhável; tags/prateleiras; re-leituras;
  (opcional) leitura de código de barras ISBN via `BarcodeDetector`.

---

## 17. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Capas externas (hotlink) saírem do ar | Permitir "salvar cópia" no bucket; fallback placeholder |
| Rate limit / instabilidade da API de metadados | Debounce + cache React Query; Google Books como fallback; sempre há entrada manual |
| Timer perdido em reload | Estado em `localStorage` recalculado por `startEpoch` (§11.3) |
| Stats no cliente ficarem pesadas (muitos livros) | Hoje trivial; se crescer, migrar agregação p/ **view Postgres** (padrão `finance_ledger`) |
| `page_count` ausente (livro sem metadados) | Progresso por página some; permitir progresso por % manual; pedir páginas ao iniciar |
| Storage 1 GB | Hotlink por padrão; capas são pequenas; monitorar como já se monitora `patient-documents` |
| Precisão de `published_year`/gênero variável entre fontes | Campos editáveis; gênero como texto livre (não enum) |

---

## 18. Decisões tomadas e pontos em aberto

**Decididas (confirmadas com o solicitante):**
- Idioma do plano/documentação: **PT-BR** (alinhado a `docs/` e à UI).
- Metadados: **auto-fetch (Open Library/Google Books) + entrada manual**.

**Assumidas por padrão (fáceis de mudar — avise se quiser diferente):**
- Rótulos das páginas: **"Track"** e **"Dashboard"** (como pedido).
- Capas: **hotlink externo por padrão** + upload próprio opcional; bucket **público**.
- Avaliação com **meia-estrela**; `current_page` como fonte de verdade do progresso.
- Cor do progresso passando por **rosa → âmbar → verde** (cores da marca).
- Módulo colocado em `docs/09-leituras/` como doc de módulo de 1ª classe.

**Em aberto (não bloqueiam começar):**
- Board por status e visão em tabela (além da gallery) — incluir já ou depois?
- Tags/prateleiras livres no MVP ou só na Fase 6?
- "Wrapped" e "Shelfie" entram neste ciclo?

---

## 19. Apêndice — mapeamento requisito → solução e fontes

### 19.1 Requisito → solução
| Requisito | Solução no plano |
|---|---|
| Pasta `Leituras` com Track + Dashboard | §15 (NavGroup + rotas aninhadas) |
| Adicionar livro c/ imagem, páginas… | §6 (`books`), §7 (metadados), §10.2 (dialog), §6.2 (capa) |
| Cronômetro OU início/fim manual | §11 (`session-timer` / `log-session-dialog` c/ `time-picker`) |
| Slider + botões + campo de páginas | §9.1 (`ui/slider`), §10.3 (`progress-control`) |
| Exibição bonita c/ progresso | §10 (gallery + `book-card` + anel colorido) |
| Todas as métricas no Dashboard | §13 (catálogo) + `domain/reading.ts` |
| Partículas ao concluir | §12.2 (`celebrateBook` + `finish-celebration`) |
| Cor muda com o progresso | §12.1 (`progressColor`) |

### 19.2 Fontes da pesquisa (principais)
- Hardcover — página de estatísticas e blog: `hardcover.app/blog/making-the-most-of-hardcover-stats`,
  `hardcover.app/blog/book-stats`, exemplos públicos `hardcover.app/@florisw/stats`.
- Bookmory — `bookmory.net`; review Makeheadway (2026).
- The StoryGraph — `thestorygraph.com`; comparativos Book Riot.
- Fable — `fable.co`; caso da IA (jan/2025): Lit Hub, Book Riot, Complex, AI Incident DB #882.
- Literal — `literal.club`; review Bookwise.
- BookSloth — Book Riot; AMT Lab (Goodreads vs BookSloth).
- ReadEra — `readera.org` / `readera.org/premium`.
- Templates Notion — Notion Marketplace (categoria Books); Super.so; ClickUp.
- APIs — Open Library (`openlibrary.org/developers/api`, Covers API), Google Books API.
- Roundups — ISBNDB "book tracking apps and websites"; BuzzFeed; BiblioLifestyle.

> **Nota metodológica:** "Hardcover feito por ex-engenheiros do Goodreads" é **mito** — é
> projeto indie (Adam Fortuna + Ste) reagindo ao fim da API do Goodreads. Rating do Hardcover:
> evidência majoritária aponta **estrelas inteiras** (não meia). Adotamos **meia-estrela**
> por escolha de produto, independentemente disso.
