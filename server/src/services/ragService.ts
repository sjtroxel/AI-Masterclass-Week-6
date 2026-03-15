/**
 * ragService.ts
 *
 * Dual-index RAG retrieval for Asteroid Bonanza.
 *
 * Every query hits both science_chunks (hard facts) and scenario_chunks
 * (2050 projections) in parallel. Results are labeled with source_type so
 * the AI Analyst (Phase 4) and agents (Phase 5) can distinguish grounded
 * measurements from forward-looking projections.
 *
 * Used by: AI Analyst (Phase 4), agent swarm RAG grounding (Phase 5).
 */

import { supabase } from '../db/supabase.js';
import { embedText } from './voyageService.js';
import { DatabaseError, ValidationError } from '../errors/AppError.js';
import type { RagResult } from '../../../shared/types.js';

// ── Config ─────────────────────────────────────────────────────────────────────

const DEFAULT_TOP_K = 5;       // results per index; max 10 combined by default
const MAX_TOP_K = 20;          // hard cap per index (40 combined max)
const DEFAULT_THRESHOLD = 0.3; // minimum cosine similarity

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RagQueryOptions {
  /** Max results to return per index. Total results ≤ topK × 2. Default: 5. */
  topK?: number;
  /** Minimum cosine similarity threshold (0–1). Default: 0.3. */
  threshold?: number;
}

export interface RagQueryResult {
  query: string;
  results: RagResult[];
  /** How many results came from each index. */
  counts: { science: number; scenario: number };
}

// Raw row shape returned by the Supabase match_*_chunks RPC functions
interface ChunkRpcRow {
  id: string;
  source_id: string;
  source_title: string;
  source_url: string | null;
  source_year: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * Query both RAG indices for chunks relevant to the given query string.
 *
 * Both indices are queried in parallel. Results are merged and sorted by
 * similarity descending. Each result is labeled with source_type so callers
 * know whether the chunk is a hard fact ('science') or a projection ('scenario').
 */
export async function queryRag(
  query: string,
  options: RagQueryOptions = {},
): Promise<RagQueryResult> {
  const trimmed = query.trim();
  if (!trimmed) throw new ValidationError('RAG query cannot be empty');

  const topK = Math.min(MAX_TOP_K, Math.max(1, options.topK ?? DEFAULT_TOP_K));
  const threshold = Math.max(0, Math.min(1, options.threshold ?? DEFAULT_THRESHOLD));

  const embedding = await embedText(trimmed);

  const [scienceRes, scenarioRes] = await Promise.all([
    supabase.rpc('match_science_chunks', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
    }),
    supabase.rpc('match_scenario_chunks', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
    }),
  ]);

  if (scienceRes.error) throw new DatabaseError(scienceRes.error.message);
  if (scenarioRes.error) throw new DatabaseError(scenarioRes.error.message);

  const scienceResults: RagResult[] = ((scienceRes.data ?? []) as ChunkRpcRow[]).map(
    (row) => ({ ...row, source_type: 'science' as const }),
  );

  const scenarioResults: RagResult[] = ((scenarioRes.data ?? []) as ChunkRpcRow[]).map(
    (row) => ({ ...row, source_type: 'scenario' as const }),
  );

  const results = [...scienceResults, ...scenarioResults].sort(
    (a, b) => b.similarity - a.similarity,
  );

  return {
    query: trimmed,
    results,
    counts: { science: scienceResults.length, scenario: scenarioResults.length },
  };
}
