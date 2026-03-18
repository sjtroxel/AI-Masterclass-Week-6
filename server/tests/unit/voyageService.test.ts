import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    }),
  );
}

function mockFetchError(status: number, text = 'Bad request'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      text: () => Promise.resolve(text),
    }),
  );
}

function makeVoyageResponse(texts: string[]): unknown {
  return {
    data: texts.map((_, i) => ({
      index: i,
      embedding: Array.from({ length: 1024 }, (__, j) => (i + 1) * j * 0.001),
    })),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('voyageService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env['VOYAGE_API_KEY'] = 'test-voyage-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['VOYAGE_API_KEY'];
  });

  describe('embedText', () => {
    it('returns a 1024-dimensional embedding for a single text', async () => {
      mockFetchOk(makeVoyageResponse(['iron rich asteroid']));

      const { embedText } = await import('../../src/services/voyageService.js');
      const result = await embedText('iron rich asteroid');

      expect(result).toHaveLength(1024);
      expect(typeof result[0]).toBe('number');
    });

    it('calls Voyage AI with correct model and input', async () => {
      mockFetchOk(makeVoyageResponse(['test query']));

      const { embedText } = await import('../../src/services/voyageService.js');
      await embedText('test query');

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-voyage-key',
            'Content-Type': 'application/json',
          }) as unknown,
          body: expect.stringContaining('voyage-large-2-instruct') as unknown,
        }) as unknown,
      );
    });

    it('throws when Voyage API returns an error status', async () => {
      mockFetchError(401, 'Unauthorized');

      const { embedText } = await import('../../src/services/voyageService.js');
      await expect(embedText('test')).rejects.toThrow('Voyage AI error 401');
    });

    it('throws when Voyage returns an empty embedding array', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        }),
      );

      const { embedText } = await import('../../src/services/voyageService.js');
      await expect(embedText('test')).rejects.toThrow('Voyage AI returned empty embedding');
    });

    it('throws when VOYAGE_API_KEY is not set', async () => {
      delete process.env['VOYAGE_API_KEY'];

      const { embedText } = await import('../../src/services/voyageService.js');
      await expect(embedText('test')).rejects.toThrow('VOYAGE_API_KEY environment variable is not set');
    });
  });

  describe('embedBatch', () => {
    it('returns empty array for empty input without calling fetch', async () => {
      // stub fetch so we can assert it was not called
      vi.stubGlobal('fetch', vi.fn());

      const { embedBatch } = await import('../../src/services/voyageService.js');
      const result = await embedBatch([]);

      expect(result).toEqual([]);
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it('returns one embedding per input text', async () => {
      const texts = ['query one', 'query two', 'query three'];
      mockFetchOk(makeVoyageResponse(texts));

      const { embedBatch } = await import('../../src/services/voyageService.js');
      const result = await embedBatch(texts);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(1024);
    });

    it('sends all texts in a single API call', async () => {
      const texts = ['alpha', 'beta'];
      mockFetchOk(makeVoyageResponse(texts));

      const { embedBatch } = await import('../../src/services/voyageService.js');
      await embedBatch(texts);

      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
      const call = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string) as { input: string[] };
      expect(body.input).toEqual(texts);
    });

    it('throws when Voyage API returns an error status', async () => {
      mockFetchError(500, 'Internal Server Error');

      const { embedBatch } = await import('../../src/services/voyageService.js');
      await expect(embedBatch(['test'])).rejects.toThrow('Voyage AI error 500');
    });
  });
});
