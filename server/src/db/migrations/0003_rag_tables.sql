-- Migration: 0003_rag_tables
-- Creates science_chunks and scenario_chunks vector tables for the RAG system.
-- science_chunks: hard facts (NASA reports, peer-reviewed papers, mission data)
-- scenario_chunks: 2050 projections (Vision 2050, ISRU roadmaps, economic analyses)
-- Populated in Phase 3 by the document ingest pipeline.

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS science_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source document metadata
  source_id     text NOT NULL,     -- Stable identifier for the source document (e.g. "nasa-sbag-2023")
  source_title  text NOT NULL,     -- Human-readable document title
  source_url    text,              -- Canonical URL for citation
  source_year   smallint,          -- Publication year

  -- Chunk content
  chunk_index   integer NOT NULL,  -- Position of this chunk within the source document
  content       text NOT NULL,     -- Raw text of this chunk

  -- Vector embedding (Voyage AI voyage-large-2-instruct, 1024 dims)
  embedding     vector(1024) NOT NULL,

  -- Flexible metadata for filtering (asteroid ids, topic tags, etc.)
  metadata      jsonb NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT science_chunks_source_chunk_unique UNIQUE (source_id, chunk_index)
);

CREATE TRIGGER science_chunks_updated_at
  BEFORE UPDATE ON science_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- IVFFlat cosine similarity index
CREATE INDEX idx_science_chunks_embedding ON science_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_science_chunks_source_id ON science_chunks (source_id);
CREATE INDEX idx_science_chunks_metadata  ON science_chunks USING gin (metadata);

ALTER TABLE science_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read science_chunks"
  ON science_chunks FOR SELECT
  USING (true);


-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scenario_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source document metadata
  source_id     text NOT NULL,     -- Stable identifier (e.g. "nasa-vision-2050")
  source_title  text NOT NULL,
  source_url    text,
  source_year   smallint,

  -- Chunk content
  chunk_index   integer NOT NULL,
  content       text NOT NULL,

  -- Vector embedding
  embedding     vector(1024) NOT NULL,

  -- Flexible metadata
  metadata      jsonb NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scenario_chunks_source_chunk_unique UNIQUE (source_id, chunk_index)
);

CREATE TRIGGER scenario_chunks_updated_at
  BEFORE UPDATE ON scenario_chunks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_scenario_chunks_embedding ON scenario_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_scenario_chunks_source_id ON scenario_chunks (source_id);
CREATE INDEX idx_scenario_chunks_metadata  ON scenario_chunks USING gin (metadata);

ALTER TABLE scenario_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read scenario_chunks"
  ON scenario_chunks FOR SELECT
  USING (true);


-- ============================================================
-- DOWN
-- ============================================================
-- DROP TRIGGER IF EXISTS scenario_chunks_updated_at ON scenario_chunks;
-- DROP TABLE IF EXISTS scenario_chunks;
-- DROP TRIGGER IF EXISTS science_chunks_updated_at ON science_chunks;
-- DROP TABLE IF EXISTS science_chunks;
