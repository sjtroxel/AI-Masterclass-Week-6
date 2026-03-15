import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock external dependencies before importing the service ───────────────────

vi.mock('../../src/db/supabase.js', () => ({
  supabase: { rpc: vi.fn() },
  supabaseAdmin: {},
}));

vi.mock('../../src/services/voyageService.js', () => ({
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'world.' } };
      yield { type: 'message_stop' };
    },
  };

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockResolvedValue(mockStream),
      },
    })),
  };
});

import {
  createSession,
  getSession,
  deleteSession,
  streamAnalystMessage,
} from '../../src/services/analystService.js';
import { SessionExpiredError, ValidationError } from '../../src/errors/AppError.js';
import { supabase } from '../../src/db/supabase.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const SCIENCE_CHUNK = {
  id: 'sc-001',
  source_id: 'osiris-rex-bennu',
  source_title: 'OSIRIS-REx Bennu Sample Mineralogy — Hamilton et al. (2024)',
  source_url: 'https://ntrs.nasa.gov/example',
  source_year: 2024,
  chunk_index: 0,
  content: 'Bennu samples contain serpentine and carbonate minerals.',
  metadata: {},
  similarity: 0.85,
};

const SCENARIO_CHUNK = {
  id: 'sc-002',
  source_id: 'asteroid-mining-economics-hein',
  source_title: 'A Techno-Economic Analysis of Asteroid Mining — Hein et al. (2018)',
  source_url: 'https://arxiv.org/pdf/1810.03836',
  source_year: 2018,
  chunk_index: 4,
  content: 'By 2050, asteroid mining could yield significant returns on platinum-group metals.',
  metadata: {},
  similarity: 0.78,
};

beforeEach(() => {
  // clearAllMocks resets call history only — preserves mock implementations
  // (resetAllMocks would wipe the Anthropic factory mock, breaking the SDK)
  vi.clearAllMocks();
  vi.mocked(supabase.rpc)
    .mockResolvedValueOnce({ data: [SCIENCE_CHUNK], error: null } as never)
    .mockResolvedValueOnce({ data: [SCENARIO_CHUNK], error: null } as never);

  process.env['ANTHROPIC_API_KEY'] = 'test-key';
});

afterEach(() => {
  delete process.env['ANTHROPIC_API_KEY'];
});

// ── Session management ─────────────────────────────────────────────────────────

describe('createSession', () => {
  it('returns a session with a UUID id', () => {
    const session = createSession();
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stores optional contextAsteroidId', () => {
    const session = createSession('2000433');
    expect(session.contextAsteroidId).toBe('2000433');
  });

  it('starts with empty history', () => {
    const session = createSession();
    expect(session.history).toHaveLength(0);
  });
});

describe('getSession', () => {
  it('returns the session by id', () => {
    const created = createSession();
    const retrieved = getSession(created.id);
    expect(retrieved.id).toBe(created.id);
  });

  it('throws SessionExpiredError for unknown id', () => {
    expect(() => getSession('00000000-dead-beef-0000-000000000000')).toThrow(
      SessionExpiredError,
    );
  });
});

describe('deleteSession', () => {
  it('removes the session so getSession throws', () => {
    const session = createSession();
    deleteSession(session.id);
    expect(() => getSession(session.id)).toThrow(SessionExpiredError);
  });

  it('does not throw when deleting a non-existent session', () => {
    expect(() => deleteSession('no-such-id')).not.toThrow();
  });
});

// ── streamAnalystMessage ───────────────────────────────────────────────────────

describe('streamAnalystMessage', () => {
  it('calls onTrace before any tokens', async () => {
    const session = createSession();
    const events: string[] = [];

    await streamAnalystMessage(session.id, 'What minerals are on Bennu?', {
      onTrace: () => events.push('trace'),
      onToken: () => events.push('token'),
      onDone: () => events.push('done'),
      onError: (err) => { throw err; },
    });

    expect(events[0]).toBe('trace');
  });

  it('emits trace with retrieved chunk data', async () => {
    const session = createSession();
    let capturedTrace: unknown;

    await streamAnalystMessage(session.id, 'What minerals are on Bennu?', {
      onTrace: (trace) => { capturedTrace = trace; },
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: (err) => { throw err; },
    });

    const trace = capturedTrace as {
      retrievedChunks: Array<{ sourceType: string; similarity: number }>;
      ragCounts: { science: number; scenario: number };
    };

    expect(trace.retrievedChunks).toHaveLength(2);
    expect(trace.retrievedChunks[0]?.sourceType).toBe('science');
    expect(trace.retrievedChunks[1]?.sourceType).toBe('scenario');
    expect(trace.ragCounts).toEqual({ science: 1, scenario: 1 });
  });

  it('assembles streamed tokens into full response', async () => {
    const session = createSession();
    const tokens: string[] = [];
    let doneText = '';

    await streamAnalystMessage(session.id, 'Tell me about Bennu', {
      onTrace: vi.fn(),
      onToken: (t) => tokens.push(t),
      onDone: (text) => { doneText = text; },
      onError: (err) => { throw err; },
    });

    expect(tokens).toEqual(['Hello ', 'world.']);
    expect(doneText).toBe('Hello world.');
  });

  it('appends user and assistant turns to session history', async () => {
    const session = createSession();

    await streamAnalystMessage(session.id, 'What is Bennu made of?', {
      onTrace: vi.fn(),
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: (err) => { throw err; },
    });

    expect(session.history).toHaveLength(2);
    expect(session.history[0]).toEqual({ role: 'user', content: 'What is Bennu made of?' });
    expect(session.history[1]).toEqual({ role: 'assistant', content: 'Hello world.' });
  });

  it('throws ValidationError for empty message', async () => {
    const session = createSession();

    await expect(
      streamAnalystMessage(session.id, '   ', {
        onTrace: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws SessionExpiredError for invalid session', async () => {
    await expect(
      streamAnalystMessage('bad-session-id', 'hello', {
        onTrace: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      }),
    ).rejects.toThrow(SessionExpiredError);
  });

  it('includes contextAsteroidId in trace when session has one', async () => {
    const session = createSession('2000433');
    let capturedTrace: unknown;

    await streamAnalystMessage(session.id, 'Tell me about this asteroid', {
      onTrace: (trace) => { capturedTrace = trace; },
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError: (err) => { throw err; },
    });

    const trace = capturedTrace as { contextAsteroidId: string };
    expect(trace.contextAsteroidId).toBe('2000433');
  });
});
