-- Migration: 0001_extensions_and_triggers
-- Enables pgvector and creates the shared updated_at trigger function.
-- Must run before all other migrations.

-- ============================================================
-- UP
-- ============================================================

-- Enable pgvector for 1024-dimension embeddings (Voyage AI voyage-large-2-instruct)
CREATE EXTENSION IF NOT EXISTS vector;

-- Shared trigger function: keeps updated_at current on any table that uses it.
-- Never let application code set updated_at directly.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- DOWN
-- ============================================================
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP EXTENSION IF EXISTS vector;
