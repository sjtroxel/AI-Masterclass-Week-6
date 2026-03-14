-- Migration: 0002_asteroids
-- Creates the core asteroids table with all raw NASA/JPL fields.
-- AI-generated fields are intentionally nullable — populated in Phase 5.

-- ============================================================
-- UP
-- ============================================================

CREATE TABLE IF NOT EXISTS asteroids (
  -- Primary key
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NASA / JPL identifiers
  nasa_id                     text NOT NULL,        -- NeoWs integer id (e.g. "3542519")
  spkid                       text,                 -- JPL SBDB SPK-ID
  full_name                   text,                 -- SBDB full designation (e.g. "433 Eros (1898 DQ)")
  name                        text,                 -- Common or provisional name
  designation                 text,                 -- IAU packed designation

  -- Hazard classification
  is_pha                      boolean NOT NULL DEFAULT false,  -- Potentially Hazardous Asteroid
  is_sentry_object            boolean NOT NULL DEFAULT false,  -- On JPL Sentry impact monitoring list

  -- Physical parameters (may be null when SBDB has no data)
  absolute_magnitude_h        numeric(6, 3),        -- H magnitude (brightness proxy for size)
  diameter_min_km             numeric(12, 6),       -- Estimated diameter lower bound (km)
  diameter_max_km             numeric(12, 6),       -- Estimated diameter upper bound (km)
  diameter_sigma_km           numeric(12, 6),       -- 1-sigma uncertainty on diameter

  -- Spectral classification (may be null — many NEOs unclassified)
  spectral_type_smass         text,                 -- SMASS II taxonomy (e.g. "S", "C", "X")
  spectral_type_tholen        text,                 -- Tholen taxonomy

  -- Orbital elements (J2000 ecliptic, from SBDB)
  orbit_epoch_jd              numeric(14, 6),       -- Reference epoch (Julian Date)
  semi_major_axis_au          numeric(16, 10),      -- a (AU)
  eccentricity                numeric(12, 10),      -- e
  inclination_deg             numeric(12, 8),       -- i (degrees)
  longitude_asc_node_deg      numeric(12, 8),       -- Ω (degrees)
  argument_perihelion_deg     numeric(12, 8),       -- ω (degrees)
  mean_anomaly_deg            numeric(12, 8),       -- M (degrees)
  perihelion_distance_au      numeric(16, 10),      -- q (AU)
  aphelion_distance_au        numeric(16, 10),      -- Q (AU)
  orbital_period_yr           numeric(14, 8),       -- T (years)
  min_orbit_intersection_au   numeric(16, 10),      -- MOID (AU) — key hazard metric

  -- NHATS human accessibility (from JPL NHATS API)
  nhats_accessible            boolean,              -- True if human mission is feasible
  nhats_min_delta_v_kms       numeric(8, 4),        -- Minimum total delta-V (km/s)
  nhats_min_duration_days     numeric(8, 2),        -- Shortest round-trip mission duration (days)

  -- Close approach summary (denormalized from CAD/NeoWs for fast queries)
  next_approach_date          date,                 -- Next predicted close approach
  next_approach_au            numeric(16, 12),      -- Distance at next approach (AU)
  next_approach_miss_km       numeric(16, 4),       -- Miss distance at next approach (km)
  closest_approach_date       date,                 -- Historical/predicted closest on record
  closest_approach_au         numeric(16, 12),      -- Distance at closest approach (AU)

  -- AI-generated fields — populated in Phase 5 by AI ingest pipeline
  composition_summary         text,                 -- populated in Phase 5 by AI ingest pipeline
  resource_profile            jsonb,                -- populated in Phase 5 by AI ingest pipeline
  economic_tier               text,                 -- populated in Phase 5 by AI ingest pipeline
  embedding                   vector(1024),         -- populated in Phase 5 by AI ingest pipeline

  -- Timestamps
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT asteroids_nasa_id_unique UNIQUE (nasa_id)
);

-- updated_at auto-maintenance
CREATE TRIGGER asteroids_updated_at
  BEFORE UPDATE ON asteroids
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common query patterns
CREATE INDEX idx_asteroids_nasa_id       ON asteroids (nasa_id);
CREATE INDEX idx_asteroids_is_pha        ON asteroids (is_pha);
CREATE INDEX idx_asteroids_is_sentry     ON asteroids (is_sentry_object);
CREATE INDEX idx_asteroids_nhats         ON asteroids (nhats_accessible) WHERE nhats_accessible = true;
CREATE INDEX idx_asteroids_moid          ON asteroids (min_orbit_intersection_au);
CREATE INDEX idx_asteroids_next_approach ON asteroids (next_approach_date);

-- IVFFlat index for cosine similarity search on embeddings (populated in Phase 5)
-- lists=100 is appropriate for up to ~100k rows
CREATE INDEX idx_asteroids_embedding ON asteroids
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Row Level Security
ALTER TABLE asteroids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read asteroids"
  ON asteroids FOR SELECT
  USING (true);


-- ============================================================
-- DOWN
-- ============================================================
-- DROP TRIGGER IF EXISTS asteroids_updated_at ON asteroids;
-- DROP TABLE IF EXISTS asteroids;
