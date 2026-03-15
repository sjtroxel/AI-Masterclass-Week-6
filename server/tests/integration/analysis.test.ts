import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────
const { mockRunOrchestrator, mockSupabaseFrom } = vi.hoisted(() => {
  // Supabase chain builder
  const eqFn = vi.fn().mockResolvedValue({ error: null });
  const singleFn = vi.fn().mockResolvedValue({ error: { code: 'PGRST116' } });
  const limitFn = vi.fn().mockReturnValue({ single: singleFn });
  const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
  const inFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn, eq: eqFn, in: inFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  return {
    mockRunOrchestrator: vi.fn(),
    mockSupabaseFrom: fromFn,
  };
});

// ── Mock all external dependencies before importing app ───────────────────────

vi.mock('../../src/services/orchestrator/orchestrator.js', () => ({
  runOrchestrator: mockRunOrchestrator,
}));

vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: mockSupabaseFrom },
  supabaseAdmin: {},
}));

// Mock Voyage (required by analystService which is loaded transitively)
vi.mock('../../src/services/voyageService.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

// Mock Anthropic (required by analystService)
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

// ── Fixture orchestrator result ───────────────────────────────────────────────

const FIXTURE_ORCHESTRATOR_RESULT = {
  state: {
    asteroidId: 'test-asteroid-uuid',
    missionParams: {},
    requestedAgents: ['navigator', 'geologist', 'economist', 'riskAssessor'],
    phase: 'complete',
    errors: [],
    handoffTriggered: false,
    confidenceScores: {
      orbital: 0.85,
      compositional: 0.80,
      economic: 0.75,
      risk: 0.90,
      overall: 0.82,
    },
    synthesis: 'This is a test synthesis of the asteroid.',
    navigatorOutput: {
      accessibilityRating: 'good',
      minDeltaV_kms: 5.0,
      bestLaunchWindows: [],
      missionDurationDays: 200,
      orbitalClass: 'Apollo',
      dataCompleteness: 0.85,
      assumptionsRequired: [],
      reasoning: 'Good accessibility.',
      sources: [],
    },
    geologistOutput: null,
    economistOutput: null,
    riskOutput: null,
  },
  trace: {
    analysisId: 'analysis-result-uuid',
    asteroidId: 'test-asteroid-uuid',
    asteroidName: 'Test Asteroid',
    agentTraces: {},
    confidenceInputs: {
      orbital: { dataCompleteness: 0.85, assumptionsCount: 0, agentSucceeded: true },
      compositional: { dataCompleteness: 0.80, assumptionsCount: 0, agentSucceeded: true },
      economic: { dataCompleteness: 0.75, assumptionsCount: 0, agentSucceeded: true },
      risk: { dataCompleteness: 0.90, assumptionsCount: 0, agentSucceeded: true },
    },
    confidenceScores: {
      orbital: 0.85,
      compositional: 0.80,
      economic: 0.75,
      risk: 0.90,
      overall: 0.82,
    },
    handoffTriggered: false,
    totalLatencyMs: 15000,
  },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env['ANTHROPIC_API_KEY'] = 'test-key';

  // Default: orchestrator succeeds
  mockRunOrchestrator.mockResolvedValue(FIXTURE_ORCHESTRATOR_RESULT);

  // Default supabase chain for GET /api/analysis/:asteroidId/latest:
  // from('analyses').select('*').eq(...).in(...).order(...).limit(1).single() → PGRST116
  const singleFn = vi.fn().mockResolvedValue({ error: { code: 'PGRST116' } });
  const limitFn = vi.fn().mockReturnValue({ single: singleFn });
  const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
  const inFn = vi.fn().mockReturnValue({ order: orderFn });
  // eq() needs to return object with .in() for the latest route
  const eqFn = vi.fn().mockReturnValue({ in: inFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn, single: singleFn });
  mockSupabaseFrom.mockReturnValue({ select: selectFn });
});

// ── POST /api/analysis/:asteroidId ────────────────────────────────────────────

