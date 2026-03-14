/**
 * voyageService.ts
 *
 * Voyage AI embedding utility for the server.
 * Used by searchService.ts to embed incoming search queries before pgvector lookup.
 * Model: voyage-large-2-instruct (1024-dimensional embeddings)
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-large-2-instruct';

interface VoyageResponse {
  data: Array<{ index: number; embedding: number[] }>;
}

function getApiKey(): string {
  const key = process.env['VOYAGE_API_KEY'];
  if (!key) throw new Error('VOYAGE_API_KEY environment variable is not set');
  return key;
}

async function callVoyage(texts: string[]): Promise<number[][]> {
  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage AI error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as VoyageResponse;
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed a single text string. Returns a 1024-dimensional vector. */
export async function embedText(text: string): Promise<number[]> {
  const results = await callVoyage([text]);
  const embedding = results[0];
  if (!embedding) throw new Error('Voyage AI returned empty embedding');
  return embedding;
}

/** Embed multiple texts in one API call (max 128 per Voyage AI request). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return callVoyage(texts);
}
