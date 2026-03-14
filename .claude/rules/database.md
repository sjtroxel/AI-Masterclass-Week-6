# Database Rules — Asteroid Bonanza

## Migrations
- Every migration file must include both an `up` and a `down` function (rollback)
- Migration files are numbered sequentially: `0001_initial_schema.sql`, `0002_add_vector_index.sql`
- Never edit a migration that has been applied — write a new migration instead
- Test rollback locally before committing any migration

## AI fields
- All AI-generated fields (embedding vectors, confidence scores, agent-generated text, spectral inferences) must be nullable until Phase 5
- Schema comment on every nullable AI field: `-- populated in Phase 5 by AI ingest pipeline`
- Do not write application code that assumes AI fields are populated until Phase 5

## Credentials
- Never hardcode database URLs, passwords, or API keys in any source file
- Credentials come from environment variables only
- `.env` files are in `.gitignore` — never commit them
- Use `dotenv` in development; Railway/Vercel environment config in production

## pgvector
- Vector columns: `embedding vector(1024)` (Voyage AI `voyage-3` produces 1024-dimensional embeddings)
- Index type: `ivfflat` with `lists = 100` for datasets up to ~100k rows
- Similarity function: cosine distance (`<=>`) — not L2, not inner product
- Always `ANALYZE` the table after bulk inserts before running similarity searches

## Table conventions
- `id` column: `uuid` with `gen_random_uuid()` default — no serial integers for application tables
- `created_at` and `updated_at` on every table: `timestamptz not null default now()`
- `updated_at` must be maintained by a trigger, not application code
- Foreign keys must have explicit `ON DELETE` behavior declared — never leave it as default

## Supabase specifics
- Enable Row Level Security (RLS) on all tables — even for a public app (defense in depth)
- For public read tables: `CREATE POLICY "public read" ON <table> FOR SELECT USING (true)`
- No direct Supabase client calls from Angular — all database access goes through the Express API
