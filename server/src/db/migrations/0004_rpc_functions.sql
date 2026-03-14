-- Migration: 0004_rpc_functions
-- Supabase RPC functions for vector similarity search.
-- Called by the server via supabase.rpc('function_name', params).

-- ============================================================
-- UP
-- ============================================================

-- match_science_chunks
-- Returns the top N science_chunks nearest to a query embedding.
-- match_threshold: minimum cosine similarity (0.0–1.0); filter out noise below this.
-- match_count: maximum rows to return.
CREATE OR REPLACE FUNCTION match_science_chunks(
  query_embedding   vector(1024),
  match_threshold   float,
  match_count       int
)
RETURNS TABLE (
  id            uuid,
  source_id     text,
  source_title  text,
  source_url    text,
  source_year   smallint,
  chunk_index   integer,
  content       text,
  metadata      jsonb,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    source_id,
    source_title,
    source_url,
    source_year,
    chunk_index,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM science_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;


-- match_scenario_chunks
-- Returns the top N scenario_chunks nearest to a query embedding.
CREATE OR REPLACE FUNCTION match_scenario_chunks(
  query_embedding   vector(1024),
  match_threshold   float,
  match_count       int
)
RETURNS TABLE (
  id            uuid,
  source_id     text,
  source_title  text,
  source_url    text,
  source_year   smallint,
  chunk_index   integer,
  content       text,
  metadata      jsonb,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    source_id,
    source_title,
    source_url,
    source_year,
    chunk_index,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM scenario_chunks
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ============================================================
-- DOWN
-- ============================================================
-- DROP FUNCTION IF EXISTS match_scenario_chunks(vector(1024), float, int);
-- DROP FUNCTION IF EXISTS match_science_chunks(vector(1024), float, int);
