-- ============================================================
-- 018_leituras.sql — módulo de acompanhamento de leitura
-- Aplicar no SQL Editor do Supabase, após a migração 017.
-- ============================================================

-- Estante de livros
create table if not exists public.books (
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
create index if not exists books_status_idx   on public.books (status) where active;
create index if not exists books_finished_idx on public.books (finished_at);

-- Sessões de leitura
create table if not exists public.reading_sessions (
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
create index if not exists reading_sessions_book_idx on public.reading_sessions (book_id);
create index if not exists reading_sessions_date_idx on public.reading_sessions (date);

-- Meta anual (desafio de leitura)
create table if not exists public.reading_goals (
  id             text primary key,                -- rg_<nanoid(10)>
  year           int  not null unique,
  target_books   int,
  target_pages   int,
  target_minutes int,
  created_at     text not null,
  updated_at     text not null
);

-- Citações / destaques
create table if not exists public.book_quotes (
  id         text primary key,                    -- qt_<nanoid(10)>
  book_id    text not null references public.books(id) on delete cascade,
  text       text not null,
  page       int,
  created_at text not null
);
create index if not exists book_quotes_book_idx on public.book_quotes (book_id);

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
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_authenticated'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true);',
        t || '_authenticated', t
      );
    end if;
  end loop;
end $$;

-- ---------- Storage: bucket público de capas ----------
insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

-- Leitura é pública (public=true); escrita restrita ao dono (1º segmento do caminho = auth.uid()).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='book_covers_insert_own') then
    create policy "book_covers_insert_own" on storage.objects for insert to authenticated
      with check (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='book_covers_update_own') then
    create policy "book_covers_update_own" on storage.objects for update to authenticated
      using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='book_covers_delete_own') then
    create policy "book_covers_delete_own" on storage.objects for delete to authenticated
      using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
