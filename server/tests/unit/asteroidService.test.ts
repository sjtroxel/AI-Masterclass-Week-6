import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the service — the module throws at load time
// if env vars are absent, so the mock must be hoisted above any real import.
vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: vi.fn() },
  supabaseAdmin: { from: vi.fn() },
}));

import { supabase } from '../../src/db/supabase.js';
import {
  listAsteroids,
  getAsteroidById,
  getAsteroidByNasaId,
} from '../../src/services/asteroidService.js';
import { NotFoundError, DatabaseError } from '../../src/errors/AppError.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ASTEROID_ROW = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  nasa_id: '2000433',
  spkid: '2000433',
  full_name: '433 Eros (1898 DQ)',
  name: 'Eros',
  designation: '433',
  is_pha: false,
  is_sentry_object: false,
  absolute_magnitude_h: 10.31,
  diameter_min_km: 14.47,
  diameter_max_km: 32.36,
  diameter_sigma_km: null,
  spectral_type_smass: 'S',
  spectral_type_tholen: 'S',
  orbit_epoch_jd: 2460200.5,
  semi_major_axis_au: 1.45799,
  eccentricity: 0.22265,
  inclination_deg: 10.8288,
  longitude_asc_node_deg: 304.3249,
  argument_perihelion_deg: 178.8712,
  mean_anomaly_deg: 41.3082,
  perihelion_distance_au: 1.13318,
  aphelion_distance_au: 1.78281,
  orbital_period_yr: 1.7595,
  min_orbit_intersection_au: 0.148,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 5.31,
  nhats_min_duration_days: 370,
  next_approach_date: '2056-01-14',
  next_approach_au: 0.3491,
  next_approach_miss_km: 52239100,
  closest_approach_date: '2056-01-14',
  closest_approach_au: 0.3491,
  composition_summary: null,
  resource_profile: null,
  economic_tier: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// Builder for a Supabase query mock chain
function mockChain(resolves: { data: unknown; error: unknown; count?: number }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(resolves),
    single: vi.fn().mockResolvedValue(resolves),
  };
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('asteroidService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('listAsteroids', () => {
    it('returns paginated results', async () => {
      const chain = mockChain({ data: [ASTEROID_ROW], error: null, count: 1 });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await listAsteroids(1, 20, {});
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
    });

    it('throws DatabaseError when Supabase returns an error', async () => {
      const chain = mockChain({ data: null, error: { message: 'connection failed' }, count: 0 });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(listAsteroids(1, 20, {})).rejects.toBeInstanceOf(DatabaseError);
    });
  });

  describe('getAsteroidById', () => {
    it('returns an asteroid for a valid UUID', async () => {
      const chain = mockChain({ data: ASTEROID_ROW, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await getAsteroidById(ASTEROID_ROW.id);
      expect(result.nasa_id).toBe('2000433');
      expect(result.name).toBe('Eros');
    });

    it('throws NotFoundError when Supabase returns PGRST116', async () => {
      const chain = mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(getAsteroidById('non-existent-id')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws DatabaseError for other Supabase errors', async () => {
      const chain = mockChain({ data: null, error: { code: '500', message: 'db error' } });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(getAsteroidById('some-id')).rejects.toBeInstanceOf(DatabaseError);
    });
  });

  describe('getAsteroidByNasaId', () => {
    it('returns an asteroid by nasa_id', async () => {
      const chain = mockChain({ data: ASTEROID_ROW, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await getAsteroidByNasaId('2000433');
      expect(result.id).toBe(ASTEROID_ROW.id);
    });

    it('throws NotFoundError when nasa_id does not exist', async () => {
      const chain = mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(getAsteroidByNasaId('9999999')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
