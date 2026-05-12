import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Stub asteroid lookups so resolveAsteroidUuid works in tests without a real DB
vi.mock('../../src/services/asteroidService.js', () => ({
  getAsteroidById: vi.fn().mockResolvedValue({ id: 'test-asteroid-uuid' }),
  getAsteroidByNasaId: vi.fn().mockResolvedValue({ id: 'test-asteroid-uuid' }),
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
    expect(res.body.analysisId).toBe('analysis-record-uuid');
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

// ── GET /api/analysis/:asteroidId/stream ─────────────────────────────────────

describe('GET /api/analysis/:asteroidId/stream', () => {
  beforeEach(() => {
    // Configure orchestrator to call onProgress so SSE events are emitted
    mockRunOrchestrator.mockImplementation(
      async (
        _asteroidId: string,
        _missionParams: Record<string, unknown>,
        _agents: string[],
        onProgress?: (e: { type: string; phase?: string; agent?: string; status?: string }) => void,
      ) => {
        onProgress?.({ type: 'agent_start', phase: 'navigating' });
        onProgress?.({ type: 'agent_complete', agent: 'navigator', status: 'success' });
        onProgress?.({ type: 'agent_start', phase: 'geologizing' });
        onProgress?.({ type: 'agent_complete', agent: 'geologist', status: 'success' });
        onProgress?.({ type: 'agent_complete', agent: 'riskAssessor', status: 'success' });
        onProgress?.({ type: 'agent_start', phase: 'economizing' });
        onProgress?.({ type: 'agent_complete', agent: 'economist', status: 'success' });
        onProgress?.({ type: 'agent_start', phase: 'synthesizing' });
        return FIXTURE_ORCHESTRATOR_RESULT;
      },
    );
  });

  it('returns 200 with text/event-stream content type', async () => {
    const res = await request(app)
      .get('/api/analysis/test-asteroid-uuid/stream')
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
  });

  it('emits agent_start and agent_complete events followed by analysis_complete', async () => {
    const res = await request(app)
      .get('/api/analysis/test-asteroid-uuid/stream')
      .buffer(true);

    const body: string = res.text ?? String(res.body);
    expect(body).toContain('event: agent_start');
    expect(body).toContain('event: agent_complete');
    expect(body).toContain('event: analysis_complete');
    expect(body).toContain('event: done');
  });

  it('analysis_complete payload matches the expected AnalysisResponse shape', async () => {
    const res = await request(app)
      .get('/api/analysis/test-asteroid-uuid/stream')
      .buffer(true);

    const body: string = res.text ?? String(res.body);
    const completeLine = body
      .split('\n\n')
      .find((block) => block.includes('event: analysis_complete'));

    expect(completeLine).toBeDefined();
    const dataLine = completeLine!.split('\n').find((l) => l.startsWith('data:'));
    expect(dataLine).toBeDefined();
    const payload = JSON.parse(dataLine!.slice('data: '.length)) as {
      analysisId: string;
      asteroidId: string;
      status: string;
      handoffTriggered: boolean;
    };
    expect(payload.analysisId).toBe('analysis-result-uuid');
    expect(payload.asteroidId).toBe('test-asteroid-uuid');
    expect(payload.status).toBe('complete');
    expect(payload.handoffTriggered).toBe(false);
  });

  it('emits agent_start events for each phase in order', async () => {
    const res = await request(app)
      .get('/api/analysis/test-asteroid-uuid/stream')
      .buffer(true);

    const body: string = res.text ?? String(res.body);
    const startBlocks = body
      .split('\n\n')
      .filter((b) => b.includes('event: agent_start'));

    const phases = startBlocks.map((block) => {
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      const data = JSON.parse(dataLine!.slice('data: '.length)) as { phase: string };
      return data.phase;
    });

    expect(phases).toEqual(['navigating', 'geologizing', 'economizing', 'synthesizing']);
  });

  it('returns 404 when asteroid is not found', async () => {
    const { NotFoundError } = await import('../../src/errors/AppError.js');
    const { getAsteroidById, getAsteroidByNasaId } = await import('../../src/services/asteroidService.js');
    vi.mocked(getAsteroidById).mockRejectedValueOnce(new NotFoundError('Asteroid not found'));
    vi.mocked(getAsteroidByNasaId).mockRejectedValueOnce(new NotFoundError('Asteroid not found'));

    const res = await request(app).get('/api/analysis/nonexistent-id/stream');
    expect(res.status).toBe(404);
  });

  it('emits error event when orchestrator throws after stream opens', async () => {
    mockRunOrchestrator.mockRejectedValueOnce(new Error('Orchestrator crashed'));

    const res = await request(app)
      .get('/api/analysis/test-asteroid-uuid/stream')
      .buffer(true);

    expect(res.status).toBe(200); // SSE headers already sent
    const body: string = res.text ?? String(res.body);
    expect(body).toContain('event: error');
    expect(body).toContain('Orchestrator crashed');
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

// ── Rate limiting (swarm endpoints) ───────────────────────────────────────────

describe('swarm rate limit (production mode)', () => {
  beforeEach(async () => {
    // Activate the limiter (it's a no-op outside production).
    vi.stubEnv('NODE_ENV', 'production');
    // Reset the in-memory counter between tests so each starts fresh.
    const { swarmRateLimit } = await import('../../src/middleware/swarmRateLimit.js');
    swarmRateLimit.resetKey('::ffff:127.0.0.1');
    swarmRateLimit.resetKey('127.0.0.1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows the first two POST /api/analysis requests and 429s the third', async () => {
    const res1 = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    expect(res1.status).toBe(200);
    expect(res1.headers['ratelimit-remaining']).toBe('1');

    const res2 = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    expect(res2.status).toBe(200);
    expect(res2.headers['ratelimit-remaining']).toBe('0');

    const res3 = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res3.body.error.message).toMatch(/quota is exhausted/i);
  });

  it('emits standard RateLimit-* headers on successful responses', async () => {
    const res = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    expect(res.headers['ratelimit-limit']).toBe('2');
    expect(res.headers['ratelimit-remaining']).toBe('1');
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  it('does NOT rate-limit GET /api/analysis/:id/latest', async () => {
    // Four cheap DB reads — none should 429 even after the swarm quota is spent.
    const responses = await Promise.all([
      request(app).get('/api/analysis/test-asteroid-uuid/latest'),
      request(app).get('/api/analysis/test-asteroid-uuid/latest'),
      request(app).get('/api/analysis/test-asteroid-uuid/latest'),
      request(app).get('/api/analysis/test-asteroid-uuid/latest'),
    ]);
    responses.forEach((res) => {
      expect(res.status).not.toBe(429);
    });
  });

  it('is a no-op when NODE_ENV is not production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    // Five POSTs would normally trigger the limiter; in non-prod they all pass.
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
      expect(res.status).toBe(200);
    }
  });
});

// ── GET /api/analysis/quota ───────────────────────────────────────────────────

describe('GET /api/analysis/quota', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the unrestricted quota when NODE_ENV is not production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const res = await request(app).get('/api/analysis/quota');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      limit: 2,
      used: 0,
      remaining: 2,
      resetTime: null,
      active: false,
    });
  });

  it('reflects consumed quota in production after a successful analysis', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { swarmRateLimit } = await import('../../src/middleware/swarmRateLimit.js');
    swarmRateLimit.resetKey('::ffff:127.0.0.1');
    swarmRateLimit.resetKey('127.0.0.1');

    // Empty quota first.
    const before = await request(app).get('/api/analysis/quota');
    expect(before.body).toMatchObject({ limit: 2, used: 0, remaining: 2, active: true });

    // Consume one.
    const analysisRes = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    expect(analysisRes.status).toBe(200);

    // Quota now reflects 1 used.
    const after = await request(app).get('/api/analysis/quota');
    expect(after.body).toMatchObject({ limit: 2, used: 1, remaining: 1, active: true });
    expect(typeof after.body.resetTime).toBe('string');
  });

  it('peeking at the quota does NOT consume any of it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { swarmRateLimit } = await import('../../src/middleware/swarmRateLimit.js');
    swarmRateLimit.resetKey('::ffff:127.0.0.1');
    swarmRateLimit.resetKey('127.0.0.1');

    // Hit /quota many times — must not affect the analysis quota.
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/api/analysis/quota');
      expect(res.body.used).toBe(0);
      expect(res.body.remaining).toBe(2);
    }

    // Both analyses should still succeed afterwards.
    const a1 = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    const a2 = await request(app).post('/api/analysis/test-asteroid-uuid').send({});
    expect(a1.status).toBe(200);
    expect(a2.status).toBe(200);
  });
});
