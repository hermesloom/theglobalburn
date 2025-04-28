-- Enable the pgvector extension for vector embeddings
create extension if not exists vector;

-- Table for storing offers (what users want to give)
create table gar_offers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  user_id uuid references profiles not null,
  text_content text not null,
  embedding vector(1536) -- OpenAI's common embedding dimension
);

-- Table for storing desires (what users want to receive)
create table gar_desires (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  user_id uuid references profiles not null,
  text_content text not null,
  embedding vector(1536) -- OpenAI's common embedding dimension
);

-- Add indexes for faster similarity searches
create index on gar_offers using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index on gar_desires using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