describe('POST /api/analysis/:asteroidId', () => {
  it('returns 200 with correct shape for a valid asteroid ID', async () => {
    const res = await request(app)
      .post('/api/analysis/test-asteroid-uuid')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      analysisId: 'analysis-result-uuid',
      asteroidId: 'test-asteroid-uuid',
      status: 'complete',
      phase: 'complete',
      handoffTriggered: false,
      confidenceScores: {
        orbital: expect.any(Number),
        compositional: expect.any(Number),
        economic: expect.any(Number),
        risk: expect.any(Number),
        overall: expect.any(Number),
      },
      outputs: expect.any(Object),
      trace: expect.any(Object),
      errors: expect.any(Array),
    });
  });

  it('passes missionParams to orchestrator when provided', async () => {
    const missionParams = { maxDeltaV_kms: 6.0, missionType: 'flyby' };

    await request(app)
      .post('/api/analysis/test-asteroid-uuid')
      .send({ missionParams });

    expect(mockRunOrchestrator).toHaveBeenCalledWith(
      'test-asteroid-uuid',
      missionParams,
      ['navigator', 'geologist', 'economist', 'riskAssessor'],
    );
  });

  it('accepts optional agents array', async () => {
    await request(app)
      .post('/api/analysis/test-asteroid-uuid')
      .send({ agents: ['navigator', 'geologist'] });

    expect(mockRunOrchestrator).toHaveBeenCalledWith(
      'test-asteroid-uuid',
      {},
      ['navigator', 'geologist'],
    );
  });

  it('returns 400 when unknown agent is requested', async () => {
    const res = await request(app)
      .post('/api/analysis/test-asteroid-uuid')
      .send({ agents: ['navigator', 'unknown-agent'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when orchestrator throws NotFoundError', async () => {
    const { NotFoundError } = await import('../../src/errors/AppError.js');
    mockRunOrchestrator.mockRejectedValue(new NotFoundError('Asteroid not found'));

    const res = await request(app)
      .post('/api/analysis/nonexistent-uuid')
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns handoff response shape when handoffTriggered is true', async () => {
    mockRunOrchestrator.mockResolvedValue({
      ...FIXTURE_ORCHESTRATOR_RESULT,
      state: {
        ...FIXTURE_ORCHESTRATOR_RESULT.state,
        phase: 'handoff',
        handoffTriggered: true,
        synthesis: undefined,
        handoffPacket: {
          triggeredBy: 'low_confidence',
          aggregateConfidence: 0.35,
          whatWasFound: 'Limited data available.',
          confidenceBreakdown: { orbital: 0.3, compositional: 0.3, economic: 0.3, risk: 0.3, overall: 0.35 },
          whereConfidenceBrokDown: 'Low confidence in: orbital (0.3), compositional (0.3)',
          whatHumanExpertNeeds: 'Expert review required.',
          generatedAt: '2026-03-15T00:00:00.000Z',
        },
      },
    });

    const res = await request(app)
      .post('/api/analysis/test-asteroid-uuid')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.handoffTriggered).toBe(true);
    expect(res.body.handoffPacket).toBeDefined();
    expect(res.body.status).toBe('handoff');
  });
});

// ── GET /api/analysis/:asteroidId/latest ──────────────────────────────────────

describe('GET /api/analysis/:asteroidId/latest', () => {
  it('returns 404 when no completed analysis exists in DB', async () => {
    // Default mock already returns PGRST116 (set in beforeEach)
    const res = await request(app).get('/api/analysis/test-asteroid-uuid/latest');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with analysis data when a completed analysis exists', async () => {
    const mockAnalysisRecord = {
      id: 'analysis-record-uuid',
      asteroid_id: 'test-asteroid-uuid',
      status: 'complete',
      phase: 'complete',
      confidence_scores: { orbital: 0.85, compositional: 0.80, economic: 0.75, risk: 0.90, overall: 0.82 },
      created_at: '2026-03-15T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
    };

    const singleFn = vi.fn().mockResolvedValue({ data: mockAnalysisRecord, error: null });
    const limitFn = vi.fn().mockReturnValue({ single: singleFn });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const inFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn2 = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn2 });
    mockSupabaseFrom.mockReturnValue({ select: selectFn });

    const res = await request(app).get('/api/analysis/test-asteroid-uuid/latest');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('analysis-record-uuid');
    expect(res.body.status).toBe('complete');
  });

  it('returns 500 when Supabase returns an unexpected error', async () => {
    const singleFn = vi.fn().mockResolvedValue({ error: { code: 'INTERNAL', message: 'DB error' } });
    const limitFn = vi.fn().mockReturnValue({ single: singleFn });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const inFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn2 = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn2 });
    mockSupabaseFrom.mockReturnValue({ select: selectFn });

    const res = await request(app).get('/api/analysis/test-asteroid-uuid/latest');

    expect(res.status).toBe(500);
  });
});

// ── GET /api/analysis/record/:analysisId ─────────────────────────────────────

describe('GET /api/analysis/record/:analysisId', () => {
  it('returns 404 when analysis record does not exist', async () => {
    const singleFn = vi.fn().mockResolvedValue({ error: { code: 'PGRST116' } });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockSupabaseFrom.mockReturnValue({ select: selectFn });

    const res = await request(app).get('/api/analysis/record/nonexistent-id');

    expect(res.status).toBe(404);
  });

  it('returns 200 with record when it exists', async () => {
    const mockRecord = {
      id: 'analysis-record-uuid',
      asteroid_id: 'test-asteroid-uuid',
      status: 'complete',
    };

    const singleFn = vi.fn().mockResolvedValue({ data: mockRecord, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockSupabaseFrom.mockReturnValue({ select: selectFn });

    const res = await request(app).get('/api/analysis/record/analysis-record-uuid');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('analysis-record-uuid');
  });
});
