-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the document chunks table
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null,
  instance_id varchar not null,
  document_name varchar not null,
  chunk_content text not null,
  embedding vector(1536), -- OpenAI standard
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Note: We can add an index later for better performance, e.g.:
-- create index on document_chunks using ivfflat (embedding vector_cosine_ops)
-- with (lists = 100);

-- Create a function to search for documents
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_tenant_id varchar,
  match_instance_id varchar,
  match_count int DEFAULT 5
) returns table (
  id uuid,
  document_name varchar,
  chunk_content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.document_name,
    document_chunks.chunk_content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 
    tenant_id = match_tenant_id
    and instance_id = match_instance_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
