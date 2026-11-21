-- Triage schema for Supabase Postgres.
-- Apply in the Supabase SQL editor, or with the Supabase CLI.
-- pgvector is used for past decision embeddings. If pgvector is not
-- available in your project, comment out the embedding column and the
-- vector index and the rest of the schema still works.
-- Never store API keys in this database. Keys live in back end env vars.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists packs (
  id text primary key,
  name text not null,
  company text not null,
  domain text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists items (
  id text primary key,
  pack_id text not null references packs(id) on delete cascade,
  title text not null,
  description text not null,
  source text,
  requester_type text,
  theme text,
  impact int check (impact between 1 and 10),
  effort int check (effort between 1 and 10),
  risk text check (risk in ('Low', 'Medium', 'High')),
  evidence_strength text check (evidence_strength in ('Low', 'Medium', 'High')),
  created_at timestamptz default now()
);

create table if not exists clusters (
  id text primary key,
  pack_id text not null references packs(id) on delete cascade,
  theme text,
  representative_id text references items(id),
  item_ids text[] default '{}',
  size int default 1,
  reason text,
  created_at timestamptz default now()
);

create table if not exists scores (
  item_id text primary key references items(id) on delete cascade,
  reach int check (reach between 1 and 10),
  impact int check (impact between 1 and 10),
  confidence int check (confidence between 0 and 100),
  effort int check (effort between 1 and 10),
  rice int,
  low_evidence boolean default false,
  reason text,
  model text,
  scored_at timestamptz default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references items(id) on delete cascade,
  decision text not null check (decision in ('approved', 'edited', 'rejected')),
  reason text,
  reviewer text,
  story_text text,
  clickup_task_id text,
  created_at timestamptz default now()
);
create index if not exists decisions_item_idx on decisions(item_id);

create table if not exists eval_runs (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null references packs(id) on delete cascade,
  model text,
  accuracy numeric,
  wrong_theme_rate numeric,
  cost_usd numeric,
  latency_ms int,
  items_evaluated int,
  run_at timestamptz default now()
);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  pack_id text references packs(id) on delete set null,
  run_id text,
  model text,
  input_tokens int default 0,
  output_tokens int default 0,
  cost_usd numeric,
  created_at timestamptz default now()
);

-- Past decisions, for RAG retrieval. Store an embedding of title plus
-- description plus decision, so new items can pull the closest past items.
create table if not exists decision_embeddings (
  item_id text primary key references items(id) on delete cascade,
  embedding vector(1536),
  decision text
);
create index if not exists decision_embeddings_idx
  on decision_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Seed packs. Item data is loaded from data/*.json, not from this file.
insert into packs (id, name, company, domain) values
  ('healthcare', 'Healthcare', 'Meridian Ops', 'Multi-site healthcare clinics'),
  ('fintech', 'Fintech', 'Northbeam Pay', 'Small-business payments and lending'),
  ('games', 'Games', 'Project Larkspur', 'Generic game features'),
  ('ecommerce', 'E-commerce', 'Marketlane', 'Marketplace')
on conflict (id) do nothing;
