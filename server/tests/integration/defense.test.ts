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

const PHA_ROW = {
  nasa_id: '99942',
  name: 'Apophis',
  full_name: '(99942) Apophis',
  is_sentry_object: false,
  diameter_min_km: 0.31,
  diameter_max_km: 0.37,
  absolute_magnitude_h: 19.7,
  min_orbit_intersection_au: 0.00021,
  next_approach_date: '2029-04-13',
  next_approach_miss_km: 38017.0,
  closest_approach_date: '2029-04-13',
  closest_approach_au: 0.000254,
};

const UPCOMING_ROW = {
  nasa_id: '3542519',
  name: null,
  full_name: '(2010 PK9)',
  is_pha: false,
  is_sentry_object: false,
  diameter_min_km: 0.05,
  diameter_max_km: 0.11,
  next_approach_date: '2026-06-15',
  next_approach_miss_km: 1500000.0,
};

const APOPHIS_ROW = {
  nasa_id: '99942',
  name: 'Apophis',
  full_name: '(99942) Apophis',
  is_pha: true,
  is_sentry_object: false,
  diameter_min_km: 0.31,
  diameter_max_km: 0.37,
  absolute_magnitude_h: 19.7,
  spectral_type_smass: 'Sq',
  min_orbit_intersection_au: 0.00021,
  semi_major_axis_au: 0.9224,
  eccentricity: 0.191,
  inclination_deg: 3.33,
  orbital_period_yr: 0.886,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 5.76,
  next_approach_date: '2029-04-13',
  next_approach_miss_km: 38017.0,
  closest_approach_date: '2029-04-13',
  closest_approach_au: 0.000254,
};

function mockChain(resolves: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(resolves),
    single: vi.fn().mockResolvedValue(resolves),
  };
}

// ── GET /api/defense/pha ──────────────────────────────────────────────────────

describe('GET /api/defense/pha', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 with data array and total', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [PHA_ROW], error: null }) as never,
    );

    const res = await request(app).get('/api/defense/pha');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: expect.any(Array) as unknown, total: 1 });
  });

  it('maps nasa_id and hazard_rating fields correctly', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [PHA_ROW], error: null }) as never,
    );

    const res = await request(app).get('/api/defense/pha');
    expect(res.status).toBe(200);
    const item = res.body.data[0] as Record<string, unknown>;
    expect(item['nasa_id']).toBe('99942');
    expect(item['next_approach_date']).toBe('2029-04-13');
    expect(item['hazard_rating']).toBeNull();
  });

  it('returns empty list when no PHAs found', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [], error: null }) as never,
    );

    const res = await request(app).get('/api/defense/pha');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it('returns 500 on database error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { message: 'db down' } }) as never,
    );

    const res = await request(app).get('/api/defense/pha');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/defense/upcoming ─────────────────────────────────────────────────

describe('GET /api/defense/upcoming', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 with data, total, and days', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [UPCOMING_ROW], error: null }) as never,
    );

    const res = await request(app).get('/api/defense/upcoming');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: expect.any(Array) as unknown,
      total: 1,
      days: 365,
    });
  });

  it('accepts a custom days query param', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: [], error: null }) as never,
    );

    const res = await request(app).get('/api/defense/upcoming?days=90');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(90);
  });

  it('returns 400 when days is out of range', async () => {
    const res = await request(app).get('/api/defense/upcoming?days=9999');
    expect(res.status).toBe(400);
  });

  it('returns 400 when days is not a number', async () => {
    const res = await request(app).get('/api/defense/upcoming?days=banana');
    expect(res.status).toBe(400);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { message: 'db down' } }) as never,
    );

    const res = await request(app).get('/api/defense/upcoming');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/defense/apophis ──────────────────────────────────────────────────

describe('GET /api/defense/apophis', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 with full Apophis record', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: APOPHIS_ROW, error: null }) as never,
    );

    const res = await request(app).get('/api/defense/apophis');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nasa_id: '99942',
      name: 'Apophis',
      is_pha: true,
      next_approach_date: '2029-04-13',
      nhats_accessible: true,
    });
  });

  it('returns 404 when Apophis is not in the database', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } }) as never,
    );

    const res = await request(app).get('/api/defense/apophis');
    expect(res.status).toBe(404);
  });

  it('returns 500 on generic database error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { code: 'OTHER', message: 'db down' } }) as never,
    );

    const res = await request(app).get('/api/defense/apophis');
    expect(res.status).toBe(500);
  });
});
