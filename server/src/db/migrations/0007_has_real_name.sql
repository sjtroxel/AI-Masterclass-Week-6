-- 0007_has_real_name.sql
--
-- Adds a stored generated boolean column `has_real_name` to the asteroids table.
-- True when the asteroid's `name` field starts with a letter, meaning it has been
-- assigned a proper name (e.g. "Apophis", "Bennu") as opposed to a provisional
-- designation (e.g. "(2001 EC16)").
--
-- Used to power the "Named first" sort option: ORDER BY has_real_name DESC, name ASC/DESC.
-- Named asteroids come first, then unnamed (numbered/provisional) ones after.

-- ── Up ────────────────────────────────────────────────────────────────────────

ALTER TABLE asteroids
  ADD COLUMN IF NOT EXISTS has_real_name boolean
  GENERATED ALWAYS AS (name ~ '^[A-Za-z]') STORED;

CREATE INDEX IF NOT EXISTS idx_asteroids_has_real_name_name
  ON asteroids (has_real_name DESC, name ASC);

-- ── Down ──────────────────────────────────────────────────────────────────────
-- To roll back:
--   DROP INDEX IF EXISTS idx_asteroids_has_real_name_name;
--   ALTER TABLE asteroids DROP COLUMN IF EXISTS has_real_name;
