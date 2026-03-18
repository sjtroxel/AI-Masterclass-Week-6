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
  nasa_id: '2099942',
  name: 'Apophis',
  full_name: '(2099942) Apophis',
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
  nasa_id: '2099942',
  name: 'Apophis',
  full_name: '(2099942) Apophis',
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

// Mimic a Supabase query builder: every method returns `this`, and the object
// is thenable — awaiting it (or any suffix of the chain) resolves with `resolves`.
function mockChain(resolves: { data: unknown; error: unknown }) {
  const p = Promise.resolve(resolves);
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    or:     vi.fn().mockReturnThis(),
    gt:     vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lte:    vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    // Thenable — allows `await chain`, `await chain.order()`, `await chain.single()`, etc.
    then:   p.then.bind(p),
    catch:  p.catch.bind(p),
  };
  return chain;
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
    expect(item['nasa_id']).toBe('2099942');
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
      nasa_id: '2099942',
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

// ── GET /api/defense/risk/:nasaId ─────────────────────────────────────────────

const RISK_OUTPUT = {
  planetaryDefense: {
    isPHA: true,
    hazardRating: 'none',
    monitoringStatus: 'Confirmed safe through 2100',
    notableApproaches: [
      { close_approach_date: '2029-04-13', miss_distance_km: 38017, orbiting_body: 'Earth' },
    ],
    mitigationContext: 'No mitigation required.',
  },
  missionRisk: {
    overallRating: 'low',
    communicationDelayMinutes: { min: 1, max: 2 },
    surfaceConditions: 'Rocky surface',
    primaryRisks: [],
  },
  dataCompleteness: 0.9,
  assumptionsRequired: [],
  reasoning: 'Well-characterized orbit.',
  sources: ['nasa-cad'],
};

const RISK_ANALYSIS_ROW = {
  id: 'aaaabbbb-0000-0000-0000-000000000001',
  asteroid_id: 'aaaabbbb-0000-0000-0000-000000000002',
  risk_output: RISK_OUTPUT,
  created_at: '2026-03-17T12:00:00Z',
};

const APOPHIS_FULL_ROW = { ...APOPHIS_ROW, id: 'aaaabbbb-0000-0000-0000-000000000002' };

describe('GET /api/defense/risk/:nasaId', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 200 with risk output when a completed analysis exists', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(mockChain({ data: APOPHIS_FULL_ROW, error: null }) as never)
      .mockReturnValueOnce(mockChain({ data: RISK_ANALYSIS_ROW, error: null }) as never);

    const res = await request(app).get('/api/defense/risk/2099942');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nasaId: '2099942',
      asteroidName: 'Apophis',
      analysisId: RISK_ANALYSIS_ROW.id,
    });
    expect(res.body.riskOutput.planetaryDefense.hazardRating).toBe('none');
  });

  it('returns 404 when no completed analysis exists', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(mockChain({ data: APOPHIS_FULL_ROW, error: null }) as never)
      .mockReturnValueOnce(
        mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } }) as never,
      );

    const res = await request(app).get('/api/defense/risk/2099942');
    expect(res.status).toBe(404);
  });

  it('returns 404 when the asteroid itself is not found', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { code: 'PGRST116', message: 'not found' } }) as never,
    );

    const res = await request(app).get('/api/defense/risk/unknown-id');
    expect(res.status).toBe(404);
  });

  it('returns 500 on database error fetching the asteroid', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({ data: null, error: { code: 'OTHER', message: 'db down' } }) as never,
    );

    const res = await request(app).get('/api/defense/risk/2099942');
    expect(res.status).toBe(500);
  });

  it('returns 500 on non-PGRST116 database error fetching the analysis', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(mockChain({ data: APOPHIS_FULL_ROW, error: null }) as never)
      .mockReturnValueOnce(
        mockChain({ data: null, error: { code: 'OTHER', message: 'analyses table down' } }) as never,
      );

    const res = await request(app).get('/api/defense/risk/2099942');
    expect(res.status).toBe(500);
  });

  it('returns 404 when analysis row exists but risk_output has no planetaryDefense', async () => {
    const incompleteRow = {
      ...RISK_ANALYSIS_ROW,
      risk_output: { missionRisk: {}, dataCompleteness: 0.1 },
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(mockChain({ data: APOPHIS_FULL_ROW, error: null }) as never)
      .mockReturnValueOnce(mockChain({ data: incompleteRow, error: null }) as never);

    const res = await request(app).get('/api/defense/risk/2099942');
    expect(res.status).toBe(404);
  });
});
