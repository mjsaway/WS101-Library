-- Run this in Supabase: SQL Editor > New query > Run

create table if not exists public.books (
  book_id          text primary key,
  title            text not null,
  author           text not null,
  category         text not null,
  publication_year integer not null check (publication_year between 1000 and 2100),
  quantity         integer not null default 1 check (quantity >= 0),
  created_at       timestamptz not null default now()
);

create index if not exists books_title_idx  on public.books (lower(title));
create index if not exists books_author_idx on public.books (lower(author));

-- Block direct access through Supabase's public API (anon key).
-- The Express server connects as the database owner, so it is not affected.
alter table public.books enable row level security;

insert into public.books (book_id, title, author, category, publication_year, quantity) values
  ('B-001', 'Noli Me Tangere', 'Jose Rizal', 'Fiction', 1887, 6),
  ('B-002', 'El Filibusterismo', 'Jose Rizal', 'Fiction', 1891, 5),
  ('B-003', 'A Brief History of Time', 'Stephen Hawking', 'Science', 1988, 3),
  ('B-004', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Technology', 2009, 2)
on conflict (book_id) do nothing;
