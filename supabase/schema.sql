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
  content text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Private bucket for original PDFs; only the server-side service role key
-- (lib/supabase-admin.js) reads or writes here.
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

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
