import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Mock all external dependencies before importing app ───────────────────────

vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock('../../src/services/voyageService.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

const mockStream = {
  [Symbol.asyncIterator]: async function* () {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Test ' } };
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'response.' } };
  },
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { stream: vi.fn().mockResolvedValue(mockStream) },
  })),
}));

import app from '../../src/app.js';
import { supabase } from '../../src/db/supabase.js';

beforeEach(() => {
  // clearAllMocks resets call history only — preserves mock implementations
  // (resetAllMocks would wipe the Anthropic factory mock, breaking the SDK)
  vi.clearAllMocks();
  // Default RAG mock: return one chunk from each index
  vi.mocked(supabase.rpc)
    .mockResolvedValueOnce({
      data: [{
        id: 'c1', source_id: 'test-doc', source_title: 'Test Science Doc',
        source_url: null, source_year: 2024, chunk_index: 0,
        content: 'Science fact about asteroids.', metadata: {}, similarity: 0.8,
      }],
      error: null,
    } as never)
    .mockResolvedValueOnce({
      data: [{
        id: 'c2', source_id: 'test-scenario', source_title: 'Test Scenario Doc',
        source_url: null, source_year: 2022, chunk_index: 0,
        content: 'Projection about 2050 mining.', metadata: {}, similarity: 0.72,
      }],
      error: null,
    } as never);

  process.env['ANTHROPIC_API_KEY'] = 'test-key';
});

// ── POST /api/analyst/start ───────────────────────────────────────────────────

describe('POST /api/analyst/start', () => {
  it('creates a session and returns session_token', async () => {
    const res = await request(app).post('/api/analyst/start').send({});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      session_token: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
      created_at: expect.any(String),
      expires_at: expect.any(String),
      context_asteroid_id: null,
    });
  });

  it('accepts optional context_asteroid_id', async () => {
    const res = await request(app)
      .post('/api/analyst/start')
      .send({ context_asteroid_id: '2000433' });
    expect(res.status).toBe(201);
    expect(res.body.context_asteroid_id).toBe('2000433');
  });

  it('ignores non-string context_asteroid_id', async () => {
    const res = await request(app)
      .post('/api/analyst/start')
      .send({ context_asteroid_id: 12345 });
    expect(res.status).toBe(201);
    expect(res.body.context_asteroid_id).toBeNull();
  });
});

// ── POST /api/analyst/message ─────────────────────────────────────────────────

describe('POST /api/analyst/message', () => {
  it('streams SSE events: trace → tokens → done', async () => {
    const startRes = await request(app).post('/api/analyst/start').send({});
    const sessionToken = startRes.body.session_token as string;

    const res = await request(app)
      .post('/api/analyst/message')
      .send({ session_token: sessionToken, message: 'What is Bennu?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const body = res.text;
    expect(body).toContain('event: trace');
    expect(body).toContain('event: token');
    expect(body).toContain('event: done');
  });

  it('returns 400 when session_token is missing', async () => {
    const res = await request(app)
      .post('/api/analyst/message')
      .send({ message: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when message is missing', async () => {
    const startRes = await request(app).post('/api/analyst/start').send({});
    const res = await request(app)
      .post('/api/analyst/message')
      .send({ session_token: startRes.body.session_token });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 410 when session_token is invalid', async () => {
    const res = await request(app)
      .post('/api/analyst/message')
      .send({ session_token: 'no-such-session', message: 'hello' });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });
});

// ── DELETE /api/analyst/session ───────────────────────────────────────────────

describe('DELETE /api/analyst/session', () => {
  it('returns 204 and deletes the session', async () => {
    const startRes = await request(app).post('/api/analyst/start').send({});
    const token = startRes.body.session_token as string;

    const delRes = await request(app)
      .delete('/api/analyst/session')
      .send({ session_token: token });
    expect(delRes.status).toBe(204);

    // Subsequent message attempt returns 410
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockResolvedValueOnce({ data: [], error: null } as never);

    const msgRes = await request(app)
      .post('/api/analyst/message')
      .send({ session_token: token, message: 'hello' });
    expect(msgRes.status).toBe(410);
  });

  it('returns 400 when session_token is missing', async () => {
    const res = await request(app).delete('/api/analyst/session').send({});
    expect(res.status).toBe(400);
  });
});
