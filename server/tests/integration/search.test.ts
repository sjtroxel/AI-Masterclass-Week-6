/**
 * Integration tests for GET /api/asteroids/search and the uncovered filter
 * branches in GET /api/asteroids. Also exercises the errorHandler non-AppError
 * path (plain Error → 500 INTERNAL_ERROR).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock supabase and voyageService before app is imported.
vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock('../../src/services/voyageService.js', () => ({
  embedText: vi.fn(),
}));

import app from '../../src/app.js';
import { supabase } from '../../src/db/supabase.js';
import { embedText } from '../../src/services/voyageService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_EMBEDDING = Array.from({ length: 1024 }, (_, i) => i * 0.001);

const SEARCH_ROW = {
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

function mockListChain(resolves: { data: unknown; error: unknown; count?: number }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(resolves),
    single: vi.fn().mockResolvedValue(resolves),
  };
}

// ── GET /api/asteroids/search ─────────────────────────────────────────────────

describe('GET /api/asteroids/search', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 with paginated results for a valid query', async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SEARCH_ROW], error: null } as never);

    const res = await request(app).get('/api/asteroids/search?q=iron+rich');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array) as unknown,
      total: 1,
      page: 1,
    });
    expect(res.body.data[0].name).toBe('Eros');
  });

  it('returns 400 when q param is missing', async () => {
    const res = await request(app).get('/api/asteroids/search');
    expect(res.status).toBe(400);
  });

  it('returns 400 when q param is empty string', async () => {
    const res = await request(app).get('/api/asteroids/search?q=   ');
    expect(res.status).toBe(400);
  });

  it('passes count and threshold query params through to the service', async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    const res = await request(app).get('/api/asteroids/search?q=metallic&count=5&threshold=0.6');

    expect(res.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'match_asteroids',
      expect.objectContaining({ match_count: 5, match_threshold: 0.6 }) as unknown,
    );
  });

  it('returns 500 when the embedding service fails', async () => {
    vi.mocked(embedText).mockRejectedValue(new Error('Voyage API down'));

    const res = await request(app).get('/api/asteroids/search?q=iron');

    expect(res.status).toBe(500);
  });

  it('returns 500 when supabase.rpc returns an error', async () => {
    vi.mocked(embedText).mockResolvedValue(FAKE_EMBEDDING);
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    } as never);

    const res = await request(app).get('/api/asteroids/search?q=platinum');

    expect(res.status).toBe(500);
  });
});

// ── GET /api/asteroids — additional filter coverage ───────────────────────────

describe('GET /api/asteroids — filter branches', () => {
  beforeEach(() => vi.resetAllMocks());

  it('accepts spectral_type filter', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [SEARCH_ROW], error: null, count: 1 }) as never,
    );

    const res = await request(app).get('/api/asteroids?spectral_type=S');
    expect(res.status).toBe(200);
  });

  it('accepts sort_by filter with a valid column', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [SEARCH_ROW], error: null, count: 1 }) as never,
    );

    const res = await request(app).get('/api/asteroids?sort_by=absolute_magnitude_h');
    expect(res.status).toBe(200);
  });

  it('ignores sort_by when the column is not in the allowlist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [], error: null, count: 0 }) as never,
    );

    const res = await request(app).get('/api/asteroids?sort_by=injected_column');
    expect(res.status).toBe(200);
  });

  it('accepts sort_dir=asc', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [], error: null, count: 0 }) as never,
    );

    const res = await request(app).get('/api/asteroids?sort_dir=asc');
    expect(res.status).toBe(200);
  });

  it('accepts sort_dir=desc', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [], error: null, count: 0 }) as never,
    );

    const res = await request(app).get('/api/asteroids?sort_dir=desc');
    expect(res.status).toBe(200);
  });

  it('accepts include_orbital=true', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [SEARCH_ROW], error: null, count: 1 }) as never,
    );

    const res = await request(app).get('/api/asteroids?include_orbital=true');
    expect(res.status).toBe(200);
  });

  it('accepts include_orbital=false', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [SEARCH_ROW], error: null, count: 1 }) as never,
    );

    const res = await request(app).get('/api/asteroids?include_orbital=false');
    expect(res.status).toBe(200);
  });

  it('accepts combined filters', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockListChain({ data: [], error: null, count: 0 }) as never,
    );

    const res = await request(app)
      .get('/api/asteroids?is_pha=true&nhats_accessible=true&spectral_type=C&sort_by=name&sort_dir=asc&include_orbital=true');
    expect(res.status).toBe(200);
  });
});

// ── errorHandler — non-AppError path ─────────────────────────────────────────

describe('errorHandler — plain Error path', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 500 INTERNAL_ERROR when the service throws a non-AppError', async () => {
    // Make supabase.from throw a plain Error (not an AppError subclass)
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('Unexpected crash');
    });

    const res = await request(app).get('/api/asteroids');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('An unexpected error occurred.');
  });
});
