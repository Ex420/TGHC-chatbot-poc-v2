-- Run this once against the Supabase project used by this app
-- (SQL Editor -> New query -> paste -> Run).

create extension if not exists vector;

-- One row per uploaded PDF.
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  chunk_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Embedded text segments belonging to a document.
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

-- Heading the chunk's content was grouped under (set by the structure-aware
-- chunker in lib/chunk.js), so search results can show it as a source
-- reference. Null for chunks with no detected heading.
alter table chunks add column if not exists heading text;

create index if not exists chunks_document_id_idx on chunks (document_id);
create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- Top-N similarity search used by /api/chat.
create or replace function match_chunks (
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  heading text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.heading,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Private bucket for original PDFs. The browser uploads directly here with
-- the anon key (lib/supabase-browser.js) to avoid routing large files
-- through our API route; the server-side service role key
-- (lib/supabase-admin.js) is still required to read, list, or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 104857600, array['application/pdf'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lets the browser's anon-key client upload new PDFs directly to Storage.
-- Scoped to insert only, so the anon key still can't read, list, or delete
-- existing objects -- those stay limited to the service role.
drop policy if exists "Anon can upload pdfs" on storage.objects;
create policy "Anon can upload pdfs"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'pdfs');

-- One row per chat exchange, logged by /api/chat and read by
-- /admin/analytics. user_identifier/session_id are anonymous IDs generated
-- client-side (lib/identity.js); there is no user account system.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_identifier text,
  user_name text,
  question text not null,
  answer text not null,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  chunks_retrieved int,
  chunk_ids uuid[],
  response_time_ms int,
  question_length int,
  answer_length int,
  session_id uuid,
  document_ids uuid[],
  created_at timestamptz not null default now()
);

create index if not exists conversations_created_at_idx on conversations (created_at);
create index if not exists conversations_user_identifier_idx on conversations (user_identifier);

-- RLS on with no policies: only the service role (which bypasses RLS) can
-- access these tables. The app never uses the anon key for DB access.
alter table documents enable row level security;
alter table chunks enable row level security;
alter table conversations enable row level security;
