import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase and voyageService before importing searchService
vi.mock('../../src/db/supabase.js', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('../../src/services/voyageService.js', () => ({
  embedText: vi.fn(),
}));

import { supabase } from '../../src/db/supabase.js';
import { embedText } from '../../src/services/voyageService.js';
import { searchAsteroids } from '../../src/services/searchService.js';
import { ValidationError, DatabaseError } from '../../src/errors/AppError.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_EMBEDDING = Array.from({ length: 1024 }, (_, i) => i * 0.001);

const SEARCH_RESULT = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  nasa_id: '2000433',
  name: 'Eros',
  full_name: '433 Eros (1898 DQ)',
  designation: '433',
  is_pha: false,
  is_sentry_object: false,
  absolute_magnitude_h: 10.31,
  diameter_min_km: 14.47,
  diameter_max_km: 32.36,
  spectral_type_smass: 'S',
  spectral_type_tholen: 'S',
  nhats_accessible: true,
  nhats_min_delta_v_kms: 5.31,
  next_approach_date: '2056-01-14',
  next_approach_au: 0.3491,
  min_orbit_intersection_au: 0.148,
  economic_tier: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  similarity: 0.87,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('searchService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('searchAsteroids', () => {
    it('returns paginated results for a valid query', async () => {
      vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [SEARCH_RESULT], error: null } as never);

      const result = await searchAsteroids('iron-rich near Earth');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe('Eros');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
    });

    it('passes count and threshold to supabase.rpc', async () => {
      vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

      await searchAsteroids('metallic', 50, 0.5);

      expect(supabase.rpc).toHaveBeenCalledWith('match_asteroids', {
        query_embedding: FAKE_EMBEDDING,
        match_threshold: 0.5,
        match_count: 50,
      });
    });

    it('clamps count to MAX_COUNT (100)', async () => {
      vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

      await searchAsteroids('test', 999, 0.3);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'match_asteroids',
        expect.objectContaining({ match_count: 100 }) as unknown,
      );
    });

    it('clamps threshold to [0, 1]', async () => {
      vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

      await searchAsteroids('test', 20, -0.5);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'match_asteroids',
        expect.objectContaining({ match_threshold: 0 }) as unknown,
      );
    });

    it('returns empty results when supabase returns null data', async () => {
      vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

      const result = await searchAsteroids('rare metals');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('throws ValidationError for empty query', async () => {
      await expect(searchAsteroids('   ')).rejects.toBeInstanceOf(ValidationError);
      expect(embedText).not.toHaveBeenCalled();
    });

    it('throws DatabaseError when supabase.rpc returns an error', async () => {
      vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'rpc failed' },
      } as never);

      await expect(searchAsteroids('platinum asteroids')).rejects.toBeInstanceOf(DatabaseError);
    });
  });
});
