-- Migration: 0006_analyses
-- Persists agent swarm analysis results per asteroid.
-- All agent output columns are jsonb — typed by the application layer.
-- Created in Phase 5 (Agent Swarm).

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS analyses (
  -- Primary key
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to the asteroid being analyzed
  asteroid_id         uuid NOT NULL REFERENCES asteroids(id) ON DELETE CASCADE,

  -- Orchestration state
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'complete', 'handoff', 'error')),
  phase               text NOT NULL DEFAULT 'idle'
                        CHECK (phase IN (
                          'idle', 'navigating', 'geologizing', 'economizing',
                          'risk_assessing', 'synthesizing', 'complete', 'handoff', 'error'
                        )),

  -- Agent outputs (jsonb — nullable until that agent has run)
  navigator_output    jsonb,          -- NavigatorOutput shape from shared/types.d.ts
  geologist_output    jsonb,          -- GeologistOutput shape
  economist_output    jsonb,          -- EconomistOutput shape
  risk_output         jsonb,          -- RiskOutput shape

  -- Synthesis
  confidence_scores   jsonb,          -- ConfidenceScores shape
  synthesis           text,           -- Plain-language synthesis paragraph (Orchestrator)
  handoff_packet      jsonb,          -- HandoffPacket shape — populated when status = 'handoff'

  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger (reuses the function created in 0001)
CREATE TRIGGER analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index for looking up all analyses for a given asteroid
CREATE INDEX IF NOT EXISTS analyses_asteroid_id_idx ON analyses(asteroid_id);

-- Index for filtering by status (e.g. find all running analyses)
CREATE INDEX IF NOT EXISTS analyses_status_idx ON analyses(status);

-- RLS: public read, no public write (agent swarm writes via service role key)
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read analyses"
  ON analyses FOR SELECT USING (true);


-- ============================================================
-- DOWN
-- ============================================================

-- DROP TRIGGER IF EXISTS analyses_updated_at ON analyses;
-- DROP INDEX IF EXISTS analyses_asteroid_id_idx;
-- DROP INDEX IF EXISTS analyses_status_idx;
-- DROP TABLE IF EXISTS analyses;
