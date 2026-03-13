# Asteroid Bonanza — Database Schema

*All tables, indexes, and RPC functions in Supabase/PostgreSQL.*

---

All tables live in Supabase. The pgvector extension must be enabled before running migrations. Every migration file has a paired rollback.

---

## `asteroids`

The core table. Populated by the NASA ingestion pipeline and updated on a schedule.

```sql
CREATE TABLE asteroids (
  id                    TEXT PRIMARY KEY,          -- NASA/JPL designation (e.g. "2000433" for Eros)
  name                  TEXT NOT NULL,             -- Common name if exists
  designation           TEXT NOT NULL,             -- Official JPL designation
  spectral_class        TEXT,                      -- C, S, M, X, D, etc.
  diameter_km_min       NUMERIC,                   -- Estimated diameter lower bound
  diameter_km_max       NUMERIC,                   -- Estimated diameter upper bound
  absolute_magnitude    NUMERIC,                   -- H value — relates to size
  is_potentially_hazardous BOOLEAN DEFAULT FALSE,  -- PHA classification
  is_neo                BOOLEAN DEFAULT TRUE,      -- Near-Earth Object
  nhats_accessible      BOOLEAN DEFAULT FALSE,     -- Human-accessible per JPL NHATS
  nhats_min_delta_v     NUMERIC,                   -- Minimum delta-V km/s from NHATS
  orbital_class         TEXT,                      -- Amor, Apollo, Aten, Atira
  semi_major_axis_au    NUMERIC,                   -- Orbital element
  eccentricity          NUMERIC,                   -- Orbital element
  inclination_deg       NUMERIC,                   -- Orbital element
  composition_summary   TEXT,                      -- AI-generated plain-language summary
  resource_profile      JSONB,                     -- {water_ice: %, metals: %, silicates: %}
  economic_tier         TEXT,                      -- 'exceptional' | 'high' | 'moderate' | 'low'
  embedding             vector(1024),              -- Voyage AI embedding of full text profile
  nasa_url              TEXT,                      -- Source URL
  last_updated          TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON asteroids USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON asteroids (is_potentially_hazardous);
CREATE INDEX ON asteroids (nhats_accessible);
CREATE INDEX ON asteroids (spectral_class);
CREATE INDEX ON asteroids (economic_tier);
```

---

## `close_approaches`

One-to-many with `asteroids`. Stores future and historical close approach events.

```sql
CREATE TABLE close_approaches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asteroid_id           TEXT REFERENCES asteroids(id) ON DELETE CASCADE,
  approach_date         DATE NOT NULL,
  miss_distance_km      NUMERIC NOT NULL,
  miss_distance_lunar   NUMERIC,                   -- In lunar distances (LD)
  relative_velocity_kms NUMERIC,                   -- km/s at closest approach
  is_featured           BOOLEAN DEFAULT FALSE,     -- Apophis 2029 etc.
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON close_approaches (asteroid_id);
CREATE INDEX ON close_approaches (approach_date);
CREATE INDEX ON close_approaches (is_featured);
```

---

## `science_chunks`

The hard science RAG index. Contains real, sourced, factual content from NASA reports, ESA publications, and peer-reviewed papers.

```sql
CREATE TABLE science_chunks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_title          TEXT NOT NULL,             -- e.g. "OSIRIS-REx Mission Report 2023"
  source_type           TEXT NOT NULL,             -- 'nasa_report' | 'peer_reviewed' | 'esa_pub' | 'mission_data'
  source_url            TEXT,
  chunk_index           INTEGER NOT NULL,          -- Position within source document
  content               TEXT NOT NULL,             -- The actual text chunk
  embedding             vector(1024),
  token_count           INTEGER,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON science_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON science_chunks (source_type);
```

---

## `scenario_chunks`

The 2050 scenario RAG index. Contains projections, roadmaps, and economic analyses. Always clearly distinguished from established science in the Analyst's responses.

```sql
CREATE TABLE scenario_chunks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_title          TEXT NOT NULL,             -- e.g. "NASA Planetary Science Vision 2050"
  source_type           TEXT NOT NULL,             -- 'nasa_roadmap' | 'economic_projection' | 'isru_analysis' | 'policy_doc'
  source_url            TEXT,
  chunk_index           INTEGER NOT NULL,
  content               TEXT NOT NULL,
  embedding             vector(1024),
  token_count           INTEGER,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON scenario_chunks USING ivfflat (embedding vector_cosine_ops);
```

---

## `analyses`

Stores completed swarm analysis results. Expensive to produce — cache aggressively.

```sql
CREATE TABLE analyses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asteroid_id           TEXT REFERENCES asteroids(id),
  request_type          TEXT NOT NULL,             -- 'full' | 'navigator' | 'geologist' | 'economist' | 'risk'
  mission_params        JSONB,                     -- User-supplied mission constraints
  navigator_output      JSONB,                     -- Structured output from Navigator Agent
  geologist_output      JSONB,                     -- Structured output from Geologist Agent
  economist_output      JSONB,                     -- Structured output from Economist Agent
  risk_output           JSONB,                     -- Structured output from Risk Agent
  synthesis             TEXT,                      -- Orchestrator's synthesized narrative
  confidence_scores     JSONB,                     -- {orbital, compositional, economic, risk, overall}
  handoff_triggered     BOOLEAN DEFAULT FALSE,
  handoff_packet        JSONB,                     -- Structured handoff if confidence < threshold
  model_used            TEXT,                      -- Track which Claude model
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON analyses (asteroid_id);
CREATE INDEX ON analyses (created_at DESC);
```

---

## `analyst_sessions`

Conversation history for the AI Analyst. 24-hour TTL.

```sql
CREATE TABLE analyst_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token         TEXT UNIQUE NOT NULL,
  messages              JSONB DEFAULT '[]',        -- Array of {role, content} pairs
  context_asteroid_id   TEXT REFERENCES asteroids(id), -- Optional — anchors chat to a specific asteroid
  expires_at            TIMESTAMPTZ NOT NULL,       -- NOW() + interval '24 hours'
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON analyst_sessions (session_token);
CREATE INDEX ON analyst_sessions (expires_at);
```

---

## Supabase RPC Functions

```sql
-- Semantic asteroid search
CREATE FUNCTION match_asteroids(
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE(id TEXT, name TEXT, similarity FLOAT) ...

-- Retrieve from hard science index
CREATE FUNCTION match_science_chunks(
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE(id UUID, content TEXT, source_title TEXT, source_type TEXT, similarity FLOAT) ...

-- Retrieve from 2050 scenario index
CREATE FUNCTION match_scenario_chunks(
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE(id UUID, content TEXT, source_title TEXT, source_type TEXT, similarity FLOAT) ...
```

---

*Document created: 2026-03-13*
