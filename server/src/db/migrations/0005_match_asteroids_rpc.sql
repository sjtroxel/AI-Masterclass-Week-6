-- Migration: 0005_match_asteroids_rpc
-- Vector similarity search function for the asteroids table.
-- Called by searchService.ts via supabase.rpc('match_asteroids', params).
-- Requires embeddings to be populated (Phase 2 generateEmbeddings script).

-- ============================================================
-- UP
-- ============================================================

CREATE OR REPLACE FUNCTION match_asteroids(
  query_embedding   vector(1024),
  match_threshold   float,
  match_count       int
)
RETURNS TABLE (
  id                          uuid,
  nasa_id                     text,
  full_name                   text,
  name                        text,
  designation                 text,
  is_pha                      boolean,
  is_sentry_object            boolean,
  absolute_magnitude_h        float,
  diameter_min_km             float,
  diameter_max_km             float,
  spectral_type_smass         text,
  spectral_type_tholen        text,
  min_orbit_intersection_au   float,
  nhats_accessible            boolean,
  nhats_min_delta_v_kms       float,
  next_approach_date          text,
  next_approach_au            float,
  economic_tier               text,
  created_at                  timestamptz,
  updated_at                  timestamptz,
  similarity                  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    nasa_id,
    full_name,
    name,
    designation,
    is_pha,
    is_sentry_object,
    absolute_magnitude_h,
    diameter_min_km,
    diameter_max_km,
    spectral_type_smass,
    spectral_type_tholen,
    min_orbit_intersection_au,
    nhats_accessible,
    nhats_min_delta_v_kms,
    next_approach_date,
    next_approach_au,
    economic_tier,
    created_at,
    updated_at,
    1 - (embedding <=> query_embedding) AS similarity
  FROM asteroids
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ============================================================
-- DOWN
-- ============================================================
-- DROP FUNCTION IF EXISTS match_asteroids(vector(1024), float, int);
