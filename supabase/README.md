# Supabase setup

## Apply the schema

1. Create a Supabase project.
2. Open the SQL editor in Supabase.
3. Paste the contents of `schema.sql` and run it.
4. Check that the tables exist: packs, items, clusters, scores, decisions, eval_runs, usage_logs, decision_embeddings.

If your project does not have pgvector, comment out the `vector` extension, the `embedding` column, and the `decision_embeddings_idx` index. The rest of the schema works without it, and RAG retrieval falls back to keyword matching in the back end.

## Environment variables

Set these in Netlify or Railway, never in the repo:

- `SUPABASE_URL`: your project URL
- `SUPABASE_ANON_KEY`: anon key, for the front end read path only
- `SUPABASE_SERVICE_ROLE_KEY`: service role key, for the back end only

## Load data

Load `data/*.json` into `items` with the pack id as `pack_id`. A small loader script is planned in `scripts/load-data.mjs`. Until then, use the Supabase table editor import, or the SQL `COPY` command, with the JSON files as the source.

## Auth

Use Supabase Auth with GitHub login for the two collaborators. Row level security is not enabled in this starter schema. Enable it before adding real users, and restrict writes to authenticated collaborators.
