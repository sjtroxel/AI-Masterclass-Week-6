import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────

const { mockCompareAsteroids, mockBuildScenario, mockOptimizePortfolio } = vi.hoisted(() => ({
  mockCompareAsteroids: vi.fn(),
  mockBuildScenario: vi.fn(),
  mockOptimizePortfolio: vi.fn(),
}));

// ── Mock all external dependencies before importing app ───────────────────────

vi.mock('../../src/services/planningService.js', () => ({
  compareAsteroids: mockCompareAsteroids,
  buildScenario: mockBuildScenario,
  optimizePortfolio: mockOptimizePortfolio,
}));

// asteroidService — required by planning route's resolveAllUuids
vi.mock('../../src/services/asteroidService.js', () => ({
  getAsteroidById: vi.fn().mockImplementation((id: string) => Promise.resolve({ id })),
  getAsteroidByNasaId: vi.fn().mockImplementation((id: string) => Promise.resolve({ id })),
}));

// Transitive mocks required by other routes loaded with app
vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: vi.fn() },
  supabaseAdmin: {},
}));

vi.mock('../../src/services/voyageService.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: vi.fn().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'test' } };
          yield { type: 'message_stop' };
        },
      }),
    },
  })),
}));

import app from '../../src/app.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CANDIDATE = {
  asteroidId: 'asteroid-uuid-1',
  asteroidName: 'Bennu',
  rank: 1,
  accessibilityRating: 'good',
  minDeltaV_kms: 5.1,
  missionDurationDays: 280,
  orbitalClass: 'Apollo',
  score: 0.762,
  scoreBreakdown: { accessibility: 0.75, economics: 0.75, constraintSatisfaction: 1.0 },
  rationale: 'Bennu: good accessibility · 5.1 km/s delta-V · 280-day mission',
  navigatorOutput: {
    accessibilityRating: 'good',
    minDeltaV_kms: 5.1,
    bestLaunchWindows: [],
    missionDurationDays: 280,
    orbitalClass: 'Apollo',
    dataCompleteness: 0.85,
    assumptionsRequired: [],
    reasoning: 'Good accessibility.',
    sources: [],
  },
  passesConstraints: true,
  constraintViolations: [],
};

const FIXTURE_COMPARE = {
  candidates: [MOCK_CANDIDATE],
  missionParams: {},
  rankedAt: '2026-03-16T00:00:00.000Z',
};

const FIXTURE_SCENARIO = {
  recommendations: [MOCK_CANDIDATE],
  constraints: {},
  topPick: MOCK_CANDIDATE,
  feasibleCount: 1,
  rankedAt: '2026-03-16T00:00:00.000Z',
};

const FIXTURE_PORTFOLIO = {
  optimalPortfolio: [MOCK_CANDIDATE],
  portfolioScore: 0.762,
  allCandidates: [MOCK_CANDIDATE],
  constraints: {},
  portfolioRationale: 'Optimal 1-asteroid portfolio: Bennu.',
  rankedAt: '2026-03-16T00:00:00.000Z',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockCompareAsteroids.mockResolvedValue(FIXTURE_COMPARE);
  mockBuildScenario.mockResolvedValue(FIXTURE_SCENARIO);
  mockOptimizePortfolio.mockResolvedValue(FIXTURE_PORTFOLIO);
});

// ── POST /api/planning/compare ────────────────────────────────────────────────

