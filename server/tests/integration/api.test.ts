import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock supabase before app.ts is imported — prevents env-var throw at module load.
vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: vi.fn() },
  supabaseAdmin: { from: vi.fn() },
}));

import app from '../../src/app.js';
import { supabase } from '../../src/db/supabase.js';

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
  spectral_type_smass: 'S',
  nhats_accessible: true,
  next_approach_date: '2056-01-14',
  economic_tier: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function mockChain(resolves: { data: unknown; error: unknown; count?: number }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(resolves),
    single: vi.fn().mockResolvedValue(resolves),
  };
}

// ── Health ────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.timestamp).toBe('string');
  });
});

// ── Asteroids list ────────────────────────────────────────────────────────────

describe('GET /api/asteroids', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 with paginated structure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [ASTEROID_ROW], error: null, count: 1 }) as never,
    );

    const res = await request(app).get('/api/asteroids');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array) as unknown,
      total: 1,
      page: 1,
      per_page: 20,
    });
  });

  it('accepts is_pha filter', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [], error: null, count: 0 }) as never,
    );

    const res = await request(app).get('/api/asteroids?is_pha=true');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('accepts nhats_accessible filter', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [ASTEROID_ROW], error: null, count: 1 }) as never,
    );

    const res = await request(app).get('/api/asteroids?nhats_accessible=true');
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { message: 'db down' }, count: 0 }) as never,
    );

    const res = await request(app).get('/api/asteroids');
    expect(res.status).toBe(500);
  });
});

// ── Asteroid detail ───────────────────────────────────────────────────────────

describe('GET /api/asteroids/:id', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 for a valid UUID', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: ASTEROID_ROW, error: null }) as never,
    );

    const res = await request(app).get(`/api/asteroids/${ASTEROID_ROW.id}`);
    expect(res.status).toBe(200);
    expect(res.body.nasa_id).toBe('2000433');
  });

  it('returns 200 when looked up by nasa_id (non-UUID)', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: ASTEROID_ROW, error: null }) as never,
    );

    const res = await request(app).get('/api/asteroids/2000433');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Eros');
  });

  it('returns 404 when asteroid does not exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } }) as never,
    );

    const res = await request(app).get('/api/asteroids/9999999');
    expect(res.status).toBe(404);
  });
});