describe('POST /api/planning/compare', () => {
  it('returns 200 with candidates array for valid input', async () => {
    const res = await request(app)
      .post('/api/planning/compare')
      .send({ asteroidIds: ['asteroid-uuid-1', 'asteroid-uuid-2'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      candidates: expect.any(Array),
      missionParams: expect.any(Object),
      rankedAt: expect.any(String),
    });
  });

  it('passes asteroidIds and missionParams to service', async () => {
    const missionParams = { maxDeltaV_kms: 6.0, missionType: 'rendezvous' };

    await request(app)
      .post('/api/planning/compare')
      .send({ asteroidIds: ['id-1', 'id-2'], missionParams });

    expect(mockCompareAsteroids).toHaveBeenCalledWith(['id-1', 'id-2'], missionParams);
  });

  it('uses empty missionParams when not provided', async () => {
    await request(app)
      .post('/api/planning/compare')
      .send({ asteroidIds: ['id-1'] });

    expect(mockCompareAsteroids).toHaveBeenCalledWith(['id-1'], {});
  });

  it('returns 400 when asteroidIds is missing', async () => {
    const res = await request(app).post('/api/planning/compare').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when asteroidIds is not an array', async () => {
    const res = await request(app)
      .post('/api/planning/compare')
      .send({ asteroidIds: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when service throws ValidationError (too many candidates)', async () => {
    const { ValidationError } = await import('../../src/errors/AppError.js');
    mockCompareAsteroids.mockRejectedValue(new ValidationError('Maximum 10 candidates per request'));

    const res = await request(app)
      .post('/api/planning/compare')
      .send({ asteroidIds: new Array(11).fill('some-id') });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when service throws NotFoundError', async () => {
    const { NotFoundError } = await import('../../src/errors/AppError.js');
    mockCompareAsteroids.mockRejectedValue(new NotFoundError('Asteroid not found: bad-id'));

    const res = await request(app)
      .post('/api/planning/compare')
      .send({ asteroidIds: ['bad-id'] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ── POST /api/planning/scenario ───────────────────────────────────────────────

describe('POST /api/planning/scenario', () => {
  it('returns 200 with recommendations, topPick, and feasibleCount', async () => {
    const res = await request(app)
      .post('/api/planning/scenario')
      .send({ asteroidIds: ['id-1', 'id-2'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      recommendations: expect.any(Array),
      topPick: expect.any(Object),
      feasibleCount: expect.any(Number),
      rankedAt: expect.any(String),
    });
  });

  it('passes asteroidIds and constraints to service', async () => {
    const constraints = { maxDeltaV_kms: 5.5, priorities: { accessibility: 0.6, economics: 0.3, risk: 0.1 } };

    await request(app)
      .post('/api/planning/scenario')
      .send({ asteroidIds: ['id-1'], constraints });

    expect(mockBuildScenario).toHaveBeenCalledWith(['id-1'], constraints);
  });

  it('uses empty constraints when not provided', async () => {
    await request(app)
      .post('/api/planning/scenario')
      .send({ asteroidIds: ['id-1'] });

    expect(mockBuildScenario).toHaveBeenCalledWith(['id-1'], {});
  });

  it('returns 400 when asteroidIds is missing', async () => {
    const res = await request(app).post('/api/planning/scenario').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when an asteroidId is an empty string', async () => {
    const res = await request(app)
      .post('/api/planning/scenario')
      .send({ asteroidIds: ['valid-id', ''] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── POST /api/planning/portfolio ──────────────────────────────────────────────

describe('POST /api/planning/portfolio', () => {
  it('returns 200 with optimalPortfolio and portfolioScore', async () => {
    const res = await request(app)
      .post('/api/planning/portfolio')
      .send({ asteroidIds: ['id-1', 'id-2', 'id-3'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      optimalPortfolio: expect.any(Array),
      portfolioScore: expect.any(Number),
      allCandidates: expect.any(Array),
      portfolioRationale: expect.any(String),
      rankedAt: expect.any(String),
    });
  });

  it('passes portfolioSize=3 by default', async () => {
    await request(app)
      .post('/api/planning/portfolio')
      .send({ asteroidIds: ['id-1', 'id-2', 'id-3'] });

    expect(mockOptimizePortfolio).toHaveBeenCalledWith(['id-1', 'id-2', 'id-3'], {}, 3);
  });

  it('passes explicit portfolioSize to service', async () => {
    await request(app)
      .post('/api/planning/portfolio')
      .send({ asteroidIds: ['id-1', 'id-2'], portfolioSize: 2 });

    expect(mockOptimizePortfolio).toHaveBeenCalledWith(['id-1', 'id-2'], {}, 2);
  });

  it('returns 400 when portfolioSize is not a positive integer', async () => {
    const res = await request(app)
      .post('/api/planning/portfolio')
      .send({ asteroidIds: ['id-1'], portfolioSize: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when portfolioSize is a float', async () => {
    const res = await request(app)
      .post('/api/planning/portfolio')
      .send({ asteroidIds: ['id-1'], portfolioSize: 1.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when asteroidIds is missing', async () => {
    const res = await request(app).post('/api/planning/portfolio').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when service throws NotFoundError', async () => {
    const { NotFoundError } = await import('../../src/errors/AppError.js');
    mockOptimizePortfolio.mockRejectedValue(new NotFoundError('Asteroid not found'));

    const res = await request(app)
      .post('/api/planning/portfolio')
      .send({ asteroidIds: ['bad-id'] });

    expect(res.status).toBe(404);
  });
});
